// constants/detection-images.constants.ts

/**
 * Detection Images Constants
 * 
 * Centralized constants for detection images feature.
 */

export const STORAGE_BUCKET_NAME = 'detection-images';

export const DEFAULT_ITEMS_PER_PAGE = 24;

export const ITEMS_PER_PAGE_OPTIONS = [12, 24, 48, 96];

export const DETECTION_TYPES = [
  'all',
  'person',
  'car',
  'truck',
  'motorcycle',
  'bicycle',
  'bus',
  'train',
];

// Sort options without confidence
export const SORT_OPTIONS = [
  { value: 'date', label: 'Date' },
  { value: 'camera', label: 'Camera' },
  { value: 'size', label: 'Size' },
];