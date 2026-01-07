# ============================================================================
# FILE: models/logging.py
# ============================================================================
from dataclasses import dataclass
from typing import Optional, Dict, Any


class LogCategory:
    """Log category constants"""
    CAMERA = "CAMERA"
    STORAGE = "STORAGE"
    CODEC = "CODEC"
    NETWORK = "NETWORK"
    DATABASE = "DATABASE"
    RECORDING = "RECORDING"
    WEBSOCKET = "WEBSOCKET"
    SYSTEM = "SYSTEM"
    PERFORMANCE = "PERFORMANCE"
    SECURITY = "SECURITY"
    DETECTION = "DETECTION"
    CONVERSION = "CONVERSION"


class LogSubcategory:
    """Log subcategory constants"""
    CAMERA_CONNECTION = "camera_connection"
    CAMERA_DISCONNECTION = "camera_disconnection"
    CAMERA_RECONNECTION = "camera_reconnection"
    FRAME_PROCESSING = "frame_processing"
    MOTION_DETECTION = "motion_detection"
    OBJECT_DETECTION = "object_detection"
    SUPABASE_UPLOAD = "supabase_upload"
    SUPABASE_DOWNLOAD = "supabase_download"
    RECORDING_START = "recording_start"
    RECORDING_STOP = "recording_stop"
    WEBSOCKET_CONNECTION = "websocket_connection"
    WEBSOCKET_MESSAGE = "websocket_message"


@dataclass
class LogContext:
    """Logging context information"""
    camera_id: Optional[int] = None
    camera_name: Optional[str] = None
    camera_url: Optional[str] = None
    session_id: Optional[str] = None
    client_id: Optional[str] = None
    operation_id: Optional[str] = None
    performance_data: Optional[Dict[str, Any]] = None
    additional_data: Optional[Dict[str, Any]] = None
