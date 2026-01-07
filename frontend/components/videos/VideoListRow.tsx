/**
 * VideoListRow Component
 * Table row for list view
 */

import React from 'react';
import { Play, Download, FolderOpen, Trash2, Loader } from 'lucide-react';
import type { VideoFile } from '@/types/video.types';
import { formatDate, getVideoTypeColor, getDefaultThumbnail, getFileExtension } from '@/utils/video.utils';

interface VideoListRowProps {
  video: VideoFile;
  onPlay: (video: VideoFile) => void;
  onDownload: (video: VideoFile) => void;
  onDelete: (video: VideoFile) => void;
  isDeleting?: boolean;
}

export const VideoListRow: React.FC<VideoListRowProps> = ({
  video,
  onPlay,
  onDownload,
  onDelete,
  isDeleting = false,
}) => {
  const handleThumbnailError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.src = getDefaultThumbnail();
  };

  return (
    <tr className="hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
      {/* Video thumbnail and name */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div className="relative">
            <img
              src={video.thumbnail}
              alt={video.name}
              className="w-16 h-9 object-cover rounded mr-3 cursor-pointer hover:opacity-75 transition-opacity"
              loading="lazy"
              onError={handleThumbnailError}
              onClick={() => onPlay(video)}
            />
            <div className={`absolute top-0 right-3 px-1 py-0.5 rounded text-xs text-white font-medium ${getVideoTypeColor(video.type)} text-center`}>
              {video.type === 'continuous' ? 'C' : 'M'}
            </div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 max-w-xs truncate" title={video.name}>
              {video.name}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 max-w-xs truncate" title={video.path}>
              Path: {video.path}
            </div>
          </div>
        </div>
      </td>
      
      {/* Camera */}
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4" />
          {video.camera}
        </div>
      </td>
      
      {/* Type */}
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`px-3 py-1 rounded-full text-xs font-medium text-white ${getVideoTypeColor(video.type)}`}>
          {video.type.charAt(0).toUpperCase() + video.type.slice(1)}
        </span>
      </td>
      
      {/* Format */}
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`px-2 py-1 rounded text-xs font-medium text-white ${
          getFileExtension(video.name) === 'WEBM' ? 'bg-green-600' : 'bg-gray-600'
        }`}>
          {getFileExtension(video.name)}
        </span>
      </td>
      
      {/* Date */}
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
        <div>{formatDate(video.timestamp)}</div>
      </td>
      
      {/* Duration */}
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 font-mono">
        {video.duration}
      </td>
      
      {/* Size */}
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 font-mono">
        {video.size}
      </td>
      
      {/* Actions */}
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onPlay(video)}
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors p-1 hover:bg-blue-100 dark:hover:bg-blue-600 hover:bg-opacity-20 rounded"
            title="Play video"
          >
            <Play className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => onDownload(video)}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors p-1 hover:bg-gray-200 dark:hover:bg-gray-600 hover:bg-opacity-20 rounded"
            title="Download video"
          >
            <Download className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => onDelete(video)}
            disabled={isDeleting}
            className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors p-1 hover:bg-red-100 dark:hover:bg-red-600 hover:bg-opacity-20 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title={isDeleting ? 'Deleting...' : 'Delete video'}
          >
            {isDeleting ? (
              <Loader className="w-5 h-5 animate-spin" />
            ) : (
              <Trash2 className="w-5 h-5" />
            )}
          </button>
        </div>
      </td>
    </tr>
  );
};