# ============================================================================
# FILE: utils/image_storage.py
# ============================================================================
import io
import base64
import logging
from datetime import datetime, timezone
from typing import Optional, Tuple
import numpy as np
from PIL import Image
from supabase import Client

logger = logging.getLogger(__name__)


class ImageStorageManager:
    """Manages image storage to Supabase Storage"""
    
    def __init__(self, supabase_client: Client, bucket_name: str = "detection-frames"):
        """
        Initialize image storage manager
        
        Args:
            supabase_client: Supabase client instance
            bucket_name: Name of the storage bucket
        """
        self.supabase = supabase_client
        self.bucket_name = bucket_name
        self._ensure_bucket_exists()
    
    def _ensure_bucket_exists(self):
        """Ensure the storage bucket exists, create if it doesn't"""
        try:
            # Try to get bucket info
            buckets = self.supabase.storage.list_buckets()
            bucket_exists = any(b['name'] == self.bucket_name for b in buckets)
            
            if not bucket_exists:
                # Create bucket with public access for easy retrieval
                self.supabase.storage.create_bucket(
                    self.bucket_name,
                    options={"public": True}
                )
                logger.info(f"Created storage bucket: {self.bucket_name}")
            else:
                logger.info(f"Storage bucket already exists: {self.bucket_name}")
                
        except Exception as e:
            logger.warning(f"Could not verify/create bucket: {e}")
    
    def upload_frame(
        self, 
        frame: np.ndarray, 
        camera_id: int,
        camera_name: str,
        tracker_id: Optional[int] = None,
        object_class: Optional[str] = None,
        quality: int = 85
    ) -> Optional[str]:
        """
        Upload annotated frame to Supabase Storage
        
        Args:
            frame: Annotated frame as numpy array
            camera_id: Camera ID
            camera_name: Camera name
            tracker_id: Optional tracker ID
            object_class: Optional detected object class
            quality: JPEG quality (1-100)
            
        Returns:
            Public URL of uploaded image or None if failed
        """
        try:
            # Convert frame to JPEG
            image = Image.fromarray(frame)
            buffer = io.BytesIO()
            image.save(buffer, format='JPEG', quality=quality, optimize=True)
            buffer.seek(0)
            
            # Generate unique filename
            timestamp = datetime.now(timezone.utc)
            timestamp_str = timestamp.strftime("%Y%m%d_%H%M%S_%f")
            
            # Build path: camera_id/YYYYMMDD/timestamp_tracker_class.jpg
            date_folder = timestamp.strftime("%Y%m%d")
            
            filename_parts = [timestamp_str]
            if tracker_id is not None:
                filename_parts.append(f"t{tracker_id}")
            if object_class:
                filename_parts.append(object_class.replace(" ", "_"))
            
            filename = "_".join(filename_parts) + ".jpg"
            file_path = f"{camera_id}/{date_folder}/{filename}"
            
            # Upload to Supabase Storage
            response = self.supabase.storage.from_(self.bucket_name).upload(
                path=file_path,
                file=buffer.getvalue(),
                file_options={
                    "content-type": "image/jpeg",
                    "cache-control": "3600",
                    "upsert": "false"
                }
            )
            
            # Get public URL
            public_url = self.supabase.storage.from_(self.bucket_name).get_public_url(file_path)
            
            logger.debug(f"Uploaded frame to: {file_path}")
            return public_url
            
        except Exception as e:
            logger.error(f"Failed to upload frame: {e}")
            return None
    
    def upload_frame_base64(
        self,
        frame: np.ndarray,
        camera_id: int,
        max_size: Tuple[int, int] = (800, 600)
    ) -> Optional[str]:
        """
        Convert frame to base64 for inline storage (alternative to file upload)
        
        Args:
            frame: Annotated frame as numpy array
            camera_id: Camera ID
            max_size: Maximum dimensions (width, height)
            
        Returns:
            Base64 encoded string or None if failed
        """
        try:
            # Convert and resize frame
            image = Image.fromarray(frame)
            
            # Resize if too large
            if image.size[0] > max_size[0] or image.size[1] > max_size[1]:
                image.thumbnail(max_size, Image.Resampling.LANCZOS)
            
            # Convert to base64
            buffer = io.BytesIO()
            image.save(buffer, format='JPEG', quality=75, optimize=True)
            buffer.seek(0)
            
            base64_str = base64.b64encode(buffer.getvalue()).decode('utf-8')
            return f"data:image/jpeg;base64,{base64_str}"
            
        except Exception as e:
            logger.error(f"Failed to convert frame to base64: {e}")
            return None
    
    def delete_old_images(self, days_old: int = 30):
        """
        Delete images older than specified days
        
        Args:
            days_old: Delete images older than this many days
        """
        try:
            # Calculate cutoff date
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_old)
            cutoff_str = cutoff_date.strftime("%Y%m%d")
            
            # List all files in bucket
            files = self.supabase.storage.from_(self.bucket_name).list()
            
            deleted_count = 0
            for file_obj in files:
                # Extract date from path
                try:
                    parts = file_obj['name'].split('/')
                    if len(parts) >= 2:
                        date_str = parts[1]  # YYYYMMDD folder
                        if date_str < cutoff_str:
                            # Delete file
                            self.supabase.storage.from_(self.bucket_name).remove([file_obj['name']])
                            deleted_count += 1
                except Exception as e:
                    logger.warning(f"Could not delete file {file_obj.get('name')}: {e}")
                    continue
            
            logger.info(f"Deleted {deleted_count} old images (older than {days_old} days)")
            return deleted_count
            
        except Exception as e:
            logger.error(f"Failed to delete old images: {e}")
            return 0
    
    def get_image_url(self, file_path: str) -> Optional[str]:
        """
        Get public URL for an image
        
        Args:
            file_path: Path to file in storage
            
        Returns:
            Public URL or None
        """
        try:
            return self.supabase.storage.from_(self.bucket_name).get_public_url(file_path)
        except Exception as e:
            logger.error(f"Failed to get image URL: {e}")
            return None