/**
 * Enhanced Skeleton Loaders
 * Optimized loading states for video management
 */

import React from 'react';

/**
 * Skeleton Grid Card - Used in grid view loading state
 */
export const SkeletonGridCard: React.FC = () => {
  return (
    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden shadow animate-pulse">
      {/* Thumbnail skeleton */}
      <div className="aspect-video bg-gray-300 dark:bg-gray-600" />
      
      {/* Info skeleton */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4" />
        
        {/* Metadata lines */}
        <div className="space-y-2">
          <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2" />
          <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-2/3" />
          <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/3" />
        </div>
        
        {/* Action buttons */}
        <div className="flex gap-2 pt-2">
          <div className="h-9 bg-gray-300 dark:bg-gray-600 rounded flex-1" />
          <div className="h-9 w-9 bg-gray-300 dark:bg-gray-600 rounded" />
        </div>
      </div>
    </div>
  );
};

/**
 * Skeleton List Row - Used in list view loading state
 */
export const SkeletonListRow: React.FC = () => {
  return (
    <tr className="animate-pulse">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div className="w-16 h-9 bg-gray-300 dark:bg-gray-600 rounded mr-3" />
          <div className="space-y-2">
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-48" />
            <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-32" />
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-20" />
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-24" />
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-32" />
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-16" />
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-16" />
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex gap-3">
          <div className="h-6 w-6 bg-gray-300 dark:bg-gray-600 rounded" />
          <div className="h-6 w-6 bg-gray-300 dark:bg-gray-600 rounded" />
          <div className="h-6 w-6 bg-gray-300 dark:bg-gray-600 rounded" />
        </div>
      </td>
    </tr>
  );
};

/**
 * Skeleton Header - Used in header loading state
 */
export const SkeletonHeader: React.FC = () => {
  return (
    <div className="animate-pulse">
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-3">
          <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-64" />
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-96" />
        </div>
        <div className="h-10 w-32 bg-gray-300 dark:bg-gray-600 rounded" />
      </div>
      
      {/* Stats skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-24 mb-2" />
            <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-16" />
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Skeleton Filter Bar - Used for filter controls loading
 */
export const SkeletonFilterBar: React.FC = () => {
  return (
    <div className="mb-6 space-y-4 animate-pulse">
      {/* Search bar */}
      <div className="h-10 bg-gray-300 dark:bg-gray-600 rounded-lg" />
      
      {/* Filter controls */}
      <div className="flex flex-wrap gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-10 bg-gray-300 dark:bg-gray-600 rounded w-32" />
        ))}
      </div>
    </div>
  );
};

/**
 * Full Page Skeleton - Complete page loading state
 */
export const FullPageSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SkeletonHeader />
        
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <SkeletonFilterBar />
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <SkeletonGridCard key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Inline Loading Spinner
 */
export const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ 
  size = 'md' 
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div className="flex items-center justify-center">
      <div className={`${sizeClasses[size]} border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin`} />
    </div>
  );
};

/**
 * Loading Overlay - For full page loading with message
 */
export const LoadingOverlay: React.FC<{ message?: string }> = ({ 
  message = 'Loading...' 
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-8 shadow-2xl">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-gray-700 dark:text-gray-300 text-center">
          {message}
        </p>
      </div>
    </div>
  );
};