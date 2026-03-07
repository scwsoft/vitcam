# ============================================================================
# FILE: config/constants.py
# ============================================================================
import cv2


# Comprehensive bitrate mapping based on resolution and codec
RESOLUTION_CODEC_BITRATE_MAP = {
    (1920, 1080): {
        'H264': 8_500_000, 'VP8': 5_500_000, 'VP9': 4_000_000, 'MJPG': 3_500_000,
    },
    (1280, 720): {
        'H264': 3_500_000, 'VP8': 2_500_000, 'VP9': 1_800_000, 'MJPG': 1_700_000,
    },
    (960, 540): {
        'H264': 1_800_000, 'VP8': 1_500_000, 'VP9': 1_100_000, 'MJPG': 1_100_000,
    },
    (640, 480): {
        'H264': 950_000, 'VP8': 750_000, 'VP9': 550_000, 'MJPG': 550_000,
    },
    (640, 360): {
        'H264': 950_000, 'VP8': 750_000, 'VP9': 550_000, 'MJPG': 550_000,
    },
    (384, 216): {
        'H264': 400_000, 'VP8': 350_000, 'VP9': 250_000, 'MJPG': 230_000,
    },
    (320, 240): {
        'H264': 330_000, 'VP8': 280_000, 'VP9': 210_000, 'MJPG': 200_000,
    },
    (320, 180): {
        'H264': 330_000, 'VP8': 280_000, 'VP9': 210_000, 'MJPG': 200_000,
    },
    (160, 90): {
        'H264': 110_000, 'VP8': 100_000, 'VP9': 80_000, 'MJPG': 75_000,
    },
}

# Default fallback bitrates by codec
DEFAULT_CODEC_BITRATES = {
    'VP9': 2_000_000,
    'VP8': 2_500_000,
    'H264': 3_000_000,
    'MJPG': 1_500_000,
}

# Codec container mapping
CODEC_CONTAINER_MAP = {
    'VP9': {
        'fourcc_codes': ['VP90', 'vp90', 'VP9', 'vp9'],
        'containers': ['webm', 'mkv'],
        'preferred_container': 'webm',
        'opencv_fourcc': cv2.VideoWriter_fourcc(*'VP90'),
        'browser_compatible': True,
        'web_priority': 1
    },
    'VP8': {
        'fourcc_codes': ['VP80', 'vp80', 'VP8', 'vp8'],
        'containers': ['webm', 'mkv'],
        'preferred_container': 'webm',
        'opencv_fourcc': cv2.VideoWriter_fourcc(*'VP80'),
        'browser_compatible': True,
        'web_priority': 2
    },
    'H264': {
        'fourcc_codes': ['H264', 'h264', 'X264', 'x264', 'AVC1', 'avc1'],
        'containers': ['mp4', 'avi', 'mov', 'mkv', 'webm'],
        'preferred_container': 'webm',
        'opencv_fourcc': cv2.VideoWriter_fourcc(*'H264'),
        'browser_compatible': True,
        'web_priority': 3
    },
    'MJPG': {
        'fourcc_codes': ['MJPG', 'mjpg', 'MJPA', 'mjpa'],
        'containers': ['avi', 'mov', 'mp4', 'webm'],
        'preferred_container': 'webm',
        'opencv_fourcc': cv2.VideoWriter_fourcc(*'MJPG'),
        'browser_compatible': True,
        'web_priority': 4
    }
}

CODEC_FALLBACK_ORDER = ['VP9', 'VP8', 'H264', 'MJPG']

