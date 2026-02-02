# ============================================================================
# FILE: streaming/video_track.py
# ============================================================================
import asyncio
import logging
import time
import cv2
import numpy as np
import os
import tempfile
from datetime import datetime
from collections import deque
from typing import Optional
from aiortc import VideoStreamTrack
from av import VideoFrame
import fractions
from vidgear.gears import CamGear
from typing import Optional, Dict, List, Any, Tuple, Union
from utils.globals import get_logging_manager

from models.camera import CameraConfig, GeneralSettings
from detection.predictor import CameraPredictor
from core.datetime_formatter import DateTimeFormatter
from core.codec import safe_fourcc
from core.bitrate import BitrateManager
from streaming.connection_status import ConnectionStatus
from models.logging import LogCategory, LogSubcategory, LogContext
from config.settings import settings
import platform
import glob

logger = logging.getLogger(__name__)

# ====== LOCAL/USB CAMERA SUPPORT - NO SCHEMA CHANGES ======
# Add this code to your existing vitcam-server.py

# ====== LOCAL CAMERA DETECTION ======

class LocalCameraDetector:
    """Detect and enumerate local/USB cameras"""
    
    @staticmethod
    def detect_cameras(max_cameras: int = 10) -> List[Dict[str, any]]:
        """Detect all available local cameras"""
        available_cameras = []
        system = platform.system()
        
        if system == "Windows":
            available_cameras = LocalCameraDetector._detect_windows_cameras(max_cameras)
        elif system == "Linux":
            available_cameras = LocalCameraDetector._detect_linux_cameras()
        elif system == "Darwin":  # macOS
            available_cameras = LocalCameraDetector._detect_macos_cameras(max_cameras)
        
        return available_cameras
    
    @staticmethod
    def _detect_windows_cameras(max_cameras: int = 10) -> List[Dict[str, any]]:
        """Detect cameras on Windows"""
        cameras = []
        
        for index in range(max_cameras):
            cap = cv2.VideoCapture(index, cv2.CAP_DSHOW)
            if cap.isOpened():
                ret, frame = cap.read()
                if ret:
                    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                    fps = int(cap.get(cv2.CAP_PROP_FPS))
                    
                    cameras.append({
                        'index': index,
                        'name': f"Camera {index}",
                        'url': f"local:{index}",  # Use "local:0" format
                        'device_path': None,
                        'resolution': f"{width}x{height}",
                        'fps': fps if fps > 0 else 30,
                        'backend': 'DSHOW'
                    })
                cap.release()
        
        return cameras
    
    @staticmethod
    def _detect_linux_cameras() -> List[Dict[str, any]]:
        """Detect cameras on Linux"""
        cameras = []
        video_devices = glob.glob('/dev/video*')
        
        for device_path in video_devices:
            try:
                cap = cv2.VideoCapture(device_path)
                if cap.isOpened():
                    ret, frame = cap.read()
                    if ret:
                        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                        fps = int(cap.get(cv2.CAP_PROP_FPS))
                        
                        device_name = LocalCameraDetector._get_linux_device_name(device_path)
                        device_index = int(device_path.replace('/dev/video', ''))
                        
                        cameras.append({
                            'index': device_index,
                            'name': device_name,
                            'url': f"local:{device_path}",  # Use "local:/dev/video0" format
                            'device_path': device_path,
                            'resolution': f"{width}x{height}",
                            'fps': fps if fps > 0 else 30,
                            'backend': 'V4L2'
                        })
                    cap.release()
            except Exception as e:
                logger.warning(f"Error checking device {device_path}: {e}")
        
        return cameras
    
    @staticmethod
    def _get_linux_device_name(device_path: str) -> str:
        """Get device name on Linux using v4l2-ctl"""
        try:
            result = subprocess.run(
                ['v4l2-ctl', '--device', device_path, '--info'],
                capture_output=True,
                text=True,
                timeout=2
            )
            
            for line in result.stdout.split('\n'):
                if 'Card type' in line:
                    return line.split(':')[1].strip()
        except:
            pass
        
        return f"Camera {device_path}"
    
    @staticmethod
    def _detect_macos_cameras(max_cameras: int = 10) -> List[Dict[str, any]]:
        """Detect cameras on macOS"""
        cameras = []
        
        for index in range(max_cameras):
            cap = cv2.VideoCapture(index)
            if cap.isOpened():
                ret, frame = cap.read()
                if ret:
                    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                    fps = int(cap.get(cv2.CAP_PROP_FPS))
                    
                    cameras.append({
                        'index': index,
                        'name': f"Camera {index}",
                        'url': f"local:{index}",  # Use "local:0" format
                        'device_path': None,
                        'resolution': f"{width}x{height}",
                        'fps': fps if fps > 0 else 30,
                        'backend': 'AVFoundation'
                    })
                cap.release()
        
        return cameras


# ====== CAMERA TYPE DETECTION ======

