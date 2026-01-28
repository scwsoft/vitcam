/**
 * useAnalyticsFilters Hook
 * Manages filter state and provides filter controls
 */

import { useState, useCallback } from 'react';
import type { AnalyticsFilters } from '@/types/analytics.types';
import { ANALYTICS_CONFIG } from '@/constants/analytics.constants';

interface UseAnalyticsFiltersReturn {
  filters: AnalyticsFilters;
  setFilters: React.Dispatch<React.SetStateAction<AnalyticsFilters>>;
  updateFilter: <K extends keyof AnalyticsFilters>(
    key: K,
    value: AnalyticsFilters[K]
  ) => void;
  resetFilters: () => void;
}

const DEFAULT_FILTERS: AnalyticsFilters = {
  cameraIds: [],
  objectClasses: [],
  confidenceMin: 0,
  timeRange: ANALYTICS_CONFIG.DEFAULT_TIME_RANGE,
};

export const useAnalyticsFilters = (): UseAnalyticsFiltersReturn => {
  const [filters, setFilters] = useState<AnalyticsFilters>(DEFAULT_FILTERS);

  const updateFilter = useCallback(
    <K extends keyof AnalyticsFilters>(key: K, value: AnalyticsFilters[K]) => {
      setFilters((prev) => ({
        ...prev,
        [key]: value,
      }));
    },
    []
  );

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  return {
    filters,
    setFilters,
    updateFilter,
    resetFilters,
  };
};