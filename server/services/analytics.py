# ============================================================================
# FILE: services/analytics.py
# [Continue with analytics service...]
# ============================================================================
import time
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from collections import defaultdict, deque
from supabase import Client
from config.constants import COCO_CLASS_NAMES

logger = logging.getLogger(__name__)


class ObjectDetectionAnalytics:
    """Enhanced object detection analytics manager"""
    
    def __init__(self, supabase_client: Client, logging_manager=None):
        """
        Initialize analytics manager
        
        Args:
            supabase_client: Supabase client instance
            logging_manager: Optional logging manager
        """
        self.supabase_client = supabase_client
        self.logging_manager = logging_manager
        self.detection_buffer = []
        self.buffer_size = 50
        self.last_flush = time.time()
        self.flush_interval = 30.0
        
        # Analytics aggregation
        self.hourly_stats = {}
        self.daily_stats = {}
        
    async def log_detection_event(self, camera_config, detections, frame_shape, session_id=None):
        """Log object detection events to database"""
        try:
            current_time = datetime.now(tz=timezone.utc)
            
            for i in range(len(detections.class_id) if hasattr(detections, 'class_id') else 0):
                # Extract detection data safely
                bbox = detections.xyxy[i] if hasattr(detections, 'xyxy') and len(detections.xyxy) > i else [0, 0, 0, 0]
                class_id = int(detections.class_id[i]) if hasattr(detections, 'class_id') and len(detections.class_id) > i else 0
                confidence = float(detections.confidence[i]) if hasattr(detections, 'confidence') and len(detections.confidence) > i else 0.0
                
                # Get class name using COCO dataset mapping
                class_name = COCO_CLASS_NAMES.get(class_id, f"class_{class_id}")
                if hasattr(detections, 'class_name'):
                    class_name = detections.class_name[i] if isinstance(detections.class_name, list) else str(detections.class_name)
                elif hasattr(camera_config, 'model_class_names') and class_id < len(camera_config.model_class_names):
                    class_name = camera_config.model_class_names[class_id]
                
                detection_event = {
                    'camera_id': camera_config.id,
                    'camera_name': camera_config.name,
                    'camera_url': camera_config.url,
                    'timestamp': current_time.isoformat(),
                    'object_class_id': class_id,
                    'object_class_name': class_name,
                    'confidence': confidence,
                    'bbox_x': float(bbox[0]) if len(bbox) > 0 else 0.0,
                    'bbox_y': float(bbox[1]) if len(bbox) > 1 else 0.0,
                    'bbox_width': float(bbox[2] - bbox[0]) if len(bbox) > 2 else 0.0,
                    'bbox_height': float(bbox[3] - bbox[1]) if len(bbox) > 3 else 0.0,
                    'frame_width': frame_shape[1] if len(frame_shape) > 1 else 0,
                    'frame_height': frame_shape[0] if len(frame.shape) > 0 else 0,
                    'session_id': session_id,
                    'detection_metadata': {
                        'model_threshold': camera_config.odthreshold / 100.0,
                        'detection_classes': camera_config.detection_classes,
                        'recording_active': getattr(camera_config, 'recording_active', False)
                    }
                }
                
                self.detection_buffer.append(detection_event)
            
            # Check if we need to flush
            current_time_unix = time.time()
            if (len(self.detection_buffer) >= self.buffer_size or 
                current_time_unix - self.last_flush >= self.flush_interval):
                await self._flush_detection_buffer()
                
        except Exception as e:
            if self.logging_manager:
                await self.logging_manager.log_error(
                    f"Error logging detection events: {e}",
                    category="DETECTION",
                    error=e
                )
    
    async def _flush_detection_buffer(self):
        """
        Flush detection events to database.
        Handles both INSERT (new detections) and UPDATE (existing tracked objects).
        """
        if not self.detection_buffer:
            return
            
        try:
            events_to_flush = self.detection_buffer.copy()
            self.detection_buffer.clear()
            self.last_flush = time.time()
            
            # Separate inserts from updates
            inserts = []
            updates = []
            
            for event in events_to_flush:
                if event.get('_is_update'):
                    # Remove the flag before updating
                    event_copy = event.copy()
                    event_copy.pop('_is_update', None)
                    updates.append(event_copy)
                else:
                    inserts.append(event)
            
            # Handle INSERT operations (new detections with images)
            if inserts:
                batch_size = 25
                total_inserted = 0
                
                for i in range(0, len(inserts), batch_size):
                    batch = inserts[i:i + batch_size]
                    
                    try:
                        result = self.supabase_client.table('object_detection_events').insert(batch).execute()
                        
                        if hasattr(result, 'data') and result.data:
                            total_inserted += len(result.data)
                        
                        if hasattr(result, 'error') and result.error:
                            logger.error(f"Error inserting detection events batch: {result.error}")
                            if self.logging_manager:
                                await self.logging_manager.log_error(
                                    f"Error inserting detection events batch: {result.error}",
                                    category="DETECTION"
                                )
                    except Exception as batch_error:
                        logger.error(f"Error inserting batch {i//batch_size + 1}: {batch_error}")
                        if self.logging_manager:
                            await self.logging_manager.log_error(
                                f"Error inserting batch: {batch_error}",
                                category="DETECTION",
                                error=batch_error
                            )
                
                logger.info(f"Successfully inserted {total_inserted} new detection events")
            
            # Handle UPDATE operations (existing tracked objects)
            if updates:
                total_updated = 0
                
                for update in updates:
                    try:
                        tracker_id = update.get('tracker_id')
                        camera_id = update.get('camera_id')
                        
                        if tracker_id is None or camera_id is None:
                            logger.warning(f"Skipping update: missing tracker_id or camera_id")
                            continue
                        
                        # Prepare update payload (only fields that should be updated)
                        update_payload = {
                            'timestamp': update['timestamp'],
                            'confidence': update['confidence'],
                            'bbox_x': update['bbox_x'],
                            'bbox_y': update['bbox_y'],
                            'bbox_width': update['bbox_width'],
                            'bbox_height': update['bbox_height'],
                            'detection_metadata': update['detection_metadata']
                        }
                        
                        # Update the most recent record for this tracker_id and camera_id
                        result = self.supabase_client.table('object_detection_events')\
                            .update(update_payload)\
                            .eq('tracker_id', tracker_id)\
                            .eq('camera_id', camera_id)\
                            .order('timestamp', desc=True)\
                            .limit(1)\
                            .execute()
                        
                        if hasattr(result, 'data') and result.data:
                            total_updated += len(result.data)
                        
                        if hasattr(result, 'error') and result.error:
                            logger.error(f"Error updating tracker_id {tracker_id}: {result.error}")
                            if self.logging_manager:
                                await self.logging_manager.log_error(
                                    f"Error updating tracker_id {tracker_id}: {result.error}",
                                    category="DETECTION"
                                )
                                
                    except Exception as update_error:
                        logger.error(f"Error updating tracker_id {tracker_id}: {update_error}")
                        if self.logging_manager:
                            await self.logging_manager.log_error(
                                f"Error updating detection: {update_error}",
                                category="DETECTION",
                                error=update_error
                            )
                
                logger.info(f"Successfully updated {total_updated} detection events")
            
            # Log summary
            if inserts or updates:
                logger.info(
                    f"Flushed detection buffer: {len(inserts)} inserts, {len(updates)} updates"
                )
                
        except Exception as e:
            logger.error(f"Critical error flushing detection buffer: {e}")
            if self.logging_manager:
                await self.logging_manager.log_error(
                    f"Error flushing detection buffer: {e}",
                    category="DETECTION",
                    error=e
                )
            
            # Re-add failed events back to buffer for retry (optional)
            # Be careful with this to avoid infinite loops
            # self.detection_buffer.extend(events_to_flush[:10])  # Only retry first 10