/**
 * Video API Route - Storage Bucket with Recursive Subfolder Traversal
 * Reads from: vitcam-recordings bucket
 * Handles: Nested folder structures (camera/date/videos)
 * 
 * Usage: /api/videos?page=1&limit=12&search=test&camera=cam1&type=motion&sortBy=timestamp&sortOrder=desc
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

const BUCKET_NAME = 'vitcam-recordings';

interface VideoQueryParams {
  page: number;
  limit: number;
  search?: string;
  camera?: string;
  type?: 'motion' | 'continuous' | 'all';
  sortBy: 'name' | 'timestamp' | 'size' | 'duration' | 'camera';
  sortOrder: 'asc' | 'desc';
}

interface StorageFile {
  name: string;
  id: string;
  updated_at: string;
  created_at: string;
  last_accessed_at: string;
  metadata: {
    eTag: string;
    size: number;
    mimetype: string;
    cacheControl: string;
    lastModified: string;
    contentLength: number;
    httpStatusCode: number;
  };
}

interface VideoFile {
  id: string;
  name: string;
  path: string;
  camera: string;
  size: string;
  duration: string;
  timestamp: string;
  thumbnail: string;
  type: 'motion' | 'continuous';
  etag: string;
  publicUrl: string;
  mimeType: string;
}

interface PaginatedResponse {
  videos: VideoFile[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  stats: {
    totalVideos: number;
    totalSize: number;
    motionEvents: number;
    continuousRecordings: number;
  };
  cameras: string[];
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const params: VideoQueryParams = {
      page: Math.max(1, parseInt(searchParams.get('page') || '1')),
      limit: Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '12'))),
      search: searchParams.get('search') || undefined,
      camera: searchParams.get('camera') || undefined,
      type: (searchParams.get('type') as any) || 'all',
      sortBy: (searchParams.get('sortBy') as any) || 'timestamp',
      sortOrder: (searchParams.get('sortOrder') as any) || 'desc',
    };

    console.log(`📦 Fetching videos from bucket: ${BUCKET_NAME}`);
    console.log('Parameters:', params);

    // Recursively fetch all video files from all subfolders
    const allFiles = await listAllFilesRecursively(supabase, BUCKET_NAME);
    
    console.log(`✅ Found ${allFiles.length} total files in storage`);

    if (allFiles.length === 0) {
      return NextResponse.json({
        videos: [],
        pagination: {
          currentPage: 1,
          totalPages: 0,
          totalItems: 0,
          itemsPerPage: params.limit,
          hasNextPage: false,
          hasPreviousPage: false,
        },
        stats: {
          totalVideos: 0,
          totalSize: 0,
          motionEvents: 0,
          continuousRecordings: 0,
        },
        cameras: [],
      });
    }

    // Transform storage files to VideoFile format
    const allVideos: VideoFile[] = allFiles
      .filter(file => isVideoFile(file.name))
      .map(file => transformToVideoFile(supabase, file));

    console.log(`✅ Transformed ${allVideos.length} video files`);

    // Apply filters
    let filteredVideos = allVideos.filter(video => {
      // Search filter
      if (params.search) {
        const searchLower = params.search.toLowerCase();
        const matchesSearch = 
          video.name.toLowerCase().includes(searchLower) ||
          video.camera.toLowerCase().includes(searchLower) ||
          video.path.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Camera filter
      if (params.camera && params.camera !== 'all') {
        if (video.camera !== params.camera) return false;
      }

      // Type filter
      if (params.type && params.type !== 'all') {
        if (video.type !== params.type) return false;
      }

      return true;
    });

    console.log(`✅ After filtering: ${filteredVideos.length} videos`);

    // Apply sorting
    filteredVideos.sort((a, b) => {
      let aValue: any = a[params.sortBy as keyof VideoFile];
      let bValue: any = b[params.sortBy as keyof VideoFile];
      
      if (params.sortBy === 'timestamp') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      } else if (params.sortBy === 'size') {
        aValue = parseSizeToBytes(aValue as string);
        bValue = parseSizeToBytes(bValue as string);
      } else if (params.sortBy === 'duration') {
        aValue = parseDurationToSeconds(aValue as string);
        bValue = parseDurationToSeconds(bValue as string);
      } else if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      if (params.sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    // Calculate pagination
    const totalItems = filteredVideos.length;
    const totalPages = Math.ceil(totalItems / params.limit);
    const start = (params.page - 1) * params.limit;
    const end = start + params.limit;
    const paginatedVideos = filteredVideos.slice(start, end);

    console.log(`✅ Paginated: Page ${params.page}/${totalPages}, showing ${paginatedVideos.length} videos`);

    // Calculate stats
    const stats = {
      totalVideos: allVideos.length,
      totalSize: allVideos.reduce((sum, v) => sum + parseSizeToBytes(v.size), 0),
      motionEvents: allVideos.filter(v => v.type === 'motion').length,
      continuousRecordings: allVideos.filter(v => v.type === 'continuous').length,
    };

    // Get unique cameras
    const uniqueCameras = Array.from(
      new Set(allVideos.map(v => v.camera).filter(c => c && c !== 'unknown'))
    ).sort();

    const response: PaginatedResponse = {
      videos: paginatedVideos,
      pagination: {
        currentPage: params.page,
        totalPages,
        totalItems,
        itemsPerPage: params.limit,
        hasNextPage: params.page < totalPages,
        hasPreviousPage: params.page > 1,
      },
      stats,
      cameras: uniqueCameras,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Recursively list all files in bucket including all subfolders
 */
