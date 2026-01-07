# ============================================================================
# FILE: api/schemas.py
# ============================================================================
from pydantic import BaseModel, Field
from typing import Any, Optional


class DetectionEventAPI(BaseModel):
    """Detection event API schema"""
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
    """Analytics response API schema"""
    success: bool
    data: Any
    message: Optional[str] = None
    total_count: Optional[int] = None

