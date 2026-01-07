# ============================================================================
# FILE: core/bitrate.py
# ============================================================================
from typing import Optional, Dict, Any
from config.constants import (
    RESOLUTION_CODEC_BITRATE_MAP,
    DEFAULT_CODEC_BITRATES
)


class BitrateManager:
    """Enhanced BitrateManager with resolution and codec-aware bitrate selection"""
    
    @staticmethod
    def get_bitrate_for_resolution_and_codec(width: int, height: int, codec: str) -> int:
        """
        Get optimal bitrate based on resolution and codec type
        
        Args:
            width: Video width
            height: Video height
            codec: Codec name (VP9, VP8, H264, MJPG)
            
        Returns:
            Bitrate in bits per second
        """
        # Normalize codec name
        codec = codec.upper()
        if codec not in ['VP9', 'VP8', 'H264', 'MJPG']:
            codec = 'VP9'  # Default to VP9
        
        # Try exact resolution match first
        resolution_key = (width, height)
        if resolution_key in RESOLUTION_CODEC_BITRATE_MAP:
            codec_bitrates = RESOLUTION_CODEC_BITRATE_MAP[resolution_key]
            if codec in codec_bitrates:
                return codec_bitrates[codec]
        
        # Try to find closest resolution match
        closest_bitrate = BitrateManager._find_closest_resolution_bitrate(width, height, codec)
        if closest_bitrate:
            return closest_bitrate
        
        # Fall back to default codec bitrate
        return DEFAULT_CODEC_BITRATES.get(codec, 2_000_000)
    
    @staticmethod
    def _find_closest_resolution_bitrate(width: int, height: int, codec: str) -> Optional[int]:
        """Find bitrate for closest matching resolution"""
        target_pixels = width * height
        closest_resolution = None
        min_diff = float('inf')
        
        for (res_width, res_height), bitrates in RESOLUTION_CODEC_BITRATE_MAP.items():
            res_pixels = res_width * res_height
            diff = abs(target_pixels - res_pixels)
            
            if diff < min_diff:
                min_diff = diff
                closest_resolution = (res_width, res_height)
        
        if closest_resolution and codec in RESOLUTION_CODEC_BITRATE_MAP[closest_resolution]:
            # Scale bitrate proportionally based on pixel difference
            base_bitrate = RESOLUTION_CODEC_BITRATE_MAP[closest_resolution][codec]
            closest_pixels = closest_resolution[0] * closest_resolution[1]
            
            # Scale bitrate: bitrate * (target_pixels / closest_pixels)
            scaled_bitrate = int(base_bitrate * (target_pixels / closest_pixels))
            
            # Clamp to reasonable range (100kbps to 20Mbps)
            scaled_bitrate = max(100_000, min(scaled_bitrate, 20_000_000))
            
            return scaled_bitrate
        
        return None
    
    @staticmethod
    def get_bitrate_config(width: int, height: int, codec: str, fps: int = 30) -> Dict[str, Any]:
        """
        Get complete bitrate configuration for camera settings
        
        Args:
            width: Video width
            height: Video height
            codec: Codec name
            fps: Frames per second
            
        Returns:
            Dictionary with bitrate configuration
        """
        max_bitrate = BitrateManager.get_bitrate_for_resolution_and_codec(width, height, codec)
        
        # Calculate CRF value based on bitrate
        if max_bitrate >= 4_000_000:  # >= 4 Mbps
            crf = 23
        elif max_bitrate >= 2_000_000:  # >= 2 Mbps
            crf = 28
        elif max_bitrate >= 1_000_000:  # >= 1 Mbps
            crf = 30
        else:  # < 1 Mbps
            crf = 33
        
        return {
            "max_bitrate": max_bitrate,
            "resolution": (width, height),
            "fps": fps,
            "crf": crf,
            "codec": codec
        }
    
    @staticmethod
    def modify_sdp_for_bitrate(sdp: str, max_bitrate: int) -> str:
        """
        Modify SDP to include bitrate constraints
        
        Args:
            sdp: Original SDP string
            max_bitrate: Maximum bitrate in bps
            
        Returns:
            Modified SDP string
        """
        lines = sdp.split('\r\n')
        modified_lines = []
        
        for line in lines:
            modified_lines.append(line)
            
            # Add bitrate constraints after video media line
            if line.startswith('m=video'):
                bitrate_kbps = max_bitrate // 1000
                
                # AS (Application Specific) - maximum bandwidth
                modified_lines.append(f'b=AS:{bitrate_kbps}')
                
                # CT (Conference Total) - total bandwidth
                modified_lines.append(f'b=CT:{bitrate_kbps}')
                
                # TIAS (Transport Independent Application Specific) - more precise
                modified_lines.append(f'b=TIAS:{max_bitrate}')
        
        return '\r\n'.join(modified_lines)
    
    @staticmethod
    def get_recommended_fps(width: int, height: int, codec: str) -> int:
        """Get recommended FPS based on resolution and codec"""
        pixels = width * height
        
        if pixels >= 1920 * 1080:  # 1080p
            return 30
        elif pixels >= 1280 * 720:  # 720p
            return 30
        elif pixels >= 640 * 480:   # VGA
            return 30
        else:  # Lower resolutions
            return 15
