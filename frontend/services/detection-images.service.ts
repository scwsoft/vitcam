// services/detection-images.service.ts - FIXED TIMEZONE HANDLING

/**
 * Detection Images Service
 * 
 * FIXED: Properly handles local timezone when parsing filenames
 */

import { createClient } from '@/utils/supabase/client';
import type {
  DetectionImage,
  Camera,
  DetectionImagesQueryParams,
  DetectionImagesResponse,
  BulkDeleteParams,
} from '@/types/detection-images.types';

const STORAGE_BUCKET_NAME = 'detection-images';

/**
 * Extract detection type from filename
 * Format: YYYYMMDD_HHMMSS_XXXXXX_trackerN_TYPE.jpg
 */
function extractDetectionTypeFromFilename(filename: string): string {
  const nameWithoutExt = filename.replace(/\.(jpg|jpeg|png)$/i, '');
  const parts = nameWithoutExt.split('_');
  
  if (parts.length >= 5) {
    return parts[parts.length - 1].toLowerCase();
  }
  
  return 'unknown';
}

/**
 * Parse timestamp from filename - FIXED to convert UTC to local timezone
 * Format: YYYYMMDD_HHMMSS
 * Example: 20251124_174412 -> This is UTC time from server, convert to local
 */
function parseTimestampFromFilename(filename: string): string {
  const parts = filename.split('_');
  
  if (parts.length >= 2) {
    const datePart = parts[0]; // YYYYMMDD
    const timePart = parts[1]; // HHMMSS
    
    try {
      const year = datePart.substring(0, 4);
      const month = datePart.substring(4, 6);
      const day = datePart.substring(6, 8);
      
      const hours = timePart.substring(0, 2);
      const minutes = timePart.substring(2, 4);
      const seconds = timePart.substring(4, 6);
      
      // FIXED: Add Z suffix to indicate this is UTC time
      // The browser will automatically convert to local timezone when displayed
      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
      
    } catch (error) {
      console.error('Failed to parse timestamp from filename:', filename, error);
    }
  }
  
  return new Date().toISOString();
}

/**
 * Parse tracker ID from filename
 */
function parseTrackerIdFromFilename(filename: string): number | null {
  const trackerMatch = filename.match(/tracker(\d+)/);
  return trackerMatch ? parseInt(trackerMatch[1], 10) : null;
}

/**
 * Get all images from storage
 */
