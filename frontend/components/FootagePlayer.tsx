"use client";
import React, { useState, useRef, useEffect } from 'react';
import { Download, Trash2, Loader, AlertCircle } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

interface ImprovedVideoPlayerProps {
  camera: string;
  filename: string;
  theme?: 'dark' | 'light';
  className?: string;
  publicUrl?: string;
  autoPlay?: boolean;
  poster?: string;
  onVideoDelete?: () => void;
  mimeType?: string;
}

const VideoPlayer: React.FC<ImprovedVideoPlayerProps> = ({
  camera,
  filename,
  theme = 'dark',
  className = '',
  publicUrl,
  autoPlay = false,
  poster,
  onVideoDelete,
  mimeType = 'video/webm'
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(publicUrl || null);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  
  const supabase = createClient();
  const isDark = theme === 'dark';

  // Theme classes
  const themeClasses = {
    bg: isDark ? 'bg-gray-900' : 'bg-gray-100',
    text: isDark ? 'text-white' : 'text-gray-900',
    textSecondary: isDark ? 'text-gray-300' : 'text-gray-600',
  };

  // Get video URL from Supabase Storage
  useEffect(() => {
    const getVideoUrl = async () => {
      if (publicUrl) {
        console.log('Using provided public URL:', publicUrl);
        setVideoUrl(publicUrl);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const filePath = `${camera}/${filename}`;
        console.log(`Getting video URL for: ${filePath}`);

        const { data } = supabase.storage
          .from('vitcam-recordings')
          .getPublicUrl(filePath);

        if (data?.publicUrl) {
          console.log(`Video URL obtained: ${data.publicUrl}`);
          setVideoUrl(data.publicUrl);
        } else {
          throw new Error('Failed to get video URL from Supabase Storage');
        }
      } catch (err) {
        console.error('Error getting video URL:', err);
        setError(err instanceof Error ? err.message : 'Failed to load video URL');
      } finally {
        setLoading(false);
      }
    };

    getVideoUrl();
  }, [camera, filename, publicUrl, supabase]);

  // Handle iframe load
  const handleIframeLoad = () => {
    console.log('Iframe loaded successfully');
    setIframeLoaded(true);
    setLoading(false);
    setError(null);
  };

  const handleIframeError = () => {
    console.error('Iframe failed to load');
    setError('Failed to load video in iframe. The video file may be inaccessible or corrupted.');
    setLoading(false);
  };

  // Enhanced download functionality
  const handleDownload = async () => {
    if (!videoUrl || !filename) return;
    
    try {
      setDownloadLoading(true);
      console.log(`Attempting to download: ${filename} from ${videoUrl}`);
      
      try {
        const response = await fetch(videoUrl, {
          method: 'GET',
          headers: {
            'Accept': mimeType + ',video/*,*/*',
            'Cache-Control': 'no-cache',
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const blob = await response.blob();
        const correctBlob = new Blob([blob], { type: mimeType });
        const url = window.URL.createObjectURL(correctBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        alert(`Successfully downloading ${filename}...`);
        return;
        
      } catch (fetchError) {
        console.warn('Direct fetch failed, trying Supabase download:', fetchError);
        
        const filePath = `${camera}/${filename}`;
        const { data, error } = await supabase.storage
          .from('vitcam-recordings')
          .download(filePath);

        if (error) {
          throw new Error(`Supabase download failed: ${error.message}`);
        }

        if (!data) {
          throw new Error('No data received from Supabase');
        }

        const correctBlob = new Blob([data], { type: mimeType });
        const url = window.URL.createObjectURL(correctBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        alert(`Successfully downloading ${filename}...`);
      }
      
    } catch (err) {
      console.error('Error downloading video:', err);
      
      try {
        console.log('Attempting to open video in new tab as fallback...');
        window.open(videoUrl, '_blank');
        alert(`Opened ${filename} in new tab. You can right-click and "Save As" to download.`);
      } catch (openError) {
        console.error('All download methods failed:', openError);
        alert(`Failed to download ${filename}. Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    } finally {
      setDownloadLoading(false);
    }
  };

  // Delete video functionality
  const handleDeleteVideo = async () => {
    if (!camera || !filename) return;
    
    try {
      setDeleteLoading(true);
      console.log(`Starting deletion for: ${filename} from camera: ${camera}`);

      const filePath = `${camera}/${filename}`;
      const { error } = await supabase.storage
        .from('vitcam-recordings')
        .remove([filePath]);

      if (error) {
        throw new Error(`Supabase deletion error: ${error.message}`);
      }

      console.log(`Successfully deleted: ${filename}`);
      alert(`Successfully deleted: ${filename}`);
      
      if (onVideoDelete) {
        onVideoDelete();
      }

      setShowDeleteConfirm(false);

    } catch (err) {
      console.error('Delete operation failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      alert(`Failed to delete ${filename}: ${errorMessage}\n\nCheck console for details.`);
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`${themeClasses.bg} ${className} rounded-lg flex items-center justify-center h-96`}>
        <div className="flex flex-col items-center gap-3">
          <Loader className={`w-8 h-8 animate-spin ${themeClasses.text}`} />
          <span className={`${themeClasses.textSecondary} text-sm`}>Loading video player...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${themeClasses.bg} ${className} rounded-lg flex items-center justify-center h-96`}>
        <div className="flex flex-col items-center gap-3 text-center max-w-lg p-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
          <div className="text-red-500 font-medium">Error Loading Video</div>
          <div className={`${themeClasses.textSecondary} text-sm`}>{error}</div>
          
          <div className="flex flex-wrap gap-2 mt-3 justify-center">
            <button
              onClick={() => {
                console.log('Retrying video load...');
                setError(null);
                setLoading(true);
                setIframeLoaded(false);
              }}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
            
            {videoUrl && (
              <button
                onClick={() => {
                  console.log('Opening video in new tab:', videoUrl);
                  window.open(videoUrl, '_blank');
                }}
                className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors"
              >
                Open Direct
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!videoUrl) {
    return (
      <div className={`${themeClasses.bg} ${className} rounded-lg flex items-center justify-center h-96`}>
        <div className={`${themeClasses.textSecondary}`}>No video URL available</div>
      </div>
    );
  }

  return (
    <div className={`relative ${className} w-full`} style={{ height: '60vh', minHeight: '400px', maxHeight: '800px' }}>
      {/* Main iframe video player */}
      <iframe
        ref={iframeRef}
        src={videoUrl}
        className="w-full h-full border-0 rounded-lg shadow-lg"
        allowFullScreen
        allow="autoplay; fullscreen; picture-in-picture"
        loading="lazy"
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        title={`Video player for ${filename}`}
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        style={{ aspectRatio: '3/2' }}
      />

      {/* Loading overlay - only shows while loading */}
      {!iframeLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-90 z-10 rounded-lg">
          <div className="text-center text-white">
            <Loader className="w-8 h-8 animate-spin mx-auto mb-2" />
            <div className="text-sm">Loading video...</div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg max-w-md w-full p-6`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 dark:bg-red-900 p-2 rounded-full">
                <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className={`text-lg font-semibold ${themeClasses.text}`}>Delete Video</h3>
                <p className={`text-sm ${themeClasses.textSecondary}`}>This action cannot be undone</p>
              </div>
            </div>
            
            <div className={`mb-6 p-4 ${isDark ? 'bg-gray-700' : 'bg-gray-100'} rounded-lg`}>
              <div className={`text-sm font-medium ${themeClasses.text} mb-2`}>{filename}</div>
              <div className={`text-xs ${themeClasses.textSecondary} space-y-1`}>
                <div>Camera: {camera}</div>
                <div>Format: {mimeType}</div>
                <div>Path: {camera}/{filename}</div>
              </div>
            </div>
            
            <div className="bg-yellow-100 dark:bg-yellow-900 border border-yellow-400 dark:border-yellow-600 rounded-lg p-3 mb-6">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                <div className="text-yellow-800 dark:text-yellow-200 text-sm">
                  <div className="font-medium mb-1">Warning</div>
                  <div>This will permanently delete the video file from storage. This action cannot be undone.</div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteLoading}
                className={`px-4 py-2 ${isDark ? 'bg-gray-600 hover:bg-gray-700 text-gray-200' : 'bg-gray-300 hover:bg-gray-400 text-gray-700'} rounded-lg transition-colors disabled:opacity-50`}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteVideo}
                disabled={deleteLoading}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {deleteLoading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Video
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;