class CameraTypeDetector:
    """Detect camera type from URL without schema changes"""
    
    @staticmethod
    def get_camera_type(url: str) -> str:
        """
        Determine camera type from URL:
        - "rtsp://" or "rtmp://" → RTSP camera
        - "local:0" or "local:/dev/video0" → Local camera
        - "0", "1", "2", etc. → Local camera (device index)
        - "/dev/video0" → Local camera (device path)
        """
        if not url:
            return "rtsp"
        
        url_lower = url.lower()
        
        # Check for YouTube URLs
        if CameraTypeDetector.is_youtube_url(url):
            return "youtube"
        
        # Check for RTSP/RTMP
        if url_lower.startswith('rtsp://') or url_lower.startswith('rtmp://'):
            return "rtsp"
        
        # Check for local camera prefix
        if url_lower.startswith('local:'):
            return "local"
        
        # Check if it's a device path
        if url.startswith('/dev/video'):
            return "local"
        
        # Check if it's a numeric device index
        try:
            int(url)
            return "local"
        except ValueError:
            pass
        
        # Default to RTSP
        return "rtsp"
    
    @staticmethod
    def is_youtube_url(url: str) -> bool:
        """
        Check if URL is a YouTube URL
        Supports various YouTube URL formats:
        - https://www.youtube.com/watch?v=VIDEO_ID
        - https://youtu.be/VIDEO_ID
        - https://youtube.com/watch?v=VIDEO_ID
        - https://m.youtube.com/watch?v=VIDEO_ID
        - https://www.youtube.com/embed/VIDEO_ID
        - https://www.youtube.com/v/VIDEO_ID
        """
        if not url:
            return False
        
        url_lower = url.lower()
        youtube_patterns = [
            'youtube.com/watch',
            'youtube.com/embed',
            'youtube.com/v/',
            'youtu.be/',
            'm.youtube.com',
            'www.youtube.com'
        ]
        
        return any(pattern in url_lower for pattern in youtube_patterns)
    
    @staticmethod
    def parse_camera_source(url: str) -> Union[int, str]:
        """
        Parse camera source from URL:
        - "local:0" → 0
        - "local:/dev/video0" → "/dev/video0"
        - "0" → 0
        - "/dev/video0" → "/dev/video0"
        - "rtsp://..." → "rtsp://..."
        """
        # Check for YouTube URLs - return as-is
        if CameraTypeDetector.is_youtube_url(url):
            return url
        
        if not url:
            return url
        
        # Remove "local:" prefix if present
        if url.lower().startswith('local:'):
            source = url[6:]  # Remove "local:" prefix
        else:
            source = url
        
        # Try to convert to int (device index)
        try:
            return int(source)
        except ValueError:
            return source


# ====== ENHANCED CUSTOM VIDEO STREAM TRACK ======

