# ws_webrtc_server15_dynamic_bitrate.py
# Complete WebRTC Server with Dynamic Bitrate, Object Detection Analytics, and Full Recording
import platform
import glob  # For Linux 
import asyncio
import json
import logging
import ssl
import websockets
import time
import traceback
from contextlib import suppress
import os
from aiohttp import web
from aiortc import RTCPeerConnection, RTCSessionDescription, VideoStreamTrack, MediaStreamTrack, RTCIceCandidate, RTCConfiguration,RTCIceServer
from aiortc.contrib.media import MediaRelay, MediaBlackhole
from aiortc.contrib.media import MediaPlayer, MediaRelay, MediaRecorder
from aiortc.rtcrtpsender import RTCRtpSender
import platform
import torch
from transformers import RTDetrForObjectDetection, RTDetrImageProcessor
from transformers import RTDetrV2ForObjectDetection, RTDetrImageProcessor
from av import VideoFrame
import cv2
import supervision as sv
from PIL import Image 
import numpy as np
import fractions
from PIL import Image 
from vidgear.gears import CamGear
try:
    from vidgear.gears import WriteGear
    VIDGEAR_AVAILABLE = True
except ImportError:
    WriteGear = None
    VIDGEAR_AVAILABLE = False
import uuid
import threading
import queue
import weakref
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, List, Any, Tuple, Union
from dataclasses import dataclass, asdict
from abc import ABC, abstractmethod
import asyncpg
from supabase import create_client, Client
from functools import lru_cache, wraps
from dotenv import load_dotenv
import subprocess
import shutil
import tempfile
import io
import aiohttp
import aiofiles
from pathlib import Path
import hashlib
import re

# Analytics and API imports
import psutil
import inspect
from collections import defaultdict, deque
from fastapi import FastAPI, HTTPException, Query, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import uvicorn
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import unquote
from supervision import ByteTrack

load_dotenv()

# ====== ENHANCED BITRATE CONFIGURATION SYSTEM ======

# Comprehensive bitrate mapping based on resolution and codec
RESOLUTION_CODEC_BITRATE_MAP = {
    # Format: (width, height): {codec: bitrate_in_bps}
    (1920, 1080): {
        'H264': 8_500_000,  # 8.50 Mbps
        'VP8': 5_500_000,   # 5.50 Mbps
        'VP9': 4_000_000,   # 4.00 Mbps
        'MJPG': 3_500_000,  # 3.50 Mbps (using AVI value)
    },
    (1280, 720): {
        'H264': 3_500_000,  # 3.50 Mbps
        'VP8': 2_500_000,   # 2.50 Mbps
        'VP9': 1_800_000,   # 1.80 Mbps
        'MJPG': 1_700_000,  # 1.70 Mbps
    },
    (960, 540): {
        'H264': 1_800_000,  # 1.80 Mbps
        'VP8': 1_500_000,   # 1.50 Mbps
        'VP9': 1_100_000,   # 1.10 Mbps
        'MJPG': 1_100_000,  # 1.10 Mbps
    },
    (640, 480): {
        'H264': 950_000,    # 950 kbps
        'VP8': 750_000,     # 750 kbps
        'VP9': 550_000,     # 550 kbps
        'MJPG': 550_000,    # 550 kbps
    },
    (640, 360): {
        'H264': 950_000,    # 950 kbps
        'VP8': 750_000,     # 750 kbps
        'VP9': 550_000,     # 550 kbps
        'MJPG': 550_000,    # 550 kbps
    },
    (384, 216): {
        'H264': 400_000,    # 400 kbps
        'VP8': 350_000,     # 350 kbps
        'VP9': 250_000,     # 250 kbps
        'MJPG': 230_000,    # 230 kbps
    },
    (320, 240): {
        'H264': 330_000,    # 330 kbps
        'VP8': 280_000,     # 280 kbps
        'VP9': 210_000,     # 210 kbps
        'MJPG': 200_000,    # 200 kbps
    },
    (320, 180): {
        'H264': 330_000,    # 330 kbps
        'VP8': 280_000,     # 280 kbps
        'VP9': 210_000,     # 210 kbps
        'MJPG': 200_000,    # 200 kbps
    },
    (160, 90): {
        'H264': 110_000,    # 110 kbps
        'VP8': 100_000,     # 100 kbps
        'VP9': 80_000,      # 80 kbps
        'MJPG': 75_000,     # 75 kbps
    },
}

# Default fallback bitrates by codec (used when resolution not in map)
DEFAULT_CODEC_BITRATES = {
    'VP9': 2_000_000,   # 2 Mbps default
    'VP8': 2_500_000,   # 2.5 Mbps default
    'H264': 3_000_000,  # 3 Mbps default
    'MJPG': 1_500_000,  # 1.5 Mbps default
}

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
        # Lower bitrate = higher CRF (lower quality)
        # Higher bitrate = lower CRF (higher quality)
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
        
        # Higher resolutions get standard FPS
        if pixels >= 1920 * 1080:  # 1080p
            return 30
        elif pixels >= 1280 * 720:  # 720p
            return 30
        elif pixels >= 640 * 480:   # VGA
            return 30
        else:  # Lower resolutions
            return 15

# ====== ANALYTICS SYSTEM CLASSES ======

@dataclass
class DetectionEvent:
    """Object detection event data structure"""
    camera_id: int
    camera_name: str
    timestamp: datetime
    object_class_id: int
    object_class_name: str
    confidence: float
    bbox_x: float
    bbox_y: float
    bbox_width: float
    bbox_height: float
    frame_width: int
    frame_height: int
    session_id: Optional[str] = None

class ObjectDetectionAnalytics:
    """Enhanced object detection analytics manager"""
    
    def __init__(self, supabase_client, logging_manager=None):
        self.supabase_client = supabase_client
        self.logging_manager = logging_manager
        self.detection_buffer = []
        self.buffer_size = 50
        self.last_flush = time.time()
        self.flush_interval = 30.0
        
        # Analytics aggregation
        self.hourly_stats = {}
        self.daily_stats = {}
        
    async def log_detection_event(self, camera_config, detections, frame_shape, session_id=None):
        """Log object detection events to database"""
        try:
            current_time = datetime.now(tz=timezone.utc)
            
            for i in range(len(detections.class_id) if hasattr(detections, 'class_id') else 0):
                # Extract detection data safely
                bbox = detections.xyxy[i] if hasattr(detections, 'xyxy') and len(detections.xyxy) > i else [0, 0, 0, 0]
                class_id = int(detections.class_id[i]) if hasattr(detections, 'class_id') and len(detections.class_id) > i else 0
                confidence = float(detections.confidence[i]) if hasattr(detections, 'confidence') and len(detections.confidence) > i else 0.0
                
                # Get class name using COCO dataset mapping
                class_name = COCO_CLASS_NAMES.get(class_id, f"class_{class_id}")
                if hasattr(detections, 'class_name'):
                    class_name = detections.class_name[i] if isinstance(detections.class_name, list) else str(detections.class_name)
                elif hasattr(camera_config, 'model_class_names') and class_id < len(camera_config.model_class_names):
                    class_name = camera_config.model_class_names[class_id]
                
                detection_event = {
                    'camera_id': camera_config.id,
                    'camera_name': camera_config.name,
                    'camera_url': camera_config.url,
                    'timestamp': current_time.isoformat(),
                    'object_class_id': class_id,
                    'object_class_name': class_name,
                    'confidence': confidence,
                    'bbox_x': float(bbox[0]) if len(bbox) > 0 else 0.0,
                    'bbox_y': float(bbox[1]) if len(bbox) > 1 else 0.0,
                    'bbox_width': float(bbox[2] - bbox[0]) if len(bbox) > 2 else 0.0,
                    'bbox_height': float(bbox[3] - bbox[1]) if len(bbox) > 3 else 0.0,
                    'frame_width': frame_shape[1] if len(frame_shape) > 1 else 0,
                    'frame_height': frame_shape[0] if len(frame_shape) > 0 else 0,
                    'session_id': session_id,
                    'detection_metadata': {
                        'model_threshold': camera_config.odthreshold / 100.0,
                        'detection_classes': camera_config.detection_classes,
                        'recording_active': getattr(camera_config, 'recording_active', False)
                    }
                }
                
                self.detection_buffer.append(detection_event)
            
            # Check if we need to flush
            current_time_unix = time.time()
            if (len(self.detection_buffer) >= self.buffer_size or 
                current_time_unix - self.last_flush >= self.flush_interval):
                await self._flush_detection_buffer()
                
        except Exception as e:
            if self.logging_manager:
                await self.logging_manager.log_error(
                    f"Error logging detection events: {e}",
                    category="DETECTION",
                    error=e
                )
    
    async def _flush_detection_buffer(self):
        """Flush detection events to database"""
        if not self.detection_buffer:
            return
            
        try:
            events_to_flush = self.detection_buffer.copy()
            self.detection_buffer.clear()
            self.last_flush = time.time()
            
            # Insert in batches
            batch_size = 25
            for i in range(0, len(events_to_flush), batch_size):
                batch = events_to_flush[i:i + batch_size]
                
                result = self.supabase_client.table('object_detection_events').insert(batch).execute()
                
                if hasattr(result, 'error') and result.error:
                    if self.logging_manager:
                        await self.logging_manager.log_error(
                            f"Error inserting detection events batch: {result.error}",
                            category="DETECTION"
                        )
                
        except Exception as e:
            if self.logging_manager:
                await self.logging_manager.log_error(
                    f"Error flushing detection buffer: {e}",
                    category="DETECTION",
                    error=e
                )
    
    async def generate_hourly_analytics(self, camera_id: Optional[int] = None, hours_back: int = 24):
        """Generate hourly analytics for object detection"""
        try:
            end_time = datetime.now(tz=timezone.utc)
            start_time = end_time - timedelta(hours=hours_back)
            
            query = self.supabase_client.table('object_detection_events').select('*')
            
            if camera_id:
                query = query.eq('camera_id', camera_id)
            
            query = query.gte('timestamp', start_time.isoformat()).lte('timestamp', end_time.isoformat())
            
            result = query.execute()
            
            if result.data:
                analytics = self._process_detection_analytics(result.data, 'hourly')
                await self._store_analytics_summary(analytics, 'hourly')
                return analytics
            
            return []
            
        except Exception as e:
            if self.logging_manager:
                await self.logging_manager.log_error(
                    f"Error generating hourly analytics: {e}",
                    category="DETECTION",
                    error=e
                )
            return []
    
    async def generate_daily_analytics(self, camera_id: Optional[int] = None, days_back: int = 7):
        """Generate daily analytics for object detection"""
        try:
            end_time = datetime.now(tz=timezone.utc)
            start_time = end_time - timedelta(days=days_back)
            
            query = self.supabase_client.table('object_detection_events').select('*')
            
            if camera_id:
                query = query.eq('camera_id', camera_id)
            
            query = query.gte('timestamp', start_time.isoformat()).lte('timestamp', end_time.isoformat())
            
            result = query.execute()
            
            if result.data:
                analytics = self._process_detection_analytics(result.data, 'daily')
                await self._store_analytics_summary(analytics, 'daily')
                return analytics
            
            return []
            
        except Exception as e:
            if self.logging_manager:
                await self.logging_manager.log_error(
                    f"Error generating daily analytics: {e}",
                    category="DETECTION",
                    error=e
                )
            return []
    
    def _process_detection_analytics(self, detection_data: List[Dict], period_type: str) -> List[Dict]:
        """Process raw detection data into analytics"""
        analytics = {}
        
        for event in detection_data:
            camera_id = event['camera_id']
            camera_name = event['camera_name']
            object_class = event['object_class_name']
            timestamp = datetime.fromisoformat(event['timestamp'].replace('Z', '+00:00'))
            
            # Group by camera
            if camera_id not in analytics:
                analytics[camera_id] = {
                    'camera_id': camera_id,
                    'camera_name': camera_name,
                    'total_detections': 0,
                    'object_counts': {},
                    'hourly_distribution': {},
                    'confidence_stats': {
                        'total': 0,
                        'sum': 0,
                        'max': 0,
                        'min': 1.0
                    },
                    'peak_activity_hour': None,
                    'unique_objects': set()
                }
            
            camera_analytics = analytics[camera_id]
            
            # Update counts
            camera_analytics['total_detections'] += 1
            camera_analytics['unique_objects'].add(object_class)
            
            if object_class not in camera_analytics['object_counts']:
                camera_analytics['object_counts'][object_class] = 0
            camera_analytics['object_counts'][object_class] += 1
            
            # Update hourly distribution
            hour = timestamp.hour
            if hour not in camera_analytics['hourly_distribution']:
                camera_analytics['hourly_distribution'][hour] = 0
            camera_analytics['hourly_distribution'][hour] += 1
            
            # Update confidence stats
            confidence = event['confidence']
            conf_stats = camera_analytics['confidence_stats']
            conf_stats['total'] += 1
            conf_stats['sum'] += confidence
            conf_stats['max'] = max(conf_stats['max'], confidence)
            conf_stats['min'] = min(conf_stats['min'], confidence)
        
        # Finalize analytics
        for camera_id, camera_analytics in analytics.items():
            # Convert set to list
            camera_analytics['unique_objects'] = list(camera_analytics['unique_objects'])
            
            # Calculate average confidence
            conf_stats = camera_analytics['confidence_stats']
            if conf_stats['total'] > 0:
                conf_stats['average'] = conf_stats['sum'] / conf_stats['total']
            
            # Find peak activity hour
            if camera_analytics['hourly_distribution']:
                peak_hour = max(camera_analytics['hourly_distribution'].items(), key=lambda x: x[1])
                camera_analytics['peak_activity_hour'] = peak_hour[0]
        
        return list(analytics.values())
    
    async def _store_analytics_summary(self, analytics: List[Dict], period_type: str):
        """Store analytics summary in database"""
        try:
            current_time = datetime.now(tz=timezone.utc)
            
            for camera_analytics in analytics:
                summary_data = {
                    'camera_id': camera_analytics['camera_id'],
                    'camera_name': camera_analytics['camera_name'],
                    'period_type': period_type,
                    'period_start': current_time.isoformat(),
                    'total_detections': camera_analytics['total_detections'],
                    'unique_objects': camera_analytics['unique_objects'],
                    'object_counts': camera_analytics['object_counts'],
                    'hourly_distribution': camera_analytics['hourly_distribution'],
                    'confidence_stats': camera_analytics['confidence_stats'],
                    'peak_activity_hour': camera_analytics['peak_activity_hour'],
                    'generated_at': current_time.isoformat()
                }
                
                result = self.supabase_client.table('detection_analytics_summary').upsert(summary_data).execute()
                
                if hasattr(result, 'error') and result.error:
                    if self.logging_manager:
                        await self.logging_manager.log_error(
                            f"Error storing analytics summary: {result.error}",
                            category="DETECTION"
                        )
                
        except Exception as e:
            if self.logging_manager:
                await self.logging_manager.log_error(
                    f"Error storing analytics summary: {e}",
                    category="DETECTION",
                    error=e
                )

