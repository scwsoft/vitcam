# ============================================================================
# FILE: services/analytics.py
# [Continue with analytics service...]
# ============================================================================
import time
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from collections import defaultdict, deque
from supabase import Client
from config.constants import COCO_CLASS_NAMES


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
                    'frame_height': frame_shape[0] if len(frame_shape) > 0 else 0,
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
        """Flush detection events to database"""
        if not self.detection_buffer:
            return
            
        try:
            events_to_flush = self.detection_buffer.copy()
            self.detection_buffer.clear()
            self.last_flush = time.time()
            
            # Insert in batches
            batch_size = 25
            for i in range(0, len(events_to_flush), batch_size):
                batch = events_to_flush[i:i + batch_size]
                
                result = self.supabase_client.table('object_detection_events').insert(batch).execute()
                
                if hasattr(result, 'error') and result.error:
                    if self.logging_manager:
                        await self.logging_manager.log_error(
                            f"Error inserting detection events batch: {result.error}",
                            category="DETECTION"
                        )
                
        except Exception as e:
            if self.logging_manager:
                await self.logging_manager.log_error(
                    f"Error flushing detection buffer: {e}",
                    category="DETECTION",
                    error=e
                )

