/**
 * Analytics Constants
 * Shared constants for the video analytics dashboard
 * UPDATED: Added 1min, 15min, 30min date range options
 */

export const CHART_COLORS = [
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#6366f1', // indigo
  '#84cc16', // lime
] as const;

export const DATE_RANGE_OPTIONS = {
  '1min': 'Last 1 Minute',
  '15min': 'Last 15 Minutes',
  '30min': 'Last 30 Minutes',
  '1h': 'Last Hour',
  '24h': 'Last 24 Hours',
  '7d': 'Last 7 Days',
  '30d': 'Last 30 Days',
} as const;

export const DATE_RANGE_MS = {
  '1min': 60 * 1000,
  '15min': 15 * 60 * 1000,
  '30min': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
} as const;

export const AUTO_REFRESH_INTERVAL = 30000; // 30 seconds

export const DEFAULT_PAGE_SIZE = 100;

export const MAX_CHART_ITEMS = 8;

export const MAX_DURATION_ITEMS = 10;

export const CONFIDENCE_THRESHOLDS = {
  EXCELLENT: 85,
  GOOD: 70,
} as const;