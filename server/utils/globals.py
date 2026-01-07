# ============================================================================
# FILE: utils/globals.py
# ============================================================================
"""Global state management for application-wide services"""

from typing import Optional

# Global service instances
_logging_manager = None
_analytics_manager = None


def get_logging_manager():
    """Get global logging manager instance"""
    return _logging_manager


def set_logging_manager(logging_manager):
    """Set global logging manager instance"""
    global _logging_manager
    _logging_manager = logging_manager


def get_analytics_manager():
    """Get global analytics manager instance"""
    return _analytics_manager


def set_analytics_manager(analytics_manager):
    """Set global analytics manager instance"""
    global _analytics_manager
    _analytics_manager = analytics_manager


