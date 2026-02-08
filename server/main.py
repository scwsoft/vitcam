# ============================================================================
# FILE: main.py
# ============================================================================
"""
VitCam Server - Main Application Entry Point

Complete WebRTC Server with:
- Dynamic Bitrate Management
- Object Detection Analytics
- Full Recording Support
- DateTime Overlay
- Tracking System
"""

import asyncio
import json
import logging
import sys
import time
import threading
import uuid
import websockets
from aiortc import RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, RTCConfiguration, RTCIceServer

import uvicorn

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s - [%(filename)s:%(lineno)d]'
)
logger = logging.getLogger("vitcam_server")

# Import application modules
from config.settings import settings
from config.constants import RESOLUTION_CODEC_BITRATE_MAP
from services.database import DatabaseManager
from services.storage import SupabaseStorageManager
from services.logging_service import SupabaseLoggingManager
from services.analytics import ObjectDetectionAnalytics
from services.recording import RecordingManager
from streaming.connection import ConnectionManager, force_codec
from core.bitrate import BitrateManager
from models.logging import LogCategory, LogContext
from api.analytics_api import create_analytics_app
from utils.globals import set_logging_manager, set_analytics_manager, get_logging_manager


# ============================================================================
# Initialize Global Components
# ============================================================================

# Database and storage
db_manager = DatabaseManager(settings.SUPABASE_URL, settings.SUPABASE_KEY)
storage_manager = SupabaseStorageManager(
    settings.SUPABASE_URL, 
    settings.SUPABASE_KEY, 
    settings.SUPABASE_BUCKET
)

# Recording manager
recording_manager = RecordingManager(storage_manager)

# Connection manager
connection_manager = ConnectionManager(db_manager, recording_manager)


# ============================================================================
# WebSocket Handler
# ============================================================================

