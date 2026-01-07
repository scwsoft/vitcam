# ============================================================================
# FILE: models/detection.py
# ============================================================================
from dataclasses import dataclass
from datetime import datetime
from typing import Optional


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
    tracker_id: Optional[int] = None