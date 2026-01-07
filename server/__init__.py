# ============================================================================
# FILE: __init__.py (root)
# ============================================================================
"""
VitCam Server - WebRTC Streaming with Dynamic Bitrate and Object Detection

A professional video streaming server with:
- Dynamic bitrate management
- Real-time object detection and tracking
- Recording and storage management
- Analytics and monitoring
- DateTime overlay
"""

__version__ = '15.0.0'
__author__ = 'VitCam Development Team'
__license__ = 'MIT'

# Package metadata
__all__ = [
    'config',
    'models',
    'core',
    'services',
    'detection',
    'streaming',
    'api',
    'utils'
]

# Import main components for easy access
from config import settings
from services import (
    DatabaseManager,
    SupabaseStorageManager,
    SupabaseLoggingManager,
    RecordingManager
)
from streaming import ConnectionManager

# Version info
def get_version_info():
    """Get version information"""
    return {
        'version': __version__,
        'author': __author__,
        'license': __license__
    }