async def handle_websocket(websocket):
    """WebSocket handler with dynamic bitrate support"""
    client_id = str(uuid.uuid4())
    logging_manager = get_logging_manager()
    
    if logging_manager:
        await logging_manager.log_info(
            f"New client connected: {client_id}",
            category=LogCategory.WEBSOCKET,
            subcategory="websocket_connection",
            context=LogContext(
                client_id=client_id,
                session_id=logging_manager.session_id,
                additional_data={'client_remote_address': str(websocket.remote_address)}
            )
        )
    
    logger.info(f"New client connected: {client_id}")
    
    peer_connection = None
    active_tracks = {}
    current_screen_type = "full_screen"
    
    def setup_peer_connection():
        """Setup WebRTC peer connection"""
        nonlocal peer_connection
        
        # Load STUN servers from environment configuration
        if not hasattr(settings, 'WEBRTC_STUN_SERVERS'):
            raise AttributeError(
                "WEBRTC_STUN_SERVERS not found in settings. "
                "Please add WEBRTC_STUN_SERVERS to your .env file and config/settings.py"
            )
        
        stun_servers = settings.WEBRTC_STUN_SERVERS.split(',')
        ice_servers = [RTCIceServer(urls=stun_servers)]
        
        # Add TURN server if configured
        if hasattr(settings, 'WEBRTC_TURN_SERVER'):
            ice_servers.append(
                RTCIceServer(
                    urls=[settings.WEBRTC_TURN_SERVER],
                    username=settings.WEBRTC_TURN_USERNAME,
                    credential=settings.WEBRTC_TURN_CREDENTIAL
                )
            )
        
        configuration = RTCConfiguration(iceServers=ice_servers)
        
        new_pc = RTCPeerConnection(configuration=configuration)
        new_pc = connection_manager.add_connection(new_pc)
        
        if new_pc is None:
            logger.error("Failed to create new peer connection")
            return None
        
        peer_connection = new_pc

        @new_pc.on("datachannel")
        def on_datachannel(channel):
            """Handle data channel"""
            logger.info(f"Data channel established: {channel.label}")
            
            @channel.on("message")
            async def on_message(message):
                """Handle data channel messages"""
                nonlocal current_screen_type
                
                try:
                    data = json.loads(message) if isinstance(message, str) else message
                    logger.info(f"Received message on data channel: {data}")
                    
                    if isinstance(data, dict) and "type" in data:
                        if data["type"] == "ping":
                            await channel.send(json.dumps({
                                "type": "pong", 
                                "timestamp": time.time()
                            }))
                        
                        elif data["type"] == "get_bitrate_info":
                            rtsp_url = data.get("rtsp_url")
                            if rtsp_url:
                                camera_config = await db_manager.get_camera_config(rtsp_url)
                                if camera_config:
                                    width, height = camera_config.resolution_tuple
                                    codec = camera_config.normalized_encoder
                                    fps = camera_config.fps or 30
                                    
                                    bitrate_config = BitrateManager.get_bitrate_config(
                                        width, height, codec, fps
                                    )
                                    
                                    await channel.send(json.dumps({
                                        "type": "bitrate_info_response",
                                        "camera_name": camera_config.name,
                                        "bitrate_config": bitrate_config,
                                        "timestamp": time.time()
                                    }))
                        
                        elif data["type"] == "refresh_camera_config":
                            rtsp_url = data.get("rtsp_url")
                            if rtsp_url:
                                success = await connection_manager.refresh_camera_config(rtsp_url)
                                await channel.send(json.dumps({
                                    "type": "config_refreshed",
                                    "success": success,
                                    "timestamp": time.time()
                                }))
                        
                except Exception as e:
                    logger.error(f"Error handling data channel message: {e}")
                    await channel.send(json.dumps({
                        "type": "error", 
                        "message": str(e)
                    }))

        @new_pc.on("connectionstatechange")
        async def on_connectionstatechange():
            """Handle connection state changes"""
            logger.info(f"Connection state: {new_pc.connectionState} for client {client_id}")
            
            if new_pc.connectionState == "connected":
                pass
            elif new_pc.connectionState == "failed":
                logger.warning(f"Connection failed for client {client_id}")
                connection_manager.remove_connection(new_pc)
                await cleanup(new_pc)
            elif new_pc.connectionState == "closed":
                logger.info(f"Connection closed for client {client_id}")
                connection_manager.remove_connection(new_pc)

        return new_pc

    setup_peer_connection()

    try:
        async for message in websocket:
            try:
                data = json.loads(message)
                logger.info(f"Received websocket message type: {data.get('type', 'unknown')}")

                if data["type"] == "offer":
                    if not peer_connection or peer_connection.signalingState == "closed":
                        setup_peer_connection()
                    
                    try:
                        await peer_connection.setRemoteDescription(
                            RTCSessionDescription(
                                sdp=data["sdp"]["sdp"], 
                                type=data["sdp"]["type"]
                            )
                        )
                    except Exception as e:
                        logger.error(f"Error setting remote description: {e}")
                        setup_peer_connection()
                        await peer_connection.setRemoteDescription(
                            RTCSessionDescription(
                                sdp=data["sdp"]["sdp"], 
                                type=data["sdp"]["type"]
                            )
                        )

                    rtsp_url = data.get("rtsp_url")
                    screen_type = data.get("screen_type", "full_screen")
                    motion_detection = data.get("motion_detection", False)
                    current_screen_type = screen_type
                                       
                    if rtsp_url:
                        try:
                            video_track = await connection_manager.get_or_create_video_track(
                                rtsp_url, 
                                screen_type=screen_type, 
                                motion_detection=motion_detection
                            )
                            
                            if video_track:
                                key = f"{rtsp_url}_{screen_type}_{motion_detection}"
                                active_tracks[key] = video_track
                                
                                # video_sender = peer_connection.addTrack(video_track)
                                video_senders = peer_connection.getSenders() 
                                
                                if not any(video_sender.track == active_tracks[key] for video_sender in video_senders):
                                  peer_connection.addTrack(active_tracks[key])
                                  force_codec(peer_connection, active_tracks[key], 'video/VP9')
                        
                        except Exception as e:
                            logger.error(f"Error setting up video track: {e}")
                   
                    answer = await peer_connection.createAnswer()
                    await peer_connection.setLocalDescription(answer)

                    # Wait for ICE gathering
                    while peer_connection.iceGatheringState != "complete":
                        await asyncio.sleep(0.1)
                    
                    # Apply dynamic bitrate
                    if rtsp_url:
                        camera_config = await db_manager.get_camera_config(rtsp_url)
                        if camera_config:
                            width, height = camera_config.resolution_tuple
                            codec = camera_config.normalized_encoder
                            fps = camera_config.fps or 30
                            
                            bitrate_config = BitrateManager.get_bitrate_config(
                                width, height, codec, fps
                            )
                            
                            modified_sdp = BitrateManager.modify_sdp_for_bitrate(
                                peer_connection.localDescription.sdp,
                                bitrate_config["max_bitrate"]
                            )
                            
                            logger.info(
                                f"Applied dynamic bitrate: "
                                f"{bitrate_config['max_bitrate']//1000}kbps for "
                                f"{camera_config.name}"
                            )
                        else:
                            bitrate_config = BitrateManager.get_bitrate_config(
                                640, 480, 'VP9', 30
                            )
                            modified_sdp = peer_connection.localDescription.sdp
                    else:
                        bitrate_config = BitrateManager.get_bitrate_config(
                            640, 480, 'VP9', 30
                        )
                        modified_sdp = peer_connection.localDescription.sdp
                    
                    response_data = {
                        "type": "answer",
                        "sdp": {
                            "sdp": modified_sdp, 
                            "type": peer_connection.localDescription.type
                        },
                        "bitrate_config": bitrate_config
                    }
                    
                    if rtsp_url:
                        camera_config = await db_manager.get_camera_config(rtsp_url)
                        if camera_config:
                            config_dict = {
                                'id': camera_config.id,
                                'name': camera_config.name,
                                'browser_compatible': camera_config.is_browser_compatible,
                                'optimal_container': camera_config.optimal_container,
                                'analytics_enabled': True,
                                'dynamic_bitrate': True,
                                'bitrate_mbps': round(
                                    bitrate_config['max_bitrate'] / 1_000_000, 2
                                )
                            }
                            response_data["camera_config"] = config_dict
                    
                    await websocket.send(json.dumps(response_data))
                    
                elif data["type"] == "control":
                    rtsp_url = data.get("rtsp_url")
                    action = data.get("action")
                    screen_type = data.get("screen_type", current_screen_type)
                    motion_detection = data.get("motion_detection", False)
                    
                    if action == "stop" and rtsp_url:
                        success = connection_manager.stop_video_track(rtsp_url, screen_type, motion_detection)
                        
                        key = f"{rtsp_url}_{screen_type}_{motion_detection}"
                        if key in active_tracks:
                            del active_tracks[key]
                        
                        await websocket.send(json.dumps({
                            "type": "control_response",
                            "action": "stop",
                            "success": success
                        }))
                    
                    elif action == "refresh_config" and rtsp_url:
                        success = await connection_manager.refresh_camera_config(rtsp_url)
                        camera_config = await db_manager.get_camera_config(rtsp_url) if success else None
                        
                        response_data = {
                            "type": "control_response",
                            "action": "refresh_config",
                            "success": success
                        }
                        
                        if camera_config:
                            config_dict = camera_config.to_dict()
                            config_dict['storage_type'] = 'Supabase Storage'
                            config_dict['primary_format'] = 'WebM'
                            config_dict['analytics_enabled'] = True
                            response_data["camera_config"] = config_dict
                        
                        await websocket.send(json.dumps(response_data))
                
                elif data["type"] == "ice_candidate":
                    if peer_connection:
                        # Parse the SDP candidate string
                        candidate_sdp = data["candidate"]["candidate"]
                        candidate = RTCIceCandidate.from_sdp(candidate_sdp)
                        candidate.sdpMid = data["candidate"]["sdpMid"]
                        candidate.sdpMLineIndex = data["candidate"]["sdpMLineIndex"]
                        await peer_connection.addIceCandidate(candidate)
                
            except json.JSONDecodeError:
                logger.error(f"Invalid JSON received: {message}")
            except Exception as e:
                logger.error(f"Error processing message: {e}")
                await websocket.send(json.dumps({
                    "type": "error",
                    "message": str(e)
                }))
    
    except websockets.exceptions.ConnectionClosed as e:
        logger.info(f"WebSocket connection closed for client {client_id}: {e}")
    except Exception as e:
        logger.error(f"Error in websocket handler: {e}")
    finally:
        logger.info(f"Client disconnected: {client_id}")
        
        for key, track in active_tracks.items():
            if hasattr(track, 'stop'):
                track.stop()
        active_tracks.clear()
        
        if peer_connection:
            await cleanup(peer_connection)


