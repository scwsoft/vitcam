/**
 * VideoCard Component
 * Grid view card for individual videos
 */

import React from 'react';
import { Play, Download, Calendar, FolderOpen, Trash2, Loader } from 'lucide-react';
import type { VideoFile } from '@/types/video.types';
import { formatDate, getVideoTypeColor, getDefaultThumbnail, getFileExtension } from '@/utils/video.utils';

interface VideoCardProps {
  video: VideoFile;
  onPlay: (video: VideoFile) => void;
  onDownload: (video: VideoFile) => void;
  onDelete: (video: VideoFile) => void;
  isDeleting?: boolean;
}

export const VideoCard: React.FC<VideoCardProps> = ({
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
    <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300">
      {/* Thumbnail */}
      <div className="relative group cursor-pointer" onClick={() => onPlay(video)}>
        <img
          src={video.thumbnail}
          alt={video.name}
          className="w-full h-48 object-cover"
          loading="lazy"
          onError={handleThumbnailError}
        />
        
        {/* Play overlay */}
        <div className="absolute inset-0 bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-300 flex items-center justify-center">
          <Play className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>
        
        {/* Duration badge */}
        <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 px-2 py-1 rounded text-xs text-white font-medium">
          {video.duration}
        </div>
        
        {/* Type badge */}
        <div className={`absolute top-2 left-2 ${getVideoTypeColor(video.type)} px-2 py-1 rounded text-xs text-white font-medium`}>
          {video.type === 'continuous' ? 'Continuous' : 'Motion'}
        </div>
        
        {/* Size badge */}
        <div className="absolute top-2 right-2 bg-gray-900 bg-opacity-75 px-2 py-1 rounded text-xs text-white font-medium">
          {video.size}
        </div>
      </div>
      
      {/* Card content */}
      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 truncate" title={video.name}>
          {video.name}
        </h3>
        
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4" />
            <span className="truncate">{video.camera}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>{formatDate(video.timestamp)}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="font-medium">Format:</span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${
              getFileExtension(video.name) === 'WEBM' ? 'bg-green-600' : 'bg-gray-600'
            }`}>
              {getFileExtension(video.name)}
            </span>
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => onPlay(video)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors duration-200"
          >
            <Play className="w-4 h-4" />
            <span>Play</span>
          </button>
          
          <button
            onClick={() => onDownload(video)}
            className="p-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors duration-200"
            title="Download"
          >
            <Download className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => onDelete(video)}
            disabled={isDeleting}
            className="p-2 bg-red-100 dark:bg-red-900 hover:bg-red-200 dark:hover:bg-red-800 text-red-600 dark:text-red-400 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Delete"
          >
            {isDeleting ? (
              <Loader className="w-5 h-5 animate-spin" />
            ) : (
              <Trash2 className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};