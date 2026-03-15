# ============================================================================
# FILE: streaming/connection.py
# ============================================================================
import asyncio
import logging
import weakref
from typing import Dict, Optional
from aiortc import RTCPeerConnection
from aiortc.rtcrtpsender import RTCRtpSender

from services.database import DatabaseManager
from detection.factory import CameraPredictorFactory
from streaming.video_track import CustomVideoStreamTrack
from streaming.video_track import EnhancedCustomVideoStreamTrack

from streaming.connection_status import ConnectionStatus
from core.bitrate import BitrateManager
from models.camera import CameraConfig
from models.logging import LogContext

logger = logging.getLogger(__name__)


def force_codec(pc: RTCPeerConnection, sender, forced_codec: str):
    """
    Force specific codec for RTP sender
    
    Args:
        pc: Peer connection
        sender: RTP sender
        forced_codec: Codec MIME type
    """
    if not forced_codec:
        return
        
    kind = forced_codec.split("/")[0]
    codecs = RTCRtpSender.getCapabilities(kind).codecs
    transceiver = next(t for t in pc.getTransceivers() if t.sender == sender)
    transceiver.setCodecPreferences(
        [codec for codec in codecs if codec.mimeType == forced_codec]
    )


class ConnectionManager:
    """WebRTC connection manager"""
    
    def __init__(self, db_manager: DatabaseManager, recording_manager=None):
        """
        Initialize connection manager
        
        Args:
            db_manager: Database manager instance
            recording_manager: Recording manager instance
        """
        self.connections = set()
        self.video_tracks = {}
        self.connection_statuses = {}
        self.db_manager = db_manager
        self.recording_manager = recording_manager
        self.predictor_cache = {}
        
    def add_connection(self, pc: RTCPeerConnection) -> RTCPeerConnection:
        """
        Add peer connection to manager
        
        Args:
            pc: Peer connection
            
        Returns:
            Peer connection
        """
        self.connections.add(pc)
        conn_id = id(pc)
        self.connection_statuses[conn_id] = ConnectionStatus()
        
        from utils.globals import get_logging_manager
        logging_manager = get_logging_manager()
        if logging_manager:
            asyncio.create_task(logging_manager.log_info(
                f"New peer connection added: {conn_id}",
                category="NETWORK",
                context=LogContext(additional_data={'connection_id': conn_id})
            ))
        
        return pc
        
    def remove_connection(self, pc: RTCPeerConnection):
        """
        Remove peer connection from manager
        
        Args:
            pc: Peer connection
        """
        if pc in self.connections:
            self.connections.remove(pc)
            conn_id = id(pc)
            if conn_id in self.connection_statuses:
                del self.connection_statuses[conn_id]
            
            from utils.globals import get_logging_manager
            logging_manager = get_logging_manager()
            if logging_manager:
                asyncio.create_task(logging_manager.log_info(
                    f"Peer connection removed: {conn_id}",
                    category="NETWORK",
                    context=LogContext(additional_data={'connection_id': conn_id})
                ))
            
    async def close_all(self):
        """Close all connections"""
        from utils.globals import get_logging_manager
        logging_manager = get_logging_manager()
        if logging_manager:
            await logging_manager.log_info(
                f"Closing all connections: {len(self.connections)}",
                category="NETWORK"
            )
        
        coros = [pc.close() for pc in self.connections]
        await asyncio.gather(*coros, return_exceptions=True)
        self.connections.clear()
        
    async def get_or_create_video_track(self, rtsp_url: str, screen_type: str = "full_screen", 
                                       motion_detection: bool = False) -> Optional[CustomVideoStreamTrack]:
        """
        Get existing or create new video track
        
        Args:
            rtsp_url: Camera RTSP URL
            screen_type: Screen type identifier
            motion_detection: Enable motion detection
            
        Returns:
            Video track or None
        """
        from utils.globals import get_logging_manager, get_analytics_manager
        logging_manager = get_logging_manager()
        analytics_manager = get_analytics_manager()
        
        try:
            camera_config = await self.db_manager.get_camera_config(rtsp_url)
            if not camera_config:
                error_msg = f"No camera configuration found for URL: {rtsp_url}"
                if logging_manager:
                    await logging_manager.log_error(
                        error_msg,
                        category="CAMERA",
                        context=LogContext(camera_url=rtsp_url)
                    )
                return None
            
            key = f"{rtsp_url}_{camera_config.rectype}_{camera_config.is_detection}_{screen_type}"
            
            if key not in self.video_tracks or self.video_tracks[key]() is None:
                # Create predictor with analytics
                predictor = await self._get_or_create_predictor_with_analytics(camera_config)
                
                # Calculate dynamic bitrate based on camera settings
                width, height = camera_config.resolution_tuple
                codec = camera_config.normalized_encoder
                fps = camera_config.fps or 30
                
                bitrate_config = BitrateManager.get_bitrate_config(width, height, codec, fps)
                
                # Log bitrate selection
                if logging_manager:
                    await logging_manager.log_info(
                        f"Creating track with dynamic bitrate: {bitrate_config['max_bitrate']//1000}kbps",
                        category="NETWORK",
                        context=LogContext(
                            camera_name=camera_config.name,
                            additional_data={
                                'resolution': f"{width}x{height}",
                                'codec': codec,
                                'bitrate_mbps': round(bitrate_config['max_bitrate'] / 1_000_000, 2)
                            }
                        )
                    )
                
                # track = CustomVideoStreamTrack(
                #     camera_config=camera_config,
                #     predictor=predictor,
                #     bitrate_config=bitrate_config,
                #     recording_manager=self.recording_manager,
                #     db_manager=self.db_manager
                # )

                track = EnhancedCustomVideoStreamTrack(
                    camera_config=camera_config,
                    predictor=predictor,
                    bitrate_config=bitrate_config,
                    recording_manager= self.recording_manager,
                    db_manager=self.db_manager
                )                

                self.video_tracks[key] = weakref.ref(track)
                return track
            else:
                return self.video_tracks[key]()
                
        except Exception as e:
            error_msg = f"VIDEO TRACK ERROR for {rtsp_url}: {e}"
            if logging_manager:
                await logging_manager.log_error(
                    error_msg,
                    category="CAMERA",
                    context=LogContext(camera_url=rtsp_url),
                    error=e
                )
            return None
    
    async def _get_or_create_predictor_with_analytics(self, camera_config: CameraConfig):
        """
        Get or create predictor with analytics
        
        Args:
            camera_config: Camera configuration
            
        Returns:
            Camera predictor instance
        """
        #cache_key = camera_config.url
        from utils.globals import get_analytics_manager
        analytics_manager = get_analytics_manager()
        
        # if cache_key not in self.predictor_cache:
        #     # config = CameraPredictorFactory.MODEL_CONFIGS[ModelType.RFDETR_MEDIUM]
        #     # print(f"Optimization enabled: {config['optimize_for_inference']}")
        #     predictor = await CameraPredictorFactory.create_predictor(
        #         camera_config, 
        #         analytics_manager
        #     )
        #     self.predictor_cache[cache_key] = predictor
        # else:
        #     predictor = self.predictor_cache[cache_key]
        #     predictor.update_config(camera_config)
        predictor = await CameraPredictorFactory.create_predictor(
                camera_config, 
                analytics_manager
            )
            #self.predictor_cache[cache_key] = predictor    
        return predictor
    
    def stop_video_track(self, rtsp_url: str, screen_type: str = "full_screen", 
                        motion_detection: bool = False) -> bool:
        """
        Stop video track
        
        Args:
            rtsp_url: Camera RTSP URL
            screen_type: Screen type identifier
            motion_detection: Motion detection flag
            
        Returns:
            True if stopped, False otherwise
        """
        try:
            keys_to_remove = []
            for key in self.video_tracks:
                if key.startswith(f"{rtsp_url}_"):
                    keys_to_remove.append(key)
            
            for key in keys_to_remove:
                if self.video_tracks[key]() is not None:
                    track = self.video_tracks[key]()
                    track.stop()
                    del self.video_tracks[key]
                    return True
            return False
        except Exception as e:
            logger.error(f"Error stopping video track: {e}")
            return False
    
    async def refresh_camera_config(self, rtsp_url: str) -> bool:
        """
        Refresh camera configuration from database
        
        Args:
            rtsp_url: Camera RTSP URL
            
        Returns:
            True if refreshed, False otherwise
        """
        try:
            camera_config = await self.db_manager.get_camera_config(rtsp_url)
            if camera_config and rtsp_url in self.predictor_cache:
                self.predictor_cache[rtsp_url].update_config(camera_config)
                
                for key, track_ref in self.video_tracks.items():
                    if key.startswith(f"{rtsp_url}_") and track_ref() is not None:
                        track = track_ref()
                        if hasattr(track, 'update_camera_config'):
                            track.update_camera_config(camera_config)
                
                return True
            return False
        except Exception as e:
            logger.error(f"Error refreshing camera config: {e}")
            return False
    
    def get_active_tracks_count(self) -> int:
        """Get count of active video tracks"""
        active_count = 0
        for track_ref in self.video_tracks.values():
            if track_ref() is not None:
                active_count += 1
        return active_count
    
    def get_connection_stats(self) -> Dict:
        """Get connection statistics"""
        return {
            'total_connections': len(self.connections),
            'active_tracks': self.get_active_tracks_count(),
            'cached_predictors': len(self.predictor_cache)
        }
