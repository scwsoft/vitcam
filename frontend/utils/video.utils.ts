/**
 * Video Utilities
 * Pure utility functions for video operations
 */

import type { VideoFile, VideoType } from '@/types/video.types';
import { VIDEO_CONFIG, VIDEO_TYPE_COLORS } from '@/constants/video.constants';

/**
 * Format file size from bytes to human-readable format
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${units[i]}`;
};

/**
 * Format duration from seconds to HH:MM:SS
 */
export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts = [];
  if (hours > 0) parts.push(hours.toString().padStart(2, '0'));
  parts.push(minutes.toString().padStart(2, '0'));
  parts.push(secs.toString().padStart(2, '0'));
  
  return parts.join(':');
};

/**
 * Format date to readable format
 */
export const formatDate = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return timestamp;
  }
};

/**
 * Get video type color class
 */
export const getVideoTypeColor = (type: VideoType): string => {
  return VIDEO_TYPE_COLORS[type] || 'bg-gray-500';
};

/**
 * Get default thumbnail URL
 */
export const getDefaultThumbnail = (): string => {
  return VIDEO_CONFIG.THUMBNAIL_FALLBACK;
};

/**
 * Extract file extension from filename
 */
export const getFileExtension = (filename: string): string => {
  return filename.split('.').pop()?.toUpperCase() || 'Unknown';
};

/**
 * Calculate total size from array of videos
 */
export const calculateTotalSize = (videos: VideoFile[]): string => {
  const totalBytes = videos.reduce((acc, video) => {
    const sizeMatch = video.size.match(/(\d+\.?\d*)\s*(B|KB|MB|GB)/);
    if (!sizeMatch) return acc;
    
    const [, value, unit] = sizeMatch;
    const multipliers: Record<string, number> = {
      B: 1,
      KB: 1024,
      MB: 1024 * 1024,
      GB: 1024 * 1024 * 1024,
    };
    
    return acc + parseFloat(value) * (multipliers[unit] || 1);
  }, 0);
  
  return formatFileSize(totalBytes);
};

/**
 * Generate thumbnail URL from video path
 */
export const generateThumbnailUrl = (videoPath: string): string => {
  // This would typically be handled by your backend/CDN
  return videoPath.replace(/\.(mp4|webm|mov)$/i, '.jpg');
};

/**
 * Validate video file format
 */
export const isValidVideoFormat = (filename: string): boolean => {
  const extension = filename.split('.').pop()?.toLowerCase();
  return extension ? VIDEO_CONFIG.SUPPORTED_VIDEO_FORMATS.includes(extension) : false;
};

/**
 * Sort comparator for videos
 */
export const createVideoComparator = (
  field: string,
  order: 'asc' | 'desc'
) => {
  return (a: VideoFile, b: VideoFile): number => {
    let comparison = 0;
    
    switch (field) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'date':
        comparison = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        break;
      case 'size':
        // Simple comparison assuming format is consistent
        comparison = a.size.localeCompare(b.size);
        break;
      case 'duration':
        comparison = a.duration.localeCompare(b.duration);
        break;
      default:
        comparison = 0;
    }
    
    return order === 'asc' ? comparison : -comparison;
  };
};

/**
 * Filter videos based on search and filters
 */
export const filterVideos = (
  videos: VideoFile[],
  searchQuery: string,
  cameraFilter: string,
  typeFilter: string
): VideoFile[] => {
  return videos.filter((video) => {
    const matchesSearch =
      !searchQuery ||
      video.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.camera.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCamera =
      cameraFilter === 'all' || video.camera === cameraFilter;
    
    const matchesType =
      typeFilter === 'all' || video.type === typeFilter;
    
    return matchesSearch && matchesCamera && matchesType;
  });
};

/**
 * Debounce function for search input
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};