async def cleanup(peer_connection):
    """Clean up resources for a peer connection"""
    if not peer_connection:
        return
        
    logger.info("Cleaning up resources")
    
    if peer_connection in connection_manager.connections:
        connection_manager.remove_connection(peer_connection)
        
        try:
            close_task = asyncio.create_task(peer_connection.close())
            await asyncio.wait_for(close_task, timeout=2.0)
        except asyncio.TimeoutError:
            logger.warning("Timeout while closing peer connection")
        except Exception as e:
            logger.error(f"Error closing peer connection: {e}")


async def heartbeat():
    """Enhanced heartbeat with dynamic bitrate monitoring"""
    while True:
        try:
            logger.info(f"Active connections: {len(connection_manager.connections)}")
            
            # Log active tracks with bitrate info
            for key, track_ref in connection_manager.video_tracks.items():
                if track_ref() is not None:
                    track = track_ref()
                    if hasattr(track, 'camera_config') and hasattr(track, 'max_bitrate'):
                        logger.info(
                            f"Active track: {track.camera_config.name} - "
                            f"{track.max_bitrate//1000}kbps @ "
                            f"{track.target_resolution[0]}x{track.target_resolution[1]}"
                        )
            
        except Exception as e:
            logger.error(f"Error in heartbeat: {e}")
            
        await asyncio.sleep(30)


