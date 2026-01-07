# ============================================================================
# FILE: api/analytics_api.py
# ============================================================================
import traceback
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from urllib.parse import unquote

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from supabase import create_client
from api.schemas import AnalyticsResponseAPI
from config.settings import settings


def create_analytics_app() -> FastAPI:
    """Create and configure FastAPI analytics application"""
    
    app = FastAPI(title="Object Detection Analytics API", version="1.0.0")
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    def get_supabase_client():
        """Get Supabase client instance"""
        return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    
    @app.get("/api/analytics/cameras", response_model=AnalyticsResponseAPI)
    async def get_cameras_with_analytics(
        page: int = Query(1, ge=1, description="Page number (1-indexed)"),
        page_size: int = Query(50, ge=1, le=500, description="Items per page"),
        camera_name: Optional[str] = Query(None, description="Filter by camera name")
    ):
        """Get cameras with detection analytics (paginated)"""
        try:
            supabase = get_supabase_client()
            
            # Calculate offset for pagination
            offset = (page - 1) * page_size
            
            # Get unique cameras from detection events with filtering
            cameras_query = supabase.table('object_detection_events').select(
                'camera_id, camera_name'
            )
            
            if camera_name:
                cameras_query = cameras_query.ilike('camera_name', f'%{camera_name}%')
            
            cameras_response = cameras_query.execute()
            
            cameras_dict = {}
            
            if cameras_response and hasattr(cameras_response, 'data') and cameras_response.data:
                for event in cameras_response.data:
                    if not event or not isinstance(event, dict):
                        continue
                        
                    camera_id = event.get('camera_id')
                    camera_name_val = event.get('camera_name', 'Unknown Camera')
                    
                    if camera_id and camera_id not in cameras_dict:
                        cameras_dict[camera_id] = {
                            'id': camera_id,
                            'name': camera_name_val,
                            'detection_count': 0,
                            'last_detection': None
                        }
            
            # Get total count before pagination
            total_cameras = len(cameras_dict)
            
            # Apply pagination to cameras
            cameras_list = list(cameras_dict.values())
            paginated_cameras = cameras_list[offset:offset + page_size]
            
            # Get detection counts and last detection for paginated cameras
            for camera_data in paginated_cameras:
                camera_id = camera_data['id']
                try:
                    count_response = supabase.table('object_detection_events').select(
                        'id', count='exact'
                    ).eq('camera_id', camera_id).execute()
                    
                    detection_count = 0
                    if count_response and hasattr(count_response, 'count') and count_response.count is not None:
                        detection_count = count_response.count
                    elif count_response and hasattr(count_response, 'data') and count_response.data:
                        detection_count = len(count_response.data)
                    
                    camera_data['detection_count'] = detection_count
                    
                    latest_response = supabase.table('object_detection_events').select(
                        'timestamp'
                    ).eq('camera_id', camera_id).order('timestamp', desc=True).limit(1).execute()
                    
                    if (latest_response and hasattr(latest_response, 'data') and 
                        latest_response.data and len(latest_response.data) > 0):
                        camera_data['last_detection'] = latest_response.data[0].get('timestamp')
                    
                except Exception as camera_error:
                    camera_data['detection_count'] = 0
                    camera_data['last_detection'] = None
            
            return AnalyticsResponseAPI(
                success=True,
                data={
                    'cameras': paginated_cameras,
                    'pagination': {
                        'page': page,
                        'page_size': page_size,
                        'total_items': total_cameras,
                        'total_pages': (total_cameras + page_size - 1) // page_size,
                        'has_next': offset + page_size < total_cameras,
                        'has_previous': page > 1
                    }
                },
                total_count=total_cameras,
                message="Camera analytics retrieved successfully"
            )
            
        except Exception as e:
            return AnalyticsResponseAPI(
                success=False,
                data={
                    'cameras': [],
                    'pagination': {
                        'page': page,
                        'page_size': page_size,
                        'total_items': 0,
                        'total_pages': 0,
                        'has_next': False,
                        'has_previous': False
                    }
                },
                total_count=0,
                message=str(e)
            )
    
    @app.get("/api/analytics/dashboard", response_model=AnalyticsResponseAPI)
    async def get_dashboard_data(
        start_date: Optional[str] = Query(None),
        end_date: Optional[str] = Query(None),
        camera_id: Optional[int] = Query(None),
        camera_name: Optional[str] = Query(None),
        page: int = Query(1, ge=1, description="Page number for events (1-indexed)"),
        page_size: int = Query(100, ge=1, le=1000, description="Events per page"),
        cursor: Optional[str] = Query(None, description="Cursor for pagination (timestamp of last item)")
    ):
        """Get dashboard analytics data with cursor-based pagination for events"""
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
            
            # Get total count for the filtered query (for pagination metadata)
            try:
                count_query = supabase.table('object_detection_events').select(
                    'id', count='exact'
                ).gte('timestamp', start_date_str).lte('timestamp', end_date_str)
                
                if camera_id:
                    count_query = count_query.eq('camera_id', camera_id)
                if camera_name:
                    count_query = count_query.ilike('camera_name', f'%{camera_name}%')
                
                count_response = count_query.execute()
                
                total_events = 0
                if count_response and hasattr(count_response, 'count') and count_response.count is not None:
                    total_events = count_response.count
                    
            except Exception:
                total_events = 0
            
            # Build query for events with cursor-based pagination
            try:
                query = supabase.table('object_detection_events').select(
                    'id, camera_id, camera_name, timestamp, object_class_name, confidence, '
                    'bbox_x, bbox_y, bbox_width, bbox_height, tracker_id, detection_metadata'
                )
                
                query = query.gte('timestamp', start_date_str).lte('timestamp', end_date_str)
                
                # Cursor-based pagination (more efficient for large datasets)
                if cursor:
                    try:
                        cursor_date = unquote(cursor)
                        if cursor_date.endswith('Z'):
                            cursor_date = cursor_date.replace('Z', '+00:00')
                        query = query.lt('timestamp', cursor_date)
                    except Exception:
                        pass  # Invalid cursor, ignore
                
                if camera_id:
                    query = query.eq('camera_id', camera_id)
                if camera_name:
                    query = query.ilike('camera_name', f'%{camera_name}%')
                
                # Order by timestamp descending and limit to page_size + 1 (to check if there's a next page)
                response = query.order('timestamp', desc=True).limit(page_size + 1).execute()
                
                events_data = []
                has_next_page = False
                next_cursor = None
                
                if response and hasattr(response, 'data') and response.data:
                    events_data = response.data[:page_size]
                    has_next_page = len(response.data) > page_size
                    
                    # Set next cursor to the timestamp of the last item
                    if has_next_page and events_data:
                        next_cursor = events_data[-1].get('timestamp')
                    
            except Exception as query_error:
                events_data = []
                has_next_page = False
                next_cursor = None
            
            # Process data for aggregations (use a separate query with reasonable limits)
            try:
                # For aggregations, limit to a reasonable sample size
                agg_query = supabase.table('object_detection_events').select(
                    'timestamp, object_class_name, camera_id, camera_name'
                ).gte('timestamp', start_date_str).lte('timestamp', end_date_str)
                
                if camera_id:
                    agg_query = agg_query.eq('camera_id', camera_id)
                if camera_name:
                    agg_query = agg_query.ilike('camera_name', f'%{camera_name}%')
                
                # Limit aggregation data to prevent memory issues
                agg_response = agg_query.order('timestamp', desc=True).limit(10000).execute()
                agg_data = agg_response.data if agg_response and hasattr(agg_response, 'data') else []
                
            except Exception:
                agg_data = []
            
            # Process aggregation data
            hourly_data = {str(i): 0 for i in range(24)}
            object_counts = {}
            cameras_dict = {}
            
            for event in agg_data:
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
                    'total_events': total_events,
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
                'cameras': list(cameras_dict.values()),
                'pagination': {
                    'page': page,
                    'page_size': page_size,
                    'total_items': total_events,
                    'total_pages': (total_events + page_size - 1) // page_size if total_events > 0 else 0,
                    'has_next': has_next_page,
                    'next_cursor': next_cursor,
                    'cursor': cursor
                }
            }
            
            return AnalyticsResponseAPI(
                success=True,
                data=dashboard_data,
                total_count=total_events,
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
                'cameras': [],
                'pagination': {
                    'page': page,
                    'page_size': page_size,
                    'total_items': 0,
                    'total_pages': 0,
                    'has_next': False,
                    'next_cursor': None,
                    'cursor': cursor
                }
            }
            
            return AnalyticsResponseAPI(
                success=False,
                data=empty_data,
                total_count=0,
                message=str(e)
            )
    
    @app.get("/api/analytics/events", response_model=AnalyticsResponseAPI)
    async def get_events_paginated(
        start_date: Optional[str] = Query(None),
        end_date: Optional[str] = Query(None),
        camera_id: Optional[int] = Query(None),
        camera_name: Optional[str] = Query(None),
        object_class: Optional[str] = Query(None),
        page: int = Query(1, ge=1, description="Page number (1-indexed)"),
        page_size: int = Query(100, ge=1, le=1000, description="Events per page"),
        cursor: Optional[str] = Query(None, description="Cursor for pagination (timestamp of last item)")
    ):
        """
        Get paginated detection events with cursor-based pagination.
        This endpoint is optimized for fetching large datasets efficiently.
        """
        try:
            supabase = get_supabase_client()
            
            # Parse dates
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
            
            # Get total count
            try:
                count_query = supabase.table('object_detection_events').select(
                    'id', count='exact'
                ).gte('timestamp', start_date_str).lte('timestamp', end_date_str)
                
                if camera_id:
                    count_query = count_query.eq('camera_id', camera_id)
                if camera_name:
                    count_query = count_query.ilike('camera_name', f'%{camera_name}%')
                if object_class:
                    count_query = count_query.ilike('object_class_name', f'%{object_class}%')
                
                count_response = count_query.execute()
                total_events = count_response.count if count_response and hasattr(count_response, 'count') else 0
                
            except Exception:
                total_events = 0
            
            # Build query with cursor
            query = supabase.table('object_detection_events').select(
                'id, camera_id, camera_name, timestamp, object_class_name, confidence, '
                'bbox_x, bbox_y, bbox_width, bbox_height, tracker_id, detection_metadata'
            )
            
            query = query.gte('timestamp', start_date_str).lte('timestamp', end_date_str)
            
            if cursor:
                try:
                    cursor_date = unquote(cursor)
                    if cursor_date.endswith('Z'):
                        cursor_date = cursor_date.replace('Z', '+00:00')
                    query = query.lt('timestamp', cursor_date)
                except Exception:
                    pass
            
            if camera_id:
                query = query.eq('camera_id', camera_id)
            if camera_name:
                query = query.ilike('camera_name', f'%{camera_name}%')
            if object_class:
                query = query.ilike('object_class_name', f'%{object_class}%')
            
            response = query.order('timestamp', desc=True).limit(page_size + 1).execute()
            
            events_data = []
            has_next_page = False
            next_cursor = None
            
            if response and hasattr(response, 'data') and response.data:
                events_data = response.data[:page_size]
                has_next_page = len(response.data) > page_size
                
                if has_next_page and events_data:
                    next_cursor = events_data[-1].get('timestamp')
            
            return AnalyticsResponseAPI(
                success=True,
                data={
                    'events': events_data,
                    'pagination': {
                        'page': page,
                        'page_size': page_size,
                        'total_items': total_events,
                        'total_pages': (total_events + page_size - 1) // page_size if total_events > 0 else 0,
                        'has_next': has_next_page,
                        'next_cursor': next_cursor,
                        'cursor': cursor
                    }
                },
                total_count=total_events,
                message="Events retrieved successfully"
            )
            
        except Exception as e:
            return AnalyticsResponseAPI(
                success=False,
                data={
                    'events': [],
                    'pagination': {
                        'page': page,
                        'page_size': page_size,
                        'total_items': 0,
                        'total_pages': 0,
                        'has_next': False,
                        'next_cursor': None,
                        'cursor': cursor
                    }
                },
                total_count=0,
                message=str(e)
            )
    
    @app.get("/health")
    async def health_check():
        """Health check endpoint"""
        return {"status": "healthy", "service": "analytics-api"}
    
    return app