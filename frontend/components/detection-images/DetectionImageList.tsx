// components/detection-images/DetectionImageList.tsx

/**
 * DetectionImageList Component
 * 
 * Table/list view for detection images.
 * Displays images in a structured table format with all metadata.
 */

import React from 'react';
import Image from 'next/image';
import { Download, Trash2 } from 'lucide-react';
import type { DetectionImageListProps } from '@/types/detection-images.types';
import {
  formatFileSize,
  formatDate,
  formatDetectionType,
  getDetectionTypeColor,
} from '@/utils/detection-images.utils';

export function DetectionImageList({
  images,
  selectedImages,
  onSelectImage,
  onSelectAll,
  onDeleteImage,
  onDownloadImage,
  onImageClick,
  allSelected,
}: DetectionImageListProps) {
  return (
    <div className="bg-white dark:bg-[#1a2332] rounded-lg overflow-hidden mb-6">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-[#0f1419] border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onSelectAll}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 bg-white dark:bg-[#1a2332]"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Preview
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Camera
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Detection
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Timestamp
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Size
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {images.map((image) => (
              <tr
                key={image.id}
                className="hover:bg-gray-50 dark:hover:bg-[#0f1419] transition"
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedImages.has(image.id)}
                    onChange={() => onSelectImage(image.id)}
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 bg-white dark:bg-[#1a2332]"
                  />
                </td>
                <td className="px-4 py-3">
                  <div 
                    className="relative w-24 h-16 rounded overflow-hidden bg-gray-100 dark:bg-gray-700 cursor-pointer hover:ring-2 hover:ring-blue-500 transition"
                    onClick={onImageClick ? () => onImageClick(image) : undefined}
                    title="Click to view full size"
                  >
                    <Image
                      src={image.thumbnail_url || image.image_url}
                      alt={`${image.detection_type} detection`}
                      fill
                      className="object-cover"
                      sizes="96px"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                      unoptimized={true}
                    />
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                  {image.camera_name}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 ${getDetectionTypeColor(
                      image.detection_type
                    )}/20 text-${getDetectionTypeColor(
                      image.detection_type
                    ).replace('bg-', '')} text-xs font-medium rounded uppercase`}
                  >
                    {formatDetectionType(image.detection_type)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                  {formatDate(image.timestamp)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                  {formatFileSize(image.file_size)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onDownloadImage(image)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-[#0f1419] text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded transition"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDeleteImage(image.id)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-[#0f1419] text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded transition"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}