async function listAllFilesRecursively(
  supabase: any, 
  bucketName: string, 
  prefix: string = ''
): Promise<StorageFile[]> {
  let allFiles: StorageFile[] = [];
  
  try {
    console.log(`📂 Listing files in: ${prefix || 'root'}`);
    
    const { data: items, error } = await supabase
      .storage
      .from(bucketName)
      .list(prefix, {
        limit: 1000,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    if (error) {
      console.error(`Error listing ${prefix}:`, error);
      return allFiles;
    }

    if (!items || items.length === 0) {
      console.log(`  Empty folder: ${prefix || 'root'}`);
      return allFiles;
    }

    console.log(`  Found ${items.length} items in ${prefix || 'root'}`);

    for (const item of items) {
      const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
      
      // Check if it's a folder (ends with / or has no metadata indicating it's a file)
      const isFolder = item.name.endsWith('/') || !item.metadata || Object.keys(item.metadata).length === 0;
      
      if (isFolder) {
        // It's a folder, recursively list its contents
        console.log(`  📁 Found subfolder: ${fullPath}`);
        const subFiles = await listAllFilesRecursively(supabase, bucketName, fullPath);
        allFiles = allFiles.concat(subFiles);
      } else {
        // It's a file, add it with full path
        console.log(`  📄 Found file: ${fullPath}`);
        allFiles.push({
          ...item,
          name: fullPath // Use full path as name
        });
      }
    }

    return allFiles;

  } catch (error) {
    console.error(`Error in recursive listing for ${prefix}:`, error);
    return allFiles;
  }
}

/**
 * Check if file is a video based on extension
 */
function isVideoFile(filename: string): boolean {
  const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.m4v'];
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  return videoExtensions.includes(ext);
}

/**
 * Transform storage file to VideoFile format
 */
function transformToVideoFile(supabase: any, file: StorageFile): VideoFile {
  // Extract camera name from path
  // Examples:
  // "camera1/2024-01-15/video.webm" -> camera1
  // "front-door/motion/2024-01-15-video.webm" -> front-door
  // "videos/camera1/file.webm" -> camera1
  const pathParts = file.name.split('/');
  const camera = extractCameraName(pathParts);
  
  // Extract just the filename for display
  const fileName = pathParts[pathParts.length - 1] || file.name;
  
  // Determine type from filename or folder structure
  const type = detectVideoType(file.name);
  
  // Get public URL
  const { data: { publicUrl } } = supabase
    .storage
    .from(BUCKET_NAME)
    .getPublicUrl(file.name);

  return {
    id: file.id || generateFileId(file.name),
    name: fileName,
    path: file.name, // Full path in storage
    camera,
    size: formatBytes(file.metadata?.size || 0),
    duration: extractDuration(fileName) || '00:00:00',
    timestamp: file.created_at || file.updated_at || new Date().toISOString(),
    thumbnail: publicUrl, // Use video URL as thumbnail (can be customized)
    type,
    etag: file.metadata?.eTag || '',
    publicUrl,
    mimeType: file.metadata?.mimetype || 'video/webm',
  };
}

/**
 * Extract camera name from path parts
 * Handles various folder structures:
 * - camera/video.webm -> camera
 * - camera/date/video.webm -> camera
 * - location/camera/video.webm -> camera (second level)
 */
function extractCameraName(pathParts: string[]): string {
  if (pathParts.length === 1) {
    // File in root: "video.webm"
    return 'default';
  } else if (pathParts.length === 2) {
    // camera/video.webm
    return pathParts[0];
  } else {
    // Nested structure: use first non-date folder as camera
    for (const part of pathParts.slice(0, -1)) { // Exclude filename
      // Skip common folder names and dates
      if (!isDateFolder(part) && !isCommonFolderName(part)) {
        return part;
      }
    }
    // Fallback to first folder
    return pathParts[0];
  }
}

/**
 * Check if folder name looks like a date (YYYY-MM-DD, YYYYMMDD, etc.)
 */
function isDateFolder(folderName: string): boolean {
  // Matches: 2024-01-15, 20240115, 2024_01_15, etc.
  return /^\d{4}[-_]?\d{2}[-_]?\d{2}$/.test(folderName);
}

/**
 * Check if folder is a common non-camera folder name
 */
function isCommonFolderName(folderName: string): boolean {
  const commonNames = ['videos', 'recordings', 'footage', 'media', 'uploads', 'files'];
  return commonNames.includes(folderName.toLowerCase());
}

/**
 * Detect video type from filename or path
 * Customize this based on your naming convention
 */
function detectVideoType(path: string): 'motion' | 'continuous' {
  const lowerPath = path.toLowerCase();
  
  // Check for motion indicators
  const motionIndicators = ['motion', 'event', 'alert', 'detection', 'trigger'];
  for (const indicator of motionIndicators) {
    if (lowerPath.includes(indicator)) {
      return 'motion';
    }
  }
  
  // Check for continuous indicators
  const continuousIndicators = ['continuous', 'recording', 'stream', 'live'];
  for (const indicator of continuousIndicators) {
    if (lowerPath.includes(indicator)) {
      return 'continuous';
    }
  }
  
  // Default to continuous if no indicators found
  return 'continuous';
}

/**
 * Try to extract duration from filename if present
 * Looks for patterns like: duration-10m30s, 10m30s, etc.
 */
function extractDuration(filename: string): string | null {
  // Look for duration pattern in filename
  const durationMatch = filename.match(/(\d+)m(\d+)s/i);
  if (durationMatch) {
    const minutes = parseInt(durationMatch[1]);
    const seconds = parseInt(durationMatch[2]);
    return `00:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return null;
}

/**
 * Generate a consistent ID from filename
 */
function generateFileId(filename: string): string {
  // Simple hash function for consistent IDs
  let hash = 0;
  for (let i = 0; i < filename.length; i++) {
    const char = filename.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Parse size string to bytes for sorting
 */
function parseSizeToBytes(sizeStr: string): number {
  const match = sizeStr.match(/^([\d.]+)\s*(\w+)$/);
  if (!match) return 0;
  
  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  
  const multipliers: { [key: string]: number } = {
    'BYTES': 1,
    'B': 1,
    'KB': 1024,
    'MB': 1024 * 1024,
    'GB': 1024 * 1024 * 1024,
    'TB': 1024 * 1024 * 1024 * 1024,
  };
  
  return value * (multipliers[unit] || 0);
}

/**
 * Parse duration string to seconds for sorting
 */
function parseDurationToSeconds(durationStr: string): number {
  if (!durationStr) return 0;
  
  const parts = durationStr.split(':').map(p => parseInt(p, 10) || 0);
  
  if (parts.length === 3) {
    // HH:MM:SS
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    // MM:SS
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    // SS
    return parts[0];
  }
  
  return 0;
}