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
    """Enhanced camera predictor with analytics tracking and object tracking using DeepSORT"""
    
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
        
        # Initialize DeepSORT for object tracking using deep-sort-realtime
        try:
            from deep_sort_realtime.deepsort_tracker import DeepSort
            
            # Initialize DeepSORT with optimized parameters
            self.tracker = DeepSort(
                max_age=50,              # Frames to keep lost tracks
                n_init=3,                # Frames to confirm a track
                nms_max_overlap=0.7,     # NMS overlap threshold
                max_cosine_distance=0.3, # Appearance similarity threshold
                nn_budget=100,           # Max samples per class
                # embedder can be "mobilenet" (default, faster) or "torchreid" (more accurate)
                embedder="mobilenet",
                half=True,               # Use FP16 for faster inference
                bgr=True,                # Input frames are in BGR format
                embedder_gpu=True,       # Use GPU for embedder if available
                embedder_model_name=None,
                embedder_wts=None,
                polygon=False,
                today=None
            )
            logger.info(f"DeepSORT tracker initialized for camera: {camera_config.name} (using deep-sort-realtime)")
            self.tracker_type = "DeepSORT"
            
        except ImportError as e:
            logger.error(f"DeepSORT (deep-sort-realtime) not available: {e}")
            logger.info("Install with: pip install deep-sort-realtime")
            
            # Fallback to ByteTrack if DeepSORT not available
            try:
                logger.warning("Falling back to ByteTrack")
                from supervision import ByteTrack
                self.tracker = ByteTrack(
                    track_activation_threshold=0.25,
                    lost_track_buffer=50,
                    minimum_matching_threshold=0.8,
                    frame_rate=camera_config.fps
                )
                logger.info(f"ByteTrack tracker initialized (fallback) for camera: {camera_config.name}")
                self.tracker_type = "ByteTrack"
            except Exception as fallback_error:
                self.tracker = None
                self.tracker_type = "None"
                logger.warning(f"Object tracking not available for camera {camera_config.name}: {fallback_error}")
        except Exception as e:
            self.tracker = None
            self.tracker_type = "None"
            logger.warning(f"Object tracking not available for camera {camera_config.name}: {e}")
        
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
            if len(self.detection_classes) >= 1:
                detections = detections[np.isin(detections.class_id, list(self.detection_classes))]
                detections = detections[detections.confidence > 0.45]
                detections = detections.with_nms(threshold=0.5)
            
            # Apply tracking to detections if tracker available
            if self.tracker and self.tracker_type == "DeepSORT" and len(detections) > 0:
                # Convert detections to format expected by deep-sort-realtime
                # Format: [[x1, y1, x2, y2, confidence, class_id], ...]
                raw_detections = []
                for i in range(len(detections.xyxy)):
                    bbox = detections.xyxy[i]
                    confidence = float(detections.confidence[i])
                    class_id = int(detections.class_id[i])
                    
                    # DeepSort expects: [left, top, width, height, confidence]
                    # We have: [x1, y1, x2, y2, confidence, class_id]
                    x1, y1, x2, y2 = map(float, bbox)
                    width = x2 - x1
                    height = y2 - y1
                    
                    raw_detections.append(([x1, y1, width, height], confidence, class_id))
                
                # Update tracker with current frame and detections
                tracks = self.tracker.update_tracks(raw_detections, frame=frame)
                
                # Convert tracked results back to supervision format
                if len(tracks) > 0:
                    tracked_boxes = []
                    tracked_confidences = []
                    tracked_class_ids = []
                    tracker_ids = []
                    
                    for track in tracks:
                        if not track.is_confirmed():
                            continue
                        
                        # Get bounding box in [x1, y1, x2, y2] format
                        ltrb = track.to_ltrb()
                        tracked_boxes.append(ltrb)
                        
                        # Get track metadata - ensure proper types
                        tracker_ids.append(int(track.track_id))
                        
                        # Get confidence, default to 0.0 if not available
                        try:
                            conf = track.get_det_conf() if hasattr(track, 'get_det_conf') else None
                            tracked_confidences.append(float(conf) if conf is not None else 0.5)
                        except:
                            tracked_confidences.append(0.5)
                        
                        # Get class ID, default to 0 if not available
                        try:
                            cls = track.get_det_class() if hasattr(track, 'get_det_class') else None
                            tracked_class_ids.append(int(cls) if cls is not None else 0)
                        except:
                            tracked_class_ids.append(0)
                    
                    if len(tracked_boxes) > 0:
                        # Create new Detections object with tracker IDs
                        # Ensure all arrays are properly typed and have no None values
                        tracked_boxes_clean = []
                        tracked_confidences_clean = []
                        tracked_class_ids_clean = []
                        tracker_ids_clean = []
                        
                        for idx in range(len(tracked_boxes)):
                            # Validate all values
                            if (tracked_boxes[idx] is not None and 
                                tracked_confidences[idx] is not None and 
                                tracked_class_ids[idx] is not None and 
                                tracker_ids[idx] is not None):
                                tracked_boxes_clean.append(tracked_boxes[idx])
                                tracked_confidences_clean.append(tracked_confidences[idx])
                                tracked_class_ids_clean.append(tracked_class_ids[idx])
                                tracker_ids_clean.append(tracker_ids[idx])
                        
                        if len(tracked_boxes_clean) > 0:
                            detections = sv.Detections(
                                xyxy=np.array(tracked_boxes_clean, dtype=np.float32),
                                confidence=np.array(tracked_confidences_clean, dtype=np.float32),
                                class_id=np.array(tracked_class_ids_clean, dtype=np.int32),
                                tracker_id=np.array(tracker_ids_clean, dtype=np.int32)
                            )
                        else:
                            # No valid tracks after cleaning, keep original detections
                            logger.warning(f"No valid tracks after cleaning for camera {self.camera_config.name}")
                    else:
                        # No confirmed tracks, keep original detections without tracker IDs
                        pass
            
            elif self.tracker and self.tracker_type == "ByteTrack" and len(detections) > 0:
                # Use supervision's ByteTrack API
                detections = self.tracker.update_with_detections(detections)
            
            # Prepare labels with tracker IDs
            labels = []
            for i, (class_id, confidence) in enumerate(
                zip(detections.class_id, detections.confidence)
            ):
                # Convert to native Python types with null safety
                try:
                    if class_id is None:
                        class_id = 0
                    else:
                        class_id = int(class_id)
                except (TypeError, ValueError):
                    class_id = 0
                
                try:
                    if confidence is None:
                        confidence = 0.5
                    else:
                        confidence = float(confidence)
                except (TypeError, ValueError):
                    confidence = 0.5
                
                # Get class name with bounds checking
                if class_id >= len(COCO_CLASSES) or class_id < 0:
                    class_name = f"class_{class_id}"
                else:
                    class_name = COCO_CLASSES[class_id]
                
                # Add tracker ID if available
                if self.tracker and hasattr(detections, 'tracker_id') and detections.tracker_id is not None and len(detections.tracker_id) > i:
                    try:
                        tracker_id = int(detections.tracker_id[i])
                    except (TypeError, ValueError):
                        # No valid tracker ID, skip tracking for this detection
                        labels.append(f"{class_name} {confidence:.2f}")
                        continue
                    
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
            import traceback
            logger.error(f"Error in tracked prediction for camera {self.camera_config.name}: {e}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            return frame
    
    async def _save_detection_image(
        self, 
        frame: np.ndarray, 
        tracker_id: int, 
        class_name: str,
        bbox: list
    ) -> Optional[str]:
        """
        Save detection image to Supabase Storage with full frame
        
        Args:
            frame: Annotated frame with bounding box already drawn
            tracker_id: Tracker ID
            class_name: Object class name
            bbox: Bounding box coordinates [x1, y1, x2, y2] (not used, kept for compatibility)
            
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
            
            # Use the frame as-is (already has bounding box annotated)
            image_to_save = frame
            
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
                # Extract detection data with comprehensive null safety
                try:
                    bbox = detections.xyxy[i] if hasattr(detections, 'xyxy') and len(detections.xyxy) > i else [0, 0, 0, 0]
                except Exception as e:
                    logger.warning(f"Error extracting bbox for detection {i}: {e}")
                    bbox = [0, 0, 0, 0]
                
                try:
                    class_id_raw = detections.class_id[i] if hasattr(detections, 'class_id') and len(detections.class_id) > i else 0
                    class_id = int(class_id_raw) if class_id_raw is not None else 0
                except Exception as e:
                    logger.warning(f"Error extracting class_id for detection {i}: {e}")
                    class_id = 0
                
                try:
                    confidence_raw = detections.confidence[i] if hasattr(detections, 'confidence') and len(detections.confidence) > i else 0.5
                    confidence = float(confidence_raw) if confidence_raw is not None else 0.5
                except Exception as e:
                    logger.warning(f"Error extracting confidence for detection {i}: {e}")
                    confidence = 0.5
                
                try:
                    tracker_id_raw = detections.tracker_id[i] if hasattr(detections, 'tracker_id') and detections.tracker_id is not None and len(detections.tracker_id) > i else None
                    tracker_id = int(tracker_id_raw) if tracker_id_raw is not None else None
                except Exception as e:
                    logger.warning(f"Error extracting tracker_id for detection {i}: {e}")
                    tracker_id = None
                
                # Skip if no tracker ID
                if tracker_id is None:
                    continue
                
                # Determine if this is a new or existing tracker
                is_new_tracker = tracker_id not in self.logged_tracker_ids
                
                # Get class name with bounds checking
                if class_id >= len(COCO_CLASSES) or class_id < 0:
                    class_name = f"class_{class_id}"
                    logger.warning(f"Class ID {class_id} out of bounds, using generic name")
                else:
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
                            # Ensure confidence is valid for formatting
                            safe_confidence = confidence if confidence is not None else 0.5
                            label = f"{class_name} {safe_confidence:.2f}"
                            annotated_frame = self.box_annotator.annotate(
                                scene=annotated_frame, 
                                detections=single_detection
                            )
                            # annotated_frame = self.label_annotator.annotate(
                            #     scene=annotated_frame, 
                            #     detections=single_detection, 
                            #     labels=[label]
                            # )
                            
                            image_url = await self._save_detection_image(
                                frame=annotated_frame,
                                tracker_id=tracker_id,
                                class_name=class_name,
                                bbox=bbox  # Kept for compatibility, not used internally
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
            'tracker_type': self.tracker_type,
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
            if self.tracker_type == "DeepSORT":
                # DeepSort (deep-sort-realtime) uses delete_all_tracks()
                try:
                    if hasattr(self.tracker, 'delete_all_tracks'):
                        self.tracker.delete_all_tracks()
                    else:
                        logger.warning("DeepSort tracker doesn't have delete_all_tracks method")
                except Exception as e:
                    logger.error(f"Error resetting DeepSort tracker: {e}")
            elif self.tracker_type == "ByteTrack":
                # ByteTrack uses reset()
                try:
                    self.tracker.reset()
                except Exception as e:
                    logger.error(f"Error resetting ByteTrack tracker: {e}")
        
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