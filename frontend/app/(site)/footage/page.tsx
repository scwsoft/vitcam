/**
 * COMPLETELY FIXED VideoManagementPage Component with Working List View
 * - Fixed search/filter layout
 * - Proper thumbnail display using video element
 * - Better duration handling
 * - WORKING LIST VIEW with table layout
 * - Matches original design exactly
 */

'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { ViewMode, VideoFile } from '@/types/video.types';
import { useVideos } from '@/hooks/useVideos';
import { FilterControls } from '@/components/videos/FilterControls';
import { SortControls } from '@/components/videos/SortControls';
import { VideoStats } from '@/components/videos/VideoStats';
import { Pagination } from '@/components/ui/Pagination';
import { DeleteConfirmationModal } from '@/components/ui/DeleteConfirmationModal';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonGridCard, SkeletonListRow } from '@/components/ui/Skeletons';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '@/constants/video.constants';
import VideoPlayer from '@/components/PreviewPlayer';
import { Loader } from 'lucide-react';
import PreviewPlayer from '@/components/PreviewPlayer';

interface VideoManagementPageProps {
  theme?: 'dark' | 'light';
  className?: string;
}

const VideoManagementPage: React.FC<VideoManagementPageProps> = ({
  theme = 'dark',
  className = '',
}) => {
  const router = useRouter();
  
  // Use optimized hook
  const {
    videos,
    isLoading,
    error,
    filters,
    sortConfig,
    stats,
    user,
    authChecked,
    cameras,
    currentPage,
    itemsPerPage,
    totalPages,
    totalItems,
    hasNextPage,
    hasPreviousPage,
    fetchVideos,
    deleteVideo,
    downloadVideo,
    updateFilters,
    updateSort,
    goToPage,
    updateItemsPerPage,
  } = useVideos();

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedVideo, setSelectedVideo] = useState<VideoFile | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    video: VideoFile | null;
  }>({
    isOpen: false,
    video: null,
  });
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);

  /**
   * Handle video selection
   */
  const handleVideoSelect = useCallback((video: VideoFile) => {
    console.log('🎬 Playing video:', video.name);
    setSelectedVideo(video);
  }, []);

  /**
   * Handle video player close
   */
  const handleClosePlayer = useCallback(() => {
    setSelectedVideo(null);
  }, []);

  /**
   * Handle video download
   */
  const handleDownload = useCallback(async (video: VideoFile) => {
    try {
      await downloadVideo(video);
    } catch (err) {
      console.error('Download failed:', err);
      alert(`Download failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [downloadVideo]);

  /**
   * Show delete confirmation
   */
  const showDeleteConfirmation = useCallback((video: VideoFile) => {
    setDeleteConfirmation({
      isOpen: true,
      video,
    });
  }, []);

  /**
   * Cancel delete
   */
  const cancelDelete = useCallback(() => {
    if (!deletingVideoId) {
      setDeleteConfirmation({
        isOpen: false,
        video: null,
      });
    }
  }, [deletingVideoId]);

  /**
   * Confirm delete
   */
  const confirmDelete = useCallback(async () => {
    const { video } = deleteConfirmation;
    if (!video) return;

    setDeletingVideoId(video.id);

    try {
      await deleteVideo(video);
      setDeleteConfirmation({ isOpen: false, video: null });
      fetchVideos();
    } catch (err) {
      console.error('Delete failed:', err);
      alert(`Delete failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setDeletingVideoId(null);
    }
  }, [deleteConfirmation, deleteVideo, fetchVideos]);

  /**
   * Format date
   */
  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  /**
   * Get video type color
   */
  const getVideoTypeColor = (type: 'continuous' | 'motion') => {
    return type === 'continuous' ? 'bg-blue-500' : 'bg-orange-500';
  };

  /**
   * Clear filters
   */
  const clearFilters = useCallback(() => {
    updateFilters({
      searchQuery: '',
      cameraFilter: 'all',
      typeFilter: 'all',
    });
  }, [updateFilters]);

  // Check if filters active
  const isFiltered = filters.searchQuery !== '' || 
                     filters.cameraFilter !== 'all' || 
                     filters.typeFilter !== 'all';

  // Calculate indices
  const startIndex = (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, totalItems);

  // Video Player Modal
  if (selectedVideo) {
    const currentIndex = videos.findIndex((v) => v.id === selectedVideo.id);
    const hasPrev = currentIndex > 0;
    const hasNext = currentIndex < videos.length - 1;

    const handlePrevious = () => {
      if (hasPrev) {
        setSelectedVideo(videos[currentIndex - 1]);
      }
    };

    const handleNext = () => {
      if (hasNext) {
        setSelectedVideo(videos[currentIndex + 1]);
      }
    };

    return (
      <div className="fixed inset-0  bg-gray-50 dark:bg-gray-900 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-[#1a2332] rounded-lg max-w-6xl w-full max-h-[95vh] overflow-hidden shadow-2xl">
          <div className="p-4 border-2 border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {selectedVideo.name}
              </h3>
              <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-4 mt-1">
                <span>{selectedVideo.camera}</span>
                <span>{selectedVideo.duration}</span>
                <span className={`px-2 py-1 rounded text-xs text-white ${getVideoTypeColor(selectedVideo.type)}`}>
                  {selectedVideo.type.toUpperCase()}
                </span>
                <span>{formatDate(selectedVideo.timestamp)}</span>
              </div>
            </div>
            <button
              onClick={handleClosePlayer}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="p-4 border-2 bg-gray-100 dark:bg-gray-900">
            <PreviewPlayer
              camera={selectedVideo.camera}
              filename={selectedVideo.name}
              publicUrl={selectedVideo.publicUrl}
              autoPlay={true}
              theme={theme}
              className="w-full"
              mimeType={selectedVideo.mimeType}
            />
            
            <div className="mt-4 flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => handleDownload(selectedVideo)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </button>
                
                {/* <button
                  onClick={() => showDeleteConfirmation(selectedVideo)}
                  disabled={deletingVideoId === selectedVideo.id}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {deletingVideoId === selectedVideo.id ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                  {deletingVideoId === selectedVideo.id ? 'Deleting...' : 'Delete'}
                </button> */}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handlePrevious}
                  disabled={!hasPrev}
                  className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                
                <button
                  onClick={handleNext}
                  disabled={!hasNext}
                  className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Auth check
  if (!authChecked) {
    return (
      <div className="min-h-screen  dark:bg-gray-900 flex items-center justify-center">
        <Loader className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className={`min-h-screen dark:bg-gray-900] ${className}`}>
      <div className="container mx-auto px-4 py-6 bg-white dark:bg-[#1a2332]">
        {/* Header with Title and Refresh */}
        <div className="mb-6 flex items-center gap-4">
          <h1 className="text-2xl font-bold  text-gray-900 dark:text-gray-100">Video Management</h1>
          <button
            onClick={fetchVideos}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 text-white rounded-lg transition-colors inline-flex items-center gap-2"
          >
            <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Search Bar - Full Width */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search videos..."
            value={filters.searchQuery}
            onChange={(e) => updateFilters({ searchQuery: e.target.value })}
            className="w-full px-4 py-3 bg-white dark:bg-[#1a2332] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filters Row */}
        <div className="mb-4 flex flex-wrap gap-3 items-center">
          {/* Camera Filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">Camera:</label>
            <select
              value={filters.cameraFilter}
              onChange={(e) => updateFilters({ cameraFilter: e.target.value })}
              className="px-3 py-2 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100  border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Cameras</option>
              {cameras.map((camera) => (
                <option key={camera} value={camera}>{camera}</option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">Type:</label>
            <select
              value={filters.typeFilter}
              onChange={(e) => updateFilters({ typeFilter: e.target.value as any })}
              className="px-3 py-2 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="motion">Motion</option>
              <option value="continuous">Continuous</option>
            </select>
          </div>

          {/* View Mode */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">View:</label>
            <div className="flex gap-1 p-1 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1 rounded text-sm ${
                  viewMode === 'grid'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 rounded text-sm ${
                  viewMode === 'list'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                List
              </button>
            </div>
          </div>

          {/* Per Page */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">Per page:</label>
            <select
              value={itemsPerPage}
              onChange={(e) => updateItemsPerPage(Number(e.target.value))}
              className="px-3 py-2 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100  border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={12}>12</option>
              <option value={24}>24</option>
              <option value={48}>48</option>
              <option value={96}>96</option>
            </select>
          </div>

          {/* Clear Filters */}
          {isFiltered && (
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Sort Controls */}
        <SortControls
          sortConfig={sortConfig}
          onSortChange={updateSort}
          className="mb-4"
        />

        {/* Stats Bar */}
        <div className="mb-4 flex items-center justify-between text-sm">
          <div className="text-gray-400">
            Showing {startIndex} - {endIndex} of {totalItems} videos
          </div>
          <div className="flex gap-4 text-gray-400">
            <span>Total Storage: <span className="text-white font-medium">{formatBytes(stats.totalSize)}</span></span>
            {isFiltered && <span className="text-blue-400">Filtered</span>}
          </div>
        </div>

        {/* Error State */}
        {error && (
          <ErrorState message={error} onRetry={fetchVideos} />
        )}

        {/* Loading State */}
        {isLoading && (
          <>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {Array.from({ length: itemsPerPage }).map((_, i) => (
                  <SkeletonGridCard key={i} />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {Array.from({ length: itemsPerPage }).map((_, i) => (
                  <SkeletonListRow key={i} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Empty State */}
        {!isLoading && !error && videos.length === 0 && (
          <EmptyState
            isFiltered={isFiltered}
            onClearFilters={isFiltered ? clearFilters : undefined}
          />
        )}

        {/* Video Content - Grid or List View */}
        {!isLoading && !error && videos.length > 0 && (
          <>
            {viewMode === 'grid' ? (
              // GRID VIEW
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-6">
                {videos.map((video) => (
                  <div
                    key={video.id}
                    className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100  rounded-lg overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 group"
                  >
                    {/* Thumbnail with Video Element */}
                    <div className="relative aspect-video bg-gray-700">
                      <video
                        className="w-full h-full object-cover"
                        preload="metadata"
                        muted
                        playsInline
                        onLoadedMetadata={(e) => {
                          const videoEl = e.currentTarget;
                          videoEl.currentTime = 0.1;
                        }}
                      >
                        <source src={video.publicUrl} type={video.mimeType || 'video/webm'} />
                      </video>
                      
                      {/* Type Badge */}
                      <div className={`absolute top-2 left-2 px-2 py-1 rounded text-xs text-white font-medium ${getVideoTypeColor(video.type)}`}>
                        {video.type.toUpperCase()}
                      </div>

                      {/* Size Badge */}
                      <div className="absolute top-2 right-2 bg-black bg-opacity-75 px-2 py-1 rounded text-xs text-white">
                        {video.size}
                      </div>

                      {/* Duration Badge */}
                      <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 px-2 py-1 rounded text-xs text-white">
                        {video.duration}
                      </div>

                      {/* Play Overlay */}
                      <button
                        onClick={() => handleVideoSelect(video)}
                        className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-300 opacity-0 group-hover:opacity-100"
                      >
                        <div className="w-16 h-16 bg-white bg-opacity-90 rounded-full flex items-center justify-center transform scale-90 group-hover:scale-100 transition-transform">
                          <svg className="w-8 h-8 text-blue-600 ml-1" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                        </div>
                      </button>
                    </div>

                    {/* Info Section */}
                    <div className="p-4">
                      <h3 className="text-sm text-gray-700 dark:text-gray-300 truncate mb-2" title={video.name}>
                        {video.name}
                      </h3>
                      
                      <div className="space-y-1 mb-4 text-sm text-gray-700 dark:text-gray-300 truncate">
                        <div className="flex items-center gap-2">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          {video.camera}
                        </div>
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {formatDate(video.timestamp)}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleVideoSelect(video)}
                          className="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                          Play
                        </button>
                        <button
                          onClick={() => handleDownload(video)}
                          className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                          title="Download"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
                        <button
                          onClick={() => showDeleteConfirmation(video)}
                          disabled={deletingVideoId === video.id}
                          className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          {deletingVideoId === video.id ? (
                            <Loader className="w-4 h-4 animate-spin" />
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // LIST VIEW
              <div className="mb-6 bg-white dark:bg-[#1a2332] rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-[#0f1419] border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                          Preview
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                          Camera
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                          Duration
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                          Size
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {videos.map((video) => (
                        <tr
                          key={video.id}
                          className="hover:bg-gray-50 dark:hover:bg-[#0f1419] transition"
                        >
                          {/* Preview Thumbnail */}
                          <td className="px-4 py-3">
                            <div className="relative w-24 h-14 bg-gray-700 rounded overflow-hidden group cursor-pointer">
                              <video
                                className="w-full h-full object-cover"
                                preload="metadata"
                                muted
                                playsInline
                                onLoadedMetadata={(e) => {
                                  const videoEl = e.currentTarget;
                                  videoEl.currentTime = 0.1;
                                }}
                              >
                                <source src={video.publicUrl} type={video.mimeType || 'video/webm'} />
                              </video>
                              <button
                                onClick={() => handleVideoSelect(video)}
                                className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-300 opacity-0 group-hover:opacity-100"
                              >
                                <div className="w-8 h-8 bg-white bg-opacity-90 rounded-full flex items-center justify-center">
                                  <svg className="w-4 h-4 text-blue-600 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z"/>
                                  </svg>
                                </div>
                              </button>
                            </div>
                          </td>

                          {/* Name */}
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-700 dark:text-gray-300 font-medium max-w-xs truncate" title={video.name}>
                              {video.name}
                            </div>
                          </td>

                          {/* Camera */}
                          <td className="px-4 py-3 ">
                            <div className="text-sm text-gray-700 dark:text-gray-300">{video.camera}</div>
                          </td>

                          {/* Type */}
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs text-white dark:text-gray-300 font-medium ${getVideoTypeColor(video.type)}`}>
                              {video.type.toUpperCase()}
                            </span>
                          </td>

                          {/* Duration */}
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-700 dark:text-gray-300">{video.duration}</div>
                          </td>

                          {/* Size */}
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-700 dark:text-gray-300">{video.size}</div>
                          </td>

                          {/* Date */}
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-700 dark:text-gray-300">{formatDate(video.timestamp)}</div>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleVideoSelect(video)}
                                className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                                title="Play"
                              >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M8 5v14l11-7z"/>
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDownload(video)}
                                className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                                title="Download"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                              </button>
                              <button
                                onClick={() => showDeleteConfirmation(video)}
                                disabled={deletingVideoId === video.id}
                                className="p-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors disabled:opacity-50"
                                title="Delete"
                              >
                                {deletingVideoId === video.id ? (
                                  <Loader className="w-4 h-4 animate-spin" />
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Pagination */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              startIndex={startIndex}
              endIndex={endIndex}
              totalItems={totalItems}
              onPageChange={goToPage}
            />
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        video={deleteConfirmation.video}
        isDeleting={deletingVideoId !== null}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
};

/**
 * Format bytes helper
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default VideoManagementPage;