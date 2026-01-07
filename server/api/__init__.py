# ============================================================================
# FILE: api/__init__.py
# ============================================================================
"""REST API module for analytics endpoints"""

from .analytics_api import create_analytics_app
from .schemas import DetectionEventAPI, AnalyticsResponseAPI

__all__ = [
    'create_analytics_app',
    'DetectionEventAPI',
    'AnalyticsResponseAPI'
]