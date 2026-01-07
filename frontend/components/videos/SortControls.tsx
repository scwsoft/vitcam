/**
 * SortControls Component
 * Simple, working sort buttons that actually call onSortChange
 */

import React from 'react';
import type { VideoFile, SortConfig } from '@/types/video.types';

interface SortControlsProps {
  sortConfig: SortConfig;
  onSortChange: (field: SortConfig['field']) => void;
  className?: string;
}

export function SortControls({ sortConfig, onSortChange, className = '' }: SortControlsProps) {
  const sortFields: { field: SortConfig['field']; label: string }[] = [
    { field: 'name', label: 'Name' },
    { field: 'timestamp', label: 'Date' },
    { field: 'size', label: 'Size' },
    { field: 'duration', label: 'Duration' },
    { field: 'camera', label: 'Camera' },
  ];

  const handleSortClick = (field: SortConfig['field']) => {
    console.log('🔘 SortControls button clicked:', field);
    onSortChange(field);
  };

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Sort by:
        </span>
        <div className="flex gap-2">
          {sortFields.map(({ field, label }) => {
            const isActive = sortConfig.field === field;
            const isAscending = isActive && sortConfig.direction === 'asc';
            
            return (
              <button
                key={field}
                type="button"
                onClick={() => handleSortClick(field)}
                className={`
                  px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                  flex items-center gap-1.5
                  ${isActive 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }
                `}
              >
                {label}
                {isActive && (
                  <span className="text-xs">
                    {isAscending ? '↑' : '↓'}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}