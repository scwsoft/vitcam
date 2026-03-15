# ============================================================================
# FILE: services/database.py
# ============================================================================
import time
from typing import Optional, Dict, List
from supabase import create_client, Client
from models.camera import CameraConfig, GeneralSettings
from config.settings import settings


class DatabaseManager:
    """Database operations manager for Supabase"""
    
    def __init__(self, supabase_url: str, supabase_key: str):
        """
        Initialize database manager
        
        Args:
            supabase_url: Supabase URL
            supabase_key: Supabase API key
        """
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self._client: Optional[Client] = None
        self._cache_ttl = settings.CACHE_TTL
        self._last_cache_update = {}
        self._camera_cache: Dict[str, CameraConfig] = {}
        self._settings_cache: Optional[GeneralSettings] = None
        self._settings_cache_time = 0
        
    @property
    def client(self) -> Client:
        """Get Supabase client instance"""
        if self._client is None:
            try:
                self._client = create_client(self.supabase_url, self.supabase_key)
            except Exception as e:
                raise ConnectionError(f"Database connection failed: {e}")
        return self._client
    
    async def get_general_settings(self, user_id: Optional[str] = None) -> Optional[GeneralSettings]:
        """
        Get general system settings
        
        Args:
            user_id: Optional user ID filter
            
        Returns:
            GeneralSettings object or None
        """
        try:
            current_time = time.time()
            
            # Return cached settings if fresh
            if (self._settings_cache and 
                current_time - self._settings_cache_time < settings.SETTINGS_CHECK_INTERVAL):
                return self._settings_cache
            
            # Query database
            query = self.client.table('general_settings').select('*')
            
            if user_id:
                query = query.eq('user_id', user_id)
            
            response = query.order('updated_at', desc=True).limit(1).execute()
            
            if not response.data:
                return None
            
            settings_data = response.data[0]
            
            # Create settings object
            settings_obj = GeneralSettings(
                id=settings_data['id'],
                user_id=settings_data.get('user_id'),
                signaling_protocol=settings_data.get('signaling_protocol', 'ws'),
                signaling_ip=settings_data.get('signaling_ip'),
                signaling_port=settings_data.get('signaling_port'),
                signaling_name=settings_data.get('signaling_name'),
                datetime_enabled=settings_data.get('datetime_enabled', True),
                datetime_format=settings_data.get('datetime_format', 'YYYY-MM-DD HH:mm:ss'),
                updated_at=settings_data.get('updated_at')
            )
            
            # Cache the settings
            self._settings_cache = settings_obj
            self._settings_cache_time = current_time
            
            return settings_obj
            
        except Exception as e:
            return None
    
    def clear_settings_cache(self):
        """Clear settings cache"""
        self._settings_cache = None
        self._settings_cache_time = 0
    
    async def get_camera_config(self, camera_url: str) -> Optional[CameraConfig]:
        """
        Get camera configuration by URL
        
        Args:
            camera_url: Camera RTSP URL
            
        Returns:
            CameraConfig object or None
        """
        try:
            cache_key = f"camera_{camera_url}"
            current_time = time.time()
            
            #Return cached config if fresh
            if (cache_key in self._camera_cache and 
                cache_key in self._last_cache_update and
                current_time - self._last_cache_update[cache_key] < self._cache_ttl):
                return self._camera_cache[cache_key]
            
            # Query database
            response = self.client.table('camera').select('*').eq('url', camera_url).execute()
            
            if not response.data:
                return None
            
            camera_data = response.data[0]
            
            # Validate encoder and container
            encoder = camera_data.get('encoder', 'VP9')
            container = camera_data.get('container', 'webm')
            
            if container == 'webm' and encoder not in ['VP9', 'VP8', 'H264']:
                encoder = 'VP9'
            
            # Create config object
            config = CameraConfig(
                id=camera_data['id'],
                name=camera_data['name'],
                type=camera_data['type'],
                url=camera_data['url'],
                description=camera_data.get('description'),
                odthreshold=camera_data.get('odthreshold', 50),
                is_detection=camera_data.get('is_detection', False),
                odclasses=camera_data.get('odclasses'),
                encoder=encoder,
                resolution=camera_data.get('resolution', '640x480'),
                fps=camera_data.get('fps', 30),
                modelsize=camera_data.get('modelsize'),
                detectiontype=camera_data.get('detectiontype'),
                rectype=camera_data.get('rectype', 'none'),
                container=container,
                convert_formats=camera_data.get('convert_formats')
            )
            
            # Cache the config
            self._camera_cache[cache_key] = config
            self._last_cache_update[cache_key] = current_time
            
            return config
            
        except Exception as e:
            return None
    
    async def get_all_cameras(self) -> List[CameraConfig]:
        """
        Get all camera configurations
        
        Returns:
            List of CameraConfig objects
        """
        try:
            response = self.client.table('camera').select('*').execute()
            cameras = []
            
            for camera_data in response.data:
                encoder = camera_data.get('encoder', 'VP9')
                container = camera_data.get('container', 'webm')
                
                if container == 'webm' and encoder not in ['VP9', 'VP8', 'H264']:
                    encoder = 'VP9'
                
                config = CameraConfig(
                    id=camera_data['id'],
                    name=camera_data['name'],
                    type=camera_data['type'],
                    url=camera_data['url'],
                    description=camera_data.get('description'),
                    odthreshold=camera_data.get('odthreshold', 50),
                    is_detection=camera_data.get('is_detection', False),
                    odclasses=camera_data.get('odclasses'),
                    encoder=encoder,
                    resolution=camera_data.get('resolution', '640x480'),
                    fps=camera_data.get('fps', 30),
                    modelsize=camera_data.get('modelsize'),
                    detectiontype=camera_data.get('detectiontype'),
                    rectype=camera_data.get('rectype', 'none'),
                    container=container,
                    convert_formats=camera_data.get('convert_formats')
                )
                cameras.append(config)
                
            return cameras
            
        except Exception as e:
            return []
    
    def clear_camera_cache(self, camera_url: Optional[str] = None):
        """
        Clear camera configuration cache
        
        Args:
            camera_url: Optional specific camera URL to clear
        """
        if camera_url:
            cache_key = f"camera_{camera_url}"
            if cache_key in self._camera_cache:
                del self._camera_cache[cache_key]
            if cache_key in self._last_cache_update:
                del self._last_cache_update[cache_key]
        else:
            self._camera_cache.clear()
            self._last_cache_update.clear()