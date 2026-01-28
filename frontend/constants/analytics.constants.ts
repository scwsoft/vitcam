/**
 * Analytics Constants
 * Centralized configuration for analytics features
 */

export const ANALYTICS_CONFIG = {
  REALTIME_CHANNEL: 'detection_changes',
  TABLE_NAME: 'object_detection_events',
  VIEW_NAME: 'unique_tracker_id_view',
  DEFAULT_TIME_RANGE: 'day' as const,
  LIVE_FEED_LIMIT: 10,
  REFRESH_DEBOUNCE_MS: 300,
} as const;

export const TIME_RANGES = {
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000,
} as const;

export const CHART_COLORS = [
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#ef4444',
  '#14b8a6',
  '#f97316',
  '#06b6d4',
  '#a855f7',
] as const;

export const EXPORT_CONFIG = {
  FILE_PREFIX: 'detections',
  FILE_EXTENSION: '.csv',
  MIME_TYPE: 'text/csv',
  HEADERS: ['Timestamp', 'Camera', 'Object Class', 'Confidence', 'Position'],
} as const;