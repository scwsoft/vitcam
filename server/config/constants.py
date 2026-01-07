# ============================================================================
# FILE: config/constants.py
# ============================================================================
import cv2

# COCO class names mapping for object detection
COCO_CLASS_NAMES = {
    0: 'person', 1: 'bicycle', 2: 'car', 3: 'motorcycle', 4: 'airplane', 5: 'bus',
    6: 'train', 7: 'truck', 8: 'boat', 9: 'traffic light', 10: 'fire hydrant',
    11: 'stop sign', 12: 'parking meter', 13: 'bench', 14: 'bird', 15: 'cat',
    16: 'dog', 17: 'horse', 18: 'sheep', 19: 'cow', 20: 'elephant', 21: 'bear',
    22: 'zebra', 23: 'giraffe', 24: 'backpack', 25: 'umbrella', 26: 'handbag',
    27: 'tie', 28: 'suitcase', 29: 'frisbee', 30: 'skis', 31: 'snowboard',
    32: 'sports ball', 33: 'kite', 34: 'baseball bat', 35: 'baseball glove',
    36: 'skateboard', 37: 'surfboard', 38: 'tennis racket', 39: 'bottle',
    40: 'wine glass', 41: 'cup', 42: 'fork', 43: 'knife', 44: 'spoon',
    45: 'bowl', 46: 'banana', 47: 'apple', 48: 'sandwich', 49: 'orange',
    50: 'broccoli', 51: 'carrot', 52: 'hot dog', 53: 'pizza', 54: 'donut',
    55: 'cake', 56: 'chair', 57: 'couch', 58: 'potted plant', 59: 'bed',
    60: 'dining table', 61: 'toilet', 62: 'tv', 63: 'laptop', 64: 'mouse',
    65: 'remote', 66: 'keyboard', 67: 'cell phone', 68: 'microwave',
    69: 'oven', 70: 'toaster', 71: 'sink', 72: 'refrigerator', 73: 'book',
    74: 'clock', 75: 'vase', 76: 'scissors', 77: 'teddy bear', 78: 'hair drier',
    79: 'toothbrush'
}

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

