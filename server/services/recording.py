# ============================================================================
# FILE: services/recording.py
# ============================================================================
import os
import asyncio
import logging
from typing import Tuple, Dict
from services.storage import SupabaseStorageManager
from models.logging import LogCategory, LogSubcategory, LogContext

logger = logging.getLogger(__name__)


class RecordingManager:
    """Manager for video recording and upload operations"""
    
    def __init__(self, storage_manager: SupabaseStorageManager):
        """
        Initialize recording manager
        
        Args:
            storage_manager: Storage manager instance
        """
        self.storage_manager = storage_manager
        self.active_recorders = {}
        self.recording_status = {}
        self.upload_queue = asyncio.Queue()
        self.upload_worker_running = False
        
    def get_object_key(self, camera_config, recording_type: str = "") -> Tuple[str, str]:
        """
        Generate object key for recording
        
        Args:
            camera_config: Camera configuration
            recording_type: Recording type
            
        Returns:
            Tuple of (object_key, container)
        """
        container = 'webm'
        object_key = self.storage_manager.generate_object_key(
            camera_config.name, 
            recording_type or camera_config.rectype, 
            container
        )
        return object_key, container
    
    async def start_conversion_worker(self):
        """Start the upload worker for processing recorded files"""
        if not self.upload_worker_running:
            self.upload_worker_running = True
            asyncio.create_task(self._upload_worker())
    
    async def _upload_worker(self):
        """Background worker to upload recorded files to Supabase"""
        while self.upload_worker_running:
            try:
                # Wait for upload task
                upload_data = await asyncio.wait_for(self.upload_queue.get(), timeout=5.0)
                
                file_path = upload_data['file_path']
                object_key = upload_data['object_key']
                camera_name = upload_data['camera_name']
                recording_type = upload_data['recording_type']
                
                # Check if file exists and has content
                if os.path.exists(file_path) and os.path.getsize(file_path) > 0:
                    success = await self.storage_manager.upload_file(
                        object_key=object_key,
                        file_path=file_path,
                        content_type="video/webm"
                    )
                    
                    if success:
                        logger.info(f"Successfully uploaded recording: {object_key}")
                    else:
                        logger.error(f"Failed to upload recording: {object_key}")
                    
                    # Clean up local file
                    try:
                        os.remove(file_path)
                    except Exception as e:
                        logger.warning(f"Failed to remove local file {file_path}: {e}")
                else:
                    logger.warning(f"Recording file not found or empty: {file_path}")
                
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"Error in upload worker: {e}")
                continue
    
    async def queue_upload(self, file_path: str, object_key: str, camera_name: str, recording_type: str):
        """
        Queue a file for upload to Supabase
        
        Args:
            file_path: Local file path
            object_key: Object key in storage
            camera_name: Camera name
            recording_type: Recording type
        """
        upload_data = {
            'file_path': file_path,
            'object_key': object_key,
            'camera_name': camera_name,
            'recording_type': recording_type
        }
        await self.upload_queue.put(upload_data)
        logger.info(f"Queued recording for upload: {object_key}")
    
    async def stop_worker(self):
        """Stop the upload worker"""
        self.upload_worker_running = False