/**
 * useAnalytics Hook - UPDATED VERSION
 * Manages analytics dashboard data and state
 * NOW INCLUDES: Separate fetch for complete dwell time event history
 * UPDATED: Added support for 1min, 15min, 30min date ranges
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import type {
  DashboardData,
  DetectionEvent,
  PaginationInfo,
  DateRangeOption,
} from '@/types/analytics.types';
import { fetchDashboardData } from '@/services/analytics.service';
import { AUTO_REFRESH_INTERVAL, DEFAULT_PAGE_SIZE } from '@/constants/analytics.constants';

interface UseAnalyticsReturn {
  dashboardData: DashboardData | null;
  realtimeEvents: DetectionEvent[];
  dwellTimeEvents: DetectionEvent[];
  loading: boolean;
  refreshing: boolean;
  selectedDateRange: DateRangeOption;
  selectedCamera: string;
  isAutoRefresh: boolean;
  eventsPagination: PaginationInfo | null;
  eventsPage: number;
  setSelectedDateRange: (range: DateRangeOption) => void;
  setSelectedCamera: (camera: string) => void;
  setIsAutoRefresh: (enabled: boolean) => void;
  handleRefresh: () => void;
  handleEventsNextPage: () => void;
  handleEventsPrevPage: () => void;
  handleEventsPageChange: (page: number) => void;
}

export const useAnalytics = (userId: string | null): UseAnalyticsReturn => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [realtimeEvents, setRealtimeEvents] = useState<DetectionEvent[]>([]);
  const [dwellTimeEvents, setDwellTimeEvents] = useState<DetectionEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDateRange, setSelectedDateRange] = useState<DateRangeOption>('24h');
  const [selectedCamera, setSelectedCamera] = useState<string>('all');
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);

  // Pagination state
  const [eventsPage, setEventsPage] = useState(1);
  const [eventsCursor, setEventsCursor] = useState<string | null>(null);
  const [eventsPagination, setEventsPagination] = useState<PaginationInfo | null>(null);
  
  // Track if pagination change is in progress to prevent filter effect from resetting
  const paginationChangeRef = useRef(false);

  const supabase = createClient();

  /**
   * NEW: Fetch complete event history for dwell time calculations
   * This fetches ALL events (not deduplicated) within the date range
   * UPDATED: Added support for 1min, 15min, 30min ranges
   */
  const fetchDwellTimeEvents = useCallback(async () => {
    try {
      // Calculate date range - UPDATED with new short-term options
      const rangeMs = {
        '1min': 60000,           // 1 minute
        '15min': 900000,         // 15 minutes
        '30min': 1800000,        // 30 minutes
        '1h': 3600000,           // 1 hour
        '24h': 86400000,         // 24 hours
        '7d': 604800000,         // 7 days
        '30d': 2592000000,       // 30 days
      };

      const now = new Date();
      const startDate = new Date(now.getTime() - (rangeMs[selectedDateRange] || rangeMs['24h']));

      console.log(`🔍 [useAnalytics] Fetching dwell time events from ${startDate.toISOString()}`);

      // Build query - fetch ALL events with tracker_ids (not deduplicated)
      let query = supabase
        .from('object_detection_events')
        .select(`
          id,
          camera_id,
          camera_name,
          object_class_name,
          confidence,
          timestamp,
          tracker_id,
          bbox_x,
          bbox_y,
          bbox_width,
          bbox_height,
          detection_metadata
        `)
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', now.toISOString())
        .not('tracker_id', 'is', null)
        .order('timestamp', { ascending: true });

      // Apply camera filter
      if (selectedCamera && selectedCamera !== 'all') {
        query = query.eq('camera_name', selectedCamera);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ [useAnalytics] Error fetching dwell time events:', error);
        setDwellTimeEvents([]);
        return;
      }

      console.log(`✅ [useAnalytics] Fetched ${data?.length || 0} events for dwell time`);
      
      // Log tracker distribution for debugging
      if (data && data.length > 0) {
        const trackerCounts = new Map<number, number>();
        data.forEach(event => {
          if (event.tracker_id) {
            trackerCounts.set(event.tracker_id, (trackerCounts.get(event.tracker_id) || 0) + 1);
          }
        });
        
        const singleDetection = Array.from(trackerCounts.values()).filter(c => c === 1).length;
        const multipleDetections = Array.from(trackerCounts.values()).filter(c => c > 1).length;
        
        console.log(`📊 [useAnalytics] Dwell time data quality:`);
        console.log(`   - Unique trackers: ${trackerCounts.size}`);
        console.log(`   - With 1 detection: ${singleDetection}`);
        console.log(`   - With 2+ detections: ${multipleDetections}`);
        
        if (singleDetection === trackerCounts.size) {
          console.warn('⚠️ [useAnalytics] WARNING: All trackers have only 1 detection!');
          console.warn('   Dwell times will be 0 seconds. Check your detection logging system.');
        }
      }

      setDwellTimeEvents(data || []);
    } catch (error) {
      console.error('❌ [useAnalytics] Error in fetchDwellTimeEvents:', error);
      setDwellTimeEvents([]);
    }
  }, [selectedDateRange, selectedCamera, supabase]);

  /**
   * Fetch dashboard data from API
   */
  const fetchDashboard = useCallback(
    async (
      cursor: string | null = null, 
      resetPagination: boolean = false,
      pageOverride?: number
    ) => {
      try {
        setLoading(true);
        
        // Determine which page to use
        let pageToFetch = pageOverride ?? eventsPage;
        
        if (resetPagination) {
          setRefreshing(true);
          setEventsCursor(null);
          setEventsPage(1);
          pageToFetch = 1; // Use page 1 immediately, don't wait for state update
        }

        const data = await fetchDashboardData({
          dateRange: selectedDateRange,
          cameraFilter: selectedCamera,
          page: pageToFetch,
          pageSize: DEFAULT_PAGE_SIZE,
          cursor,
        });

        setDashboardData(data);

        if (data.pagination) {
          setEventsPagination(data.pagination);
        }
      } catch (error) {
        console.error('Error in fetchDashboard:', error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedDateRange, selectedCamera]
  );

  /**
   * Fetch realtime events from Supabase
   */
  const fetchRealtimeEvents = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('object_detection_events')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(50);

      if (error) throw error;
      if (data) setRealtimeEvents(data);
    } catch (error) {
      console.error('Error fetching realtime events:', error);
    }
  }, [supabase]);

  /**
   * Manual refresh handler - NOW ALSO REFRESHES DWELL TIME DATA
   */
  const handleRefresh = useCallback(() => {
    paginationChangeRef.current = false;
    fetchDashboard(null, true);
    fetchRealtimeEvents();
    fetchDwellTimeEvents();
  }, [fetchDashboard, fetchRealtimeEvents, fetchDwellTimeEvents]);

  /**
   * Filter change handlers that reset pagination
   */
  const handleDateRangeChange = useCallback((range: DateRangeOption) => {
    paginationChangeRef.current = false;
    setSelectedDateRange(range);
  }, []);

  const handleCameraChange = useCallback((camera: string) => {
    paginationChangeRef.current = false;
    setSelectedCamera(camera);
  }, []);

  /**
   * Pagination handlers
   */
  const handleEventsNextPage = useCallback(() => {
    if (eventsPagination?.has_next) {
      paginationChangeRef.current = true;
      setEventsPage((prev) => prev + 1);
      if (eventsPagination.next_cursor) {
        setEventsCursor(eventsPagination.next_cursor);
      }
    }
  }, [eventsPagination]);

  const handleEventsPrevPage = useCallback(() => {
    if (eventsPage > 1) {
      paginationChangeRef.current = true;
      setEventsPage((prev) => prev - 1);
      setEventsCursor(null);
    }
  }, [eventsPage]);

  /**
   * Direct page navigation handler
   */
  const handleEventsPageChange = useCallback((page: number) => {
    if (page >= 1 && eventsPagination && page <= eventsPagination.total_pages) {
      paginationChangeRef.current = true;
      setEventsPage(page);
      setEventsCursor(null);
    }
  }, [eventsPagination]);

  /**
   * Initial data load and filter changes
   * Skips if pagination change is in progress
   * NOW ALSO FETCHES DWELL TIME DATA
   */
  useEffect(() => {
    if (userId && !paginationChangeRef.current) {
      fetchDashboard(null, true);
      fetchRealtimeEvents();
      fetchDwellTimeEvents();
    }
  }, [userId, selectedDateRange, selectedCamera, fetchDashboard, fetchRealtimeEvents, fetchDwellTimeEvents]);

  /**
   * Handle pagination changes
   * Only triggers when pagination handlers set the flag
   */
  useEffect(() => {
    if (userId && paginationChangeRef.current) {
      const cursor = eventsPagination?.next_cursor || null;
      fetchDashboard(cursor, false, eventsPage).then(() => {
        paginationChangeRef.current = false;
      });
    }
  }, [eventsPage, userId, fetchDashboard, eventsPagination]);

  /**
   * Auto-refresh interval - NOW ALSO REFRESHES DWELL TIME DATA
   */
  useEffect(() => {
    if (!isAutoRefresh || !userId) return;

    const interval = setInterval(() => {
      fetchDashboard(null, true);
      fetchRealtimeEvents();
      fetchDwellTimeEvents();
    }, AUTO_REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [isAutoRefresh, userId, fetchDashboard, fetchRealtimeEvents, fetchDwellTimeEvents]);

  /**
   * Realtime subscription
   */
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('realtime-events')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'object_detection_events',
        },
        (payload) => {
          const newEvent = payload.new as DetectionEvent;
          setRealtimeEvents((prev) => [newEvent, ...prev].slice(0, 50));

          if (selectedCamera === 'all' || newEvent.camera_name === selectedCamera) {
            fetchDashboard(null, true);
            fetchDwellTimeEvents();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, selectedCamera, supabase, fetchDashboard, fetchDwellTimeEvents]);

  return {
    dashboardData,
    realtimeEvents,
    dwellTimeEvents,
    loading,
    refreshing,
    selectedDateRange,
    selectedCamera,
    isAutoRefresh,
    eventsPagination,
    eventsPage,
    setSelectedDateRange: handleDateRangeChange,
    setSelectedCamera: handleCameraChange,
    setIsAutoRefresh,
    handleRefresh,
    handleEventsNextPage,
    handleEventsPrevPage,
    handleEventsPageChange,
  };
};