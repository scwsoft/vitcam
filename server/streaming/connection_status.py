# ============================================================================
# FILE: streaming/connection_status.py
# ============================================================================
import time


class ConnectionStatus:
    """Track connection status and retry logic"""
    
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    RECONNECTING = "reconnecting"
    FAILED = "failed"
    
    def __init__(self, max_retries: int = 5, retry_delay: int = 5):
        """
        Initialize connection status
        
        Args:
            max_retries: Maximum retry attempts
            retry_delay: Delay between retries in seconds
        """
        self.status = self.DISCONNECTED
        self.retry_count = 0
        self.max_retries = max_retries
        self.last_retry_time = 0
        self.retry_delay = retry_delay
        
    def can_retry(self) -> bool:
        """Check if retry is allowed"""
        current_time = time.time()
        return (self.retry_count < self.max_retries and 
                current_time - self.last_retry_time >= self.retry_delay)
    
    def mark_retry(self):
        """Mark retry attempt"""
        self.retry_count += 1
        self.last_retry_time = time.time()
        self.status = self.RECONNECTING
        
    def reset(self):
        """Reset connection status"""
        self.retry_count = 0
        self.status = self.CONNECTED
        
    def mark_failed(self):
        """Mark connection as failed"""
        self.status = self.FAILED
        
    def mark_disconnected(self):
        """Mark connection as disconnected"""
        self.status = self.DISCONNECTED

