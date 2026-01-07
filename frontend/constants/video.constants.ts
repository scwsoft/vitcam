/**
 * Video Management Constants
 * Application-wide constants and configuration
 */

export const VIDEO_CONFIG = {
  DEFAULT_ITEMS_PER_PAGE: 12,
  MAX_ITEMS_PER_PAGE: 50,
  THUMBNAIL_FALLBACK: '/api/placeholder/320/180',
  SUPPORTED_VIDEO_FORMATS: ['webm', 'mp4', 'mov', 'avi'],
} as const;

export const VIDEO_TYPE_COLORS = {
  continuous: 'bg-blue-500',
  motion: 'bg-orange-500',
} as const;

export const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'date', label: 'Date' },
  { value: 'size', label: 'Size' },
  { value: 'duration', label: 'Duration' },
] as const;

export const ITEMS_PER_PAGE_OPTIONS = [
  { value: 12, label: '12 per page' },
  { value: 24, label: '24 per page' },
  { value: 48, label: '48 per page' },
] as const;

export const ERROR_MESSAGES = {
  FETCH_FAILED: 'Failed to fetch videos. Please try again.',
  DELETE_FAILED: 'Failed to delete video. Please try again.',
  DOWNLOAD_FAILED: 'Failed to download video. Please try again.',
  NO_VIDEOS: 'No videos found matching your criteria.',
  GENERIC_ERROR: 'An unexpected error occurred. Please try again.',
} as const;

export const SUCCESS_MESSAGES = {
  DELETE_SUCCESS: 'Video deleted successfully',
  DOWNLOAD_STARTED: 'Download started',
} as const;