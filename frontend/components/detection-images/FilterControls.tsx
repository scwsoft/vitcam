// components/detection-images/FilterControls.tsx - UPDATED FOR DYNAMIC TYPES

/**
 * FilterControls Component
 * 
 * Comprehensive filtering, sorting, and view controls for detection images.
 * NOW: Uses dynamic detection types from storage instead of constants.
 */

import React from 'react';
import { Search, Grid3x3, List, Filter, X, Trash2 } from 'lucide-react';
import type { FilterControlsProps } from '@/types/detection-images.types';
import { ITEMS_PER_PAGE_OPTIONS } from '@/constants/detection-images.constants';
import { formatFileSize, formatDetectionType } from '@/utils/detection-images.utils';

// Sort options without confidence
const SORT_OPTIONS = [
  { value: 'date', label: 'Date' },
  { value: 'camera', label: 'Camera' },
  { value: 'size', label: 'Size' },
];

export function FilterControls({
  cameras,
  detectionTypes, // NEW: Dynamic detection types from hook
  filters,
  searchQuery,
  sortConfig,
  viewMode,
  itemsPerPage,
  showFilters,
  hasActiveFilters,
  selectedCount,
  totalCount,
  totalStorage,
  onFilterChange,
  onSearchChange,
  onSortChange,
  onViewModeChange,
  onItemsPerPageChange,
  onToggleFilters,
  onClearFilters,
  onDeleteSelected,
  onSelectAll,
  allSelected,
}: FilterControlsProps) {
  return (
    <div className="space-y-4">
      {/* Main Controls Bar */}
      <div className="bg-white dark:bg-[#1a2332] rounded-lg p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search Bar */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-800" />
            <input
              type="text"
              placeholder="Search images..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
            />
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => onViewModeChange('grid')}
              className={`px-4 py-2 rounded-md transition flex items-center gap-2 ${
                viewMode === 'grid'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Grid3x3 className="w-4 h-4" />
              Grid
            </button>
            <button
              onClick={() => onViewModeChange('list')}
              className={`px-4 py-2 rounded-md transition flex items-center gap-2 ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <List className="w-4 h-4" />
              List
            </button>
          </div>

          {/* Per Page Selector */}
          <div className="flex items-center gap-2">
            <span className="text-gray-600 dark:text-gray-400 text-sm whitespace-nowrap">
              Per page:
            </span>
            <select
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
              className="bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer"
            >
              {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          {/* Filters Toggle */}
          <button
            onClick={onToggleFilters}
            className={`px-4 py-2.5 rounded-lg border transition flex items-center gap-2 ${
              showFilters || hasActiveFilters
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <span className="bg-white text-blue-600 text-xs font-semibold px-2 py-0.5 rounded-full">
                !
              </span>
            )}
          </button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Camera Filter */}
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Camera
                </label>
                <select
                  value={filters.camera}
                  onChange={(e) => onFilterChange({ camera: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                >
                  <option value="all">All Cameras</option>
                  {cameras.map((camera) => (
                    <option key={camera.id} value={camera.id}>
                      {camera.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Detection Type Filter - NOW DYNAMIC */}
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Detection Type
                </label>
                <select
                  value={filters.detectionType}
                  onChange={(e) => onFilterChange({ detectionType: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                >
                  {detectionTypes.map((type) => (
                    <option key={type} value={type}>
                      {formatDetectionType(type)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date From */}
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Date From
                </label>
                <input
                  type="datetime-local"
                  value={filters.dateFrom}
                  onChange={(e) => onFilterChange({ dateFrom: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Date To
                </label>
                <input
                  type="datetime-local"
                  value={filters.dateTo}
                  onChange={(e) => onFilterChange({ dateTo: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={onClearFilters}
                className="mt-4 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Clear All Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Sort and Actions Bar */}
      <div className="bg-white dark:bg-[#1a2332] rounded-lg px-4 py-3 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <span className="text-gray-600 dark:text-gray-400 text-sm">Sort by:</span>
          <div className="flex gap-2">
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => onSortChange(option.value as any)}
                className={`px-3 py-1.5 rounded-md text-sm transition ${
                  sortConfig.sortBy === option.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                {option.label}
                {sortConfig.sortBy === option.value && (
                  <span className="ml-1">{sortConfig.sortOrder === 'asc' ? '↑' : '↓'}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {selectedCount > 0 && (
            <button
              onClick={onDeleteSelected}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete ({selectedCount})
            </button>
          )}
          <span className="text-gray-600 dark:text-gray-400 text-sm">
            Total: {totalCount} images ({formatFileSize(totalStorage)})
          </span>
        </div>
      </div>

      {/* Selection Bar */}
      {totalCount > 0 && (
        <div className="bg-white dark:bg-[#1a2332] rounded-lg px-4 py-2 flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={onSelectAll}
              className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 bg-gray-50 dark:bg-[#0f1419]"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {allSelected ? 'Deselect All' : 'Select All'}
            </span>
          </label>
          {selectedCount > 0 && (
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {selectedCount} selected
            </span>
          )}
        </div>
      )}
    </div>
  );
}