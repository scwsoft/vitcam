// components/detection-images/ImageModal.tsx

/**
 * ImageModal Component
 * 
 * Full-screen modal for viewing detection images.
 * Similar to video modal with download/delete actions.
 */

import React, { useEffect } from 'react';
import Image from 'next/image';
import { X, Download, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { DetectionImage } from '@/types/detection-images.types';
import {
  formatDate,
  formatFileSize,
  formatDetectionType,
  getDetectionTypeColor,
} from '@/utils/detection-images.utils';

interface ImageModalProps {
  image: DetectionImage;
  isOpen: boolean;
  onClose: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

export function ImageModal({
  image,
  isOpen,
  onClose,
  onDownload,
  onDelete,
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false,
}: ImageModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Navigation with arrow keys
  useEffect(() => {
    const handleArrows = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && hasPrevious && onPrevious) {
        onPrevious();
      } else if (e.key === 'ArrowRight' && hasNext && onNext) {
        onNext();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleArrows);
    }

    return () => {
      document.removeEventListener('keydown', handleArrows);
    };
  }, [isOpen, hasPrevious, hasNext, onPrevious, onNext]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-gray-900 backdrop-blur-sm">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-lg bg-gray-800/80 hover:bg-gray-700 text-white  transition z-10"
        title="Close (Esc)"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Previous button */}
      {hasPrevious && onPrevious && (
        <button
          onClick={onPrevious}
          className="bg-gray-300 dark:bg-gray-800 absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-lg bg-gray-400 hover:bg-gray-500 text-white transition z-10"
          title="Previous (←)"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* Next button */}
      {hasNext && onNext && (
        <button
          onClick={onNext}
          className="bg-gray-400 dark:bg-gray-800 absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-lg bg-gray-400 hover:bg-gray-500 text-white transition z-10"
          title="Next (→)"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Modal content */}
      <div className="bg-gray-300 dark:bg-gray-900 w-full h-full max-w-7xl max-h-[90vh] mx-4 flex flex-col">
        {/* Header */}
        <div className="bg-gray-300 dark:bg-gray-800 rounded-t-lg p-4 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-xl font-semibold text-white truncate">
                {image.camera_name}
              </h2>
              <span
                className={`px-3 py-1 ${getDetectionTypeColor(
                  image.detection_type
                )} text-white text-sm font-semibold rounded-full uppercase`}
              >
                {formatDetectionType(image.detection_type)}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-black dark:text-gray-400">
              <span>{formatDate(image.timestamp)}</span>
              {image.metadata?.tracker_id && (
                <>
                  <span>•</span>
                  <span>Tracker #{image.metadata.tracker_id}</span>
                </>
              )}
              <span>•</span>
              <span>{formatFileSize(image.file_size)}</span>
            </div>
          </div>
        </div>

        {/* Image container */}
        <div className="flex-1 bg-want rounded-b-lg overflow-hidden relative flex items-center justify-center">
          <div className="bg-gray-300 dark:bg-gray-800 relative w-full h-full">
            <Image
              src={image.image_url}
              alt={`${image.detection_type} detection`}
              fill
              className="object-fill"
              sizes="(max-width: 1920px) 100vw, 1920px"
              priority
              unoptimized={true}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="bg-gray-300 dark:bg-gray-800 p-4 flex items-center justify-center gap-3">
          <button
            onClick={onDownload}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center gap-2 font-medium"
          >
            <Download className="w-5 h-5" />
            Download
          </button>
          <button
            onClick={onDelete}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition flex items-center gap-2 font-medium"
          >
            <Trash2 className="w-5 h-5" />
            Delete
          </button>
        </div>
      </div>

      {/* Click outside to close */}
      <div
        className="absolute inset-0 -z-10"
        onClick={onClose}
      />
    </div>
  );
}