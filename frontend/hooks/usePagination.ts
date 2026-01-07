/**
 * usePagination Hook
 * Reusable pagination logic
 */

import { useState, useMemo, useCallback } from 'react';
import type { PaginationConfig } from '@/types/video.types';
import { VIDEO_CONFIG } from '@/constants/video.constants';

interface UsePaginationProps<T> {
  items: T[];
  initialItemsPerPage?: number;
}

interface UsePaginationReturn<T> {
  currentPage: number;
  itemsPerPage: number;
  totalPages: number;
  currentItems: T[];
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  setItemsPerPage: (count: number) => void;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startIndex: number;
  endIndex: number;
}

export const usePagination = <T,>({
  items,
  initialItemsPerPage = VIDEO_CONFIG.DEFAULT_ITEMS_PER_PAGE,
}: UsePaginationProps<T>): UsePaginationReturn<T> => {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(initialItemsPerPage);

  /**
   * Calculate total pages
   */
  const totalPages = useMemo(() => {
    return Math.ceil(items.length / itemsPerPage);
  }, [items.length, itemsPerPage]);

  /**
   * Get current page items
   */
  const { currentItems, startIndex, endIndex } = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    
    return {
      currentItems: items.slice(start, end),
      startIndex: start,
      endIndex: Math.min(end, items.length),
    };
  }, [items, currentPage, itemsPerPage]);

  /**
   * Navigation helpers
   */
  const hasNextPage = currentPage < totalPages;
  const hasPreviousPage = currentPage > 1;

  /**
   * Go to specific page
   */
  const goToPage = useCallback((page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages || 1));
    setCurrentPage(validPage);
  }, [totalPages]);

  /**
   * Go to next page
   */
  const nextPage = useCallback(() => {
    if (hasNextPage) {
      setCurrentPage((prev) => prev + 1);
    }
  }, [hasNextPage]);

  /**
   * Go to previous page
   */
  const previousPage = useCallback(() => {
    if (hasPreviousPage) {
      setCurrentPage((prev) => prev - 1);
    }
  }, [hasPreviousPage]);

  /**
   * Update items per page and reset to first page
   */
  const handleSetItemsPerPage = useCallback((count: number) => {
    setItemsPerPage(count);
    setCurrentPage(1);
  }, []);

  // Reset to first page when items change significantly
  useMemo(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return {
    currentPage,
    itemsPerPage,
    totalPages,
    currentItems,
    goToPage,
    nextPage,
    previousPage,
    setItemsPerPage: handleSetItemsPerPage,
    hasNextPage,
    hasPreviousPage,
    startIndex,
    endIndex,
  };
};