async function getAllImagesFromStorage(supabase: any): Promise<DetectionImage[]> {
  const allImages: DetectionImage[] = [];

  try {
    const { data: items, error } = await supabase.storage
      .from(STORAGE_BUCKET_NAME)
      .list('', {
        limit: 1000,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (error) throw error;

    console.log(`Found ${items?.length || 0} items in storage root`);

    const folders = items?.filter((item: any) => !item.name.includes('.')) || [];
    const files = items?.filter((item: any) => item.name.match(/\.(jpg|jpeg)$/i)) || [];

    if (folders.length > 0) {
      console.log(`Detected folder structure with ${folders.length} folders`);
      
      for (const folder of folders) {
        const { data: folderFiles, error: folderError } = await supabase.storage
          .from(STORAGE_BUCKET_NAME)
          .list(folder.name, {
            limit: 1000,
            sortBy: { column: 'created_at', order: 'desc' },
          });

        if (folderError) {
          console.error(`Error listing folder ${folder.name}:`, folderError);
          continue;
        }

        const imageFiles = folderFiles?.filter((file: any) => 
          file.name.match(/\.(jpg|jpeg)$/i)
        ) || [];

        console.log(`Found ${imageFiles.length} images in ${folder.name}`);

        imageFiles.forEach((file: any) => {
          allImages.push(parseFileToDetectionImage(file, folder.name, supabase));
        });
      }
    }

    if (files.length > 0) {
      console.log(`Detected flat structure with ${files.length} images`);
      
      files.forEach((file: any) => {
        allImages.push(parseFileToDetectionImage(file, 'Camera', supabase));
      });
    }

    console.log(`Total images processed: ${allImages.length}`);
    return allImages;

  } catch (error) {
    console.error('Error getting images from storage:', error);
    throw error;
  }
}

/**
 * Parse storage file to DetectionImage object
 */
function parseFileToDetectionImage(
  file: any,
  cameraName: string,
  supabase: any
): DetectionImage {
  const filename = file.name;
  
  const detectionType = extractDetectionTypeFromFilename(filename);
  const trackerId = parseTrackerIdFromFilename(filename);
  const timestamp = parseTimestampFromFilename(filename); // Now returns local ISO string
  
  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET_NAME)
    .getPublicUrl(`${cameraName === 'Camera' ? '' : cameraName + '/'}${filename}`);

  return {
    id: `${cameraName}_${filename}`,
    camera_id: cameraName,
    camera_name: cameraName,
    detection_type: detectionType,
    confidence: 0.85,
    timestamp: timestamp, // ISO string in local timezone
    image_url: urlData.publicUrl,
    thumbnail_url: urlData.publicUrl,
    file_size: file.metadata?.size || 0,
    metadata: {
      tracker_id: trackerId,
      storage_path: `${cameraName === 'Camera' ? '' : cameraName + '/'}${filename}`,
    },
  };
}

/**
 * Fetch available detection types
 */
export async function fetchAvailableDetectionTypes(): Promise<string[]> {
  const supabase = createClient();

  try {
    const allImages = await getAllImagesFromStorage(supabase);
    const detectionTypesSet = new Set<string>();
    
    allImages.forEach((image) => {
      if (image.detection_type && image.detection_type !== 'unknown') {
        detectionTypesSet.add(image.detection_type);
      }
    });

    const detectionTypes = Array.from(detectionTypesSet).sort();
    console.log('Available detection types from storage:', detectionTypes);
    
    return ['all', ...detectionTypes];

  } catch (error) {
    console.error('Error fetching detection types:', error);
    return ['all', 'person', 'car', 'bicycle'];
  }
}

/**
 * Apply filters
 */
function applyFilters(
  images: DetectionImage[],
  filters: {
    cameraId?: string;
    detectionType?: string;
    dateFrom?: string;
    dateTo?: string;
    minConfidence?: number;
    searchQuery?: string;
  }
): DetectionImage[] {
  let filtered = [...images];

  if (filters.cameraId && filters.cameraId !== 'all') {
    filtered = filtered.filter((img) => img.camera_id === filters.cameraId);
  }

  if (filters.detectionType && filters.detectionType !== 'all') {
    filtered = filtered.filter(
      (img) => img.detection_type.toLowerCase() === filters.detectionType?.toLowerCase()
    );
  }

  if (filters.dateFrom) {
    const fromDate = new Date(filters.dateFrom);
    filtered = filtered.filter((img) => new Date(img.timestamp) >= fromDate);
  }

  if (filters.dateTo) {
    const toDate = new Date(filters.dateTo);
    filtered = filtered.filter((img) => new Date(img.timestamp) <= toDate);
  }

  if (filters.minConfidence !== undefined && filters.minConfidence > 0) {
    filtered = filtered.filter((img) => img.confidence >= filters.minConfidence!);
  }

  if (filters.searchQuery) {
    const query = filters.searchQuery.toLowerCase();
    filtered = filtered.filter(
      (img) =>
        img.camera_name.toLowerCase().includes(query) ||
        img.detection_type.toLowerCase().includes(query)
    );
  }

  return filtered;
}

/**
 * Apply sorting
 */
function applySorting(
  images: DetectionImage[],
  sortBy: string = 'timestamp',
  sortOrder: 'asc' | 'desc' = 'desc'
): DetectionImage[] {
  const sorted = [...images];

  sorted.sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'timestamp':
      case 'date':
        comparison = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        break;
      case 'camera_name':
      case 'camera':
        comparison = a.camera_name.localeCompare(b.camera_name);
        break;
      case 'file_size':
      case 'size':
        comparison = a.file_size - b.file_size;
        break;
      case 'confidence':
        comparison = a.confidence - b.confidence;
        break;
      default:
        comparison = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  return sorted;
}

/**
 * Fetch detection images
 */
export async function fetchDetectionImages(
  params: DetectionImagesQueryParams
): Promise<DetectionImagesResponse> {
  const supabase = createClient();

  const {
    cameraId,
    detectionType,
    dateFrom,
    dateTo,
    minConfidence,
    searchQuery,
    sortBy,
    sortOrder,
    page = 1,
    limit = 24,
  } = params;

  console.log('Fetching images from storage bucket with params:', params);

  try {
    const allImages = await getAllImagesFromStorage(supabase);
    console.log(`Total images found in storage: ${allImages.length}`);

    let filteredImages = applyFilters(allImages, {
      cameraId,
      detectionType,
      dateFrom,
      dateTo,
      minConfidence,
      searchQuery,
    });

    console.log(`After filters: ${filteredImages.length} images`);

    filteredImages = applySorting(filteredImages, sortBy, sortOrder);

    const totalCount = filteredImages.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedImages = filteredImages.slice(startIndex, endIndex);

    console.log(`Returning page ${page}: ${paginatedImages.length} images`);

    return {
      data: paginatedImages,
      count: totalCount,
    };
  } catch (error) {
    console.error('Error fetching detection images:', error);
    throw new Error('Failed to fetch detection images from storage');
  }
}

/**
 * Fetch cameras
 */
export async function fetchCameras(): Promise<Camera[]> {
  const supabase = createClient();

  try {
    const { data: items, error } = await supabase.storage
      .from(STORAGE_BUCKET_NAME)
      .list('', {
        limit: 100,
      });

    if (error) throw error;

    const folders = items?.filter((item: any) => !item.name.includes('.')) || [];
    const files = items?.filter((item: any) => item.name.match(/\.(jpg|jpeg)$/i)) || [];

    if (folders.length > 0) {
      return folders.map((folder: any) => ({
        id: folder.name,
        name: folder.name,
      }));
    } else if (files.length > 0) {
      return [{ id: 'default', name: 'Camera' }];
    }

    return [];
  } catch (error) {
    console.error('Error fetching cameras:', error);
    return [];
  }
}

/**
 * Delete image
 */
export async function deleteDetectionImage(
  id: string,
  image: DetectionImage
): Promise<void> {
  const supabase = createClient();

  try {
    const storagePath = image.metadata?.storage_path || image.image_url.split('/').pop();

    if (!storagePath) {
      throw new Error('Could not determine storage path for image');
    }

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET_NAME)
      .remove([storagePath]);

    if (error) throw error;

    console.log(`Deleted image: ${storagePath}`);
  } catch (error) {
    console.error('Error deleting image:', error);
    throw new Error('Failed to delete image from storage');
  }
}

