# ============================================================================
# COMPLETE __init__.py FILES FOR ALL MODULES
# ============================================================================

# ============================================================================
# FILE: config/__init__.py
# ============================================================================
"""Configuration module for application settings and constants"""

from .settings import settings, Settings
from .constants import (
    COCO_CLASS_NAMES,
    RESOLUTION_CODEC_BITRATE_MAP,
    DEFAULT_CODEC_BITRATES,
    CODEC_CONTAINER_MAP,
    CODEC_FALLBACK_ORDER
)

__all__ = [
    'settings',
    'Settings',
    'COCO_CLASS_NAMES',
    'RESOLUTION_CODEC_BITRATE_MAP',
    'DEFAULT_CODEC_BITRATES',
    'CODEC_CONTAINER_MAP',
    'CODEC_FALLBACK_ORDER'
]

__version__ = '15.0.0'
