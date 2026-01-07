# ============================================================================
# FILE: services/logging_service.py
# ============================================================================
import logging
import time
import uuid
import asyncio
import json
import traceback
import threading
import inspect
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from supabase import Client
from models.logging import LogCategory, LogSubcategory, LogContext


class SupabaseLogHandler(logging.Handler):
    """Custom logging handler that sends logs to Supabase database"""
    
    def __init__(self, supabase_client: Client, buffer_size: int = 50, flush_interval: float = 10.0):
        """
        Initialize log handler
        
        Args:
            supabase_client: Supabase client instance
            buffer_size: Buffer size before flushing
            flush_interval: Flush interval in seconds
        """
        super().__init__()
        self.supabase_client = supabase_client
        self.buffer_size = buffer_size
        self.flush_interval = flush_interval
        self.log_buffer = []
        self.buffer_lock = threading.Lock()
        self.last_flush = time.time()
        self._shutdown = False
        
    def emit(self, record: logging.LogRecord):
        """Emit a log record"""
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
    
    def _format_log_entry(self, record: logging.LogRecord) -> Dict[str, Any]:
        """Format log record as dictionary"""
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
        """Schedule async flush"""
        try:
            loop = asyncio.get_event_loop()
            if not loop.is_closed():
                asyncio.create_task(self._async_flush())
        except RuntimeError:
            pass
    
    async def _async_flush(self):
        """Flush logs to database asynchronously"""
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
                    
                    # Validate JSON serialization
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
    """Main logging manager for centralized logging"""
    
    def __init__(self, supabase_client: Client):
        """
        Initialize logging manager
        
        Args:
            supabase_client: Supabase client instance
        """
        self.supabase_client = supabase_client
        self.session_id = str(uuid.uuid4())
        self.start_time = time.time()
        self._setup_logging()
    
    def _setup_logging(self):
        """Setup logging infrastructure"""
        try:
            self.supabase_handler = SupabaseLogHandler(self.supabase_client)
            self.supabase_handler.setLevel(logging.INFO)
            
            root_logger = logging.getLogger()
            root_logger.addHandler(self.supabase_handler)
        except Exception as e:
            print(f"Failed to setup Supabase logging: {e}")
    
    def _create_enhanced_record(self, level: str, message: str, category: str, 
                              subcategory: Optional[str] = None, 
                              context: Optional[LogContext] = None, 
                              error: Optional[Exception] = None) -> logging.LogRecord:
        """Create enhanced log record with metadata"""
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
    
    async def log_info(self, message: str, category: str = LogCategory.SYSTEM, 
                      subcategory: Optional[str] = None, context: Optional[LogContext] = None):
        """Log info level message"""
        try:
            record = self._create_enhanced_record('INFO', message, category, subcategory, context)
            logging.getLogger().handle(record)
        except Exception as e:
            print(f"Error logging info: {e}")
    
    async def log_warning(self, message: str, category: str = LogCategory.SYSTEM, 
                         subcategory: Optional[str] = None, context: Optional[LogContext] = None):
        """Log warning level message"""
        try:
            record = self._create_enhanced_record('WARNING', message, category, subcategory, context)
            logging.getLogger().handle(record)
        except Exception as e:
            print(f"Error logging warning: {e}")
    
    async def log_error(self, message: str, category: str = LogCategory.SYSTEM, 
                       subcategory: Optional[str] = None, 
                       context: Optional[LogContext] = None, error: Optional[Exception] = None):
        """Log error level message"""
        try:
            record = self._create_enhanced_record('ERROR', message, category, subcategory, context, error)
            logging.getLogger().handle(record)
        except Exception as e:
            print(f"Error logging error: {e}")
    
    async def log_critical(self, message: str, category: str = LogCategory.SYSTEM, 
                          subcategory: Optional[str] = None, 
                          context: Optional[LogContext] = None, error: Optional[Exception] = None):
        """Log critical level message"""
        try:
            record = self._create_enhanced_record('CRITICAL', message, category, subcategory, context, error)
            logging.getLogger().handle(record)
        except Exception as e:
            print(f"Error logging critical: {e}")
    
    async def log_camera_status(self, camera_config, status: str, **kwargs):
        """Log camera status to database"""
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
        """Shutdown logging manager"""
        if hasattr(self, 'supabase_handler'):
            self.supabase_handler.close()
