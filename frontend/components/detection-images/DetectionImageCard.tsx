// components/detection-images/DetectionImageCard.tsx

/**
 * DetectionImageCard Component
 * 
 * Individual card for displaying a detection image in grid view.
 * Shows image, metadata, and action buttons.
 * Supports click-to-view full image.
 */

import React from 'react';
import Image from 'next/image';
import { Camera, Calendar, Download, Trash2 } from 'lucide-react';
import type { DetectionImageCardProps } from '@/types/detection-images.types';
import {
  formatFileSize,
  formatDate,
  formatDetectionType,
  getDetectionTypeColor,
} from '@/utils/detection-images.utils';

export function DetectionImageCard({
  image,
  isSelected,
  onSelect,
  onDelete,
  onDownload,
  onImageClick,
}: DetectionImageCardProps) {
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg overflow-hidden group transition ${
        isSelected ? 'ring-2 ring-blue-500' : 'hover:ring-2 hover:ring-blue-500'
      }`}
    >
      {/* Image Container - Clickable */}
      <div 
        className="relative aspect-video bg-gray-100 dark:bg-gray-800 overflow-hidden cursor-pointer"
        onClick={onImageClick}
      >
        <Image
          src={image.thumbnail_url || image.image_url}
          alt={`${image.detection_type} detection`}
          fill
          className="bg-white dark:bg-gray-800 object-cover transition-transform group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
          }}
          unoptimized={true}
        />

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
          <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity font-medium">
            Click to view
          </span>
        </div>

        {/* Checkbox Overlay */}
        <div className="absolute top-2 left-2 z-10">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onSelect}
            className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 bg-gray-900/70 backdrop-blur-sm cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* Detection Type Badge */}
        <div className="absolute top-2 right-2">
          <span
            className={`px-2 py-1 ${getDetectionTypeColor(
              image.detection_type
            )} text-white text-xs font-semibold rounded uppercase`}
          >
            {formatDetectionType(image.detection_type)}
          </span>
        </div>

        {/* File Size */}
        <div className="absolute bottom-2 right-2">
          <span className="px-2 py-1 bg-gray-900/70 backdrop-blur-sm text-white text-xs rounded">
            {formatFileSize(image.file_size)}
          </span>
        </div>

        {/* Tracker ID Badge (if exists) */}
        {image.metadata?.tracker_id && (
          <div className="absolute bottom-2 left-2">
            <span className="px-2 py-1 bg-blue-600/80 backdrop-blur-sm text-white text-xs rounded font-medium">
              Tracker #{image.metadata.tracker_id}
            </span>
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="p-3">
        <div className="flex items-start gap-2 mb-2">
          <Camera className="w-4 h-4 text-gray-500 dark:text-gray-500 mt-0.5 flex-shrink-0" />
          <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
            {image.camera_name}
          </span>
        </div>
        <div className="flex items-start gap-2 mb-3">
          <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-500 mt-0.5 flex-shrink-0" />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {formatDate(image.timestamp)}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownload();
            }}
            className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center justify-center gap-2 text-sm"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
            title="Delete image"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}