// components/detection-images/DetectionImageGrid.tsx

/**
 * DetectionImageGrid Component
 * 
 * Grid view for detection images.
 * Displays images in a responsive card grid layout.
 */

import React from 'react';
import { DetectionImageCard } from './DetectionImageCard';
import type { DetectionImageGridProps } from '@/types/detection-images.types';

export function DetectionImageGrid({
  images,
  selectedImages,
  onSelectImage,
  onDeleteImage,
  onDownloadImage,
  onImageClick,
}: DetectionImageGridProps) {
  return (
    <div className="bg-white dark:bg-gray-800 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
      {images.map((image) => (
        <DetectionImageCard
          key={image.id}
          image={image}
          isSelected={selectedImages.has(image.id)}
          onSelect={() => onSelectImage(image.id)}
          onDelete={() => onDeleteImage(image.id)}
          onDownload={() => onDownloadImage(image)}
          onImageClick={onImageClick ? () => onImageClick(image) : undefined}
        />
      ))}
    </div>
  );
}