class EnhancedCustomVideoStreamTrack(VideoStreamTrack):
    """Enhanced video stream track with local/USB camera support"""
    
    def __init__(self, camera_config: CameraConfig, predictor: CameraPredictor, 
                 bitrate_config=None, recording_manager=None, db_manager=None):
        super().__init__()
        self.camera_config = camera_config
        self.predictor = predictor
        self.recording_manager = recording_manager
        self.db_manager = db_manager
        self.frame_count = 0
        self.frame_buffer = asyncio.Queue(maxsize=5)
        self.running = True
        self.connection_status = ConnectionStatus()
        
        # Detect camera type from URL
        self.camera_type = CameraTypeDetector.get_camera_type(camera_config.url)
        self.camera_source = CameraTypeDetector.parse_camera_source(camera_config.url)
        
        # DateTime overlay settings
        self.general_settings: Optional[GeneralSettings] = None
        self.settings_last_check = 0
        self.settings_check_interval = 60
        
        # Add logging manager reference
        self.logging_manager = get_logging_manager()
        
        # Performance tracking
        self.performance_tracker = {
            'frames_processed': 0,
            'frames_dropped': 0,
            'last_fps_log': time.time(),
            'fps_log_interval': 30.0
        }
        
        # Recording attributes
        self.video_writer = None
        self.recording_active = False
        self.recording_start_time = None
        self.motion_detected = False
        self.motion_start_time = None
        self.first_frame = None
        self.current_object_key = None
        self.current_codec_info = None
        self.temp_recording_path = None
        self.last_motion_frame = None
        
        # Motion detection parameters
        self.sensitivity = 20
        self.area_threshold = 5000
        self.motion_history = deque(maxlen=30)
        self.background_subtractor = cv2.createBackgroundSubtractorMOG2(detectShadows=True)
        
        # Recording configuration
        self.max_recording_duration = 300
        self.motion_cooldown = 5
        self.last_motion_recording_end = 0
        
        # Dynamic bitrate configuration
        width, height = self.camera_config.resolution_tuple
        codec = self.camera_config.normalized_encoder
        fps = self.camera_config.fps or 30
        
        if bitrate_config:
            self.bitrate_config = bitrate_config
        else:
            self.bitrate_config = BitrateManager.get_bitrate_config(width, height, codec, fps)
        
        self.target_resolution = self.bitrate_config["resolution"]
        self.target_fps = self.bitrate_config["fps"]
        self.max_bitrate = self.bitrate_config["max_bitrate"]
        
        # Log bitrate configuration
        if self.logging_manager:
            asyncio.create_task(self.logging_manager.log_info(
                f"Camera type: {self.camera_type}, Source: {self.camera_source}",
                category=LogCategory.CAMERA,
                context=LogContext(
                    camera_name=camera_config.name,
                    additional_data={
                        'camera_type': self.camera_type,
                        'camera_source': str(self.camera_source),
                        'resolution': f"{width}x{height}",
                        'codec': codec,
                        'bitrate_mbps': round(self.max_bitrate / 1_000_000, 2),
                        'fps': fps
                    }
                )
            ))
        
        # Configure camera
        self.configure_camera()
        
        # Start background task to read frames
        asyncio.create_task(self._read_frames())
    
    def configure_camera(self):
        """Enhanced camera configuration for RTSP and local/USB cameras"""
        self.cap = None
        
        if self.logging_manager:
            asyncio.create_task(self.logging_manager.log_info(
                f"Configuring camera: {self.camera_config.name} (type: {self.camera_type})",
                category=LogCategory.CAMERA,
                subcategory=LogSubcategory.CAMERA_CONNECTION,
                context=LogContext(
                    camera_id=self.camera_config.id,
                    camera_name=self.camera_config.name,
                    camera_url=self.camera_config.url
                )
            ))
        
        try:
            fourcc, container, codec_name = safe_fourcc(
                self.camera_config.encoder,
                self.target_resolution[0],
                self.target_resolution[1],
                self.target_fps,
                'webm',
                self.camera_config.url,
                prefer_webm=True
            )
            
            # Configure based on camera type
            if self.camera_type == "local":
                self._configure_local_camera(fourcc)
            elif self.camera_type == "youtube":
                self._configure_youtube_camera(fourcc)
            else:
                self._configure_rtsp_camera(fourcc)
            
        except Exception as e:
            self.connection_status.mark_failed()
            
            if self.logging_manager:
                asyncio.create_task(self.logging_manager.log_error(
                    f"Camera configuration error: {self.camera_config.name} - {e}",
                    category=LogCategory.CAMERA,
                    subcategory=LogSubcategory.CAMERA_CONNECTION,
                    context=LogContext(
                        camera_id=self.camera_config.id,
                        camera_name=self.camera_config.name,
                        camera_url=self.camera_config.url
                    ),
                    error=e
                ))
            
            if hasattr(self, 'cap') and self.cap:
                try:
                    if hasattr(self.cap, 'stop'):
                        self.cap.stop()
                    else:
                        self.cap.release()
                except:
                    pass
                self.cap = None
    
    def _configure_local_camera(self, fourcc):
        """Configure local/USB camera"""
        logger.info(f"Configuring local camera: {self.camera_source}")

        # Parse the camera source (remove "local:" prefix)
        if isinstance(self.camera_source, str) and self.camera_source.startswith("local:"):
            camera_id = self.camera_source.replace("local:", "", 1)
            
            # Try to convert to int (for local:0, local:1, etc.)
            try:
                camera_id = int(camera_id)
            except ValueError:
                # It's a path like /dev/video0, keep as string
                pass
        else:
            camera_id = self.camera_source
        
        logger.info(f"Using camera ID: {camera_id}")
            
        # Use cv2.VideoCapture for local cameras with appropriate backend
        if platform.system() == "Windows":
            self.cap = cv2.VideoCapture(0)
        elif platform.system() == "Linux":
            self.cap = cv2.VideoCapture(0)
        else:  # macOS
            self.cap = cv2.VideoCapture(0)
        
        if not self.cap.isOpened():
            raise Exception(f"Failed to open local camera: {self.camera_source}")
        
        # Set camera properties
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.target_resolution[0])
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.target_resolution[1])
        self.cap.set(cv2.CAP_PROP_FPS, self.target_fps)
        self.cap.set(cv2.CAP_PROP_FOURCC, fourcc)
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        import time
        time.sleep(0.5)
        
        # Clear the buffer by reading a few frames
        for i in range(5):
            self.cap.grab()
        
        # Test frame capture with multiple attempts
        max_attempts = 5
        ret = False
        frame = None
        
        for attempt in range(max_attempts):
            ret, frame = self.cap.read()
            if ret and frame is not None:
                logger.info(f"Successfully read frame on attempt {attempt + 1}")
                break
            logger.warning(f"Attempt {attempt + 1}/{max_attempts} failed to read frame")
            time.sleep(0.2)
        
        if not ret or frame is None:
            # Get more diagnostic info
            width = self.cap.get(cv2.CAP_PROP_FRAME_WIDTH)
            height = self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
            fps = self.cap.get(cv2.CAP_PROP_FPS)
            logger.error(f"Camera properties: {width}x{height} @ {fps}fps")
            
            self.connection_status.mark_failed()
            self.cap.release()
            self.cap = None
            raise Exception(f"Failed to read frame from local camera {camera_id} after {max_attempts} attempts")
        
        self.connection_status.reset()
        
        actual_width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        actual_height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        actual_fps = int(self.cap.get(cv2.CAP_PROP_FPS))
        
        logger.info(f"Local camera configured successfully: {actual_width}x{actual_height} @ {actual_fps}fps")
        logger.info(f"Frame shape: {frame.shape}")
        
        if self.logging_manager:
            asyncio.create_task(self.logging_manager.log_camera_status(
                camera_config=self.camera_config,
                status='CONNECTED',
                fps_target=self.target_fps,
                resolution_actual=f"{actual_width}x{actual_height}",
                resolution_target=f"{self.target_resolution[0]}x{self.target_resolution[1]}",
                codec_used=self.camera_config.normalized_encoder,
                container_format='webm',
                bitrate_kbps=self.max_bitrate // 1000
            ))
            
            # Start recording if configured
            if self.camera_config.is_continuous_recording:
                self._start_recording("continuous")
    
    def _configure_youtube_camera(self, fourcc):
        """Configure YouTube camera"""
        logger.info(f"Configuring YouTube stream: {self.camera_config.url}")
        
        # YouTube-specific configuration
        options = {
            "STREAM_RESOLUTION": f"{self.target_resolution[1]}p",  # e.g., "720p", "1080p"
            "STREAM_PARAMS": {
                "nocheckcertificate": True,
                "format": "best",  # Get best quality available
            }
        }
        
        if self.logging_manager:
            asyncio.create_task(self.logging_manager.log_info(
                f"Initializing YouTube stream with resolution: {self.target_resolution[1]}p",
                category=LogCategory.CAMERA,
                subcategory=LogSubcategory.CAMERA_CONNECTION,
                context=LogContext(
                    camera_id=self.camera_config.id,
                    camera_name=self.camera_config.name,
                    camera_url=self.camera_config.url
                )
            ))
        
        # Initialize CamGear with YouTube URL
        # CamGear will automatically use yt-dlp to extract stream URL
        self.cap = CamGear(
            source=self.camera_config.url,
            stream_mode=True,  # Enable YouTube stream mode
            logging=True,
            **options
        )
        self.cap.start()
        
        frame = self.cap.read()
        if frame is None:
            self.connection_status.mark_failed()
            if self.cap:
                self.cap.stop()
                self.cap = None
            raise Exception("No frame received from YouTube stream")
        
        self.connection_status.reset()
        
        if self.logging_manager:
            asyncio.create_task(self.logging_manager.log_camera_status(
                camera_config=self.camera_config,
                status='CONNECTED',
                fps_target=self.target_fps,
                resolution_actual=f"{frame.shape[1]}x{frame.shape[0]}",
                resolution_target=f"{self.target_resolution[0]}x{self.target_resolution[1]}",
                codec_used=self.camera_config.normalized_encoder,
                container_format='webm',
                bitrate_kbps=self.max_bitrate // 1000
            ))
        
        if self.camera_config.is_continuous_recording:
            self._start_recording("continuous")
    
    def _configure_rtsp_camera(self, fourcc):
        """Configure RTSP camera (existing implementation)"""
        options = {
            "CAP_PROP_FRAME_WIDTH": self.target_resolution[0], 
            "CAP_PROP_FRAME_HEIGHT": self.target_resolution[1], 
            "CAP_PROP_FPS": self.target_fps,
            "CAP_PROP_BUFFERSIZE": 2,
            "CAP_PROP_FOURCC": fourcc,
        }
        
        self.cap = CamGear(source=self.camera_config.url, **options)
        self.cap.start()
        
        frame = self.cap.read()
        if frame is None:
            self.connection_status.mark_failed()
            if self.cap:
                self.cap.stop()
                self.cap = None
            raise Exception("No frame received from RTSP camera")
        
        self.connection_status.reset()
        
        if self.logging_manager:
            asyncio.create_task(self.logging_manager.log_camera_status(
                camera_config=self.camera_config,
                status='CONNECTED',
                fps_target=self.target_fps,
                resolution_actual=f"{frame.shape[1]}x{frame.shape[0]}",
                resolution_target=f"{self.target_resolution[0]}x{self.target_resolution[1]}",
                codec_used=self.camera_config.normalized_encoder,
                container_format='webm',
                bitrate_kbps=self.max_bitrate // 1000
            ))
        
        if self.camera_config.is_continuous_recording:
            self._start_recording("continuous")
    
    async def _check_general_settings(self):
        current_time = time.time()
        
        if (not self.general_settings or 
            current_time - self.settings_last_check >= self.settings_check_interval):
            
            if self.db_manager:
                try:
                    self.general_settings = await self.db_manager.get_general_settings()
                    self.settings_last_check = current_time
                except Exception as e:
                    pass
    
    def _add_datetime_overlay(self, frame: np.ndarray) -> np.ndarray:
        try:
            if not self.general_settings or not self.general_settings.datetime_enabled:
                return frame
            
            current_time = datetime.now()
            datetime_text = DateTimeFormatter.format_datetime(
                current_time, 
                self.general_settings.datetime_format
            )
            
            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = 0.6
            font_thickness = 2
            font_color = (255, 255, 255)
            background_color = (0, 0, 0)
            
            (text_width, text_height), baseline = cv2.getTextSize(
                datetime_text, font, font_scale, font_thickness
            )
            
            frame_height, frame_width = frame.shape[:2]
            margin = 10
            x = frame_width - text_width - margin
            y = margin + text_height
            
            cv2.rectangle(
                frame,
                (x - 5, y - text_height - 5),
                (x + text_width + 5, y + baseline + 5),
                background_color,
                -1
            )
            
            cv2.putText(
                frame,
                datetime_text,
                (x, y),
                font,
                font_scale,
                font_color,
                font_thickness,
                cv2.LINE_AA
            )
            
            return frame
            
        except Exception as e:
            return frame
    
    def _detect_motion(self, frame: np.ndarray) -> bool:
        """Detect motion in the frame using background subtraction"""
        try:
            fg_mask = self.background_subtractor.apply(frame)
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
            fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, kernel)
            fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_CLOSE, kernel)
            contours, _ = cv2.findContours(fg_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            for contour in contours:
                area = cv2.contourArea(contour)
                if area > self.area_threshold:
                    return True
            
            return False
        except Exception as e:
            return False
    
    def _start_recording(self, recording_type: str):
        """Start video recording"""
        try:
            if self.recording_active:
                return False
            
            object_key, container = self.recording_manager.get_object_key(self.camera_config, recording_type)
            temp_dir = tempfile.gettempdir()
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            temp_filename = f"recording_{self.camera_config.id}_{timestamp}.{container}"
            temp_recording_path = os.path.join(temp_dir, temp_filename)
            
            fourcc, optimal_container, codec_name = safe_fourcc(
                self.camera_config.encoder,
                self.target_resolution[0],
                self.target_resolution[1],
                self.target_fps,
                container,
                self.camera_config.url,
                prefer_webm=True
            )
            
            self.video_writer = cv2.VideoWriter(
                temp_recording_path,
                fourcc,
                self.target_fps,
                self.target_resolution
            )
            
            if not self.video_writer.isOpened():
                logger.error(f"Failed to open video writer for {self.camera_config.name}")
                return False
            
            self.recording_active = True
            self.recording_start_time = time.time()
            self.current_object_key = object_key
            self.temp_recording_path = temp_recording_path
            self.current_codec_info = {
                'codec': codec_name,
                'container': optimal_container,
                'fourcc': fourcc
            }
            
            logger.info(f"Started {recording_type} recording for {self.camera_config.name}: {object_key}")
            return True
            
        except Exception as e:
            logger.error(f"Error starting recording: {e}")
            return False
    
    def _stop_recording(self):
        """Stop video recording"""
        try:
            if not self.recording_active or not self.video_writer:
                return False
            
            self.video_writer.release()
            self.video_writer = None
            
            recording_duration = time.time() - self.recording_start_time if self.recording_start_time else 0
            logger.info(f"Stopped recording for {self.camera_config.name} after {recording_duration:.1f}s")
            
            if (self.temp_recording_path and 
                os.path.exists(self.temp_recording_path) and 
                os.path.getsize(self.temp_recording_path) > 0):
                
                asyncio.create_task(self.recording_manager.queue_upload(
                    file_path=self.temp_recording_path,
                    object_key=self.current_object_key,
                    camera_name=self.camera_config.name,
                    recording_type=self.camera_config.rectype
                ))
            
            self.recording_active = False
            self.recording_start_time = None
            self.current_object_key = None
            self.temp_recording_path = None
            self.current_codec_info = None
            
            return True
        except Exception as e:
            logger.error(f"Error stopping recording: {e}")
            return False
    
    def _write_frame_to_recording(self, frame: np.ndarray):
        """Write frame to active recording"""
        try:
            if self.recording_active and self.video_writer and self.video_writer.isOpened():
                recording_frame = cv2.resize(frame, self.target_resolution)
                self.video_writer.write(recording_frame)
                
                if self.recording_start_time:
                    duration = time.time() - self.recording_start_time
                    if duration > self.max_recording_duration:
                        self._stop_recording()
                        if self.camera_config.is_continuous_recording:
                            self._start_recording("continuous")
        except Exception as e:
            logger.error(f"Error writing frame to recording: {e}")
    
    def _handle_motion_recording(self, frame: np.ndarray, motion_detected: bool):
        """Handle motion-triggered recording"""
        try:
            current_time = time.time()
            
            if motion_detected:
                self.last_motion_frame = current_time
                if (not self.recording_active and 
                    current_time - self.last_motion_recording_end > self.motion_cooldown):
                    self._start_recording("motion")
            else:
                if (self.recording_active and 
                    self.last_motion_frame and 
                    current_time - self.last_motion_frame > self.motion_cooldown):
                    self._stop_recording()
                    self.last_motion_recording_end = current_time
        except Exception as e:
            logger.error(f"Error handling motion recording: {e}")
    
    async def _read_frames(self):
        """Enhanced frame reading for both RTSP and local cameras"""
        frame_interval = 1.0 / self.target_fps
        last_frame_time = 0
        
        while self.running:
            current_time = time.time()
            
            await self._check_general_settings()
            
            if not hasattr(self, 'cap') or self.cap is None:
                if self.connection_status.status != ConnectionStatus.RECONNECTING:
                    self.connection_status.mark_disconnected()
                
                reconnected = await self.reconnect()
                if not reconnected:
                    self.performance_tracker['frames_dropped'] += 1
                    no_signal_frame = self._create_no_signal_frame()
                    try:
                        await asyncio.wait_for(self.frame_buffer.put(no_signal_frame), timeout=0.1)
                    except asyncio.TimeoutError:
                        pass
                    await asyncio.sleep(1)
                    continue
            
            if current_time - last_frame_time < frame_interval:
                await asyncio.sleep(0.01)
                continue
            
            try:
                # Read frame based on camera type
                if self.camera_type == "local":
                    ret, frame = self.cap.read()
                    if not ret or frame is None:
                        self.performance_tracker['frames_dropped'] += 1
                        self.connection_status.mark_disconnected()
                        self.cap = None
                        continue
                else:
                    frame = self.cap.read()
                    if frame is None:
                        self.performance_tracker['frames_dropped'] += 1
                        self.connection_status.mark_disconnected()
                        self.cap = None
                        continue
                
                self.performance_tracker['frames_processed'] += 1
                self.frame_count += 1
                self.last_frame = frame.copy()
                
                display_frame = cv2.resize(frame, self.target_resolution)
                display_frame = self._add_datetime_overlay(display_frame)
                
                # Motion detection
                motion_detected = False
                if self.camera_config.is_motion_recording:
                    motion_detected = self._detect_motion(frame)
                    self._handle_motion_recording(frame, motion_detected)
                
                # Recording
                if self.recording_active:
                    self._write_frame_to_recording(display_frame)
                
                # Object detection
                if self.camera_config.is_detection and self.predictor:
                    try:
                        display_frame = self.predictor.predict_frame(display_frame)
                    except Exception as e:
                        if self.logging_manager:
                            await self.logging_manager.log_error(
                                f"Object detection error: {e}",
                                category=LogCategory.DETECTION,
                                context=LogContext(
                                    camera_id=self.camera_config.id,
                                    camera_name=self.camera_config.name
                                ),
                                error=e
                            )
                
                try:
                    await asyncio.wait_for(self.frame_buffer.put(display_frame.copy()), timeout=0.1)
                    last_frame_time = current_time
                except asyncio.TimeoutError:
                    pass
                    
            except Exception as e:
                self.performance_tracker['frames_dropped'] += 1
                self.connection_status.mark_disconnected()
                
                if self.logging_manager:
                    await self.logging_manager.log_error(
                        f"Frame processing error: {e}",
                        category=LogCategory.CAMERA,
                        context=LogContext(
                            camera_id=self.camera_config.id,
                            camera_name=self.camera_config.name
                        ),
                        error=e
                    )
                
                if hasattr(self, 'cap') and self.cap:
                    try:
                        if hasattr(self.cap, 'stop'):
                            self.cap.stop()
                        else:
                            self.cap.release()
                    except:
                        pass
                    self.cap = None
            
            await asyncio.sleep(0.01)
    
    async def reconnect(self):
        if not self.connection_status.can_retry():
            if self.connection_status.retry_count >= self.connection_status.max_retries:
                self.connection_status.mark_failed()
            return False
        
        self.connection_status.mark_retry()
        
        if hasattr(self, 'cap') and self.cap is not None:
            try:
                if hasattr(self.cap, 'stop'):
                    self.cap.stop()
                else:
                    self.cap.release()
            except:
                pass
            self.cap = None
        
        self.configure_camera()
        success = hasattr(self, 'cap') and self.cap is not None
        return success
    
    def _create_no_signal_frame(self):
        frame = np.zeros((self.target_resolution[1], self.target_resolution[0], 3), dtype=np.uint8)
        cv2.putText(frame, "No Signal", (self.target_resolution[0]//4, self.target_resolution[1]//2), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
        cv2.putText(frame, f"Camera: {self.camera_config.name}", 
                    (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        return frame
    
    def update_camera_config(self, camera_config: CameraConfig):
        old_rectype = self.camera_config.rectype if hasattr(self.camera_config, 'rectype') else None
        self.camera_config = camera_config
        
        if self.predictor:
            self.predictor.update_config(camera_config)
        
        if old_rectype != camera_config.rectype:
            if self.recording_active:
                self._stop_recording()
            if camera_config.is_continuous_recording:
                self._start_recording("continuous")
    
    async def recv(self):
        self.frame_count += 1
        
        try:
            frame = await asyncio.wait_for(self.frame_buffer.get(), timeout=1.0)
            video_frame = VideoFrame.from_ndarray(frame, format="bgr24")
            video_frame.pts = self.frame_count
            video_frame.time_base = fractions.Fraction(1, self.target_fps)
            return video_frame
        except (asyncio.TimeoutError, asyncio.CancelledError):
            black_frame = self._create_no_signal_frame()
            video_frame = VideoFrame.from_ndarray(black_frame, format="bgr24")
            video_frame.pts = self.frame_count
            video_frame.time_base = fractions.Fraction(1, self.target_fps)
            return video_frame
    
    def stop(self):
        self.running = False
        
        if self.recording_active:
            self._stop_recording()
        
        if hasattr(self, 'cap') and self.cap:
            try:
                if hasattr(self.cap, 'stop'):
                    self.cap.stop()
                else:
                    self.cap.release()
            except Exception:
                pass
            finally:
                self.cap = None

class CustomVideoStreamTrack(VideoStreamTrack):
    """Custom video stream track with object detection, recording, and dynamic bitrate"""
    
    def __init__(self, camera_config: CameraConfig, predictor: CameraPredictor, 
                 bitrate_config=None, recording_manager=None, db_manager=None):
        """
        Initialize video stream track
        
        Args:
            camera_config: Camera configuration
            predictor: Object detection predictor
            bitrate_config: Bitrate configuration
            recording_manager: Recording manager instance
            db_manager: Database manager instance
        """
        super().__init__()
        self.camera_config = camera_config
        self.predictor = predictor
        self.recording_manager = recording_manager
        self.db_manager = db_manager
        self.frame_count = 0
        self.frame_buffer = asyncio.Queue(maxsize=settings.FRAME_BUFFER_SIZE)
        self.running = True
        self.connection_status = ConnectionStatus(settings.MAX_RETRIES, settings.RETRY_DELAY)
        
        # DateTime overlay settings
        self.general_settings: Optional[GeneralSettings] = None
        self.settings_last_check = 0
        self.settings_check_interval = settings.SETTINGS_CHECK_INTERVAL
        
        # Get logging manager from utils
        from utils.globals import get_logging_manager
        self.logging_manager = get_logging_manager()
        
        # Performance tracking
        self.performance_tracker = {
            'frames_processed': 0,
            'frames_dropped': 0,
            'last_fps_log': time.time(),
            'fps_log_interval': 30.0
        }
        
        # Recording attributes
        self.video_writer = None
        self.recording_active = False
        self.recording_start_time = None
        self.motion_detected = False
        self.motion_start_time = None
        self.first_frame = None
        self.current_object_key = None
        self.current_codec_info = None
        self.temp_recording_path = None
        self.last_motion_frame = None
        
        # Motion detection parameters
        self.sensitivity = 20
        self.area_threshold = 5000
        self.motion_history = deque(maxlen=30)
        self.background_subtractor = cv2.createBackgroundSubtractorMOG2(detectShadows=True)
        
        # Recording configuration
        self.max_recording_duration = settings.MAX_RECORDING_DURATION
        self.motion_cooldown = settings.MOTION_COOLDOWN
        self.last_motion_recording_end = 0
        
        # Dynamic bitrate configuration
        width, height = self.camera_config.resolution_tuple
        codec = self.camera_config.normalized_encoder
        fps = self.camera_config.fps or 30
        
        if bitrate_config:
            self.bitrate_config = bitrate_config
        else:
            self.bitrate_config = BitrateManager.get_bitrate_config(width, height, codec, fps)
        
        self.target_resolution = self.bitrate_config["resolution"]
        self.target_fps = self.bitrate_config["fps"]
        self.max_bitrate = self.bitrate_config["max_bitrate"]
        
        # Log bitrate configuration
        if self.logging_manager:
            asyncio.create_task(self.logging_manager.log_info(
                f"Dynamic bitrate configuration: {self.max_bitrate//1000}kbps for {width}x{height} {codec}",
                category=LogCategory.CODEC,
                context=LogContext(
                    camera_name=camera_config.name,
                    additional_data={
                        'resolution': f"{width}x{height}",
                        'codec': codec,
                        'bitrate_mbps': round(self.max_bitrate / 1_000_000, 2),
                        'fps': fps
                    }
                )
            ))
        
        # Configure camera
        self.configure_camera()
        
        # Start background task to read frames
        asyncio.create_task(self._read_frames())
    
    async def _check_general_settings(self):
        """Check and update general settings periodically"""
        current_time = time.time()
        
        if (not self.general_settings or 
            current_time - self.settings_last_check >= self.settings_check_interval):
            
            if self.db_manager:
                try:
                    self.general_settings = await self.db_manager.get_general_settings()
                    self.settings_last_check = current_time
                except Exception:
                    pass
    
    def _add_datetime_overlay(self, frame: np.ndarray) -> np.ndarray:
        """Add datetime overlay to frame"""
        try:
            if not self.general_settings or not self.general_settings.datetime_enabled:
                return frame
            
            current_time = datetime.now()
            datetime_text = DateTimeFormatter.format_datetime(
                current_time, 
                self.general_settings.datetime_format
            )
            
            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = 0.6
            font_thickness = 2
            font_color = (255, 255, 255)
            background_color = (0, 0, 0)
            
            (text_width, text_height), baseline = cv2.getTextSize(
                datetime_text, font, font_scale, font_thickness
            )
            
            frame_height, frame_width = frame.shape[:2]
            margin = 10
            x = frame_width - text_width - margin
            y = margin + text_height
            
            cv2.rectangle(
                frame,
                (x - 5, y - text_height - 5),
                (x + text_width + 5, y + baseline + 5),
                background_color,
                -1
            )
            
            cv2.putText(
                frame,
                datetime_text,
                (x, y),
                font,
                font_scale,
                font_color,
                font_thickness,
                cv2.LINE_AA
            )
            
            return frame
            
        except Exception:
            return frame
    
    def _detect_motion(self, frame: np.ndarray) -> bool:
        """Detect motion in the frame using background subtraction"""
        try:
            fg_mask = self.background_subtractor.apply(frame)
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
            fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, kernel)
            fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_CLOSE, kernel)
            
            contours, _ = cv2.findContours(fg_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            for contour in contours:
                area = cv2.contourArea(contour)
                if area > self.area_threshold:
                    return True
            
            return False
            
        except Exception:
            return False
    
    def _start_recording(self, recording_type: str) -> bool:
        """Start video recording"""
        try:
            if self.recording_active:
                return False
            
            object_key, container = self.recording_manager.get_object_key(
                self.camera_config, recording_type
            )
            
            temp_dir = tempfile.gettempdir()
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            temp_filename = f"recording_{self.camera_config.id}_{timestamp}.{container}"
            temp_recording_path = os.path.join(temp_dir, temp_filename)
            
            fourcc, optimal_container, codec_name = safe_fourcc(
                self.camera_config.encoder,
                self.target_resolution[0],
                self.target_resolution[1],
                self.target_fps,
                container,
                self.camera_config.url,
                prefer_webm=True
            )
            
            self.video_writer = cv2.VideoWriter(
                temp_recording_path,
                fourcc,
                self.target_fps,
                self.target_resolution
            )
            
            if not self.video_writer.isOpened():
                logger.error(f"Failed to open video writer for {self.camera_config.name}")
                return False
            
            self.recording_active = True
            self.recording_start_time = time.time()
            self.current_object_key = object_key
            self.temp_recording_path = temp_recording_path
            self.current_codec_info = {
                'codec': codec_name,
                'container': optimal_container,
                'fourcc': fourcc
            }
            
            logger.info(f"Started {recording_type} recording for {self.camera_config.name}: {object_key}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error starting recording: {e}")
            return False
    
    def _stop_recording(self) -> bool:
        """Stop video recording"""
        try:
            if not self.recording_active or not self.video_writer:
                return False
            
            self.video_writer.release()
            self.video_writer = None
            
            recording_duration = time.time() - self.recording_start_time if self.recording_start_time else 0
            
            logger.info(f"Stopped recording for {self.camera_config.name} after {recording_duration:.1f}s")
            
            if (self.temp_recording_path and 
                os.path.exists(self.temp_recording_path) and 
                os.path.getsize(self.temp_recording_path) > 0):
                
                asyncio.create_task(self.recording_manager.queue_upload(
                    file_path=self.temp_recording_path,
                    object_key=self.current_object_key,
                    camera_name=self.camera_config.name,
                    recording_type=self.camera_config.rectype
                ))
            
            self.recording_active = False
            self.recording_start_time = None
            self.current_object_key = None
            self.temp_recording_path = None
            self.current_codec_info = None
            
            return True
            
        except Exception as e:
            logger.error(f"Error stopping recording: {e}")
            self.recording_active = False
            return False
    
    def _write_frame_to_recording(self, frame: np.ndarray):
        """Write frame to active recording"""
        try:
            if self.recording_active and self.video_writer and self.video_writer.isOpened():
                recording_frame = cv2.resize(frame, self.target_resolution)
                self.video_writer.write(recording_frame)
                
                if self.recording_start_time:
                    duration = time.time() - self.recording_start_time
                    if duration > self.max_recording_duration:
                        logger.info(f"Maximum recording duration reached")
                        self._stop_recording()
                        
                        if self.camera_config.is_continuous_recording:
                            self._start_recording("continuous")
                            
        except Exception as e:
            logger.error(f"Error writing frame: {e}")
    
    def _handle_motion_recording(self, frame: np.ndarray, motion_detected: bool):
        """Handle motion-triggered recording logic"""
        try:
            current_time = time.time()
            
            if motion_detected:
                self.last_motion_frame = current_time
                
                if (not self.recording_active and 
                    current_time - self.last_motion_recording_end > self.motion_cooldown):
                    self._start_recording("motion")
                    
            else:
                if (self.recording_active and 
                    self.last_motion_frame and 
                    current_time - self.last_motion_frame > self.motion_cooldown):
                    self._stop_recording()
                    self.last_motion_recording_end = current_time
                    
        except Exception as e:
            logger.error(f"Error handling motion recording: {e}")
    
    def configure_camera(self):
        """Configure camera capture"""
        self.cap = None
        
        if self.logging_manager:
            asyncio.create_task(self.logging_manager.log_info(
                f"Configuring camera: {self.camera_config.name}",
                category=LogCategory.CAMERA,
                subcategory=LogSubcategory.CAMERA_CONNECTION,
                context=LogContext(
                    camera_id=self.camera_config.id,
                    camera_name=self.camera_config.name,
                    camera_url=self.camera_config.url
                )
            ))
        
        try:
            fourcc, container, codec_name = safe_fourcc(
                self.camera_config.encoder,
                self.target_resolution[0],
                self.target_resolution[1],
                self.target_fps,
                'webm',
                self.camera_config.url,
                prefer_webm=True
            )
            
            options = {
                "CAP_PROP_FRAME_WIDTH": self.target_resolution[0], 
                "CAP_PROP_FRAME_HEIGHT": self.target_resolution[1], 
                "CAP_PROP_FPS": self.target_fps,
                "CAP_PROP_BUFFERSIZE": 2,
                "CAP_PROP_FOURCC": fourcc,
            }
            
            self.cap = CamGear(source=self.camera_config.url, **options)
            self.cap.start()
            
            frame = self.cap.read()
            if frame is None:
                self.connection_status.mark_failed()
                if self.cap:
                    self.cap.stop()
                    self.cap = None
            else:
                self.connection_status.reset()
                
                if self.camera_config.is_continuous_recording:
                    self._start_recording("continuous")
                
        except Exception as e:
            self.connection_status.mark_failed()
            logger.error(f"Camera configuration error: {e}")
            
            if hasattr(self, 'cap') and self.cap:
                try:
                    self.cap.stop()
                except:
                    pass
                self.cap = None
    
    async def _read_frames(self):
        """Background task to read frames from camera"""
        frame_interval = 1.0 / self.target_fps
        last_frame_time = 0
        
        while self.running:
            current_time = time.time()
            
            await self._check_general_settings()
            
            if not hasattr(self, 'cap') or self.cap is None:
                if self.connection_status.status != ConnectionStatus.RECONNECTING:
                    self.connection_status.mark_disconnected()
                
                reconnected = await self.reconnect()
                if not reconnected:
                    self.performance_tracker['frames_dropped'] += 1
                    no_signal_frame = self._create_no_signal_frame()
                    try:
                        await asyncio.wait_for(self.frame_buffer.put(no_signal_frame), timeout=0.1)
                    except asyncio.TimeoutError:
                        pass
                    await asyncio.sleep(1)
                    continue
            
            if current_time - last_frame_time < frame_interval:
                await asyncio.sleep(0.01)
                continue
                
            try:
                frame = self.cap.read()
                if frame is None:
                    self.performance_tracker['frames_dropped'] += 1
                    self.connection_status.mark_disconnected()
                    self.cap = None
                    continue
                
                self.performance_tracker['frames_processed'] += 1
                self.frame_count += 1
                self.last_frame = frame.copy()
                
                display_frame = cv2.resize(frame, self.target_resolution)
                display_frame = self._add_datetime_overlay(display_frame)
                
                motion_detected = False
                if self.camera_config.is_motion_recording:
                    motion_detected = self._detect_motion(frame)
                    self._handle_motion_recording(frame, motion_detected)
                
                if self.recording_active:
                    self._write_frame_to_recording(display_frame)
                
                if self.camera_config.is_detection and self.predictor:
                    try:
                        display_frame = self.predictor.predict_frame(display_frame)
                    except Exception as e:
                        logger.error(f"Detection error: {e}")
                
                try:
                    await asyncio.wait_for(self.frame_buffer.put(display_frame.copy()), timeout=0.1)
                    last_frame_time = current_time
                except asyncio.TimeoutError:
                    pass
                    
            except Exception as e:
                self.performance_tracker['frames_dropped'] += 1
                self.connection_status.mark_disconnected()
                logger.error(f"Frame processing error: {e}")
                
                if hasattr(self, 'cap') and self.cap:
                    try:
                        self.cap.stop()
                    except:
                        pass
                    self.cap = None
                
            await asyncio.sleep(0.01)
    
    async def reconnect(self) -> bool:
        """Attempt to reconnect camera"""
        if not self.connection_status.can_retry():
            if self.connection_status.retry_count >= self.connection_status.max_retries:
                self.connection_status.mark_failed()
            return False
            
        self.connection_status.mark_retry()
        
        if hasattr(self, 'cap') and self.cap is not None:
            try:
                self.cap.stop()
            except:
                pass
            self.cap = None
            
        self.configure_camera()
        
        return hasattr(self, 'cap') and self.cap is not None
    
    def _create_no_signal_frame(self) -> np.ndarray:
        """Create 'no signal' frame"""
        frame = np.zeros((self.target_resolution[1], self.target_resolution[0], 3), dtype=np.uint8)
        
        # Center "No Signal" text
        text = "No Signal"
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.7
        thickness = 2
        text_size = cv2.getTextSize(text, font, font_scale, thickness)[0]
        text_x = (self.target_resolution[0] - text_size[0]) // 2
        text_y = (self.target_resolution[1] + text_size[1]) // 2
        cv2.putText(frame, text, (text_x, text_y), font, font_scale, (0, 0, 255), thickness)
        
        # Center camera name text at top
        camera_text = f"Camera: {self.camera_config.name}"
        camera_font_scale = 0.5
        camera_thickness = 1
        camera_text_size = cv2.getTextSize(camera_text, font, camera_font_scale, camera_thickness)[0]
        camera_x = (self.target_resolution[0] - camera_text_size[0]) // 2
        cv2.putText(frame, camera_text, (camera_x, 30), font, camera_font_scale, (255, 255, 255), camera_thickness)
        
        return frame
    
    def update_camera_config(self, camera_config: CameraConfig):
        """Update camera configuration"""
        old_rectype = self.camera_config.rectype if hasattr(self.camera_config, 'rectype') else None
        
        self.camera_config = camera_config
        
        if self.predictor:
            self.predictor.update_config(camera_config)
        
        if old_rectype != camera_config.rectype:
            if self.recording_active:
                self._stop_recording()
            
            if camera_config.is_continuous_recording:
                self._start_recording("continuous")
    
    async def recv(self):
        """Receive next video frame"""
        self.frame_count += 1
        
        try:
            frame = await asyncio.wait_for(self.frame_buffer.get(), timeout=1.0)
            
            video_frame = VideoFrame.from_ndarray(frame, format="bgr24")
            video_frame.pts = self.frame_count
            video_frame.time_base = fractions.Fraction(1, self.target_fps)
            
            return video_frame
            
        except (asyncio.TimeoutError, asyncio.CancelledError):
            black_frame = self._create_no_signal_frame()
            video_frame = VideoFrame.from_ndarray(black_frame, format="bgr24")
            video_frame.pts = self.frame_count
            video_frame.time_base = fractions.Fraction(1, self.target_fps)
            return video_frame
            
    def stop(self):
        """Stop video stream"""
        self.running = False
        
        if self.recording_active:
            self._stop_recording()
        
        if hasattr(self, 'cap') and self.cap:
            try:
                self.cap.stop()
            except Exception:
                pass
            finally:
                self.cap = None