# ====== DATETIME OVERLAY CLASSES ======

class DateTimeFormatter:
    """Handle datetime formatting based on general settings"""
    
    FORMAT_MAPPING = {
        'YYYY-MM-DD HH:mm:ss': '%Y-%m-%d %H:%M:%S',
        'DD/MM/YYYY HH:mm:ss': '%d/%m/%Y %H:%M:%S', 
        'MM/DD/YYYY HH:mm:ss': '%m/%d/%Y %H:%M:%S',
        'DD-MM-YYYY HH:mm': '%d-%m-%Y %H:%M',
        'YYYY/MM/DD HH:mm': '%Y/%m/%d %H:%M',
        'MMM DD, YYYY HH:mm': '%b %d, %Y %H:%M'
    }
    
    @classmethod
    def convert_format(cls, custom_format: str) -> str:
        return cls.FORMAT_MAPPING.get(custom_format, '%Y-%m-%d %H:%M:%S')
    
    @classmethod
    def format_datetime(cls, dt: datetime, custom_format: str) -> str:
        strftime_format = cls.convert_format(custom_format)
        return dt.strftime(strftime_format)

@dataclass
class GeneralSettings:
    """General settings data class"""
    id: int
    user_id: Optional[str] = None
    signaling_protocol: str = 'ws'
    signaling_ip: Optional[str] = None
    signaling_port: Optional[str] = None
    signaling_name: Optional[str] = None
    datetime_enabled: bool = True
    datetime_format: str = 'YYYY-MM-DD HH:mm:ss'
    updated_at: Optional[datetime] = None

# ====== LOGGING SYSTEM ======

class LogCategory:
    CAMERA = "CAMERA"
    STORAGE = "STORAGE"
    CODEC = "CODEC"
    NETWORK = "NETWORK"
    DATABASE = "DATABASE"
    RECORDING = "RECORDING"
    WEBSOCKET = "WEBSOCKET"
    SYSTEM = "SYSTEM"
    PERFORMANCE = "PERFORMANCE"
    SECURITY = "SECURITY"
    DETECTION = "DETECTION"
    CONVERSION = "CONVERSION"

class LogSubcategory:
    CAMERA_CONNECTION = "camera_connection"
    CAMERA_DISCONNECTION = "camera_disconnection"
    CAMERA_RECONNECTION = "camera_reconnection"
    FRAME_PROCESSING = "frame_processing"
    MOTION_DETECTION = "motion_detection"
    OBJECT_DETECTION = "object_detection"
    SUPABASE_UPLOAD = "supabase_upload"
    SUPABASE_DOWNLOAD = "supabase_download"
    RECORDING_START = "recording_start"
    RECORDING_STOP = "recording_stop"
    WEBSOCKET_CONNECTION = "websocket_connection"
    WEBSOCKET_MESSAGE = "websocket_message"

@dataclass
class LogContext:
    camera_id: Optional[int] = None
    camera_name: Optional[str] = None
    camera_url: Optional[str] = None
    session_id: Optional[str] = None
    client_id: Optional[str] = None
    operation_id: Optional[str] = None
    performance_data: Optional[Dict[str, Any]] = None
    additional_data: Optional[Dict[str, Any]] = None

class SupabaseLogHandler(logging.Handler):
    """Custom logging handler that sends logs to Supabase database"""
    
    def __init__(self, supabase_client, buffer_size=50, flush_interval=10.0):
        super().__init__()
        self.supabase_client = supabase_client
        self.buffer_size = buffer_size
        self.flush_interval = flush_interval
        self.log_buffer = []
        self.buffer_lock = threading.Lock()
        self.last_flush = time.time()
        self._shutdown = False
        
    def emit(self, record):
        try:
            log_entry = self._format_log_entry(record)
            
            with self.buffer_lock:
                self.log_buffer.append(log_entry)
                
                current_time = time.time()
                if (len(self.log_buffer) >= self.buffer_size or 
                    current_time - self.last_flush >= self.flush_interval):
                    self._schedule_flush()
                    
        except Exception as e:
            print(f"Error in SupabaseLogHandler.emit: {e}")
    
    def _format_log_entry(self, record):
        context = getattr(record, 'context', LogContext())
        category = getattr(record, 'category', LogCategory.SYSTEM)
        subcategory = getattr(record, 'subcategory', None)
        
        stack_trace = None
        if record.levelname in ['ERROR', 'CRITICAL'] and record.exc_info:
            stack_trace = ''.join(traceback.format_exception(*record.exc_info))
        
        details = {
            'module': getattr(record, 'module', None),
            'process': getattr(record, 'process', None),
            'thread': getattr(record, 'thread', None),
            'args': record.args if record.args else None,
        }
        
        if context.performance_data:
            details['performance_data'] = context.performance_data
        if context.additional_data:
            details.update(context.additional_data)
        
        return {
            'timestamp': datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            'level': record.levelname,
            'category': category,
            'subcategory': subcategory,
            'source_file': record.pathname,
            'source_function': record.funcName,
            'line_number': record.lineno,
            'message': record.getMessage(),
            'details': details,
            'camera_id': context.camera_id,
            'camera_url': context.camera_url,
            'session_id': context.session_id,
            'client_id': context.client_id,
            'stack_trace': stack_trace,
            'performance_metrics': context.performance_data
        }
    
    def _schedule_flush(self):
        try:
            loop = asyncio.get_event_loop()
            if not loop.is_closed():
                asyncio.create_task(self._async_flush())
        except RuntimeError:
            pass
    
    async def _async_flush(self):
        if self._shutdown:
            return
            
        try:
            logs_to_flush = []
            with self.buffer_lock:
                if self.log_buffer:
                    logs_to_flush = self.log_buffer.copy()
                    self.log_buffer.clear()
                    self.last_flush = time.time()
            
            if logs_to_flush:
                batch_size = 25
                for i in range(0, len(logs_to_flush), batch_size):
                    batch = logs_to_flush[i:i + batch_size]
                    
                    validated_batch = []
                    for log_entry in batch:
                        try:
                            json.dumps(log_entry)
                            validated_batch.append(log_entry)
                        except (TypeError, ValueError) as e:
                            print(f"Skipping non-serializable log entry: {e}")
                    
                    if validated_batch:
                        try:
                            result = self.supabase_client.table('system_logs').insert(validated_batch).execute()
                        except Exception as e:
                            print(f"Error inserting log batch: {e}")
                        
        except Exception as e:
            print(f"Critical error in _async_flush: {e}")

