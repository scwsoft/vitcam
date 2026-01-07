# ============================================================================
# FILE: services/storage.py
# ============================================================================
import os
import re
import time
from datetime import datetime
from typing import Optional
from supabase import create_client, Client
import aiofiles
from config.settings import settings


class SupabaseStorageManager:
    """Supabase storage management for video recordings"""
    
    def __init__(self, supabase_url: str, supabase_key: str, bucket_name: str = None):
        """
        Initialize storage manager
        
        Args:
            supabase_url: Supabase URL
            supabase_key: Supabase API key
            bucket_name: Storage bucket name
        """
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.bucket_name = bucket_name or settings.SUPABASE_BUCKET
        self._client = None
        
    @property
    def client(self) -> Client:
        """Get Supabase client instance"""
        if self._client is None:
            try:
                self._client = create_client(self.supabase_url, self.supabase_key)
                self._ensure_bucket_exists()
            except Exception as e:
                raise ConnectionError(f"Supabase connection failed: {e}")
        return self._client
    
    def _ensure_bucket_exists(self) -> bool:
        """Ensure storage bucket exists"""
        try:
            result = self.client.storage.from_(self.bucket_name).list()
            return True
        except Exception:
            try:
                create_result = self.client.storage.create_bucket(
                    self.bucket_name, 
                    {"public": False}
                )
                        
                return True
            except Exception:
                return True
    
    def generate_object_key(self, camera_name: str, recording_type: str = "", 
                          container: str = "webm") -> str:
        """
        Generate object key for recording
        
        Args:
            camera_name: Camera name
            recording_type: Type of recording
            container: Container format
            
        Returns:
            Object key string
        """
        try:
            safe_name = self._sanitize_camera_name(camera_name)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            prefix = recording_type if recording_type else "recording"
            object_key = f"{safe_name}/{timestamp}_{prefix}.{container}"
            return object_key
        except Exception as e:
            fallback_key = (f"camera_{abs(hash(camera_name)) % 10000}/"
                          f"{int(time.time())}_{recording_type}.{container}")
            return fallback_key
    
    def _sanitize_camera_name(self, camera_name: str) -> str:
        """
        Sanitize camera name for use in object keys
        
        Args:
            camera_name: Raw camera name
            
        Returns:
            Sanitized camera name
        """
        # Remove special characters
        safe_name = re.sub(r'[^\w\s\-_.]', '', camera_name)
        # Replace spaces with underscores
        safe_name = re.sub(r'\s+', '_', safe_name)
        # Remove multiple underscores
        safe_name = re.sub(r'_+', '_', safe_name)
        # Strip and lowercase
        safe_name = safe_name.strip('_').lower()
        
        # Fallback if name becomes empty
        if not safe_name:
            safe_name = f"camera_{abs(hash(camera_name)) % 10000}"
        
        # Limit length
        if len(safe_name) > 50:
            safe_name = safe_name[:50].rstrip('_')
        
        return safe_name
    
    async def upload_file(self, object_key: str, file_path: str, 
                         content_type: str = "video/webm") -> bool:
        """
        Upload file to Supabase storage
        
        Args:
            object_key: Object key in storage
            file_path: Local file path
            content_type: MIME content type
            
        Returns:
            True if successful, False otherwise
        """
        try:
            if not os.path.exists(file_path):
                return False
            
            file_size = os.path.getsize(file_path)
            if file_size == 0:
                return False
            
            # Read file asynchronously
            async with aiofiles.open(file_path, 'rb') as file:
                file_content = await file.read()
            
            # Upload to Supabase
            result = self.client.storage.from_(self.bucket_name).upload(
                path=object_key,
                file=file_content,
                file_options={
                    "content-type": content_type,
                    "cache-control": "3600",
                    "upsert": "true"
                }
            )
            
            if result:
                if hasattr(result, 'error') and result.error:
                    return False
                return True
            return False
                
        except Exception as e:
            return False

    def object_exists(self, object_key: str) -> bool:
        """
        Check if object exists in storage
        
        Args:
            object_key: Object key to check
            
        Returns:
            True if exists, False otherwise
        """
        try:
            folder_path = os.path.dirname(object_key)
            filename = os.path.basename(object_key)
            
            if folder_path:
                result = self.client.storage.from_(self.bucket_name).list(path=folder_path)
            else:
                result = self.client.storage.from_(self.bucket_name).list()
            
            if result and isinstance(result, list):
                for item in result:
                    item_name = item.get('name', '') if isinstance(item, dict) else str(item)
                    if item_name == filename:
                        return True
                return False
            return False
            
        except Exception:
            return False
    
    async def delete_file(self, object_key: str) -> bool:
        """
        Delete file from storage
        
        Args:
            object_key: Object key to delete
            
        Returns:
            True if successful, False otherwise
        """
        try:
            result = self.client.storage.from_(self.bucket_name).remove([object_key])
            return True
        except Exception:
            return False
    
    def get_public_url(self, object_key: str, expires_in: int = 3600) -> Optional[str]:
        """
        Get public URL for object
        
        Args:
            object_key: Object key
            expires_in: URL expiration time in seconds
            
        Returns:
            Public URL or None
        """
        try:
            result = self.client.storage.from_(self.bucket_name).create_signed_url(
                object_key, 
                expires_in
            )
            return result.get('signedURL') if result else None
        except Exception:
            return None