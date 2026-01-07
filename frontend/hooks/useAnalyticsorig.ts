/**
 * useAnalytics Hook
 * Manages analytics dashboard data and state
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
}

export const useAnalytics = (userId: string | null): UseAnalyticsReturn => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [realtimeEvents, setRealtimeEvents] = useState<DetectionEvent[]>([]);
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
    [selectedDateRange, selectedCamera] // Removed eventsPage to prevent cascade
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
   * Manual refresh handler
   */
  const handleRefresh = useCallback(() => {
    paginationChangeRef.current = false; // Reset pagination flag
    fetchDashboard(null, true);
    fetchRealtimeEvents();
  }, [fetchDashboard, fetchRealtimeEvents]);

  /**
   * Filter change handlers that reset pagination
   */
  const handleDateRangeChange = useCallback((range: DateRangeOption) => {
    paginationChangeRef.current = false; // Reset pagination flag for filter change
    setSelectedDateRange(range);
  }, []);

  const handleCameraChange = useCallback((camera: string) => {
    paginationChangeRef.current = false; // Reset pagination flag for filter change
    setSelectedCamera(camera);
  }, []);

  /**
   * Pagination handlers
   */
  const handleEventsNextPage = useCallback(() => {
    if (eventsPagination?.has_next) {
      paginationChangeRef.current = true; // Mark as pagination change
      setEventsPage((prev) => prev + 1);
      if (eventsPagination.next_cursor) {
        setEventsCursor(eventsPagination.next_cursor);
      }
    }
  }, [eventsPagination]);

  const handleEventsPrevPage = useCallback(() => {
    if (eventsPage > 1) {
      paginationChangeRef.current = true; // Mark as pagination change
      setEventsPage((prev) => prev - 1);
      setEventsCursor(null);
    }
  }, [eventsPage]);

  /**
   * Initial data load and filter changes
   * Skips if pagination change is in progress
   */
  useEffect(() => {
    if (userId && !paginationChangeRef.current) {
      fetchDashboard(null, true);
      fetchRealtimeEvents();
    }
  }, [userId, selectedDateRange, selectedCamera, fetchDashboard, fetchRealtimeEvents]);

  /**
   * Handle pagination changes
   * Only triggers when pagination handlers set the flag
   */
  useEffect(() => {
    if (userId && paginationChangeRef.current) {
      const cursor = eventsPagination?.next_cursor || null;
      fetchDashboard(cursor, false, eventsPage).then(() => {
        paginationChangeRef.current = false; // Reset flag after fetch
      });
    }
  }, [eventsPage, userId, fetchDashboard, eventsPagination]);

  /**
   * Auto-refresh interval
   */
  useEffect(() => {
    if (!isAutoRefresh || !userId) return;

    const interval = setInterval(() => {
      fetchDashboard(null, true);
      fetchRealtimeEvents();
    }, AUTO_REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [isAutoRefresh, userId, fetchDashboard, fetchRealtimeEvents]);

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
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, selectedCamera, supabase, fetchDashboard]);

  return {
    dashboardData,
    realtimeEvents,
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
  };
};