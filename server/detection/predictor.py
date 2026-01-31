# ============================================================================
# FILE: detection/predictor.py
# ============================================================================
import time
import asyncio
import logging
import numpy as np
import torch
import supervision as sv
from PIL import Image
from typing import Dict, Any, Optional
from collections import deque
from datetime import datetime, timezone
from models.camera import CameraConfig
from rfdetr.util.coco_classes import COCO_CLASSES
import cv2
import io
import base64
from pathlib import Path

logger = logging.getLogger(__name__)


class CameraPredictor:
    """Base camera predictor for object detection"""
    
    def __init__(self, camera_config: CameraConfig, shared_model: Dict[str, Any]):
        """
        Initialize camera predictor
        
        Args:
            camera_config: Camera configuration
            shared_model: Shared model resources
        """
        self.camera_config = camera_config
        self.device = shared_model['device']
        self.model = shared_model['model']

        # self.processor = shared_model['processor']
        self.box_annotator = shared_model['box_annotator']
        self.label_annotator = shared_model['label_annotator']
        self.detection_classes = set(camera_config.detection_classes)
        self.confidence_threshold = camera_config.odthreshold / 100.0
    
    def update_config(self, camera_config: CameraConfig):
        """
        Update camera configuration
        
        Args:
            camera_config: New camera configuration
        """
        self.camera_config = camera_config
        self.detection_classes = set(camera_config.detection_classes)
        self.confidence_threshold = camera_config.odthreshold / 100.0
    
    def predict_frame(self, frame: np.ndarray) -> np.ndarray:
        """
        Perform object detection on frame
        
        Args:
            frame: Input frame
            
        Returns:
            Annotated frame
        """
        if not self.camera_config.is_detection or not self.detection_classes:
            return frame
            
        try:
            converted_image = Image.fromarray(frame)
            detections = self.model.predict(converted_image, threshold=self.confidence_threshold)
            
          # Filter by detection classes
            if len(self.detection_classes)>1:
               detections = detections[np.isin(detections.class_id,  list(self.detection_classes))]
             

            
            labels = []
            for class_id, confidence in zip(detections.class_id, detections.confidence):
                class_name = COCO_CLASSES[class_id]
                labels.append(f"{class_name} {confidence:.2f}")
            
            annotated_frame = frame.copy()
            annotated_frame = self.box_annotator.annotate(scene=annotated_frame, detections=detections)
            annotated_frame = self.label_annotator.annotate(scene=annotated_frame, detections=detections, labels=labels)
            
            return annotated_frame
            
        except Exception as e:
            logger.error(f"Prediction error: {e}")
            return frame


