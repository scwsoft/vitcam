/**
 * Optimized useVideos Hook
 * Server-side pagination with URL state management
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { VideoService } from '@/services/video.service';
import type { VideoFile, FilterState, SortConfig } from '@/types/video.types';

interface PaginatedVideosResponse {
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

export function useVideos() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const videoService = useMemo(() => new VideoService(supabase), [supabase]);

  // State
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  
  // Pagination state from URL
  const [currentPage, setCurrentPage] = useState(() => 
    parseInt(searchParams.get('page') || '1')
  );
  const [itemsPerPage, setItemsPerPage] = useState(() => 
    parseInt(searchParams.get('limit') || '12')
  );

  // Pagination metadata
  const [pagination, setPagination] = useState({
    totalPages: 0,
    totalItems: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  // Stats and cameras
  const [stats, setStats] = useState({
    totalVideos: 0,
    totalSize: 0,
    motionEvents: 0,
    continuousRecordings: 0,
  });
  const [cameras, setCameras] = useState<string[]>([]);
  
  // Filter and sort state from URL
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: searchParams.get('search') || '',
    cameraFilter: searchParams.get('camera') || 'all',
    typeFilter: (searchParams.get('type') as any) || 'all',
  });
  
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: (searchParams.get('sortBy') as any) || 'timestamp',
    direction: (searchParams.get('sortOrder') as any) || 'desc',
  });

  /**
   * Update URL with current query parameters
   */
  const updateURL = useCallback((params: Record<string, string>) => {
    const newSearchParams = new URLSearchParams(searchParams.toString());
    
    Object.entries(params).forEach(([key, value]) => {
      if (value && value !== 'all' && value !== '') {
        newSearchParams.set(key, value);
      } else {
        newSearchParams.delete(key);
      }
    });

    router.push(`?${newSearchParams.toString()}`, { scroll: false });
  }, [router, searchParams]);

  /**
   * Authentication check
   */
  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('🔐 Checking authentication...');
        
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('❌ Session error:', sessionError);
          throw sessionError;
        }
        
        if (!session) {
          console.warn('⚠️ No active session found');
          console.log('Redirecting to /signin...');
          setAuthChecked(true);
          setIsLoading(false);
          router.push('/signin');
          return;
        }
        
        console.log('✅ Session found:', session.user.email);
        
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          console.error('❌ User error:', userError);
          throw userError;
        }
        
        if (!user) {
          console.warn('⚠️ No user found despite having session');
          setAuthChecked(true);
          setIsLoading(false);
          router.push('/signin');
          return;
        }
        
        console.log('✅ User authenticated:', {
          id: user.id,
          email: user.email,
          role: user.role
        });
        
        setUser(user);
        setAuthChecked(true);
        
      } catch (error) {
        console.error('❌ Authentication error:', error);
        console.log('Redirecting to /signin due to error...');
        setAuthChecked(true);
        setIsLoading(false);
        router.push('/signin');
      }
    };

    checkAuth();
  }, [router, supabase]);

  /**
   * Fetch paginated videos from API
   */
  const fetchVideos = useCallback(async (resetToPage1 = false) => {
    if (!authChecked || !user) {
      console.log('⚠️ Skipping fetch - auth not ready or no user');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const page = resetToPage1 ? 1 : currentPage;
      
      // Build query parameters
      const params = new URLSearchParams({
        page: page.toString(),
        limit: itemsPerPage.toString(),
        sortBy: sortConfig.field,
        sortOrder: sortConfig.direction,
      });

      if (filters.searchQuery) {
        params.append('search', filters.searchQuery);
      }
      if (filters.cameraFilter !== 'all') {
        params.append('camera', filters.cameraFilter);
      }
      if (filters.typeFilter !== 'all') {
        params.append('type', filters.typeFilter);
      }

      console.log('🎥 Fetching videos:', params.toString());

      const response = await fetch(`/api/videos?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data: PaginatedVideosResponse = await response.json();
      
      console.log(`✅ Successfully loaded ${data.videos.length} videos (Page ${data.pagination.currentPage}/${data.pagination.totalPages})`);
      
      setVideos(data.videos);
      setPagination({
        totalPages: data.pagination.totalPages,
        totalItems: data.pagination.totalItems,
        hasNextPage: data.pagination.hasNextPage,
        hasPreviousPage: data.pagination.hasPreviousPage,
      });
      setStats(data.stats);
      setCameras(data.cameras);
      
      if (resetToPage1) {
        setCurrentPage(1);
      }
      
    } catch (err) {
      console.error('❌ Error fetching videos:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load videos';
      setError(errorMessage);
      setVideos([]);
    } finally {
      setIsLoading(false);
    }
  }, [authChecked, user, currentPage, itemsPerPage, filters, sortConfig]);

  /**
   * Initial load when auth is ready
   */
  useEffect(() => {
    if (authChecked && user) {
      console.log('✅ Auth ready, fetching initial videos...');
      fetchVideos();
    }
  }, [authChecked, user]); // Only depend on auth state for initial load

  /**
   * Fetch when filters, sort, or pagination changes
   */
  useEffect(() => {
    if (authChecked && user) {
      fetchVideos();
    }
  }, [currentPage, itemsPerPage, filters, sortConfig]);

  /**
   * Delete video
   */
  const deleteVideo = useCallback(async (video: VideoFile) => {
    try {
      await videoService.deleteVideo(video.path);
      
      // Refresh current page
      await fetchVideos();
      
      console.log('✅ Successfully deleted video:', video.name);
    } catch (err) {
      console.error('❌ Error deleting video:', err);
      throw err;
    }
  }, [videoService, fetchVideos]);

  /**
   * Download video
   */
  const downloadVideo = useCallback(async (video: VideoFile) => {
    try {
      await videoService.downloadVideo(video);
    } catch (err) {
      console.error('❌ Error downloading video:', err);
      throw err;
    }
  }, [videoService]);

  /**
   * Update filters and reset to page 1
   */
  const updateFilters = useCallback((newFilters: Partial<FilterState>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setCurrentPage(1); // Reset to first page when filters change
    
    // Update URL
    updateURL({
      page: '1',
      search: newFilters.searchQuery ?? filters.searchQuery,
      camera: newFilters.cameraFilter ?? filters.cameraFilter,
      type: newFilters.typeFilter ?? filters.typeFilter,
    });
  }, [filters, updateURL]);

  /**
   * Update sort configuration
   */
  const updateSort = useCallback((field: SortConfig['field']) => {
    console.log('🔄 Sort button clicked for field:', field);
    
    setSortConfig(prev => {
      const newDirection = prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc';
      const newConfig = {
        field,
        direction: newDirection,
      };
      
      console.log('📊 New sort config:', newConfig);
      
      // Update URL
      updateURL({
        sortBy: field,
        sortOrder: newDirection,
      });
      
      return newConfig;
    });
  }, [updateURL]);

  /**
   * Go to specific page
   */
  const goToPage = useCallback((page: number) => {
    const validPage = Math.max(1, Math.min(page, pagination.totalPages));
    setCurrentPage(validPage);
    updateURL({ page: validPage.toString() });
  }, [pagination.totalPages, updateURL]);

  /**
   * Update items per page
   */
  const updateItemsPerPage = useCallback((count: number) => {
    setItemsPerPage(count);
    setCurrentPage(1); // Reset to first page
    updateURL({ limit: count.toString(), page: '1' });
  }, [updateURL]);

  return {
    // Data
    videos,
    isLoading,
    error,
    user,
    authChecked,
    
    // Pagination
    currentPage,
    itemsPerPage,
    totalPages: pagination.totalPages,
    totalItems: pagination.totalItems,
    hasNextPage: pagination.hasNextPage,
    hasPreviousPage: pagination.hasPreviousPage,
    
    // Filters and sort
    filters,
    sortConfig,
    cameras,
    
    // Stats
    stats,
    
    // Actions
    fetchVideos,
    deleteVideo,
    downloadVideo,
    updateFilters,
    updateSort,
    goToPage,
    updateItemsPerPage,
  };
}