class SupabaseLoggingManager:
    """Main logging manager"""
    
    def __init__(self, supabase_client):
        self.supabase_client = supabase_client
        self.session_id = str(uuid.uuid4())
        self.start_time = time.time()
        self._setup_logging()
    
    def _setup_logging(self):
        try:
            self.supabase_handler = SupabaseLogHandler(self.supabase_client)
            self.supabase_handler.setLevel(logging.INFO)
            
            root_logger = logging.getLogger()
            root_logger.addHandler(self.supabase_handler)
        except Exception as e:
            print(f"Failed to setup Supabase logging: {e}")
    
    def _create_enhanced_record(self, level, message, category, subcategory=None, 
                              context=None, error=None):
        frame = inspect.currentframe()
        for _ in range(3):
            frame = frame.f_back
            if frame is None:
                break
        
        filename = frame.f_code.co_filename if frame else "unknown"
        function_name = frame.f_code.co_name if frame else "unknown"
        line_number = frame.f_lineno if frame else 0
        
        record = logging.LogRecord(
            name="supabase_logger",
            level=getattr(logging, level.upper()),
            pathname=filename,
            lineno=line_number,
            msg=message,
            args=(),
            exc_info=None
        )
        
        record.category = category
        record.subcategory = subcategory
        record.context = context or LogContext()
        record.funcName = function_name
        
        if error:
            record.exc_info = (type(error), error, error.__traceback__)
        
        return record
    
    async def log_info(self, message, category=LogCategory.SYSTEM, subcategory=None, context=None):
        try:
            record = self._create_enhanced_record('INFO', message, category, subcategory, context)
            logging.getLogger().handle(record)
        except Exception as e:
            print(f"Error logging info: {e}")
    
    async def log_warning(self, message, category=LogCategory.SYSTEM, subcategory=None, context=None):
        try:
            record = self._create_enhanced_record('WARNING', message, category, subcategory, context)
            logging.getLogger().handle(record)
        except Exception as e:
            print(f"Error logging warning: {e}")
    
    async def log_error(self, message, category=LogCategory.SYSTEM, subcategory=None, 
                       context=None, error=None):
        try:
            record = self._create_enhanced_record('ERROR', message, category, subcategory, context, error)
            logging.getLogger().handle(record)
        except Exception as e:
            print(f"Error logging error: {e}")
    
    async def log_critical(self, message, category=LogCategory.SYSTEM, subcategory=None, 
                          context=None, error=None):
        try:
            record = self._create_enhanced_record('CRITICAL', message, category, subcategory, context, error)
            logging.getLogger().handle(record)
        except Exception as e:
            print(f"Error logging critical: {e}")
    
    async def log_camera_status(self, camera_config, status, **kwargs):
        try:
            status_data = {
                'camera_id': camera_config.id,
                'camera_name': camera_config.name,
                'camera_url': camera_config.url,
                'status': status,
                'fps_target': camera_config.fps,
                'resolution_target': camera_config.resolution,
                'codec_used': camera_config.normalized_encoder,
                'container_format': camera_config.optimal_container,
                'recording_type': camera_config.rectype,
                **kwargs
            }
            
            result = self.supabase_client.table('camera_status_logs').insert(status_data).execute()
            return result.data
        except Exception as e:
            print(f"Failed to log camera status: {e}")
    
    async def shutdown(self):
        if hasattr(self, 'supabase_handler'):
            self.supabase_handler.close()

# ====== SUPABASE STORAGE MANAGER ======

class SupabaseStorageManager:
    def __init__(self, supabase_url: str, supabase_key: str, bucket_name: str = "vitcam-recordings"):
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.bucket_name = bucket_name
        self._client = None
        
    @property
    def client(self) -> Client:
        if self._client is None:
            try:
                self._client = create_client(self.supabase_url, self.supabase_key)
                self._ensure_bucket_exists()
            except Exception as e:
                raise ConnectionError(f"Supabase connection failed: {e}")
        return self._client
    
    def _ensure_bucket_exists(self) -> bool:
        try:
            result = self.client.storage.from_(self.bucket_name).list()
            return True
        except Exception as e:
            try:
                create_result = self.client.storage.create_bucket(self.bucket_name, {"public": False})
                return True
            except Exception as create_error:
                return True
    
    def generate_object_key(self, camera_name: str, recording_type: str = "", container: str = "webm") -> str:
        try:
            safe_name = self._sanitize_camera_name(camera_name)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            prefix = recording_type if recording_type else "recording"
            object_key = f"{safe_name}/{timestamp}_{prefix}.{container}"
            return object_key
        except Exception as e:
            fallback_key = f"camera_{abs(hash(camera_name)) % 10000}/{int(time.time())}_{recording_type}.{container}"
            return fallback_key
    
    def _sanitize_camera_name(self, camera_name: str) -> str:
        safe_name = re.sub(r'[^\w\s\-_.]', '', camera_name)
        safe_name = re.sub(r'\s+', '_', safe_name)
        safe_name = re.sub(r'_+', '_', safe_name)
        safe_name = safe_name.strip('_').lower()
        
        if not safe_name:
            safe_name = f"camera_{abs(hash(camera_name)) % 10000}"
        
        if len(safe_name) > 50:
            safe_name = safe_name[:50].rstrip('_')
        
        return safe_name
    
    async def upload_file(self, object_key: str, file_path: str, content_type: str = "video/webm") -> bool:
        try:
            if not os.path.exists(file_path):
                return False
            
            file_size = os.path.getsize(file_path)
            if file_size == 0:
                return False
            
            async with aiofiles.open(file_path, 'rb') as file:
                file_content = await file.read()
            
            result = self.client.storage.from_(self.bucket_name).upload(
                path=object_key,
                file=file_content,
                file_options={
                    "content-type": content_type,
                    "cache-control": "3600",
                    "upsert": "true"
                }
            )
            
            if result:
                if hasattr(result, 'error') and result.error:
                    return False
                return True
            return False
                
        except Exception as e:
            return False

    def object_exists(self, object_key: str) -> bool:
        try:
            folder_path = os.path.dirname(object_key)
            filename = os.path.basename(object_key)
            
            if folder_path:
                result = self.client.storage.from_(self.bucket_name).list(path=folder_path)
            else:
                result = self.client.storage.from_(self.bucket_name).list()
            
            if result and isinstance(result, list):
                for item in result:
                    item_name = item.get('name', '') if isinstance(item, dict) else str(item)
                    if item_name == filename:
                        return True
                return False
            return False
            
        except Exception as e:
            return False

# ====== CODEC MANAGER ======

class CodecManager:
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
    
    FALLBACK_ORDER = ['VP9', 'VP8', 'H264', 'MJPG']
    
    @classmethod
    def normalize_codec_name(cls, codec_input: str) -> Optional[str]:
        if not codec_input:
            return None
            
        codec_input = codec_input.strip().upper()
        
        for codec_name, config in cls.CODEC_CONTAINER_MAP.items():
            if codec_input in [code.upper() for code in config['fourcc_codes']]:
                return codec_name
        
        return None
    
    @classmethod
    def get_codec_config(cls, codec_name: str) -> Optional[Dict]:
        normalized = cls.normalize_codec_name(codec_name)
        return cls.CODEC_CONTAINER_MAP.get(normalized) if normalized else None
    
    @classmethod
    def get_optimal_container(cls, codec_name: str, requested_container: Optional[str] = None, 
                            prefer_webm: bool = True) -> str:
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
        
        normalized_preferred = cls.normalize_codec_name(preferred_codec)
        test_order = []
        
        if prefer_webm and normalized_preferred != 'VP9':
            test_order.append('VP9')
        if prefer_webm and normalized_preferred != 'VP8':
            test_order.append('VP8')
        
        if normalized_preferred:
            test_order.append(normalized_preferred)
        
        for fallback in cls.FALLBACK_ORDER:
            if fallback not in test_order:
                test_order.append(fallback)
        
        for codec_name in test_order:
            try:
                optimal_container = cls.get_optimal_container(codec_name, container, prefer_webm)
                
                if cls.test_codec_compatibility(codec_name, width, height, fps, optimal_container):
                    fourcc = cls.create_fourcc(codec_name)
                    config = cls.get_codec_config(codec_name)
                    return codec_name, optimal_container, fourcc
                    
            except Exception:
                continue
        
        return 'VP9', 'webm', cv2.VideoWriter_fourcc(*'VP90')
    
    @classmethod
    def create_fourcc(cls, codec_name: str) -> int:
        config = cls.get_codec_config(codec_name)
        if config:
            return config['opencv_fourcc']
        
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
    def test_codec_compatibility(cls, codec_name: str, width: int, height: int, fps: float, container: str) -> bool:
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

def safe_fourcc(encoder_string, width=640, height=480, fps=30, container=None, camera_url=None, prefer_webm=True):
    try:
        if not encoder_string:
            encoder_string = 'VP9'
        
        codec_name, optimal_container, fourcc = CodecManager.find_working_codec(
            encoder_string, width, height, fps, container, camera_url, prefer_webm
        )
        
        return fourcc, optimal_container, codec_name
        
    except Exception as e:
        return cv2.VideoWriter_fourcc(*'VP90'), 'webm', 'VP9'

# ====== CONFIGURATION CONSTANTS ======

SUPABASE_URL = os.getenv("SUPABASE_URL", "your-supabase-url")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "your-supabase-key")
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "vitcam-recordings")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s - [%(filename)s:%(lineno)d]'
)
logger = logging.getLogger("webrtc_server")

@dataclass
class CameraConfig:
    id: int
    name: str
    type: str
    url: str
    description: Optional[str] = None
    odthreshold: Optional[int] = 50
    is_detection: bool = False
    odclasses: Optional[str] = None
    encoder: Optional[str] = "VP9"
    resolution: Optional[str] = "640x480"
    fps: Optional[int] = 30
    rectype: Optional[str] = "none"
    container: Optional[str] = "webm"
    convert_formats: Optional[List[str]] = None
    
    @property
    def detection_classes(self) -> List[int]:
        if not self.odclasses:
            return []
        try:
            return [int(cls.strip()) for cls in self.odclasses.split(',') if cls.strip().isdigit()]
        except (ValueError, AttributeError):
            return []
    
    @property
    def resolution_tuple(self) -> Tuple[int, int]:
        try:
            width, height = map(int, self.resolution.split('x'))
            return (width, height)
        except (ValueError, AttributeError):
            return (640, 480)
    
    @property
    def should_record(self) -> bool:
        return self.rectype in ["motion", "continuous"]
    
    @property
    def is_motion_recording(self) -> bool:
        return self.rectype == "motion"
    
    @property
    def is_continuous_recording(self) -> bool:
        return self.rectype == "continuous"
    
    @property
    def normalized_encoder(self) -> str:
        return CodecManager.normalize_codec_name(self.encoder) or 'VP9'
    
    @property
    def optimal_container(self) -> str:
        return CodecManager.get_optimal_container(self.encoder, self.container, prefer_webm=True)
    
    @property
    def is_browser_compatible(self) -> bool:
        config = CodecManager.get_codec_config(self.encoder)
        return config.get('browser_compatible', False) if config else False

