/**
 * Analytics Service
 * Handles all data fetching and subscriptions for analytics
 */

import type { SupabaseClient } from '@supabase/auth-helpers-nextjs';
import type { DetectionEvent, AnalyticsFilters } from '@/types/analytics.types';
import { ANALYTICS_CONFIG } from '@/constants/analytics.constants';
import * as AnalyticsUtils from '@/utils/analytics.utils';

export class AnalyticsService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Fetch detection events with applied filters
   */
  async fetchDetections(filters: AnalyticsFilters): Promise<DetectionEvent[]> {
    try {
      let query = this.supabase
        .from(ANALYTICS_CONFIG.TABLE_NAME)
        .select('*')
        .order('timestamp', { ascending: false });

      // Apply camera filter
      if (filters.cameraIds.length > 0) {
        query = query.in('camera_id', filters.cameraIds);
      }

      // Apply object class filter
      if (filters.objectClasses.length > 0) {
        query = query.in('object_class_name', filters.objectClasses);
      }

      // Apply confidence filter
      if (filters.confidenceMin > 0) {
        query = query.gte('confidence', filters.confidenceMin);
      }

      // Apply time range filter
      const startTime = AnalyticsUtils.calculateTimeRangeStart(
        filters.timeRange,
        filters.startDate
      );
      query = query.gte('timestamp', startTime.toISOString());

      if (filters.timeRange === 'custom' && filters.endDate) {
        query = query.lte('timestamp', filters.endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch detections: ${error.message}`);
      }

      return (data as DetectionEvent[]) || [];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`[AnalyticsService] ${errorMessage}`);
    }
  }

  /**
   * Subscribe to real-time detection events
   */
  subscribeToDetections(
    onInsert: (detection: DetectionEvent) => void
  ): () => void {
    const channel = this.supabase
      .channel(ANALYTICS_CONFIG.REALTIME_CHANNEL)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: ANALYTICS_CONFIG.TABLE_NAME,
        },
        (payload) => {
          onInsert(payload.new as DetectionEvent);
        }
      )
      .subscribe();

    // Return cleanup function
    return () => {
      this.supabase.removeChannel(channel);
    };
  }

  /**
   * Fetch available cameras for filtering
   */
  async fetchAvailableCameras(): Promise<Array<{ id: number; name: string }>> {
    try {
      const { data, error } = await this.supabase
        .from(ANALYTICS_CONFIG.TABLE_NAME)
        .select('camera_id, camera_name')
        .order('camera_id');

      if (error) {
        throw new Error(`Failed to fetch cameras: ${error.message}`);
      }

      // Get unique cameras
      const uniqueCameras = new Map<number, string>();
      data?.forEach((item) => {
        if (!uniqueCameras.has(item.camera_id)) {
          uniqueCameras.set(
            item.camera_id,
            item.camera_name || `Camera ${item.camera_id}`
          );
        }
      });

      return Array.from(uniqueCameras.entries()).map(([id, name]) => ({
        id,
        name,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`[AnalyticsService] ${errorMessage}`);
      return [];
    }
  }

  /**
   * Fetch available object classes for filtering
   */
  async fetchAvailableObjectClasses(): Promise<string[]> {
    try {
      const { data, error } = await this.supabase
        .from(ANALYTICS_CONFIG.TABLE_NAME)
        .select('object_class_name')
        .order('object_class_name');

      if (error) {
        throw new Error(`Failed to fetch object classes: ${error.message}`);
      }

      // Get unique object classes
      const uniqueClasses = new Set(
        data?.map((item) => item.object_class_name).filter(Boolean)
      );

      return Array.from(uniqueClasses);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`[AnalyticsService] ${errorMessage}`);
      return [];
    }
  }
}