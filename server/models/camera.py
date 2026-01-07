# ============================================================================
# FILE: models/camera.py
# ============================================================================
from dataclasses import dataclass
from typing import Optional, List, Tuple
from datetime import datetime
from core.codec import CodecManager


@dataclass
class CameraConfig:
    """Camera configuration data model"""
    id: int
    name: str
    type: str
    url: str
    description: Optional[str] = None
    odthreshold: Optional[int] = 50
    is_detection: bool = False
    odclasses: Optional[str] = None
    encoder: Optional[str] = "VP9"
    resolution: Optional[str] = "640x480"
    fps: Optional[int] = 30
    rectype: Optional[str] = "none"
    container: Optional[str] = "webm"
    convert_formats: Optional[List[str]] = None
    
    @property
    def detection_classes(self) -> List[int]:
        """Parse detection classes from comma-separated string"""
        if not self.odclasses:
            return []
        try:
            return [int(cls.strip()) for cls in self.odclasses.split(',') if cls.strip().isdigit()]
        except (ValueError, AttributeError):
            return []
    
    @property
    def resolution_tuple(self) -> Tuple[int, int]:
        """Convert resolution string to tuple"""
        try:
            width, height = map(int, self.resolution.split('x'))
            return (width, height)
        except (ValueError, AttributeError):
            return (640, 480)
    
    @property
    def should_record(self) -> bool:
        """Check if recording is enabled"""
        return self.rectype in ["motion", "continuous"]
    
    @property
    def is_motion_recording(self) -> bool:
        """Check if motion-triggered recording is enabled"""
        return self.rectype == "motion"
    
    @property
    def is_continuous_recording(self) -> bool:
        """Check if continuous recording is enabled"""
        return self.rectype == "continuous"
    
    @property
    def normalized_encoder(self) -> str:
        """Get normalized codec name"""
        return CodecManager.normalize_codec_name(self.encoder) or 'VP9'
    
    @property
    def optimal_container(self) -> str:
        """Get optimal container format for codec"""
        return CodecManager.get_optimal_container(self.encoder, self.container, prefer_webm=True)
    
    @property
    def is_browser_compatible(self) -> bool:
        """Check if codec is browser compatible"""
        config = CodecManager.get_codec_config(self.encoder)
        return config.get('browser_compatible', False) if config else False


@dataclass
class GeneralSettings:
    """General system settings data model"""
    id: int
    user_id: Optional[str] = None
    signaling_protocol: str = 'ws'
    signaling_ip: Optional[str] = None
    signaling_port: Optional[str] = None
    signaling_name: Optional[str] = None
    datetime_enabled: bool = True
    datetime_format: str = 'YYYY-MM-DD HH:mm:ss'
    updated_at: Optional[datetime] = None