class DatabaseManager:
    def __init__(self, supabase_url: str, supabase_key: str):
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self._client: Optional[Client] = None
        self._cache_ttl = 300
        self._last_cache_update = {}
        self._camera_cache: Dict[str, CameraConfig] = {}
        self._settings_cache: Optional[GeneralSettings] = None
        self._settings_cache_time = 0
        
    @property
    def client(self) -> Client:
        if self._client is None:
            try:
                self._client = create_client(self.supabase_url, self.supabase_key)
            except Exception as e:
                raise ConnectionError(f"Database connection failed: {e}")
        return self._client
    
    async def get_general_settings(self, user_id: Optional[str] = None) -> Optional[GeneralSettings]:
        try:
            current_time = time.time()
            
            if (self._settings_cache and 
                current_time - self._settings_cache_time < 60):
                return self._settings_cache
            
            query = self.client.table('general_settings').select('*')
            
            if user_id:
                query = query.eq('user_id', user_id)
            
            response = query.order('updated_at', desc=True).limit(1).execute()
            
            if not response.data:
                return None
            
            settings_data = response.data[0]
            
            settings = GeneralSettings(
                id=settings_data['id'],
                user_id=settings_data.get('user_id'),
                signaling_protocol=settings_data.get('signaling_protocol', 'ws'),
                signaling_ip=settings_data.get('signaling_ip'),
                signaling_port=settings_data.get('signaling_port'),
                signaling_name=settings_data.get('signaling_name'),
                datetime_enabled=settings_data.get('datetime_enabled', True),
                datetime_format=settings_data.get('datetime_format', 'YYYY-MM-DD HH:mm:ss'),
                updated_at=settings_data.get('updated_at')
            )
            
            self._settings_cache = settings
            self._settings_cache_time = current_time
            
            return settings
            
        except Exception as e:
            return None
    
    def clear_settings_cache(self):
        self._settings_cache = None
        self._settings_cache_time = 0
    
    async def get_camera_config(self, camera_url: str) -> Optional[CameraConfig]:
        try:
            cache_key = f"camera_{camera_url}"
            current_time = time.time()
            
            if (cache_key in self._camera_cache and 
                cache_key in self._last_cache_update and
                current_time - self._last_cache_update[cache_key] < self._cache_ttl):
                return self._camera_cache[cache_key]
            
            response = self.client.table('camera').select('*').eq('url', camera_url).execute()
            
            if not response.data:
                return None
            
            camera_data = response.data[0]
            
            encoder = camera_data.get('encoder', 'VP9')
            container = camera_data.get('container', 'webm')
            
            if container == 'webm' and encoder not in ['VP9', 'VP8', 'H264']:
                encoder = 'VP9'
            
            config = CameraConfig(
                id=camera_data['id'],
                name=camera_data['name'],
                type=camera_data['type'],
                url=camera_data['url'],
                description=camera_data.get('description'),
                odthreshold=camera_data.get('odthredshold', 50),
                is_detection=camera_data.get('is_detection', False),
                odclasses=camera_data.get('odclasses'),
                encoder=encoder,
                resolution=camera_data.get('resolution', '640x480'),
                fps=camera_data.get('fps', 30),
                rectype=camera_data.get('rectype', 'none'),
                container=container,
                convert_formats=camera_data.get('convert_formats')
            )
            
            self._camera_cache[cache_key] = config
            self._last_cache_update[cache_key] = current_time
            
            return config
            
        except Exception as e:
            return None
    
    async def get_all_cameras(self) -> List[CameraConfig]:
        try:
            response = self.client.table('camera').select('*').execute()
            cameras = []
            
            for camera_data in response.data:
                encoder = camera_data.get('encoder', 'VP9')
                container = camera_data.get('container', 'webm')
                
                if container == 'webm' and encoder not in ['VP9', 'VP8', 'H264']:
                    encoder = 'VP9'
                
                config = CameraConfig(
                    id=camera_data['id'],
                    name=camera_data['name'],
                    type=camera_data['type'],
                    url=camera_data['url'],
                    description=camera_data.get('description'),
                    odthreshold=camera_data.get('odthredshold', 50),
                    is_detection=camera_data.get('is_detection', False),
                    odclasses=camera_data.get('odclasses'),
                    encoder=encoder,
                    resolution=camera_data.get('resolution', '640x480'),
                    fps=camera_data.get('fps', 30),
                    rectype=camera_data.get('rectype', 'none'),
                    container=container,
                    convert_formats=camera_data.get('convert_formats')
                )
                cameras.append(config)
                
            return cameras
            
        except Exception as e:
            return []

# ====== OBJECT DETECTION CLASSES ======

# COCO class names mapping for object detection
COCO_CLASS_NAMES = {
    1: "person",
    2: "bicycle",
    3: "car",
    4: "motorcycle",
    5: "airplane",
    6: "bus",
    7: "train",
    8: "truck",
    9: "boat",
    10: "traffic light",
    11: "fire hydrant",
    13: "stop sign",
    14: "parking meter",
    15: "bench",
    16: "bird",
    17: "cat",
    18: "dog",
    19: "horse",
    20: "sheep",
    21: "cow",
    22: "elephant",
    23: "bear",
    24: "zebra",
    25: "giraffe",
    27: "backpack",
    28: "umbrella",
    31: "handbag",
    32: "tie",
    33: "suitcase",
    34: "frisbee",
    35: "skis",
    36: "snowboard",
    37: "sports ball",
    38: "kite",
    39: "baseball bat",
    40: "baseball glove",
    41: "skateboard",
    42: "surfboard",
    43: "tennis racket",
    44: "bottle",
    46: "wine glass",
    47: "cup",
    48: "fork",
    49: "knife",
    50: "spoon",
    51: "bowl",
    52: "banana",
    53: "apple",
    54: "sandwich",
    55: "orange",
    56: "broccoli",
    57: "carrot",
    58: "hot dog",
    59: "pizza",
    60: "donut",
    61: "cake",
    62: "chair",
    63: "couch",
    64: "potted plant",
    65: "bed",
    67: "dining table",
    70: "toilet",
    72: "tv",
    73: "laptop",
    74: "mouse",
    75: "remote",
    76: "keyboard",
    77: "cell phone",
    78: "microwave",
    79: "oven",
    80: "toaster",
    81: "sink",
    82: "refrigerator",
    84: "book",
    85: "clock",
    86: "vase",
    87: "scissors",
    88: "teddy bear",
    89: "hair drier",
    90: "toothbrush",
}

class CameraPredictorFactory:
    _model_instance = None
    _model_lock = asyncio.Lock()
    
    @classmethod
    async def get_shared_model(cls):
        if cls._model_instance is None:
            async with cls._model_lock:
                if cls._model_instance is None:
                    cls._model_instance = await cls._initialize_model()
        return cls._model_instance
    
    @classmethod
    async def _initialize_model(cls):
        try:
            CHECKPOINT = "PekingU/rtdetr_v2_r18vd"
            DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            logger.info(f"Loading model {CHECKPOINT} on device: {DEVICE}")

            image_processor = RTDetrImageProcessor.from_pretrained(CHECKPOINT)
            model = RTDetrV2ForObjectDetection.from_pretrained(CHECKPOINT).to(DEVICE)
            
            box_annotator = sv.BoxAnnotator(thickness=1)
            label_annotator = sv.LabelAnnotator(text_scale=0.5, text_thickness=1)
            
            return {
                'device': DEVICE,
                'model': model,
                'processor': image_processor,
                'box_annotator': box_annotator,
                'label_annotator': label_annotator
            }
            
        except Exception as e:
            raise
    
    @classmethod
    async def create_predictor(cls, camera_config: CameraConfig) -> 'CameraPredictor':
        shared_model = await cls.get_shared_model()
        analytics_manager = get_analytics_manager()
        return CameraPredictorWithAnalytics(camera_config, shared_model, analytics_manager)

class CameraPredictor:
    def __init__(self, camera_config: CameraConfig, shared_model: Dict[str, Any]):
        self.camera_config = camera_config
        self.device = shared_model['device']
        self.model = shared_model['model']
        self.processor = shared_model['processor']
        self.box_annotator = shared_model['box_annotator']
        self.label_annotator = shared_model['label_annotator']
        self.detection_classes = set(camera_config.detection_classes)
        self.confidence_threshold = camera_config.odthreshold / 100.0
    
    def update_config(self, camera_config: CameraConfig):
        self.camera_config = camera_config
        self.detection_classes = set(camera_config.detection_classes)
        self.confidence_threshold = camera_config.odthreshold / 100.0
    
    def predict_frame(self, frame: np.ndarray) -> np.ndarray:
        if not self.camera_config.is_detection or not self.detection_classes:
            return frame
            
        try:
            inputs = self.processor(images=frame, return_tensors="pt").to(self.device)
            converted_image = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            pil_image = Image.fromarray(converted_image)
            target_sizes = torch.tensor([pil_image.size[::-1]]).to(self.device)
            
            with torch.no_grad():
                outputs = self.model(**inputs)
            
            results = self.processor.post_process_object_detection(
                outputs, 
                target_sizes=target_sizes, 
                threshold=self.confidence_threshold
            )
            detections = sv.Detections.from_transformers(results[0]).with_nms(threshold=0.1)
            
            if self.detection_classes:
                mask = np.isin(detections.class_id, list(self.detection_classes))
                detections = detections[mask]
            
            labels = []
            for class_id, confidence in zip(detections.class_id, detections.confidence):
                class_name = COCO_CLASS_NAMES.get(class_id, f"class_{class_id}")
                labels.append(f"{class_name} {confidence:.2f}")
            
            annotated_frame = frame.copy()
            annotated_frame = self.box_annotator.annotate(scene=annotated_frame, detections=detections)
            annotated_frame = self.label_annotator.annotate(scene=annotated_frame, detections=detections, labels=labels)
            
            return annotated_frame
            
        except Exception as e:
            return frame

