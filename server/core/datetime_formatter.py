# ============================================================================
# FILE: core/datetime_formatter.py
# ============================================================================
from datetime import datetime


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
        """
        Convert custom format to strftime format
        
        Args:
            custom_format: Custom format string
            
        Returns:
            strftime format string
        """
        return cls.FORMAT_MAPPING.get(custom_format, '%Y-%m-%d %H:%M:%S')
    
    @classmethod
    def format_datetime(cls, dt: datetime, custom_format: str) -> str:
        """
        Format datetime according to custom format
        
        Args:
            dt: Datetime object
            custom_format: Custom format string
            
        Returns:
            Formatted datetime string
        """
        strftime_format = cls.convert_format(custom_format)
        return dt.strftime(strftime_format)
