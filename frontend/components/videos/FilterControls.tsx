/**
 * FilterControls Component - Fixed version
 * Handles sort config gracefully when not provided
 */

import React from 'react';
import type { FilterState, SortConfig } from '@/types/video.types';

interface FilterControlsProps {
  filters: FilterState;
  sortConfig?: SortConfig; // Made optional
  viewMode: 'grid' | 'list';
  itemsPerPage: number;
  cameras: string[];
  onFiltersChange: (filters: Partial<FilterState>) => void;
  onSortChange?: (field: SortConfig['field']) => void; // Made optional
  onViewModeChange: (mode: 'grid' | 'list') => void;
  onItemsPerPageChange: (count: number) => void;
}

export function FilterControls({
  filters,
  sortConfig,
  viewMode,
  itemsPerPage,
  cameras,
  onFiltersChange,
  onSortChange,
  onViewModeChange,
  onItemsPerPageChange,
}: FilterControlsProps) {
  return (
    <div className="mb-6 space-y-4">
      {/* Search Bar */}
      <div className="flex gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search videos..."
            value={filters.searchQuery}
            onChange={(e) => onFiltersChange({ searchQuery: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap gap-4 items-center">
        {/* Camera Filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Camera:
          </label>
          <select
            value={filters.cameraFilter}
            onChange={(e) => onFiltersChange({ cameraFilter: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Cameras</option>
            {cameras.map((camera) => (
              <option key={camera} value={camera}>
                {camera}
              </option>
            ))}
          </select>
        </div>

        {/* Type Filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Type:
          </label>
          <select
            value={filters.typeFilter}
            onChange={(e) => onFiltersChange({ typeFilter: e.target.value as 'all' | 'motion' | 'continuous' })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            <option value="motion">Motion</option>
            <option value="continuous">Continuous</option>
          </select>
        </div>

        {/* Sort Dropdown - Only show if sortConfig and onSortChange are provided */}
        {sortConfig && onSortChange && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Sort:
            </label>
            <select
              value={sortConfig.field}
              onChange={(e) => onSortChange(e.target.value as SortConfig['field'])}
              className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="name">Name</option>
              <option value="timestamp">Date</option>
              <option value="size">Size</option>
              <option value="duration">Duration</option>
              <option value="camera">Camera</option>
            </select>
            <button
              type="button"
              onClick={() => onSortChange(sortConfig.field)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title={`Sort ${sortConfig.direction === 'asc' ? 'ascending' : 'descending'}`}
            >
              {sortConfig.direction === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        )}

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            View:
          </label>
          <div className="flex gap-1 p-1 bg-gray-200 dark:bg-gray-700 rounded-lg">
            <button
              type="button"
              onClick={() => onViewModeChange('grid')}
              className={`px-3 py-1 rounded ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Grid
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('list')}
              className={`px-3 py-1 rounded ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              List
            </button>
          </div>
        </div>

        {/* Items Per Page */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Per page:
          </label>
          <select
            value={itemsPerPage}
            onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={12}>12</option>
            <option value={24}>24</option>
            <option value={48}>48</option>
            <option value={96}>96</option>
          </select>
        </div>

        {/* Clear Filters */}
        {(filters.searchQuery !== '' || filters.cameraFilter !== 'all' || filters.typeFilter !== 'all') && (
          <button
            type="button"
            onClick={() =>
              onFiltersChange({
                searchQuery: '',
                cameraFilter: 'all',
                typeFilter: 'all',
              })
            }
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Clear Filters
          </button>
        )}
      </div>
    </div>
  );
}