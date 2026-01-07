/**
 * FilterControls Component
 * Date range and camera filter controls
 */

import { Filter } from 'lucide-react';
import type { Camera, DateRangeOption } from '@/types/analytics.types';
import { DATE_RANGE_OPTIONS } from '@/constants/analytics.constants';

interface FilterControlsProps {
  selectedDateRange: DateRangeOption;
  selectedCamera: string;
  cameras: Camera[];
  onDateRangeChange: (range: DateRangeOption) => void;
  onCameraChange: (camera: string) => void;
  onClearCameraFilter: () => void;
}

export const FilterControls = ({
  selectedDateRange,
  selectedCamera,
  cameras,
  onDateRangeChange,
  onCameraChange,
  onClearCameraFilter,
}: FilterControlsProps) => {
  return (
    <div className="flex items-center space-x-4 p-4 rounded-2xl border dark:border-slate-700 backdrop-blur-sm bg-opacity-80 bg-white dark:bg-slate-800">
      <Filter className="w-5 h-5 opacity-60" />

      <select
        value={selectedDateRange}
        onChange={(e) => onDateRangeChange(e.target.value as DateRangeOption)}
        className="px-3 py-2 rounded-lg text-sm font-medium border backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border-gray-200 dark:border-slate-600"
      >
        {Object.entries(DATE_RANGE_OPTIONS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <select
        value={selectedCamera}
        onChange={(e) => onCameraChange(e.target.value)}
        className="px-3 py-2 rounded-lg text-sm font-medium border backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border-gray-200 dark:border-slate-600"
      >
        <option value="all">All Cameras</option>
        {cameras.map((camera) => (
          <option key={camera.id} value={camera.name}>
            {camera.name}
          </option>
        ))}
      </select>

      {selectedCamera !== 'all' && (
        <button
          onClick={onClearCameraFilter}
          className="px-3 py-1 text-sm rounded-lg bg-violet-500/20 hover:bg-violet-500/30 transition-all text-violet-600 dark:text-violet-400"
        >
          Clear filter
        </button>
      )}
    </div>
  );
};