/**
 * useAnalyticsExport Hook
 * Handles CSV export functionality for analytics data
 */

import { useCallback } from 'react';
import type { DetectionEvent } from '@/types/analytics.types';
import * as AnalyticsUtils from '@/utils/analytics.utils';
import { EXPORT_CONFIG } from '@/constants/analytics.constants';

interface UseAnalyticsExportReturn {
  exportToCSV: () => void;
  isExporting: boolean;
}

export const useAnalyticsExport = (
  detections: DetectionEvent[]
): UseAnalyticsExportReturn => {
  const exportToCSV = useCallback(() => {
    const content = AnalyticsUtils.generateCSVContent(detections);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${EXPORT_CONFIG.FILE_PREFIX}_${timestamp}${EXPORT_CONFIG.FILE_EXTENSION}`;
    
    AnalyticsUtils.downloadCSV(content, filename);
  }, [detections]);

  return {
    exportToCSV,
    isExporting: false, // Can be extended for async export operations
  };
};