/**
 * Bulk delete images
 */
export async function bulkDeleteDetectionImages(
  params: BulkDeleteParams
): Promise<void> {
  const supabase = createClient();

  try {
    const paths = params.images
      .map((img) => img.metadata?.storage_path || img.image_url.split('/').pop())
      .filter((path): path is string => !!path);

    if (paths.length === 0) {
      throw new Error('No valid paths to delete');
    }

    const { error } = await supabase.storage.from(STORAGE_BUCKET_NAME).remove(paths);

    if (error) throw error;

    console.log(`Bulk deleted ${paths.length} images`);
  } catch (error) {
    console.error('Error bulk deleting images:', error);
    throw new Error('Failed to bulk delete images from storage');
  }
}

/**
 * Download image
 */
export async function downloadImageFromUrl(image: DetectionImage): Promise<void> {
  try {
    const response = await fetch(image.image_url);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const filename = image.metadata?.storage_path?.split('/').pop() || 
                    image.image_url.split('/').pop() || 
                    'detection_image.jpg';
    
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    console.log(`Downloaded image: ${filename}`);
  } catch (error) {
    console.error('Error downloading image:', error);
    throw new Error('Failed to download image');
  }
}

/**
 * Calculate total storage
 */
export function calculateTotalStorage(images: DetectionImage[]): number {
  return images.reduce((total, image) => total + (image.file_size || 0), 0);
}