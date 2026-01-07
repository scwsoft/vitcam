# ============================================================================
# FILE: detection/__init__.py
# ============================================================================
"""Object detection module with predictors and factory"""

from .predictor import CameraPredictor, CameraPredictorWithAnalytics
from .factory import CameraPredictorFactory

__all__ = [
    'CameraPredictor',
    'CameraPredictorWithAnalytics',
    'CameraPredictorFactory'
]
