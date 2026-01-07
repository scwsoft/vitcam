# ============================================================================
# FILE: utils/__init__.py
# ============================================================================
"""Utility functions and global state management"""

from .globals import (
    get_logging_manager,
    set_logging_manager,
    get_analytics_manager,
    set_analytics_manager
)

__all__ = [
    'get_logging_manager',
    'set_logging_manager',
    'get_analytics_manager',
    'set_analytics_manager'
]

