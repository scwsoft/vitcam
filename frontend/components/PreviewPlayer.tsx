"use client";
import React, { useState, useRef, useEffect } from 'react';
import { Loader, AlertCircle } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

interface ImprovedVideoPlayerProps {
  camera: string;
  filename: string;
  theme?: 'dark' | 'light';
  className?: string;
  publicUrl?: string;
  autoPlay?: boolean;
  poster?: string;
  mimeType?: string;
}

const PreviewPlayer: React.FC<ImprovedVideoPlayerProps> = ({
  camera,
  filename,
  theme = 'dark',
  className = '',
  publicUrl,
  autoPlay = false,
  poster,
  mimeType = 'video/webm'
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(publicUrl || null);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const supabase = createClient();
  const isDark = theme === 'dark';

  const themeClasses = {
    bg: isDark ? 'bg-gray-900' : 'bg-gray-100',
    text: isDark ? 'text-white' : 'text-gray-900',
    textSecondary: isDark ? 'text-gray-300' : 'text-gray-600',
  };

  useEffect(() => {
    const getVideoUrl = async () => {
      if (publicUrl) {
        setVideoUrl(publicUrl);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const filePath = `${camera}/${filename}`;
        const { data } = supabase.storage
          .from('vitcam-recordings')
          .getPublicUrl(filePath);

        if (data?.publicUrl) {
          setVideoUrl(data.publicUrl);
        } else {
          throw new Error('Failed to get video URL from Supabase Storage');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load video URL');
      } finally {
        setLoading(false);
      }
    };

    getVideoUrl();
  }, [camera, filename, publicUrl, supabase]);

  const handleIframeLoad = () => {
    setIframeLoaded(true);
    setLoading(false);
    setError(null);
  };

  const handleIframeError = () => {
    setError('Failed to load video in iframe. The video file may be inaccessible or corrupted.');
    setLoading(false);
  };

  const handleDownload = async () => {
    if (!videoUrl || !filename) return;

    try {
      setDownloadLoading(true);

      try {
        const response = await fetch(videoUrl, {
          method: 'GET',
          headers: {
            'Accept': mimeType + ',video/*,*/*',
            'Cache-Control': 'no-cache',
          }
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

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
        const filePath = `${camera}/${filename}`;
        const { data, error } = await supabase.storage
          .from('vitcam-recordings')
          .download(filePath);

        if (error) throw new Error(`Supabase download failed: ${error.message}`);
        if (!data) throw new Error('No data received from Supabase');

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
      try {
        window.open(videoUrl, '_blank');
        alert(`Opened ${filename} in new tab. You can right-click and "Save As" to download.`);
      } catch {
        alert(`Failed to download ${filename}. Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    } finally {
      setDownloadLoading(false);
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
              onClick={() => { setError(null); setLoading(true); setIframeLoaded(false); }}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
            {videoUrl && (
              <button
                onClick={() => window.open(videoUrl, '_blank')}
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
        <div className={themeClasses.textSecondary}>No video URL available</div>
      </div>
    );
  }

  return (
    <div className={`relative ${className} w-full`} style={{ height: '60vh', minHeight: '400px', maxHeight: '800px' }}>
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

      {!iframeLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-90 z-10 rounded-lg">
          <div className="text-center text-white">
            <Loader className="w-8 h-8 animate-spin mx-auto mb-2" />
            <div className="text-sm">Loading video...</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreviewPlayer;