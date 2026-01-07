/**
 * Video Management Types
 * Centralized type definitions for video-related entities
 */

export type VideoType = 'continuous' | 'motion';

export type ViewMode = 'grid' | 'list';

export type SortField = 'name' | 'date' | 'size' | 'duration';

export type SortOrder = 'asc' | 'desc';

export interface VideoFile {
  id: string;
  name: string;
  path: string;
  camera: string;
  size: string;
  duration: string;
  timestamp: string;
  thumbnail: string;
  type: VideoType;
  etag: string;
  publicUrl: string;
  mimeType: string;
}

export interface VideoFilters {
  searchQuery: string;
  cameraFilter: string;
  typeFilter: VideoType | 'all';
}

export interface VideoSortConfig {
  field: SortField;
  order: SortOrder;
}

export interface PaginationConfig {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
}

export interface VideoStats {
  totalVideos: number;
  totalSize: string;
  motionEvents: number;
  continuousRecordings: number;
}

export interface DeleteConfirmation {
  isOpen: boolean;
  video: VideoFile | null;
}