# ============================================================================
# Main Application
# ============================================================================

async def main():
    """Enhanced main function with dynamic bitrate configuration"""
    try:
        # Ensure directories exist
        settings.ensure_directories()
        
        # Initialize logging manager
        logging_manager = SupabaseLoggingManager(
            supabase_client=storage_manager.client
        )
        set_logging_manager(logging_manager)
        
        # Initialize analytics manager
        analytics_manager = ObjectDetectionAnalytics(
            supabase_client=storage_manager.client,
            logging_manager=logging_manager
        )
        set_analytics_manager(analytics_manager)
        
        # Log system startup
        await logging_manager.log_info(
            "Starting WebRTC Server with Dynamic Bitrate Configuration",
            category=LogCategory.SYSTEM,
            context=LogContext(additional_data={
                'version': '15.0.0',
                'features': [
                    'dynamic_bitrate', 
                    'analytics', 
                    'datetime_overlay', 
                    'webm_recording',
                    'object_tracking'
                ]
            })
        )
        
        # Start recording manager
        await recording_manager.start_conversion_worker()
        
        # Start heartbeat
        asyncio.create_task(heartbeat())
        
        # Start analytics API in separate thread
        def run_analytics_api():
            analytics_app = create_analytics_app()
            uvicorn.run(
                analytics_app, 
                host=settings.ANALYTICS_API_HOST, 
                port=settings.ANALYTICS_API_PORT, 
                log_level="info"
            )
        
        analytics_thread = threading.Thread(target=run_analytics_api, daemon=True)
        analytics_thread.start()
        
        # Display startup information
        logger.info("=" * 80)
        logger.info("VitCam Server - WebRTC with Dynamic Bitrate Configuration")
        logger.info("=" * 80)
        logger.info("Dynamic Bitrate System:")
        logger.info("  - Resolution-aware bitrate selection")
        logger.info("  - Codec-specific optimization (VP9, VP8, H.264, MJPG)")
        logger.info("  - Automatic scaling for non-standard resolutions")
        logger.info("")
        logger.info("Bitrate Configuration Examples:")
        for resolution, codecs in list(RESOLUTION_CODEC_BITRATE_MAP.items())[:3]:
            logger.info(f"  {resolution[0]}x{resolution[1]}:")
            for codec, bitrate in codecs.items():
                logger.info(
                    f"    {codec}: {bitrate//1_000_000:.2f} Mbps ({bitrate//1000} kbps)"
                )
        logger.info("")
        logger.info("Server Status:")
        logger.info(f"  WebSocket: ws://{settings.WEBSOCKET_HOST}:{settings.WEBSOCKET_PORT}")
        logger.info(f"  Analytics API: http://{settings.ANALYTICS_API_HOST}:{settings.ANALYTICS_API_PORT}/api/analytics/")
        logger.info(f"  Storage: Supabase ({settings.SUPABASE_BUCKET})")
        logger.info("=" * 80)
        
        # Start WebSocket server
        async with websockets.serve(
            handle_websocket, 
            settings.WEBSOCKET_HOST, 
            settings.WEBSOCKET_PORT
        ):
            await asyncio.Future()
        
    except Exception as e:
        logger.error(f"System initialization failed: {e}")
        raise


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Server shutdown requested")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Server startup failed: {e}")
        sys.exit(1)