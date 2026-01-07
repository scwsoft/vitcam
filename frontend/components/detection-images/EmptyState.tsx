// components/detection-images/EmptyState.tsx

/**
 * EmptyState Component
 * 
 * Display when no detection images are found.
 * Provides contextual messages based on whether filters are active.
 */

import React from 'react';
import { Camera } from 'lucide-react';
import type { EmptyStateProps } from '@/types/detection-images.types';

export function EmptyState({ hasActiveFilters, onClearFilters }: EmptyStateProps) {
  return (
    <div className="bg-white dark:bg-[#1a2332] rounded-lg p-12 text-center">
      <Camera className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
      <h3 className="text-xl text-gray-700 dark:text-gray-300 mb-2">
        No detection images found
      </h3>
      <p className="text-gray-500 dark:text-gray-500 mb-4">
        {hasActiveFilters
          ? 'Try adjusting your filters or search query'
          : 'Detection images will appear here once objects are detected by your cameras'}
      </p>
      {hasActiveFilters && (
        <button
          onClick={onClearFilters}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
        >
          Clear Filters
        </button>
      )}
    </div>
  );
}