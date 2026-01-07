# ============================================================================
# FILE: models/__init__.py
# ============================================================================
"""Data models for camera configuration, detection, and logging"""

from .camera import CameraConfig, GeneralSettings
from .detection import DetectionEvent
from .logging import LogCategory, LogSubcategory, LogContext

__all__ = [
    'CameraConfig',
    'GeneralSettings',
    'DetectionEvent',
    'LogCategory',
    'LogSubcategory',
    'LogContext'
]