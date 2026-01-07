/**
 * Video Service
 * Handles all API operations for video management
 * Updated to work with vitcam-recordings bucket and WebM files
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { VideoFile } from '@/types/video.types';

export class VideoService {
  private readonly BUCKET_NAME = 'vitcam-recordings';

  constructor(private supabase: SupabaseClient) {}

  /**
   * Fetch all videos from Supabase storage
   * Processes camera folders and their video files
   */
  async fetchVideos(): Promise<VideoFile[]> {
    try {
      console.group('🎥 Fetching Videos from Supabase');
      console.log('Bucket:', this.BUCKET_NAME);
      
      // List all folders in the root directory
      const { data: rootFiles, error: listError } = await this.supabase.storage
        .from(this.BUCKET_NAME)
        .list('', {
          limit: 100,
          sortBy: { column: 'name', order: 'asc' }
        });

      if (listError) {
        console.error('❌ Error listing root directory:', listError);
        if (listError.message?.includes('permission') || listError.message?.includes('policy')) {
          throw new Error(`Permission denied: ${listError.message}. Please check your Supabase Storage RLS policies.`);
        }
        throw new Error(`Failed to access storage: ${listError.message}`);
      }

      if (!rootFiles || rootFiles.length === 0) {
        console.warn('⚠️ No files or folders found in root directory');
        console.warn('Please check if camera folders exist in the bucket');
        console.groupEnd();
        return []; // Return empty array instead of throwing
      }

      console.log('📁 Root directory items:', rootFiles.length);
      
      // Filter for folders (no id property)
      const folders = rootFiles.filter(item => {
        const isFolder = !item.id && item.name && item.name !== '.emptyFolderPlaceholder';
        return isFolder;
      });
      
      console.log('📸 Camera folders found:', folders.map(f => f.name));

      if (folders.length === 0) {
        console.warn('⚠️ No camera folders found in bucket');
        console.warn('Expected folder structure: vitcam-recordings/Camera1/, Camera2/, etc.');
        console.groupEnd();
        return []; // Return empty array instead of throwing
      }

      let allVideos: VideoFile[] = [];

      // Process each camera folder
      for (const folder of folders) {
        console.group(`📂 Processing: ${folder.name}`);
        
        try {
          const folderVideos = await this.processFolder(folder.name);
          allVideos.push(...folderVideos);
          console.log(`✅ Found ${folderVideos.length} videos`);
        } catch (folderError) {
          console.error(`❌ Error processing folder ${folder.name}:`, folderError);
        }
        
        console.groupEnd();
      }

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📊 FINAL RESULT');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`Total videos: ${allVideos.length}`);
      
      if (allVideos.length > 0) {
        console.log('Videos by camera:', allVideos.reduce((acc, video) => {
          acc[video.camera] = (acc[video.camera] || 0) + 1;
          return acc;
        }, {} as Record<string, number>));
        console.log('Sample video:', allVideos[0]);
      } else {
        console.warn('⚠️ No video files found in any camera folders');
        console.warn('Make sure video files exist in your camera folders');
      }
      
      console.groupEnd();
      return allVideos;
      
    } catch (error) {
      console.error('❌ CRITICAL ERROR in fetchVideos:', error);
      console.groupEnd();
      throw error;
    }
  }

  /**
   * Process a single camera folder
   */
  private async processFolder(folderName: string): Promise<VideoFile[]> {
    const { data: folderContents, error: folderError } = await this.supabase.storage
      .from(this.BUCKET_NAME)
      .list(folderName, {
        limit: 1000,
        sortBy: { column: 'name', order: 'desc' }
      });

    if (folderError) {
      console.error(`Error accessing folder ${folderName}:`, folderError);
      return [];
    }

    if (!folderContents || folderContents.length === 0) {
      console.log(`Folder is empty`);
      return [];
    }

    console.log(`Found ${folderContents.length} items`);

    // Filter for video files
    const videoFiles = folderContents.filter(item => {
      const hasId = item.id !== null;
      const isVideo = this.isVideoFile(item.name || '');
      if (item.name) {
        console.log(`  ${hasId ? '📄' : '📁'} ${item.name} - Video: ${isVideo ? '✅' : '❌'}`);
      }
      return hasId && isVideo;
    });

    console.log(`Video files: ${videoFiles.length}`);

    // Process each video file
    const videos: VideoFile[] = [];
    for (const file of videoFiles) {
      try {
        const videoFile = await this.transformToVideoFile(file, folderName);
        videos.push(videoFile);
        console.log(`  ✅ Processed: ${file.name}`);
      } catch (fileError) {
        console.error(`  ❌ Failed to process ${file.name}:`, fileError);
      }
    }

    return videos;
  }

  /**
   * Delete a video file
   */
  async deleteVideo(path: string): Promise<void> {
    try {
      console.log(`Starting deletion for: ${path}`);
      
      const { error } = await this.supabase.storage
        .from(this.BUCKET_NAME)
        .remove([path]);

      if (error) throw error;
      
      console.log(`Successfully deleted: ${path}`);
    } catch (error) {
      console.error('Error deleting video:', error);
      throw new Error('Failed to delete video');
    }
  }

  /**
   * Get public URL for a video
   */
  getPublicUrl(path: string): string {
    const { data } = this.supabase.storage
      .from(this.BUCKET_NAME)
      .getPublicUrl(path, {
        download: false // Ensure it's for streaming, not download
      });

    return data.publicUrl;
  }

  /**
   * Download a video file
   */
  async downloadVideo(video: VideoFile): Promise<void> {
    try {
      console.log(`Starting download for: ${video.name}`);
      
      // Method 1: Try direct fetch with proper headers
      try {
        console.log(`Fetching from URL: ${video.publicUrl}`);
        
        const response = await fetch(video.publicUrl, {
          method: 'GET',
          headers: {
            'Accept': 'video/webm,video/mp4,video/*,*/*',
            'Cache-Control': 'no-cache',
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const blob = await response.blob();
        console.log(`Blob created: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);

        // Ensure correct MIME type
        const correctBlob = new Blob([blob], { type: video.mimeType });
        this.triggerDownload(correctBlob, video.name);
        
        console.log(`Successfully initiated download: ${video.name}`);
        return;
        
      } catch (fetchError) {
        console.warn('Direct fetch failed:', fetchError);
        
        // Method 2: Try Supabase Storage download API
        const { data, error } = await this.supabase.storage
          .from(this.BUCKET_NAME)
          .download(video.path);

        if (error) {
          throw new Error(`Supabase download error: ${error.message}`);
        }

        if (!data) {
          throw new Error('No data received from Supabase Storage');
        }

        console.log(`Supabase blob received: ${(data.size / 1024 / 1024).toFixed(2)} MB`);

        // Ensure correct MIME type
        const correctBlob = new Blob([data], { type: video.mimeType });
        this.triggerDownload(correctBlob, video.name);
        
        console.log(`Supabase download successful: ${video.name}`);
      }
      
    } catch (err) {
      console.error('Download failed:', err);
      // Fallback: open in new tab
      const newWindow = window.open(video.publicUrl, '_blank');
      if (!newWindow) {
        throw new Error('Download failed. Please allow popups and try again.');
      }
      throw new Error('Download initiated in new tab. Right-click the video and select "Save video as..."');
    }
  }

  /**
   * Trigger browser download
   */
  private triggerDownload(blob: Blob, filename: string): void {
    const downloadUrl = window.URL.createObjectURL(blob);
    const cleanFilename = filename.replace(/[/\\]/g, '_');
    
    const downloadLink = document.createElement('a');
    downloadLink.href = downloadUrl;
    downloadLink.download = cleanFilename;
    downloadLink.style.display = 'none';
    
    document.body.appendChild(downloadLink);
    downloadLink.click();
    
    setTimeout(() => {
      document.body.removeChild(downloadLink);
      window.URL.revokeObjectURL(downloadUrl);
    }, 100);
  }

  /**
   * Check if file is a video based on extension
   */
  private isVideoFile(filename: string): boolean {
    if (!filename) return false;
    
    const videoExtensions = /\.(webm|mp4|avi|mov|mkv|flv|m4v)$/i;
    return videoExtensions.test(filename);
  }

  /**
   * Get mime type from file extension
   */
  private getMimeType(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      'webm': 'video/webm',
      'mp4': 'video/mp4',
      'avi': 'video/x-msvideo',
      'mov': 'video/quicktime',
      'mkv': 'video/x-matroska',
      'flv': 'video/x-flv',
      'm4v': 'video/x-m4v'
    };
    return mimeTypes[extension || ''] || 'video/mp4';
  }

  /**
   * Transform Supabase file object to VideoFile
   */
  private async transformToVideoFile(file: any, folderName: string): Promise<VideoFile> {
    const filePath = `${folderName}/${file.name}`;
    const publicUrl = this.getPublicUrl(filePath);
    
    // Extract metadata from filename
    const metadata = this.extractVideoMetadata(
      file.name,
      file.metadata?.size || 0,
      file.updated_at || file.created_at || new Date().toISOString(),
      folderName
    );

    // Generate thumbnail
    const thumbnail = await this.generateThumbnail(publicUrl, file.name);
    
    return {
      id: file.id || `${folderName}-${file.name}`,
      name: file.name,
      path: filePath,
      camera: folderName,
      size: metadata.size,
      duration: metadata.duration,
      timestamp: metadata.timestamp,
      thumbnail: thumbnail,
      type: metadata.type,
      etag: file.metadata?.eTag || file.metadata?.httpEtag || '',
      publicUrl: publicUrl,
      mimeType: metadata.mimeType
    };
  }

  /**
   * Extract metadata from filename and file info
   */
  private extractVideoMetadata(
    filename: string,
    fileSize: number,
    lastModified: string,
    folderName: string
  ) {
    // Extract timestamp from filename (format: YYYYMMDD_HHMMSS_motion.webm or YYYYMMDD_HHMMSS_continuous.webm)
    const timestampMatch = filename.match(/(\d{8}_\d{6})/);
    const typeMatch = filename.toLowerCase().includes('motion') ? 'motion' : 'continuous';
    
    let timestamp = lastModified;
    if (timestampMatch) {
      try {
        const dateStr = timestampMatch[1];
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        const hour = dateStr.substring(9, 11);
        const minute = dateStr.substring(11, 13);
        const second = dateStr.substring(13, 15);
        
        timestamp = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`).toISOString();
      } catch (parseError) {
        console.warn(`Failed to parse timestamp from ${filename}:`, parseError);
        timestamp = lastModified;
      }
    }

    return {
      type: typeMatch as 'continuous' | 'motion',
      timestamp,
      size: this.formatFileSize(fileSize),
      camera: folderName,
      duration: this.estimateDuration(fileSize),
      mimeType: this.getMimeType(filename)
    };
  }

  /**
   * Format file size to human-readable string
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Estimate duration from file size (rough approximation)
   */
  private estimateDuration(sizeInBytes: number): string {
    // Rough estimation: 1MB ≈ 1 minute for standard quality
    const totalSeconds = Math.floor(sizeInBytes / (1024 * 1024)) * 60;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Generate thumbnail for video
   */
  private async generateThumbnail(videoUrl: string, filename: string): Promise<string> {
    // For WebM files, try to generate a real thumbnail
    if (filename.toLowerCase().endsWith('.webm') || filename.toLowerCase().endsWith('.mp4')) {
      try {
        return await this.generateVideoThumbnail(videoUrl);
      } catch (error) {
        console.warn(`Failed to generate thumbnail for ${filename}:`, error);
      }
    }
    
    return this.getDefaultThumbnail();
  }

  /**
   * Generate video thumbnail from video URL
   */
  private generateVideoThumbnail(videoUrl: string): Promise<string> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.currentTime = 1; // Seek to 1 second for thumbnail
      
      video.onloadeddata = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 240;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
          resolve(thumbnail);
        } else {
          resolve(this.getDefaultThumbnail());
        }
      };
      
      video.onerror = () => {
        console.warn(`Failed to generate thumbnail for: ${videoUrl}`);
        resolve(this.getDefaultThumbnail());
      };
      
      video.src = videoUrl;
    });
  }

  /**
   * Get default thumbnail SVG
   */
  private getDefaultThumbnail(): string {
    return `data:image/svg+xml;base64,${btoa(`
      <svg width="320" height="240" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#424242"/>
        <circle cx="160" cy="120" r="30" fill="#666666"/>
        <polygon points="145,105 175,120 145,135" fill="#fff"/>
        <text x="160" y="200" text-anchor="middle" fill="#fff" font-family="Arial" font-size="12">Video</text>
      </svg>
    `)}`;
  }
}