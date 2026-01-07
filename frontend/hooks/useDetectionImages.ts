// hooks/useDetectionImages.ts - UPDATED WITH DYNAMIC DETECTION TYPES

/**
 * useDetectionImages Hook
 * 
 * Custom hook for managing detection images state and operations.
 * NOW: Fetches detection types dynamically from storage filenames.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  UseDetectionImagesOptions,
  UseDetectionImagesReturn,
  DetectionImage,
  Camera,
} from '@/types/detection-images.types';
import * as DetectionImagesService from '@/services/detection-images.service';

export function useDetectionImages(
  options: UseDetectionImagesOptions
): UseDetectionImagesReturn {
  const { filters, searchQuery, sortConfig, currentPage, itemsPerPage } = options;

  // State
  const [images, setImages] = useState<DetectionImage[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [detectionTypes, setDetectionTypes] = useState<string[]>(['all']); // NEW
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  // Use ref to track if we've fetched cameras and types
  const camerasFetched = useRef(false);
  const detectionTypesFetched = useRef(false);

  /**
   * Fetch available cameras (only once)
   */
  const fetchCameras = useCallback(async () => {
    if (camerasFetched.current) return;
    
    try {
      camerasFetched.current = true;
      const cameraList = await DetectionImagesService.fetchCameras();
      setCameras(cameraList);
    } catch (err) {
      console.error('Error fetching cameras:', err);
      camerasFetched.current = false;
    }
  }, []);

  /**
   * NEW: Fetch available detection types dynamically (only once)
   */
  const fetchDetectionTypes = useCallback(async () => {
    if (detectionTypesFetched.current) return;
    
    try {
      detectionTypesFetched.current = true;
      const types = await DetectionImagesService.fetchAvailableDetectionTypes();
      setDetectionTypes(types);
      console.log('Loaded detection types:', types);
    } catch (err) {
      console.error('Error fetching detection types:', err);
      detectionTypesFetched.current = false;
      // Fallback to basic types
      setDetectionTypes(['all', 'person', 'car', 'bicycle']);
    }
  }, []);

  /**
   * Fetch detection images with current filters and pagination
   */
  const fetchImages = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const sortColumn = getSortColumn(sortConfig.sortBy);

      const response = await DetectionImagesService.fetchDetectionImages({
        cameraId: filters.camera,
        detectionType: filters.detectionType,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        minConfidence: filters.minConfidence || 0,
        searchQuery,
        sortBy: sortColumn,
        sortOrder: sortConfig.sortOrder,
        page: currentPage,
        limit: itemsPerPage,
      });

      setImages(response.data);
      setTotalCount(response.count);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch detection images';
      setError(errorMessage);
      console.error('Error in useDetectionImages:', err);
    } finally {
      setLoading(false);
    }
  }, [
    JSON.stringify(filters),
    searchQuery,
    JSON.stringify(sortConfig),
    currentPage,
    itemsPerPage,
  ]);

  /**
   * Delete a single image
   */
  const deleteImage = useCallback(
    async (id: string) => {
      const image = images.find((img) => img.id === id);
      if (!image) {
        throw new Error('Image not found');
      }

      await DetectionImagesService.deleteDetectionImage(id, image);
      await fetchImages();
    },
    [images, fetchImages]
  );

  /**
   * Delete multiple images (bulk operation)
   */
  const deleteImages = useCallback(
    async (ids: string[]) => {
      const imagesToDelete = images.filter((img) => ids.includes(img.id));

      await DetectionImagesService.bulkDeleteDetectionImages({
        imageIds: ids,
        images: imagesToDelete,
      });

      await fetchImages();
    },
    [images, fetchImages]
  );

  /**
   * Download an image
   */
  const downloadImage = useCallback(async (image: DetectionImage) => {
    await DetectionImagesService.downloadImageFromUrl(image);
  }, []);

  /**
   * Manual refetch trigger
   */
  const refetch = useCallback(async () => {
    await fetchImages();
  }, [fetchImages]);

  // Fetch cameras on mount (only once)
  useEffect(() => {
    fetchCameras();
  }, []);

  // NEW: Fetch detection types on mount (only once)
  useEffect(() => {
    fetchDetectionTypes();
  }, []);

  // Fetch images when dependencies change
  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  // Calculate derived values
  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const totalStorage = DetectionImagesService.calculateTotalStorage(images);

  return {
    images,
    cameras,
    detectionTypes, // NEW: Return dynamic detection types
    loading,
    error,
    totalCount,
    totalPages,
    totalStorage,
    refetch,
    deleteImage,
    deleteImages,
    downloadImage,
  };
}

/**
 * Map sort by value to database column name
 */
function getSortColumn(sortBy: string): string {
  switch (sortBy) {
    case 'date':
      return 'timestamp';
    case 'camera':
      return 'camera_name';
    case 'confidence':
      return 'confidence';
    case 'size':
      return 'file_size';
    default:
      return 'timestamp';
  }
}