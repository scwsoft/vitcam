# ============================================================================
# FILE: core/codec.py
# ============================================================================
import cv2
import numpy as np
import tempfile
import os
from typing import Optional, Dict, Tuple
from config.constants import CODEC_CONTAINER_MAP, CODEC_FALLBACK_ORDER


class CodecManager:
    """Codec management and validation system"""
    
    @classmethod
    def normalize_codec_name(cls, codec_input: str) -> Optional[str]:
        """
        Normalize codec name from various input formats
        
        Args:
            codec_input: Input codec string
            
        Returns:
            Normalized codec name or None
        """
        if not codec_input:
            return None
            
        codec_input = codec_input.strip().upper()
        
        for codec_name, config in CODEC_CONTAINER_MAP.items():
            if codec_input in [code.upper() for code in config['fourcc_codes']]:
                return codec_name
        
        return None
    
    @classmethod
    def get_codec_config(cls, codec_name: str) -> Optional[Dict]:
        """
        Get codec configuration dictionary
        
        Args:
            codec_name: Codec name
            
        Returns:
            Codec configuration or None
        """
        normalized = cls.normalize_codec_name(codec_name)
        return CODEC_CONTAINER_MAP.get(normalized) if normalized else None
    
    @classmethod
    def get_optimal_container(cls, codec_name: str, requested_container: Optional[str] = None, 
                            prefer_webm: bool = True) -> str:
        """
        Get optimal container format for codec
        
        Args:
            codec_name: Codec name
            requested_container: Requested container format
            prefer_webm: Prefer WebM format
            
        Returns:
            Container format string
        """
        config = cls.get_codec_config(codec_name)
        if not config:
            return 'webm'
        
        if prefer_webm and 'webm' in config['containers']:
            return 'webm'
        
        if requested_container:
            requested_container = requested_container.lower().lstrip('.')
            if requested_container in config['containers']:
                return requested_container
        
        return config['preferred_container']
    
    @classmethod
    def find_working_codec(cls, preferred_codec: str, width: int, height: int, fps: float, 
                         container: Optional[str] = None, camera_url: Optional[str] = None,
                         prefer_webm: bool = True) -> Tuple[str, str, int]:
        """
        Find a working codec with fallback support
        
        Args:
            preferred_codec: Preferred codec name
            width: Video width
            height: Video height
            fps: Frames per second
            container: Container format
            camera_url: Camera URL (for logging)
            prefer_webm: Prefer WebM format
            
        Returns:
            Tuple of (codec_name, container, fourcc)
        """
        normalized_preferred = cls.normalize_codec_name(preferred_codec)
        test_order = []
        
        # Add WebM-compatible codecs first if preferred
        if prefer_webm and normalized_preferred != 'VP9':
            test_order.append('VP9')
        if prefer_webm and normalized_preferred != 'VP8':
            test_order.append('VP8')
        
        # Add preferred codec
        if normalized_preferred:
            test_order.append(normalized_preferred)
        
        # Add remaining fallback codecs
        for fallback in CODEC_FALLBACK_ORDER:
            if fallback not in test_order:
                test_order.append(fallback)
        
        # Test each codec
        for codec_name in test_order:
            try:
                optimal_container = cls.get_optimal_container(codec_name, container, prefer_webm)
                
                if cls.test_codec_compatibility(codec_name, width, height, fps, optimal_container):
                    fourcc = cls.create_fourcc(codec_name)
                    return codec_name, optimal_container, fourcc
                    
            except Exception:
                continue
        
        # Final fallback
        return 'VP9', 'webm', cv2.VideoWriter_fourcc(*'VP90')
    
    @classmethod
    def create_fourcc(cls, codec_name: str) -> int:
        """
        Create FourCC code for codec
        
        Args:
            codec_name: Codec name
            
        Returns:
            FourCC integer code
        """
        config = cls.get_codec_config(codec_name)
        if config:
            return config['opencv_fourcc']
        
        # Fallback fourcc creation
        try:
            codec_name = codec_name.upper()
            if len(codec_name) == 4:
                return cv2.VideoWriter_fourcc(*list(codec_name))
            elif len(codec_name) < 4:
                padded = codec_name.ljust(4)[:4]
                return cv2.VideoWriter_fourcc(*list(padded))
            else:
                return cv2.VideoWriter_fourcc(*list(codec_name[:4]))
        except Exception:
            return cv2.VideoWriter_fourcc(*'VP90')
    
    @classmethod
    def test_codec_compatibility(cls, codec_name: str, width: int, height: int, 
                                fps: float, container: str) -> bool:
        """
        Test if codec is compatible with system
        
        Args:
            codec_name: Codec name
            width: Video width
            height: Video height
            fps: Frames per second
            container: Container format
            
        Returns:
            True if compatible, False otherwise
        """
        try:
            config = cls.get_codec_config(codec_name)
            if not config:
                return False
            
            with tempfile.NamedTemporaryFile(suffix=f'.{container}', delete=False) as tmp_file:
                test_path = tmp_file.name
            
            try:
                fourcc = config['opencv_fourcc']
                writer = cv2.VideoWriter(test_path, fourcc, fps, (width, height))
                
                if not writer.isOpened():
                    return False
                
                test_frame = np.zeros((height, width, 3), dtype=np.uint8)
                writer.write(test_frame)
                writer.release()
                
                if os.path.exists(test_path) and os.path.getsize(test_path) > 0:
                    return True
                    
            finally:
                try:
                    os.unlink(test_path)
                except:
                    pass
                    
            return False
            
        except Exception:
            return False


def safe_fourcc(encoder_string: str, width: int = 640, height: int = 480, 
                fps: int = 30, container: Optional[str] = None, 
                camera_url: Optional[str] = None, prefer_webm: bool = True) -> Tuple[int, str, str]:
    """
    Safe FourCC creation with fallback support
    
    Args:
        encoder_string: Encoder/codec string
        width: Video width
        height: Video height
        fps: Frames per second
        container: Container format
        camera_url: Camera URL
        prefer_webm: Prefer WebM format
        
    Returns:
        Tuple of (fourcc, container, codec_name)
    """
    try:
        if not encoder_string:
            encoder_string = 'VP9'
        
        codec_name, optimal_container, fourcc = CodecManager.find_working_codec(
            encoder_string, width, height, fps, container, camera_url, prefer_webm
        )
        
        return fourcc, optimal_container, codec_name
        
    except Exception:
        return cv2.VideoWriter_fourcc(*'VP90'), 'webm', 'VP9'