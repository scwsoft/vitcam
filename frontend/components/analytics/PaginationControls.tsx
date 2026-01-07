/**
 * PaginationControls Component
 * Reusable pagination controls for tables and lists with 10-page navigation
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PaginationInfo } from '@/types/analytics.types';

interface PaginationControlsProps {
  pagination: PaginationInfo | null;
  onNext: () => void;
  onPrev: () => void;
  onPageChange?: (page: number) => void;
  loading?: boolean;
}

/**
 * Calculate which page numbers to display (always 10 pages when possible)
 */
const getPageNumbers = (currentPage: number, totalPages: number): number[] => {
  const maxPages = 10;
  
  // If total pages <= 10, show all pages
  if (totalPages <= maxPages) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  // Calculate start and end positions
  let startPage = Math.max(1, currentPage - Math.floor(maxPages / 2));
  let endPage = startPage + maxPages - 1;

  // Adjust if we're near the end
  if (endPage > totalPages) {
    endPage = totalPages;
    startPage = Math.max(1, endPage - maxPages + 1);
  }

  // Generate array of page numbers
  return Array.from(
    { length: endPage - startPage + 1 },
    (_, i) => startPage + i
  );
};

export const PaginationControls = ({
  pagination,
  onNext,
  onPrev,
  onPageChange,
  loading,
}: PaginationControlsProps) => {
  if (!pagination || pagination.total_items === 0) return null;

  const pageNumbers = getPageNumbers(pagination.page, pagination.total_pages);
  const showEllipsisStart = pageNumbers[0] > 1;
  const showEllipsisEnd = pageNumbers[pageNumbers.length - 1] < pagination.total_pages;

  const handlePageClick = (page: number) => {
    if (onPageChange) {
      onPageChange(page);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t dark:border-slate-700">
      {/* Info Text */}
      <div className="text-sm opacity-70">
        Page {pagination.page} of {pagination.total_pages}
        <span className="ml-2">({pagination.total_items.toLocaleString()} total)</span>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center space-x-1">
        {/* Previous Button */}
        <button
          onClick={onPrev}
          disabled={!pagination.has_previous || pagination.page === 1 || loading}
          className="p-2 rounded-lg border dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* First Page + Ellipsis */}
        {showEllipsisStart && onPageChange && (
          <>
            <button
              onClick={() => handlePageClick(1)}
              disabled={loading}
              className="px-3 py-1 rounded-lg border dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-all text-sm font-medium"
            >
              1
            </button>
            <span className="px-2 opacity-50">...</span>
          </>
        )}

        {/* Page Numbers */}
        {onPageChange ? (
          pageNumbers.map((pageNum) => (
            <button
              key={pageNum}
              onClick={() => handlePageClick(pageNum)}
              disabled={loading || pageNum === pagination.page}
              className={`
                px-3 py-1 rounded-lg border dark:border-slate-700 
                text-sm font-medium transition-all
                ${
                  pageNum === pagination.page
                    ? 'bg-violet-500 text-white border-violet-500 cursor-default'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30'
                }
              `}
              aria-label={`Page ${pageNum}`}
              aria-current={pageNum === pagination.page ? 'page' : undefined}
            >
              {pageNum}
            </button>
          ))
        ) : (
          // Fallback: show current page only if onPageChange is not provided
          <span className="px-3 py-1 rounded-lg border dark:border-slate-700 bg-violet-500 text-white border-violet-500 text-sm font-medium">
            {pagination.page}
          </span>
        )}

        {/* Last Page + Ellipsis */}
        {showEllipsisEnd && onPageChange && (
          <>
            <span className="px-2 opacity-50">...</span>
            <button
              onClick={() => handlePageClick(pagination.total_pages)}
              disabled={loading}
              className="px-3 py-1 rounded-lg border dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-all text-sm font-medium"
            >
              {pagination.total_pages}
            </button>
          </>
        )}

        {/* Next Button */}
        <button
          onClick={onNext}
          disabled={!pagination.has_next || loading}
          className="p-2 rounded-lg border dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          aria-label="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};