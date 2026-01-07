/**
 * Analytics Service
 * Handles all API interactions for analytics data
 */

import type {
  DashboardData,
  AnalyticsResponse,
  DateRangeOption,
} from '@/types/analytics.types';
import { formatDateTimeForAPI, getDateRangeMs } from '@/utils/analytics.utils';

const ANALYTICS_API =
  process.env.NEXT_PUBLIC_ANALYTICS_API || 'http://localhost:8766/api/analytics';

/**
 * Get empty dashboard data structure
 */
const getEmptyDashboardData = (): DashboardData => ({
  summary: {
    total_events: 0,
    total_cameras: 0,
    date_range: {
      start: new Date().toISOString(),
      end: new Date().toISOString(),
    },
    stats: [],
  },
  recent_events: [],
  hourly_distribution: Object.fromEntries(Array.from({ length: 24 }, (_, i) => [String(i), 0])),
  top_objects: [],
  cameras: [],
});

interface FetchDashboardParams {
  dateRange: DateRangeOption;
  cameraFilter: string;
  page: number;
  pageSize: number;
  cursor?: string | null;
}

/**
 * Fetch dashboard data from analytics API
 */
export const fetchDashboardData = async (
  params: FetchDashboardParams
): Promise<DashboardData> => {
  try {
    const endDate = formatDateTimeForAPI(new Date());
    const startDate = formatDateTimeForAPI(new Date(Date.now() - getDateRangeMs(params.dateRange)));

    const searchParams = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
      page: params.page.toString(),
      page_size: params.pageSize.toString(),
    });

    if (params.cursor) {
      searchParams.append('cursor', params.cursor);
    }

    if (params.cameraFilter !== 'all') {
      searchParams.append('camera_name', params.cameraFilter);
    }

    const apiUrl = `${ANALYTICS_API}/dashboard?${searchParams}`;

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: AnalyticsResponse = await response.json();

    if (result.success && result.data) {
      return result.data;
    } else {
      return getEmptyDashboardData();
    }
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return getEmptyDashboardData();
  }
};