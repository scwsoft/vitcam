# ============================================================================
# FILE: config/settings.py
# ============================================================================
import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    """Application configuration settings"""
    
    # Supabase Configuration
    SUPABASE_URL = os.getenv("SUPABASE_URL", "your-supabase-url")
    SUPABASE_KEY = os.getenv("SUPABASE_KEY", "your-supabase-key")
    SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "vitcam-recordings")
     # Model Configuration - Small, Meduim, Large, Edge
    MODEL_SIZE= os.getenv("MODEL_SIZE")
    MODEL_CHECKPOINT_PATH = os.getenv("MODEL_CHECKPOINT_PATH")
    WEBRTC_STUN_SERVERS = os.getenv("WEBRTC_STUN_SERVERS")
    WEBRTC_TURN_SERVER = os.getenv("WEBRTC_TURN_SERVER")
    WEBRTC_TURN_USERNAME = os.getenv("WEBRTC_TURN_USERNAME")
    WEBRTC_TURN_CREDENTIAL = os.getenv("WEBRTC_TURN_CREDENTIAL")
    # Server Configuration
    WEBSOCKET_HOST = "0.0.0.0"
    WEBSOCKET_PORT = 8765
    ANALYTICS_API_HOST = "0.0.0.0"
    ANALYTICS_API_PORT = 8766
    
    # Recording Configuration
    MAX_RECORDING_DURATION = 3600  # 300 default seconds
    MOTION_COOLDOWN = 5  # seconds
    TEMP_RECORDING_DIR = os.path.join(os.path.dirname(__file__), '..', 'temp_recordings')
    
    # Performance Configuration
    FRAME_BUFFER_SIZE = 5
    LOG_BUFFER_SIZE = 50
    LOG_FLUSH_INTERVAL = 10.0
    DETECTION_BUFFER_SIZE = 50
    DETECTION_FLUSH_INTERVAL = 30.0
    
    # Connection Configuration
    MAX_RETRIES = 5
    RETRY_DELAY = 5  # seconds
    
    # Cache Configuration
    CACHE_TTL = 300  # seconds
    SETTINGS_CHECK_INTERVAL = 60  # seconds

   
    @classmethod
    def ensure_directories(cls):
        """Ensure required directories exist"""
        os.makedirs(cls.TEMP_RECORDING_DIR, exist_ok=True)

settings = Settings()


# ============================================================================
# FILE: config/constants.py
# ============================================================================
import cv2

