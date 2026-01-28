/**
 * useAnalyticsStats Hook
 * Computes derived statistics from detection data
 */

import { useMemo } from 'react';
import type {
  DetectionEvent,
  AnalyticsStats,
  CameraStats,
  ObjectClassStats,
} from '@/types/analytics.types';
// Use namespace import to avoid destructuring issues
import * as AnalyticsUtils from '@/utils/analytics.utils';

interface UseAnalyticsStatsReturn {
  stats: AnalyticsStats;
  cameraStats: CameraStats[];
  objectStats: ObjectClassStats[];
}

export const useAnalyticsStats = (
  detections: DetectionEvent[]
): UseAnalyticsStatsReturn => {
  const stats = useMemo(
    () => AnalyticsUtils.calculateStats(detections),
    [detections]
  );

  const cameraStats = useMemo(
    () => AnalyticsUtils.calculateCameraStats(detections),
    [detections]
  );

  const objectStats = useMemo(
    () => AnalyticsUtils.calculateObjectStats(detections),
    [detections]
  );

  return {
    stats,
    cameraStats,
    objectStats,
  };
};