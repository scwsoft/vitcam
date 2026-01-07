/**
 * VideoStats Component
 * Display video statistics and summary
 */

import React from 'react';
import type { VideoStats } from '@/types/video.types';
import { formatBytes } from '@/utils/formatters'

interface VideoStatsProps {
  stats: VideoStats;
  filteredCount: number;
  isFiltered: boolean;
}

export const VideoStats: React.FC<VideoStatsProps> = ({
  stats,
  filteredCount,
  isFiltered,
}) => {
  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      <div className="text-gray-600 dark:text-gray-400">
        {isFiltered ? (
          <>
            Showing {filteredCount} of {stats.totalVideos} videos
          </>
        ) : (
          <>
            Total: {stats.totalVideos} videos ({stats.continuousRecordings} continuous, {stats.motionEvents} motion events)
          </>
        )}
      </div>
      
      <div className="flex items-center gap-4">
        <span className="text-gray-600 dark:text-gray-400">
          Total Storage: <span className="font-medium text-gray-900 dark:text-gray-100">
            {formatBytes(stats.totalSize)}
          </span>
        </span>
        
        {isFiltered && (
          <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded text-xs font-medium">
            Filtered
          </span>
        )}
      </div>
    </div>
  );
};