class CameraPredictorWithAnalytics(CameraPredictor):
    """Enhanced camera predictor with analytics tracking and object tracking"""
    
    def __init__(self, camera_config: CameraConfig, shared_model: Dict[str, Any], analytics_manager: ObjectDetectionAnalytics):
        super().__init__(camera_config, shared_model)
        self.analytics_manager = analytics_manager
        self.session_id = str(uuid.uuid4())
        
        # Initialize ByteTrack for object tracking
        self.tracker = ByteTrack(
            track_activation_threshold=0.25,
            lost_track_buffer=30,
            minimum_matching_threshold=0.8,
            frame_rate=30
        )
        
        # Track statistics
        self.tracked_objects = {}  # {tracker_id: {'class_id': int, 'class_name': str, 'first_seen': timestamp}}
        self.track_history = deque(maxlen=1000)  # Store recent tracking events
        
        logger.info(f"Object tracker initialized for camera: {camera_config.name}")
    
    def predict_frame(self, frame: np.ndarray) -> np.ndarray:
        if not self.camera_config.is_detection or not self.detection_classes:
            return frame
            
        try:
            inputs = self.processor(images=frame, return_tensors="pt").to(self.device)
            converted_image = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            pil_image = Image.fromarray(converted_image)
            target_sizes = torch.tensor([pil_image.size[::-1]]).to(self.device)
            
            with torch.no_grad():
                outputs = self.model(**inputs)
            
            results = self.processor.post_process_object_detection(
                outputs, 
                target_sizes=target_sizes, 
                threshold=self.confidence_threshold
            )
            detections = sv.Detections.from_transformers(results[0]).with_nms(threshold=0.1)
            
            # Filter by detection classes
            if self.detection_classes:
                mask = np.isin(detections.class_id, list(self.detection_classes))
                detections = detections[mask]
            
            # Apply tracking to detections
            detections = self.tracker.update_with_detections(detections)
            
            # Log detection events with tracker IDs for analytics
            if len(detections) > 0 and self.analytics_manager:
                asyncio.create_task(
                    self._log_tracked_detections(
                        detections, 
                        frame.shape
                    )
                )
            
            # Prepare labels with tracker IDs
            labels = []
            for i, (class_id, confidence, tracker_id) in enumerate(
                zip(detections.class_id, detections.confidence, detections.tracker_id)
            ):
                class_name = COCO_CLASS_NAMES.get(class_id, f"class_{class_id}")
                
                # Update tracked objects dictionary
                if tracker_id not in self.tracked_objects:
                    self.tracked_objects[tracker_id] = {
                        'class_id': class_id,
                        'class_name': class_name,
                        'first_seen': time.time(),
                        'frame_count': 0
                    }
                
                self.tracked_objects[tracker_id]['frame_count'] += 1
                self.tracked_objects[tracker_id]['last_seen'] = time.time()
                
                # Create label with tracker ID
                labels.append(f"#{tracker_id} {class_name} {confidence:.2f}")
            
            # Annotate frame with detections and tracker IDs
            annotated_frame = frame.copy()
            annotated_frame = self.box_annotator.annotate(scene=annotated_frame, detections=detections)
            annotated_frame = self.label_annotator.annotate(scene=annotated_frame, detections=detections, labels=labels)
            
            return annotated_frame
            
        except Exception as e:
            logger.error(f"Error in tracked prediction: {e}")
            return frame
    
    async def _log_tracked_detections(self, detections, frame_shape):
        """Log detection events with tracker IDs to analytics"""
        try:
            current_time = datetime.now(tz=timezone.utc)
            
            for i in range(len(detections.class_id) if hasattr(detections, 'class_id') else 0):
                # Extract detection data
                bbox = detections.xyxy[i] if hasattr(detections, 'xyxy') and len(detections.xyxy) > i else [0, 0, 0, 0]
                class_id = int(detections.class_id[i]) if hasattr(detections, 'class_id') and len(detections.class_id) > i else 0
                confidence = float(detections.confidence[i]) if hasattr(detections, 'confidence') and len(detections.confidence) > i else 0.0
                tracker_id = int(detections.tracker_id[i]) if hasattr(detections, 'tracker_id') and len(detections.tracker_id) > i else None
                
                # Get class name
                class_name = COCO_CLASS_NAMES.get(class_id, f"class_{class_id}")
                
                # Get tracking metadata
                track_metadata = {}
                if tracker_id and tracker_id in self.tracked_objects:
                    track_info = self.tracked_objects[tracker_id]
                    track_metadata = {
                        'tracker_id': tracker_id,
                        'first_seen': track_info.get('first_seen'),
                        'frame_count': track_info.get('frame_count', 0),
                        'track_duration': time.time() - track_info.get('first_seen', time.time())
                    }
                
                detection_event = {
                    'camera_id': self.camera_config.id,
                    'camera_name': self.camera_config.name,
                    'camera_url': self.camera_config.url,
                    'timestamp': current_time.isoformat(),
                    'object_class_id': class_id,
                    'object_class_name': class_name,
                    'confidence': confidence,
                    'bbox_x': float(bbox[0]) if len(bbox) > 0 else 0.0,
                    'bbox_y': float(bbox[1]) if len(bbox) > 1 else 0.0,
                    'bbox_width': float(bbox[2] - bbox[0]) if len(bbox) > 2 else 0.0,
                    'bbox_height': float(bbox[3] - bbox[1]) if len(bbox) > 3 else 0.0,
                    'frame_width': frame_shape[1] if len(frame_shape) > 1 else 0,
                    'frame_height': frame_shape[0] if len(frame_shape) > 0 else 0,
                    'session_id': self.session_id,
                    'tracker_id': tracker_id,  # Add tracker ID
                    'detection_metadata': {
                        'model_threshold': self.camera_config.odthreshold / 100.0,
                        'detection_classes': self.camera_config.detection_classes,
                        'recording_active': getattr(self.camera_config, 'recording_active', False),
                        'tracking_metadata': track_metadata  # Add tracking metadata
                    }
                }
                
                self.analytics_manager.detection_buffer.append(detection_event)
                
                # Store in track history
                self.track_history.append({
                    'tracker_id': tracker_id,
                    'class_name': class_name,
                    'timestamp': current_time.isoformat()
                })
            
            # Check if we need to flush
            current_time_unix = time.time()
            if (len(self.analytics_manager.detection_buffer) >= self.analytics_manager.buffer_size or 
                current_time_unix - self.analytics_manager.last_flush >= self.analytics_manager.flush_interval):
                await self.analytics_manager._flush_detection_buffer()
                
        except Exception as e:
            if self.analytics_manager and self.analytics_manager.logging_manager:
                await self.analytics_manager.logging_manager.log_error(
                    f"Error logging tracked detection events: {e}",
                    category="DETECTION",
                    error=e
                )
    
    def get_tracking_statistics(self) -> Dict[str, Any]:
        """Get statistics about tracked objects"""
        return {
            'total_tracked_objects': len(self.tracked_objects),
            'active_tracks': len([t for t in self.tracked_objects.values() 
                                 if time.time() - t.get('last_seen', 0) < 5]),
            'tracked_objects': self.tracked_objects,
            'recent_history': list(self.track_history)[-50:]  # Last 50 tracking events
        }
    
    def reset_tracker(self):
        """Reset the tracker and clear tracked objects"""
        self.tracker.reset()
        self.tracked_objects.clear()
        self.track_history.clear()
        logger.info(f"Tracker reset for camera: {self.camera_config.name}")

# ====== RECORDING MANAGER ======

class RecordingManager:
    def __init__(self, storage_manager: SupabaseStorageManager):
        self.storage_manager = storage_manager
        self.active_recorders = {}
        self.recording_status = {}
        self.upload_queue = asyncio.Queue()
        self.upload_worker_running = False
        
    def get_object_key(self, camera_config: CameraConfig, recording_type: str = "") -> Tuple[str, str]:
        container = 'webm'
        object_key = self.storage_manager.generate_object_key(
            camera_config.name, 
            recording_type or camera_config.rectype, 
            container
        )
        return object_key, container
    
    async def start_conversion_worker(self):
        """Start the upload worker for processing recorded files"""
        if not self.upload_worker_running:
            self.upload_worker_running = True
            asyncio.create_task(self._upload_worker())
    
    async def _upload_worker(self):
        """Background worker to upload recorded files to Supabase"""
        while self.upload_worker_running:
            try:
                # Wait for upload task
                upload_data = await asyncio.wait_for(self.upload_queue.get(), timeout=5.0)
                
                file_path = upload_data['file_path']
                object_key = upload_data['object_key']
                camera_name = upload_data['camera_name']
                recording_type = upload_data['recording_type']
                
                # Check if file exists and has content
                if os.path.exists(file_path) and os.path.getsize(file_path) > 0:
                    success = await self.storage_manager.upload_file(
                        object_key=object_key,
                        file_path=file_path,
                        content_type="video/webm"
                    )
                    
                    if success:
                        logger.info(f"Successfully uploaded recording: {object_key}")
                        # Log to database
                        logging_manager = get_logging_manager()
                        if logging_manager:
                            await logging_manager.log_info(
                                f"Recording uploaded successfully: {camera_name}",
                                category=LogCategory.RECORDING,
                                subcategory=LogSubcategory.SUPABASE_UPLOAD,
                                context=LogContext(
                                    camera_name=camera_name,
                                    additional_data={
                                        'object_key': object_key,
                                        'recording_type': recording_type,
                                        'file_size': os.path.getsize(file_path)
                                    }
                                )
                            )
                    else:
                        logger.error(f"Failed to upload recording: {object_key}")
                        logging_manager = get_logging_manager()
                        if logging_manager:
                            await logging_manager.log_error(
                                f"Recording upload failed: {camera_name}",
                                category=LogCategory.RECORDING,
                                subcategory=LogSubcategory.SUPABASE_UPLOAD,
                                context=LogContext(
                                    camera_name=camera_name,
                                    additional_data={
                                        'object_key': object_key,
                                        'recording_type': recording_type
                                    }
                                )
                            )
                    
                    # Clean up local file
                    try:
                        os.remove(file_path)
                    except Exception as e:
                        logger.warning(f"Failed to remove local file {file_path}: {e}")
                else:
                    logger.warning(f"Recording file not found or empty: {file_path}")
                
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"Error in upload worker: {e}")
                continue
    
    async def queue_upload(self, file_path: str, object_key: str, camera_name: str, recording_type: str):
        """Queue a file for upload to Supabase"""
        upload_data = {
            'file_path': file_path,
            'object_key': object_key,
            'camera_name': camera_name,
            'recording_type': recording_type
        }
        await self.upload_queue.put(upload_data)
        logger.info(f"Queued recording for upload: {object_key}")

# ====== CONNECTION STATUS ======

class ConnectionStatus:
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    RECONNECTING = "reconnecting"
    FAILED = "failed"
    
    def __init__(self):
        self.status = self.DISCONNECTED
        self.retry_count = 0
        self.max_retries = 5
        self.last_retry_time = 0
        self.retry_delay = 5
        
    def can_retry(self):
        current_time = time.time()
        return (self.retry_count < self.max_retries and 
                current_time - self.last_retry_time >= self.retry_delay)
    
    def mark_retry(self):
        self.retry_count += 1
        self.last_retry_time = time.time()
        self.status = self.RECONNECTING
        
    def reset(self):
        self.retry_count = 0
        self.status = self.CONNECTED
        
    def mark_failed(self):
        self.status = self.FAILED
        
    def mark_disconnected(self):
        self.status = self.DISCONNECTED



# ====== LOCAL/USB CAMERA SUPPORT - NO SCHEMA CHANGES ======
# Add this code to your existing vitcam-server.py

import platform
import glob

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
    def parse_camera_source(url: str) -> Union[int, str]:
        """
        Parse camera source from URL:
        - "local:0" → 0
        - "local:/dev/video0" → "/dev/video0"
        - "0" → 0
        - "/dev/video0" → "/dev/video0"
        - "rtsp://..." → "rtsp://..."
        """
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

# ====== CUSTOM VIDEO STREAM TRACK WITH DYNAMIC BITRATE ======

