// Hook for managing video loading states
// hooks/useVideoPlayer.ts

import { useState, useCallback } from 'react';

interface UseVideoPlayerOptions {
  onLoad?: () => void;
  onError?: (error: string) => void;
  defaultMethod?: 'direct' | 'presigned';
}

export const useVideoPlayer = (options: UseVideoPlayerOptions = {}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [loadMethod, setLoadMethod] = useState<'direct' | 'presigned'>(
    options.defaultMethod || 'direct'
  );

  const handleVideoLoad = useCallback(() => {
    setIsLoading(false);
    setError('');
    options.onLoad?.();
  }, [options.onLoad]);

  const handleVideoError = useCallback((errorMsg: string) => {
    setIsLoading(false);
    setError(errorMsg);
    options.onError?.(errorMsg);
  }, [options.onError]);

  const reset = useCallback(() => {
    setIsLoading(true);
    setError('');
  }, []);

  const switchMethod = useCallback(() => {
    setLoadMethod(prev => prev === 'direct' ? 'presigned' : 'direct');
    reset();
  }, [reset]);

  return {
    isLoading,
    error,
    loadMethod,
    setLoadMethod,
    handleVideoLoad,
    handleVideoError,
    reset,
    switchMethod,
  };
};