class CameraPredictorWithAnalytics(CameraPredictor):
    """Enhanced camera predictor with analytics tracking and object tracking"""
    
    def __init__(
        self, 
        camera_config: CameraConfig, 
        shared_model: Dict[str, Any], 
        analytics_manager,
        supabase_client=None,
        save_detection_images: bool = True,
        image_quality: int = 85,
        storage_bucket: str = "detection-images",
        frame_color_format: str = "BGR",
    ):
        """
        Initialize predictor with analytics
        
        Args:
            camera_config: Camera configuration
            shared_model: Shared model resources
            analytics_manager: Analytics manager instance
            supabase_client: Supabase client for storage (optional)
            save_detection_images: Whether to save detection images
            image_quality: JPEG quality for saved images (1-100)
            storage_bucket: Supabase storage bucket name
            frame_color_format: Color format of input frames - "BGR" (OpenCV default) or "RGB"
        """
        super().__init__(camera_config, shared_model)
        self.analytics_manager = analytics_manager
        self.session_id = None
        self.supabase_client = supabase_client
        self.save_detection_images = save_detection_images
        self.image_quality = max(1, min(100, image_quality))
        self.storage_bucket = storage_bucket
        self.frame_color_format = frame_color_format.upper()  # Store as uppercase
        
        # Initialize ByteTrack for object tracking
        try:
            from supervision import ByteTrack
            self.tracker = ByteTrack(
                track_activation_threshold=0.25,
                lost_track_buffer=30,
                minimum_matching_threshold=0.8,
                frame_rate=camera_config.fps
            )
        except ImportError:
            self.tracker = None
            logger.warning("ByteTrack not available, tracking disabled")
        
        # Track statistics
        self.tracked_objects = {}
        self.track_history = deque(maxlen=1000)
        
        # Track which objects have been logged to prevent duplicate logging
        self.logged_tracker_ids = set()
        
        logger.info(
            f"Object tracker initialized for camera: {camera_config.name}, "
            f"Image saving: {save_detection_images}"
        )
    
    def set_session_id(self, session_id: str):
        """Set session ID for tracking"""
        self.session_id = session_id
    
    def predict_frame(self, frame: np.ndarray) -> np.ndarray:
     
        if not self.camera_config.is_detection or not self.detection_classes:
            return frame
            
        try:
            converted_image = Image.fromarray(frame)
            detections = self.model.predict(converted_image, threshold=self.confidence_threshold)
        
            # Filter by detection classes
            if len(self.detection_classes) > 1:
                detections = detections[np.isin(detections.class_id, list(self.detection_classes))]
            
            # Apply tracking to detections if tracker available
            if self.tracker:
                detections = self.tracker.update_with_detections(detections)
            
            # Prepare labels with tracker IDs
            labels = []
            for i, (class_id, confidence) in enumerate(
                zip(detections.class_id, detections.confidence)
            ):
                # Get class name with bounds checking
                class_name = COCO_CLASSES[class_id]
                
                # Add tracker ID if available
                if self.tracker and hasattr(detections, 'tracker_id') and len(detections.tracker_id) > i:
                    tracker_id = detections.tracker_id[i]
                    
                    # Update tracked objects dictionary
                    if tracker_id not in self.tracked_objects:
                        self.tracked_objects[tracker_id] = {
                            'class_id': class_id,
                            'class_name': class_name,
                            'first_seen': time.time(),
                            'frame_count': 0
                        }
                    
                    self.tracked_objects[tracker_id]['frame_count'] += 1
                    self.tracked_objects[tracker_id]['last_seen'] = time.time()

                    labels.append(f"{class_name} {confidence:.2f}")
                else:
                    labels.append(f"{class_name} {confidence:.2f}")

            
            annotated_frame = frame.copy()
        
            annotated_frame = self.box_annotator.annotate(scene=annotated_frame, detections=detections)
            annotated_frame = self.label_annotator.annotate(scene=annotated_frame, detections=detections, labels=labels)

            # Log detection events with tracker IDs for analytics
            if len(detections) > 0 and self.analytics_manager:
                asyncio.create_task(
                    self._log_tracked_detections(detections, frame)
                )
            
            return annotated_frame
            
        except Exception as e:
            logger.error(f"Error in tracked prediction: {e}")
            return frame
    
    async def _save_detection_image(
        self, 
        frame: np.ndarray, 
        tracker_id: int, 
        class_name: str,
        bbox: list
    ) -> Optional[str]:
        """
        Save detection image to Supabase Storage for object_detection_events table
        
        Args:
            frame: Original frame
            tracker_id: Tracker ID
            class_name: Object class name
            bbox: Bounding box coordinates [x1, y1, x2, y2]
            
        Returns:
            Image URL or None if failed
        """
        try:
            # Validate Supabase client
            if self.supabase_client is None:
                logger.warning("Supabase client not configured, skipping image save")
                return None
            
            # Check if client has storage attribute
            if not hasattr(self.supabase_client, 'storage'):
                logger.error(
                    "Invalid Supabase client: missing 'storage' attribute. "
                    "Please use: create_client(url, key) from supabase library"
                )
                return None
            
            # Generate unique filename
            timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_%f")
            filename = f"{self.camera_config.name}/{timestamp}_tracker{tracker_id}_{class_name}.jpg"
            
            # Option 1: Save full frame with annotation
            image_to_save = frame.copy()
            
            # Option 2: Save cropped region (uncomment to use)
            # x1, y1, x2, y2 = map(int, bbox)
            # # Add padding
            # padding = 20
            # h, w = frame.shape[:2]
            # x1 = max(0, x1 - padding)
            # y1 = max(0, y1 - padding)
            # x2 = min(w, x2 + padding)
            # y2 = min(h, y2 + padding)
            # image_to_save = frame[y1:y2, x1:x2]
            
            # Handle color space conversion based on input format
            # OpenCV's imencode expects BGR format
            if len(image_to_save.shape) == 3 and image_to_save.shape[2] == 3:
                if self.frame_color_format == "RGB":
                    # Frame is RGB, convert to BGR for OpenCV
                    image_for_encoding = cv2.cvtColor(image_to_save, cv2.COLOR_RGB2BGR)
                    logger.debug("Converting RGB to BGR for image encoding")
                elif self.frame_color_format == "BGR":
                    # Frame is already BGR, use as-is
                    image_for_encoding = image_to_save
                    logger.debug("Frame already in BGR format")
                else:
                    # Unknown format, assume BGR (OpenCV default)
                    logger.warning(f"Unknown color format '{self.frame_color_format}', assuming BGR")
                    image_for_encoding = image_to_save
            else:
                # Grayscale or single channel
                image_for_encoding = image_to_save
            
            # Convert to JPEG bytes
            is_success, buffer = cv2.imencode(
                '.jpg', 
                image_for_encoding,
                [cv2.IMWRITE_JPEG_QUALITY, self.image_quality]
            )
            
            if not is_success:
                logger.error("Failed to encode image to JPEG")
                return None
            
            # Convert buffer to bytes
            image_bytes = buffer.tobytes()
            
            # Upload to Supabase Storage
            try:
                # Upload file
                response = self.supabase_client.storage.from_(self.storage_bucket).upload(
                    path=filename,
                    file=image_bytes,
                    file_options={"content-type": "image/jpeg"}
                )
                
               # The response object varies by version, just check if upload succeeded
                # If no exception was raised, upload was successful
                logger.debug(f"Upload response: {response}")
                
                # Get public URL
                public_url = self.supabase_client.storage.from_(self.storage_bucket).get_public_url(filename)
                
                logger.info(f"Image saved: {filename}")
                return public_url
                
            except AttributeError as e:
                logger.error(
                    f"Supabase client error: {e}. "
                    "Make sure you're using the synchronous client: "
                    "from supabase import create_client, Client"
                )
                return None
            except Exception as e:
                logger.error(f"Failed to upload image to Supabase: {e}")
                return None
                
        except Exception as e:
            logger.error(f"Error saving detection image: {e}")
            return None
    
    async def _log_tracked_detections(self, detections, frame: np.ndarray):
        """
        Log detection events with tracker IDs to analytics.
        - NEW trackers: Insert new detection event with image
        - EXISTING trackers: Update existing detection event (no new image)
        """
        try:
            current_time = datetime.now(tz=timezone.utc)
            new_detections = []
            update_detections = []
            
            for i in range(len(detections.class_id) if hasattr(detections, 'class_id') else 0):
                # Extract detection data
                bbox = detections.xyxy[i] if hasattr(detections, 'xyxy') and len(detections.xyxy) > i else [0, 0, 0, 0]
                class_id = int(detections.class_id[i]) if hasattr(detections, 'class_id') and len(detections.class_id) > i else 0
                confidence = float(detections.confidence[i]) if hasattr(detections, 'confidence') and len(detections.confidence) > i else 0.0
                tracker_id = int(detections.tracker_id[i]) if hasattr(detections, 'tracker_id') and len(detections.tracker_id) > i else None
                
                # Skip if no tracker ID
                if tracker_id is None:
                    continue
                
                # Determine if this is a new or existing tracker
                is_new_tracker = tracker_id not in self.logged_tracker_ids
                
                # Get class name with bounds checking
                class_name = COCO_CLASSES[class_id]
                
                # Get tracking metadata
                track_metadata = {}
                if tracker_id in self.tracked_objects:
                    track_info = self.tracked_objects[tracker_id]
                    track_metadata = {
                        'tracker_id': tracker_id,
                        'first_seen': track_info.get('first_seen'),
                        'frame_count': track_info.get('frame_count', 0),
                        'track_duration': time.time() - track_info.get('first_seen', time.time())
                    }
                
                if is_new_tracker:
                    # NEW TRACKER: Insert new detection with image
                    self.logged_tracker_ids.add(tracker_id)
                    
                    # Save detection image with ONLY this object's bounding box
                    image_url = None
                    if self.save_detection_images and self.supabase_client:
                        try:
                            # Create annotated frame with ONLY this object's bounding box
                            annotated_frame = frame.copy()
                            
                            # Create single detection for this specific object
                            single_detection = sv.Detections(
                                xyxy=np.array([bbox]),
                                confidence=np.array([confidence]),
                                class_id=np.array([class_id]),
                                tracker_id=np.array([tracker_id])
                            )
                            
                            # Annotate with bounding box and label
                            label = f"{class_name} {confidence:.2f}"
                            annotated_frame = self.box_annotator.annotate(
                                scene=annotated_frame, 
                                detections=single_detection
                            )
                            annotated_frame = self.label_annotator.annotate(
                                scene=annotated_frame, 
                                detections=single_detection, 
                                labels=[label]
                            )
                            
                            image_url = await self._save_detection_image(
                                frame=annotated_frame,
                                tracker_id=tracker_id,
                                class_name=class_name,
                                bbox=bbox
                            )
                            
                        except Exception as img_error:
                            logger.error(f"[{self.camera_config.name}] Error saving detection image for tracker_id {tracker_id}: {img_error}")
                    
                    detection_event = {
                        'camera_id': self.camera_config.id,
                        'camera_name': self.camera_config.name,
                        'camera_url': self.camera_config.url,
                        'timestamp': current_time.isoformat(),
                        'object_class_id': class_id,
                        'object_class_name': class_name,
                        'confidence': confidence,
                        'bbox_x': float(bbox[0]) if len(bbox) > 0 else 0.0,
                        'bbox_y': float(bbox[1]) if len(bbox) > 1 else 0.0,
                        'bbox_width': float(bbox[2] - bbox[0]) if len(bbox) > 2 else 0.0,
                        'bbox_height': float(bbox[3] - bbox[1]) if len(bbox) > 3 else 0.0,
                        'frame_width': frame.shape[1] if len(frame.shape) > 1 else 0,
                        'frame_height': frame.shape[0] if len(frame.shape) > 0 else 0,
                        'session_id': self.session_id,
                        'tracker_id': tracker_id,
                        'image_url': image_url,
                        'detection_metadata': {
                            'model_threshold': self.camera_config.odthreshold / 100.0,
                            'detection_classes': self.camera_config.detection_classes,
                            'recording_active': getattr(self.camera_config, 'recording_active', False),
                            'tracking_metadata': track_metadata,
                            'is_first_detection': True,
                            'image_saved': image_url is not None
                        }
                    }
                    
                    new_detections.append(detection_event)
                    
                    # Store in track history
                    self.track_history.append({
                        'tracker_id': tracker_id,
                        'class_name': class_name,
                        'timestamp': current_time.isoformat(),
                        'status': 'first_detected',
                        'image_url': image_url
                    })
                    
                    logger.info(
                        f"New object detected - Camera: {self.camera_config.name}, "
                        f"Tracker ID: {tracker_id}, Class: {class_name}, "
                        f"Confidence: {confidence:.2f}, Image: {image_url is not None}"
                    )
                    
                else:
                    # EXISTING TRACKER: Update detection (no new image)
                    detection_update = {
                        'camera_id': self.camera_config.id,
                        'tracker_id': tracker_id,
                        'timestamp': current_time.isoformat(),
                        'confidence': confidence,
                        'bbox_x': float(bbox[0]) if len(bbox) > 0 else 0.0,
                        'bbox_y': float(bbox[1]) if len(bbox) > 1 else 0.0,
                        'bbox_width': float(bbox[2] - bbox[0]) if len(bbox) > 2 else 0.0,
                        'bbox_height': float(bbox[3] - bbox[1]) if len(bbox) > 3 else 0.0,
                        'detection_metadata': {
                            'tracking_metadata': track_metadata,
                            'is_first_detection': False,
                            'last_updated': current_time.isoformat()
                        }
                    }
                    
                    update_detections.append(detection_update)
                    
                    # Store in track history
                    self.track_history.append({
                        'tracker_id': tracker_id,
                        'class_name': class_name,
                        'timestamp': current_time.isoformat(),
                        'status': 'updated',
                        'confidence': confidence
                    })
                    
                    logger.debug(
                        f"Object updated - Camera: {self.camera_config.name}, "
                        f"Tracker ID: {tracker_id}, Class: {class_name}, "
                        f"Confidence: {confidence:.2f}"
                    )
            
            # Add new detections to buffer (inserts)
            if new_detections:
                self.analytics_manager.detection_buffer.extend(new_detections)
            
            # Add updates to buffer with flag
            if update_detections:
                for update in update_detections:
                    update['_is_update'] = True
                    self.analytics_manager.detection_buffer.append(update)
            
            # Check if we need to flush
            current_time_unix = time.time()
            if (len(self.analytics_manager.detection_buffer) >= self.analytics_manager.buffer_size or 
                current_time_unix - self.analytics_manager.last_flush >= self.analytics_manager.flush_interval):
                await self.analytics_manager._flush_detection_buffer()
                
        except Exception as e:
            if self.analytics_manager and self.analytics_manager.logging_manager:
                await self.analytics_manager.logging_manager.log_error(
                    f"Error logging tracked detection events: {e}",
                    category="DETECTION",
                    error=e
                )
    
    def get_tracking_statistics(self) -> Dict[str, Any]:
        """Get statistics about tracked objects"""
        return {
            'total_tracked_objects': len(self.tracked_objects),
            'total_logged_objects': len(self.logged_tracker_ids),
            'active_tracks': len([t for t in self.tracked_objects.values() 
                                 if time.time() - t.get('last_seen', 0) < 5]),
            'tracked_objects': self.tracked_objects,
            'recent_history': list(self.track_history)[-50:],
            'image_saving_enabled': self.save_detection_images
        }
    
    def reset_tracker(self):
        """Reset the tracker and clear tracked objects"""
        if self.tracker:
            self.tracker.reset()
        self.tracked_objects.clear()
        self.track_history.clear()
        self.logged_tracker_ids.clear()
        logger.info(f"Tracker reset for camera: {self.camera_config.name}")
    
    def clear_logged_tracker_ids(self):
        """
        Clear the logged tracker IDs set.
        Useful for starting fresh without resetting the entire tracker.
        """
        self.logged_tracker_ids.clear()
        logger.info(f"Cleared logged tracker IDs for camera: {self.camera_config.name}")
    
    def set_image_saving(self, enabled: bool):
        """Enable or disable image saving"""
        self.save_detection_images = enabled
        logger.info(f"Image saving {'enabled' if enabled else 'disabled'} for camera: {self.camera_config.name}")