class CustomVideoStreamTrack(VideoStreamTrack):
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
        
        # ENHANCED: Dynamic bitrate configuration based on camera settings
        # Always get camera parameters first
        width, height = self.camera_config.resolution_tuple
        codec = self.camera_config.normalized_encoder
        fps = self.camera_config.fps or 30
        
        if bitrate_config:
            self.bitrate_config = bitrate_config
        else:
            # Calculate optimal bitrate based on camera resolution and codec
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
            # Apply background subtraction
            fg_mask = self.background_subtractor.apply(frame)
            
            # Reduce noise
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
            fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, kernel)
            fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_CLOSE, kernel)
            
            # Find contours
            contours, _ = cv2.findContours(fg_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            # Check if any contour is large enough
            for contour in contours:
                area = cv2.contourArea(contour)
                if area > self.area_threshold:
                    return True
            
            return False
            
        except Exception as e:
            return False
    
    def _start_recording(self, recording_type: str):
        """Start video recording with proper WebM format"""
        try:
            if self.recording_active:
                return False
            
            # Generate object key and temporary file path
            object_key, container = self.recording_manager.get_object_key(self.camera_config, recording_type)
            
            # Create temporary recording file
            temp_dir = tempfile.gettempdir()
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            temp_filename = f"recording_{self.camera_config.id}_{timestamp}.{container}"
            temp_recording_path = os.path.join(temp_dir, temp_filename)
            
            # Get optimal codec configuration
            fourcc, optimal_container, codec_name = safe_fourcc(
                self.camera_config.encoder,
                self.target_resolution[0],
                self.target_resolution[1],
                self.target_fps,
                container,
                self.camera_config.url,
                prefer_webm=True
            )
            
            # Create video writer
            self.video_writer = cv2.VideoWriter(
                temp_recording_path,
                fourcc,
                self.target_fps,
                self.target_resolution
            )
            
            if not self.video_writer.isOpened():
                logger.error(f"Failed to open video writer for {self.camera_config.name}")
                return False
            
            # Set recording state
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
            
            if self.logging_manager:
                asyncio.create_task(self.logging_manager.log_info(
                    f"Started {recording_type} recording",
                    category=LogCategory.RECORDING,
                    subcategory=LogSubcategory.RECORDING_START,
                    context=LogContext(
                        camera_id=self.camera_config.id,
                        camera_name=self.camera_config.name,
                        camera_url=self.camera_config.url,
                        additional_data={
                            'recording_type': recording_type,
                            'object_key': object_key,
                            'codec': codec_name,
                            'container': optimal_container,
                            'resolution': f"{self.target_resolution[0]}x{self.target_resolution[1]}",
                            'fps': self.target_fps,
                            'bitrate_kbps': self.max_bitrate // 1000
                        }
                    )
                ))
            
            return True
            
        except Exception as e:
            logger.error(f"Error starting recording for {self.camera_config.name}: {e}")
            if self.logging_manager:
                asyncio.create_task(self.logging_manager.log_error(
                    f"Error starting recording: {e}",
                    category=LogCategory.RECORDING,
                    subcategory=LogSubcategory.RECORDING_START,
                    context=LogContext(
                        camera_id=self.camera_config.id,
                        camera_name=self.camera_config.name,
                        camera_url=self.camera_config.url
                    ),
                    error=e
                ))
            return False
    
    def _stop_recording(self):
        """Stop video recording and queue for upload"""
        try:
            if not self.recording_active or not self.video_writer:
                return False
            
            # Release video writer
            self.video_writer.release()
            self.video_writer = None
            
            recording_duration = time.time() - self.recording_start_time if self.recording_start_time else 0
            
            logger.info(f"Stopped recording for {self.camera_config.name} after {recording_duration:.1f}s")
            
            # Queue for upload if file exists and has content
            if (self.temp_recording_path and 
                os.path.exists(self.temp_recording_path) and 
                os.path.getsize(self.temp_recording_path) > 0):
                
                asyncio.create_task(self.recording_manager.queue_upload(
                    file_path=self.temp_recording_path,
                    object_key=self.current_object_key,
                    camera_name=self.camera_config.name,
                    recording_type=self.camera_config.rectype
                ))
                
                if self.logging_manager:
                    asyncio.create_task(self.logging_manager.log_info(
                        f"Recording completed and queued for upload",
                        category=LogCategory.RECORDING,
                        subcategory=LogSubcategory.RECORDING_STOP,
                        context=LogContext(
                            camera_id=self.camera_config.id,
                            camera_name=self.camera_config.name,
                            camera_url=self.camera_config.url,
                            additional_data={
                                'recording_duration': recording_duration,
                                'object_key': self.current_object_key,
                                'file_size': os.path.getsize(self.temp_recording_path)
                            }
                        )
                    ))
            else:
                logger.warning(f"Recording file not found or empty: {self.temp_recording_path}")
                if self.logging_manager:
                    asyncio.create_task(self.logging_manager.log_warning(
                        f"Recording file not found or empty",
                        category=LogCategory.RECORDING,
                        subcategory=LogSubcategory.RECORDING_STOP,
                        context=LogContext(
                            camera_id=self.camera_config.id,
                            camera_name=self.camera_config.name,
                            camera_url=self.camera_config.url,
                            additional_data={
                                'temp_path': self.temp_recording_path
                            }
                        )
                    ))
            
            # Reset recording state
            self.recording_active = False
            self.recording_start_time = None
            self.current_object_key = None
            self.temp_recording_path = None
            self.current_codec_info = None
            
            return True
            
        except Exception as e:
            logger.error(f"Error stopping recording for {self.camera_config.name}: {e}")
            if self.logging_manager:
                asyncio.create_task(self.logging_manager.log_error(
                    f"Error stopping recording: {e}",
                    category=LogCategory.RECORDING,
                    subcategory=LogSubcategory.RECORDING_STOP,
                    context=LogContext(
                        camera_id=self.camera_config.id,
                        camera_name=self.camera_config.name,
                        camera_url=self.camera_config.url
                    ),
                    error=e
                ))
            self.recording_active = False
            return False
    
    def _write_frame_to_recording(self, frame: np.ndarray):
        """Write frame to active recording"""
        try:
            if self.recording_active and self.video_writer and self.video_writer.isOpened():
                # Resize frame to recording resolution
                recording_frame = cv2.resize(frame, self.target_resolution)
                self.video_writer.write(recording_frame)
                
                # Check recording duration limits
                if self.recording_start_time:
                    duration = time.time() - self.recording_start_time
                    if duration > self.max_recording_duration:
                        logger.info(f"Maximum recording duration reached for {self.camera_config.name}")
                        self._stop_recording()
                        
                        # For continuous recording, start a new recording
                        if self.camera_config.is_continuous_recording:
                            self._start_recording("continuous")
                            
        except Exception as e:
            logger.error(f"Error writing frame to recording: {e}")
    
    def _handle_motion_recording(self, frame: np.ndarray, motion_detected: bool):
        """Handle motion-triggered recording logic"""
        try:
            current_time = time.time()
            
            if motion_detected:
                self.last_motion_frame = current_time
                
                # Start recording if not active and cooldown period has passed
                if (not self.recording_active and 
                    current_time - self.last_motion_recording_end > self.motion_cooldown):
                    self._start_recording("motion")
                    
            else:
                # Stop recording if no motion for a while
                if (self.recording_active and 
                    self.last_motion_frame and 
                    current_time - self.last_motion_frame > self.motion_cooldown):
                    self._stop_recording()
                    self.last_motion_recording_end = current_time
                    
        except Exception as e:
            logger.error(f"Error handling motion recording: {e}")
        
    def configure_camera(self):
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
                
                if self.logging_manager:
                    asyncio.create_task(self.logging_manager.log_error(
                        f"Camera connection failed: {self.camera_config.name} - No frame received",
                        category=LogCategory.CAMERA,
                        subcategory=LogSubcategory.CAMERA_CONNECTION,
                        context=LogContext(
                            camera_id=self.camera_config.id,
                            camera_name=self.camera_config.name,
                            camera_url=self.camera_config.url
                        )
                    ))
            else:
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
                
                # Start recording based on configuration
                if self.camera_config.is_continuous_recording:
                    self._start_recording("continuous")
                
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
                    self.cap.stop()
                except:
                    pass
                self.cap = None
    
    async def _read_frames(self):
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
                
                # Add datetime overlay
                display_frame = self._add_datetime_overlay(display_frame)
                
                # Handle motion detection for motion recording
                motion_detected = False
                if self.camera_config.is_motion_recording:
                    motion_detected = self._detect_motion(frame)
                    self._handle_motion_recording(frame, motion_detected)
                
                # Write frame to recording if active
                if self.recording_active:
                    self._write_frame_to_recording(display_frame)
                
                # Apply object detection
                if self.camera_config.is_detection and self.predictor:
                    try:
                        display_frame = self.predictor.predict_frame(display_frame)
                    except Exception as e:
                        if self.logging_manager:
                            await self.logging_manager.log_error(
                                f"Object detection error: {self.camera_config.name} - {e}",
                                category=LogCategory.DETECTION,
                                subcategory=LogSubcategory.OBJECT_DETECTION,
                                context=LogContext(
                                    camera_id=self.camera_config.id,
                                    camera_name=self.camera_config.name,
                                    camera_url=self.camera_config.url
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
                        f"Frame processing error: {self.camera_config.name} - {e}",
                        category=LogCategory.CAMERA,
                        subcategory=LogSubcategory.FRAME_PROCESSING,
                        context=LogContext(
                            camera_id=self.camera_config.id,
                            camera_name=self.camera_config.name,
                            camera_url=self.camera_config.url
                        ),
                        error=e
                    )
                
                if hasattr(self, 'cap') and self.cap:
                    try:
                        self.cap.stop()
                    except:
                        pass
                    self.cap = None
                
            await asyncio.sleep(0.01)
    
    async def reconnect(self):
        if not self.connection_status.can_retry():
            if self.connection_status.retry_count >= self.connection_status.max_retries:
                self.connection_status.mark_failed()
                
                if self.logging_manager:
                    await self.logging_manager.log_error(
                        f"Maximum reconnection attempts reached: {self.camera_config.name}",
                        category=LogCategory.CAMERA,
                        subcategory=LogSubcategory.CAMERA_RECONNECTION,
                        context=LogContext(
                            camera_id=self.camera_config.id,
                            camera_name=self.camera_config.name,
                            camera_url=self.camera_config.url,
                            additional_data={'retry_count': self.connection_status.retry_count}
                        )
                    )
            return False
            
        self.connection_status.mark_retry()
        
        if self.logging_manager:
            await self.logging_manager.log_info(
                f"Attempting camera reconnection: {self.camera_config.name}",
                category=LogCategory.CAMERA,
                subcategory=LogSubcategory.CAMERA_RECONNECTION,
                context=LogContext(
                    camera_id=self.camera_config.id,
                    camera_name=self.camera_config.name,
                    camera_url=self.camera_config.url,
                    additional_data={'retry_attempt': self.connection_status.retry_count}
                )
            )
        
        if hasattr(self, 'cap') and self.cap is not None:
            try:
                self.cap.stop()
            except:
                pass
            self.cap = None
            
        self.configure_camera()
        
        success = hasattr(self, 'cap') and self.cap is not None
        
        if success and self.logging_manager:
            await self.logging_manager.log_info(
                f"Camera reconnection successful: {self.camera_config.name}",
                category=LogCategory.CAMERA,
                subcategory=LogSubcategory.CAMERA_RECONNECTION,
                context=LogContext(
                    camera_id=self.camera_config.id,
                    camera_name=self.camera_config.name,
                    camera_url=self.camera_config.url
                )
            )
        
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
        
        # Handle recording type changes
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
                self.cap.stop()
            except Exception:
                pass
            finally:
                self.cap = None

# ====== CONNECTION MANAGER WITH DYNAMIC BITRATE ======

def force_codec(pc, sender, forced_codec):
    if not forced_codec:
        return
        
    kind = forced_codec.split("/")[0]
    codecs = RTCRtpSender.getCapabilities(kind).codecs
    transceiver = next(t for t in pc.getTransceivers() if t.sender == sender)
    transceiver.setCodecPreferences(
        [codec for codec in codecs if codec.mimeType == forced_codec]
    )

class ConnectionManager:
    def __init__(self, db_manager: DatabaseManager):
        self.connections = set()
        self.video_tracks = {}
        self.connection_statuses = {}
        self.db_manager = db_manager
        self.predictor_cache = {}
        
    def add_connection(self, pc):
        self.connections.add(pc)
        conn_id = id(pc)
        self.connection_statuses[conn_id] = ConnectionStatus()
        
        logging_manager = get_logging_manager()
        if logging_manager:
            asyncio.create_task(logging_manager.log_info(
                f"New peer connection added: {conn_id}",
                category=LogCategory.NETWORK,
                context=LogContext(additional_data={'connection_id': conn_id})
            ))
        
        return pc
        
    def remove_connection(self, pc):
        if pc in self.connections:
            self.connections.remove(pc)
            conn_id = id(pc)
            if conn_id in self.connection_statuses:
                del self.connection_statuses[conn_id]
            
            logging_manager = get_logging_manager()
            if logging_manager:
                asyncio.create_task(logging_manager.log_info(
                    f"Peer connection removed: {conn_id}",
                    category=LogCategory.NETWORK,
                    context=LogContext(additional_data={'connection_id': conn_id})
                ))
            
    async def close_all(self):
        logging_manager = get_logging_manager()
        if logging_manager:
            await logging_manager.log_info(
                f"Closing all connections: {len(self.connections)}",
                category=LogCategory.NETWORK
            )
        
        coros = [pc.close() for pc in self.connections]
        await asyncio.gather(*coros, return_exceptions=True)
        self.connections.clear()
        
    async def get_or_create_video_track(self, rtsp_url, screen_type="full_screen", motion_detection=False):
        logging_manager = get_logging_manager()
        analytics_manager = get_analytics_manager()
        
        try:
            camera_config = await self.db_manager.get_camera_config(rtsp_url)
            if not camera_config:
                error_msg = f"No camera configuration found for URL: {rtsp_url}"
                if logging_manager:
                    await logging_manager.log_error(
                        error_msg,
                        category=LogCategory.CAMERA,
                        context=LogContext(camera_url=rtsp_url)
                    )
                return None
            
            key = f"{rtsp_url}_{camera_config.rectype}_{camera_config.is_detection}_{screen_type}"
            
            if key not in self.video_tracks or self.video_tracks[key]() is None:
                # Create predictor with analytics
                predictor = await self._get_or_create_predictor_with_analytics(camera_config)
                
                # ENHANCED: Calculate dynamic bitrate based on camera settings
                width, height = camera_config.resolution_tuple
                codec = camera_config.normalized_encoder
                fps = camera_config.fps or 30
                
                bitrate_config = BitrateManager.get_bitrate_config(width, height, codec, fps)
                
                # Log bitrate selection
                if logging_manager:
                    await logging_manager.log_info(
                        f"Creating track with dynamic bitrate: {bitrate_config['max_bitrate']//1000}kbps",
                        category=LogCategory.NETWORK,
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
                #     recording_manager=recording_manager,
                #     db_manager=self.db_manager
                # )
                # TO:
                track = EnhancedCustomVideoStreamTrack(
                    camera_config=camera_config,
                    predictor=predictor,
                    bitrate_config=bitrate_config,
                    recording_manager=recording_manager,
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
                    category=LogCategory.CAMERA,
                    context=LogContext(camera_url=rtsp_url),
                    error=e
                )
            return None
    
    async def _get_or_create_predictor_with_analytics(self, camera_config: CameraConfig) -> 'CameraPredictorWithAnalytics':
        cache_key = camera_config.url
        analytics_manager = get_analytics_manager()
        
        if cache_key not in self.predictor_cache:
            predictor = await CameraPredictorFactory.create_predictor(camera_config)
            self.predictor_cache[cache_key] = predictor
        else:
            predictor = self.predictor_cache[cache_key]
            predictor.update_config(camera_config)
            
        return predictor
    
    def stop_video_track(self, rtsp_url, screen_type="full_screen", motion_detection=False):
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
            return False
    
    async def refresh_camera_config(self, rtsp_url):
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
            return False

# ====== GLOBAL MANAGERS ======

global_logging_manager = None
global_analytics_manager = None

def get_logging_manager():
    return global_logging_manager

def set_logging_manager(logging_manager):
    global global_logging_manager
    global_logging_manager = logging_manager

def get_analytics_manager():
    return global_analytics_manager

def set_analytics_manager(analytics_manager):
    global global_analytics_manager
    global_analytics_manager = analytics_manager

# Initialize global components
db_manager = DatabaseManager(SUPABASE_URL, SUPABASE_KEY)
storage_manager = SupabaseStorageManager(SUPABASE_URL, SUPABASE_KEY, SUPABASE_BUCKET)
recording_manager = RecordingManager(storage_manager)
connection_manager = ConnectionManager(db_manager)


# ====== ANALYTICS API SERVER ======

# Pydantic models for API
class DetectionEventAPI(BaseModel):
    id: int
    camera_id: int
    camera_name: str
    timestamp: str
    object_class_name: str
    confidence: float
    bbox_x: float
    bbox_y: float
    bbox_width: float
    bbox_height: float

class AnalyticsResponseAPI(BaseModel):
    success: bool
    data: Any
    message: Optional[str] = None
    total_count: Optional[int] = None

# Analytics API
analytics_app = FastAPI(title="Object Detection Analytics API", version="1.0.0")

analytics_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_supabase_client():
    return create_client(SUPABASE_URL, SUPABASE_KEY)

@analytics_app.get("/api/analytics/cameras", response_model=AnalyticsResponseAPI)
async def get_cameras_with_analytics():
    try:
        supabase = get_supabase_client()
        
        print("Cameras API: Fetching camera analytics")
        
        # Get unique cameras from detection events
        cameras_response = supabase.table('object_detection_events').select(
            'camera_id, camera_name'
        ).execute()
        
        cameras_dict = {}
        
        if cameras_response and hasattr(cameras_response, 'data') and cameras_response.data:
            # Build unique cameras dictionary
            for event in cameras_response.data:
                if not event or not isinstance(event, dict):
                    continue
                    
                camera_id = event.get('camera_id')
                camera_name = event.get('camera_name', 'Unknown Camera')
                
                if camera_id and camera_id not in cameras_dict:
                    cameras_dict[camera_id] = {
                        'id': camera_id,
                        'name': camera_name,
                        'detection_count': 0,
                        'last_detection': None
                    }
        
        print(f"Found {len(cameras_dict)} unique cameras")
        
        # Get detection counts and last detection for each camera
        for camera_id, camera_data in cameras_dict.items():
            try:
                # Count total detections for this camera
                count_response = supabase.table('object_detection_events').select(
                    'id'
                ).eq('camera_id', camera_id).execute()
                
                detection_count = 0
                if count_response and hasattr(count_response, 'data') and count_response.data:
                    detection_count = len(count_response.data)
                
                camera_data['detection_count'] = detection_count
                
                # Get most recent detection timestamp
                latest_response = supabase.table('object_detection_events').select(
                    'timestamp'
                ).eq('camera_id', camera_id).order('timestamp', desc=True).limit(1).execute()
                
                if (latest_response and hasattr(latest_response, 'data') and 
                    latest_response.data and len(latest_response.data) > 0):
                    camera_data['last_detection'] = latest_response.data[0].get('timestamp')
                
                print(f"Camera {camera_id} ({camera_data['name']}): {detection_count} detections")
                
            except Exception as camera_error:
                print(f"Error processing camera {camera_id}: {camera_error}")
                camera_data['detection_count'] = 0
                camera_data['last_detection'] = None
        
        cameras_list = list(cameras_dict.values())
        
        return AnalyticsResponseAPI(
            success=True,
            data=cameras_list,
            total_count=len(cameras_list),
            message="Camera analytics retrieved successfully"
        )
        
    except Exception as e:
        error_msg = f"Cameras API Error: {str(e)}"
        print(f"Cameras error: {error_msg}")
        print(f"Cameras traceback: {traceback.format_exc()}")
        
        return AnalyticsResponseAPI(
            success=False,
            data=[],
            total_count=0,
            message=error_msg
        )


@analytics_app.get("/api/analytics/dashboard", response_model=AnalyticsResponseAPI)
async def get_dashboard_data(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    camera_id: Optional[int] = Query(None),
    camera_name: Optional[str] = Query(None)
):
    try:
        supabase = get_supabase_client()
        
        # Parse and validate dates
        try:
            if start_date:
                start_date = unquote(start_date)
                if start_date.endswith('Z'):
                    start_date = start_date.replace('Z', '+00:00')
                start_dt = datetime.fromisoformat(start_date)
                if start_dt.tzinfo is None:
                    start_dt = start_dt.replace(tzinfo=timezone.utc)
            else:
                start_dt = datetime.now(timezone.utc) - timedelta(days=7)
                
            if end_date:
                end_date = unquote(end_date)
                if end_date.endswith('Z'):
                    end_date = end_date.replace('Z', '+00:00')
                end_dt = datetime.fromisoformat(end_date)
                if end_dt.tzinfo is None:
                    end_dt = end_dt.replace(tzinfo=timezone.utc)
            else:
                end_dt = datetime.now(timezone.utc)
                
            start_date_str = start_dt.isoformat()
            end_date_str = end_dt.isoformat()
            
        except Exception:
            end_dt = datetime.now(timezone.utc)
            start_dt = end_dt - timedelta(days=7)
            start_date_str = start_dt.isoformat()
            end_date_str = end_dt.isoformat()
        
        # Build query
        try:
            query = supabase.table('object_detection_events').select(
                'id, camera_id, camera_name, timestamp, object_class_name, confidence, '
                'bbox_x, bbox_y, bbox_width, bbox_height, tracker_id'
            )
            
            query = query.gte('timestamp', start_date_str).lte('timestamp', end_date_str)
            
            if camera_id:
                query = query.eq('camera_id', camera_id)
            if camera_name:
                query = query.ilike('camera_name', f'%{camera_name}%')
            
            response = query.order('timestamp', desc=True).limit(1000).execute()
            
            events_data = []
            if response and hasattr(response, 'data') and response.data:
                events_data = response.data
                
        except Exception:
            events_data = []
        
        # Process data
        hourly_data = {str(i): 0 for i in range(24)}
        object_counts = {}
        cameras_dict = {}
        
        for event in events_data:
            try:
                if not event or not isinstance(event, dict):
                    continue
                
                timestamp_str = event.get('timestamp')
                if timestamp_str:
                    try:
                        if isinstance(timestamp_str, str):
                            if timestamp_str.endswith('Z'):
                                timestamp_str = timestamp_str.replace('Z', '+00:00')
                            timestamp = datetime.fromisoformat(timestamp_str)
                        else:
                            timestamp = timestamp_str
                            
                        if timestamp.tzinfo is None:
                            timestamp = timestamp.replace(tzinfo=timezone.utc)
                        
                        hour_key = str(timestamp.hour)
                        hourly_data[hour_key] = hourly_data.get(hour_key, 0) + 1
                        
                    except Exception:
                        continue
                
                obj_name = event.get('object_class_name')
                if obj_name and isinstance(obj_name, str):
                    object_counts[obj_name] = object_counts.get(obj_name, 0) + 1
                
                camera_id_val = event.get('camera_id')
                camera_name_val = event.get('camera_name')
                if camera_id_val and camera_name_val:
                    if camera_id_val not in cameras_dict:
                        cameras_dict[camera_id_val] = {
                            'id': camera_id_val,
                            'name': camera_name_val
                        }
                
            except Exception:
                continue
        
        top_objects = sorted(object_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        
        dashboard_data = {
            'summary': {
                'total_events': len(events_data),
                'total_cameras': len(cameras_dict),
                'date_range': {
                    'start': start_date_str,
                    'end': end_date_str
                },
                'stats': []
            },
            'recent_events': events_data,
            'hourly_distribution': hourly_data,
            'top_objects': top_objects,
            'cameras': list(cameras_dict.values())
        }
        
        return AnalyticsResponseAPI(
            success=True,
            data=dashboard_data,
            total_count=len(events_data),
            message="Dashboard data retrieved successfully"
        )
        
    except Exception as e:
        empty_data = {
            'summary': {
                'total_events': 0,
                'total_cameras': 0,
                'date_range': {
                    'start': datetime.now(timezone.utc).isoformat(),
                    'end': datetime.now(timezone.utc).isoformat()
                },
                'stats': []
            },
            'recent_events': [],
            'hourly_distribution': {str(i): 0 for i in range(24)},
            'top_objects': [],
            'cameras': []
        }
        
        return AnalyticsResponseAPI(
            success=False,
            data=empty_data,
            total_count=0,
            message=str(e)
        )

# ====== API ENDPOINT FOR LOCAL CAMERA DETECTION ======

@analytics_app.get("/api/cameras/local/detect")
async def detect_local_cameras():
    """Detect all available local/USB cameras"""
    try:
        cameras = LocalCameraDetector.detect_cameras()
        
        return {
            "success": True,
            "cameras": cameras,
            "total_count": len(cameras),
            "message": f"Found {len(cameras)} local camera(s)"
        }
    except Exception as e:
        return {
            "success": False,
            "cameras": [],
            "total_count": 0,
            "message": f"Error detecting cameras: {str(e)}"
        }
# ====== WEBSOCKET HANDLER WITH DYNAMIC BITRATE ======

async def handle_websocket(websocket):
    """WebSocket handler with dynamic bitrate support"""
    client_id = str(uuid.uuid4())
    logging_manager = get_logging_manager()
    analytics_manager = get_analytics_manager()
    
    if logging_manager:
        await logging_manager.log_info(
            f"New client connected: {client_id}",
            category=LogCategory.WEBSOCKET,
            subcategory=LogSubcategory.WEBSOCKET_CONNECTION,
            context=LogContext(
                client_id=client_id,
                session_id=logging_manager.session_id,
                additional_data={'client_remote_address': str(websocket.remote_address)}
            )
        )
    
    logger.info(f"New client connected: {client_id}")
    
    peer_connection = None
    connection_status = ConnectionStatus()
    active_tracks = {}
    current_screen_type = "full_screen"
    
    def setup_peer_connection():
        nonlocal peer_connection
        
        configuration = RTCConfiguration(
                iceServers=[
                    RTCIceServer(urls=["stun:stun.l.google.com:19302","stun:stun1.l.google.com:19302",
                                       "stun:stun2.l.google.com:19302","stun:stun.l.google.com:19302",
                                        "stun:stun3.l.google.com:19302","stun:stun4.l.google.com:19302"]),
                   RTCIceServer(urls=["turn:127.0.0.1:3478"], username="webrtc", credential="webrtc123")
                ])
        new_pc = RTCPeerConnection(configuration=configuration)
        new_pc = connection_manager.add_connection(new_pc)
        if new_pc is None:
            logger.error("Failed to create new peer connection")
            return None
        
        peer_connection = new_pc

        @new_pc.on("datachannel")
        def on_datachannel(channel):
            logger.info(f"Data channel established: {channel.label}")
            
            @channel.on("message")
            async def on_message(message):
                nonlocal current_screen_type
                
                try:
                    data = json.loads(message) if isinstance(message, str) else message
                    logger.info(f"Received message on data channel: {data}")
                    
                    if isinstance(data, dict) and "type" in data:
                        if data["type"] == "ping":
                            await channel.send(json.dumps({"type": "pong", "timestamp": time.time()}))
                        
                        elif data["type"] == "get_bitrate_info":
                            rtsp_url = data.get("rtsp_url")
                            if rtsp_url:
                                camera_config = await db_manager.get_camera_config(rtsp_url)
                                if camera_config:
                                    width, height = camera_config.resolution_tuple
                                    codec = camera_config.normalized_encoder
                                    fps = camera_config.fps or 30
                                    
                                    bitrate_config = BitrateManager.get_bitrate_config(width, height, codec, fps)
                                    
                                    await channel.send(json.dumps({
                                        "type": "bitrate_info_response",
                                        "camera_name": camera_config.name,
                                        "bitrate_config": bitrate_config,
                                        "timestamp": time.time()
                                    }))
                        
                        # [Include all other data channel handlers from original code]
                        
                except Exception as e:
                    logger.error(f"Error handling data channel message: {e}")
                    await channel.send(json.dumps({"type": "error", "message": str(e)}))

        @new_pc.on("connectionstatechange")
        async def on_connectionstatechange():
            logger.info(f"Connection state changed to {new_pc.connectionState} for client {client_id}")
            
            if new_pc.connectionState == "connected":
                connection_status.reset()
            elif new_pc.connectionState == "failed":
                logger.warning(f"Connection failed for client {client_id}")
                connection_status.mark_failed()
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
                message_type = data.get('type', 'unknown')
                
                logger.info(f"Received websocket message type: {data.get('type', 'unknown')}")

                if data["type"] == "offer":
                    if not peer_connection or peer_connection.signalingState == "closed":
                        setup_peer_connection()
                    
                    try:
                        await peer_connection.setRemoteDescription(
                            RTCSessionDescription(sdp=data["sdp"]["sdp"], type=data["sdp"]["type"])
                        )
                    except Exception as e:
                        logger.error(f"Error setting remote description: {e}")
                        setup_peer_connection()
                        await peer_connection.setRemoteDescription(
                            RTCSessionDescription(sdp=data["sdp"]["sdp"], type=data["sdp"]["type"])
                        )

                    rtsp_url = data.get("rtsp_url")
                    screen_type = data.get("screen_type", "full_screen")
                    motion_detection = data.get("motion_detection", False)
                    current_screen_type = screen_type
                                       
                    if rtsp_url:
                        try:
                            video_track = await connection_manager.get_or_create_video_track(
                                rtsp_url, screen_type=screen_type, motion_detection=motion_detection)
                            
                            if video_track:
                                key = f"{rtsp_url}_{screen_type}_{motion_detection}"
                                active_tracks[key] = video_track
                                
                                video_sender = peer_connection.addTrack(video_track)
                                force_codec(peer_connection, video_sender, 'video/VP9')
                        
                        except Exception as e:
                            logger.error(f"Error setting up video track: {e}")
                   
                    answer = await peer_connection.createAnswer()
                    await peer_connection.setLocalDescription(answer)

                    while peer_connection.iceGatheringState != "complete":
                        await asyncio.sleep(0.1)
                    
                    # ENHANCED: Get dynamic bitrate from camera configuration
                    if rtsp_url:
                        camera_config = await db_manager.get_camera_config(rtsp_url)
                        if camera_config:
                            width, height = camera_config.resolution_tuple
                            codec = camera_config.normalized_encoder
                            fps = camera_config.fps or 30
                            
                            bitrate_config = BitrateManager.get_bitrate_config(width, height, codec, fps)
                            
                            # Modify SDP with dynamic bitrate
                            modified_sdp = BitrateManager.modify_sdp_for_bitrate(
                                peer_connection.localDescription.sdp,
                                bitrate_config["max_bitrate"]
                            )
                            
                            # Log bitrate application
                            logger.info(f"Applied dynamic bitrate: {bitrate_config['max_bitrate']//1000}kbps for {camera_config.name}")
                        else:
                            bitrate_config = BitrateManager.get_bitrate_config(640, 480, 'VP9', 30)
                            modified_sdp = peer_connection.localDescription.sdp
                    else:
                        bitrate_config = BitrateManager.get_bitrate_config(640, 480, 'VP9', 30)
                        modified_sdp = peer_connection.localDescription.sdp
                    
                    response_data = {
                        "type": "answer",
                        "sdp": {"sdp": modified_sdp, "type": peer_connection.localDescription.type},
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
                                'bitrate_mbps': round(bitrate_config['max_bitrate'] / 1_000_000, 2)
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
            logging_manager = get_logging_manager()
            
            logger.info(f"Active connections: {len(connection_manager.connections)}")
            
            # Log active tracks with bitrate info
            for key, track_ref in connection_manager.video_tracks.items():
                if track_ref() is not None:
                    track = track_ref()
                    if hasattr(track, 'camera_config') and hasattr(track, 'max_bitrate'):
                        logger.info(f"Active track: {track.camera_config.name} - "
                                  f"{track.max_bitrate//1000}kbps @ "
                                  f"{track.target_resolution[0]}x{track.target_resolution[1]}")
            
        except Exception as e:
            logger.error(f"Error in heartbeat: {e}")
            
        await asyncio.sleep(30)

# ====== MAIN FUNCTION ======

async def main():
    """Enhanced main function with dynamic bitrate configuration"""
    try:
        # Initialize logging manager
        global global_logging_manager
        global_logging_manager = SupabaseLoggingManager(
            supabase_client=storage_manager.client
        )
        set_logging_manager(global_logging_manager)
        
        # Initialize analytics manager
        global global_analytics_manager
        global_analytics_manager = ObjectDetectionAnalytics(
            supabase_client=storage_manager.client,
            logging_manager=global_logging_manager
        )
        set_analytics_manager(global_analytics_manager)
        
        # Log system startup
        await global_logging_manager.log_info(
            "Starting WebRTC Server with Dynamic Bitrate Configuration",
            category=LogCategory.SYSTEM,
            context=LogContext(additional_data={
                'version': '15.0.0',
                'features': ['dynamic_bitrate', 'analytics', 'datetime_overlay', 'webm_recording']
            })
        )
        
        # Start recording manager
        await recording_manager.start_conversion_worker()
        
        # Start heartbeat
        asyncio.create_task(heartbeat())
        
        # Start analytics API
        def run_analytics_api():
            uvicorn.run(analytics_app, host="0.0.0.0", port=8766, log_level="info")
        
        analytics_thread = threading.Thread(target=run_analytics_api, daemon=True)
        analytics_thread.start()
        
        logger.info("=" * 80)
        logger.info("WebRTC Server with Dynamic Bitrate Configuration")
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
                logger.info(f"    {codec}: {bitrate//1_000_000:.2f} Mbps ({bitrate//1000} kbps)")
        logger.info("")
        logger.info("Server Status:")
        logger.info(f"  WebSocket: ws://0.0.0.0:8765")
        logger.info(f"  Analytics API: http://0.0.0.0:8766/api/analytics/")
        logger.info(f"  Storage: Supabase ({SUPABASE_BUCKET})")
        logger.info("=" * 80)
        
    except Exception as e:
        logger.error(f"System initialization failed: {e}")
        raise
    
    # Start WebSocket server
    async with websockets.serve(
        handle_websocket, "0.0.0.0", 8765
    ):
        await asyncio.Future()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Server shutdown requested")
    except Exception as e:
        logger.error(f"Server startup failed: {e}")