# COCO class names mapping for object detection
COCO_CLASS_NAMES = {
   # RFDETR COCO Dataset
    # 1: "person",
    # 2: "bicycle",
    # 3: "car",
    # 4: "motorcycle",
    # 5: "airplane",
    # 6: "bus",
    # 7: "train",
    # 8: "truck",
    # 9: "boat",
    # 10: "traffic light",
    # 11: "fire hydrant",
    # 13: "stop sign",
    # 14: "parking meter",
    # 15: "bench",
    # 16: "bird",
    # 17: "cat",
    # 18: "dog",
    # 19: "horse",
    # 20: "sheep",
    # 21: "cow",
    # 22: "elephant",
    # 23: "bear",
    # 24: "zebra",
    # 25: "giraffe",
    # 27: "backpack",
    # 28: "umbrella",
    # 31: "handbag",
    # 32: "tie",
    # 33: "suitcase",
    # 34: "frisbee",
    # 35: "skis",
    # 36: "snowboard",
    # 37: "sports ball",
    # 38: "kite",
    # 39: "baseball bat",
    # 40: "baseball glove",
    # 41: "skateboard",
    # 42: "surfboard",
    # 43: "tennis racket",
    # 44: "bottle",
    # 46: "wine glass",
    # 47: "cup",
    # 48: "fork",
    # 49: "knife",
    # 50: "spoon",
    # 51: "bowl",
    # 52: "banana",
    # 53: "apple",
    # 54: "sandwich",
    # 55: "orange",
    # 56: "broccoli",
    # 57: "carrot",
    # 58: "hot dog",
    # 59: "pizza",
    # 60: "donut",
    # 61: "cake",
    # 62: "chair",
    # 63: "couch",
    # 64: "potted plant",
    # 65: "bed",
    # 67: "dining table",
    # 70: "toilet",
    # 72: "tv",
    # 73: "laptop",
    # 74: "mouse",
    # 75: "remote",
    # 76: "keyboard",
    # 77: "cell phone",
    # 78: "microwave",
    # 79: "oven",
    # 80: "toaster",
    # 81: "sink",
    # 82: "refrigerator",
    # 84: "book",
    # 85: "clock",
    # 86: "vase",
    # 87: "scissors",
    # 88: "teddy bear",
    # 89: "hair drier",
    # 90: "toothbrush"

    # YOLO Coco Dataset
    # 0: "person",
    # 1: "bicycle",
    # 2: "car",
    # 3: "motorcycle",
    # 4: "airplane",
    # 5: "bus",
    # 6: "train",
    # 7: "truck",
    # 8: "boat",
    # 9: "traffic light",
    # 10: "fire hydrant",
    # 11: "stop sign",
    # 12: "parking meter",
    # 13: "bench",
    # 14: "bird",
    # 15: "cat",
    # 16: "dog",
    # 17: "horse",
    # 18: "sheep",
    # 19: "cow",
    # 20: "elephant",
    # 21: "bear",
    # 22: "zebra",
    # 23: "giraffe",
    # 24: "backpack",
    # 25: "umbrella",
    # 26: "handbag",
    # 27: "tie",
    # 28: "suitcase",
    # 29: "frisbee",
    # 30: "skis",
    # 31: "snowboard",
    # 32: "sports ball",
    # 33: "kite",
    # 34: "baseball bat",
    # 35: "baseball glove",
    # 36: "skateboard",
    # 37: "surfboard",
    # 38: "tennis racket",
    # 39: "bottle",
    # 40: "wine glass",
    # 41: "cup",
    # 42: "fork",
    # 43: "knife",
    # 44: "spoon",
    # 45: "bowl",
    # 46: "banana",
    # 47: "apple",
    # 48: "sandwich",
    # 49: "orange",
    # 50: "broccoli",
    # 51: "carrot",
    # 52: "hot dog",
    # 53: "pizza",
    # 54: "donut",
    # 55: "cake",
    # 56: "chair",
    # 57: "couch",
    # 58: "potted plant",
    # 59: "bed",
    # 60: "dining table",
    # 61: "toilet",
    # 62: "tv",
    # 63: "laptop",
    # 64: "mouse",
    # 65: "remote",
    # 66: "keyboard",
    # 67: "cell phone",
    # 68: "microwave",
    # 69: "oven",
    # 70: "toaster",
    # 71: "sink",
    # 72: "refrigerator",
    # 73: "book",
    # 74: "clock",
    # 75: "vase",
    # 76: "scissors",
    # 77: "teddy bear",
    # 78: "hair drier",
    # 79: "toothbrush"
    
    # 0: "Normal Vehicle",
    # 1: "Vehicular Accident",
    # 2: "Bicycle",
    # 3: "Bus",
    # 4: "Car",
    # 5: "Motorcycle",
    # 6: "Cars",
    # 7: "Truck",
    # 8: "Cars",
    # 9: "Mini Bus",
    # 10: "Mobil",
    # 11: "Mobil Box",
    # 12: "Mobil Pickup",
    # 13: "Mobil Van",
    # 14: "Motobike",
    # 15: "Motorbike",
    # 16: "Motorbike",
    # 17: "Truck"
    1:"Accident",
    2:"Bicycle",
    3:"Bus",
    4:"Car",
    5:"License Plate",
    6:"Motorcycle",
    7:"Non Accident",
    8:"Truck",
    9:"With Helmet",
    10:"Without Helmet"
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

