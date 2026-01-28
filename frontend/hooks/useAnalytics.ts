/**
 * useAnalytics Hook
 * Manages detection data fetching and real-time subscriptions
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { DetectionEvent, AnalyticsFilters } from '@/types/analytics.types';
import { AnalyticsService } from '@/services/analytics.service';

interface UseAnalyticsReturn {
  detections: DetectionEvent[];
  loading: boolean;
  refreshing: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export const useAnalytics = (filters: AnalyticsFilters): UseAnalyticsReturn => {
  const supabase = createClientComponentClient();
  const [detections, setDetections] = useState<DetectionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Memoize service instance to prevent recreation
  const service = useMemo(() => new AnalyticsService(supabase), [supabase]);

  const fetchDetections = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      
      const data = await service.fetchDetections(filters);
      setDetections(data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch detections');
      setError(error);
      console.error('[useAnalytics] Error:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [service, filters]);

  // Initial fetch and filter changes
  useEffect(() => {
    fetchDetections();
  }, [fetchDetections]);

  // Real-time subscription
  useEffect(() => {
    const cleanup = service.subscribeToDetections((newDetection) => {
      setDetections((prev) => [newDetection, ...prev]);
    });

    return cleanup;
  }, [service]);

  const refresh = useCallback(async () => {
    await fetchDetections();
  }, [fetchDetections]);

  return {
    detections,
    loading,
    refreshing,
    error,
    refresh,
  };
};