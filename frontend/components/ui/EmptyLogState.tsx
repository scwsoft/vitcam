/**
 * EmptyState Component
 * Display when no videos are found
 */

import React from 'react';
import { Search } from 'lucide-react';

interface EmptyLogStateProps {
  isFiltered: boolean;
  onClearFilters?: () => void;
}

export const EmptyLogState:React.FC<EmptyLogStateProps> = ({ isFiltered, onClearFilters })  => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
        <Search className="w-12 h-12 text-gray-400 dark:text-gray-500" />
      </div>
      
      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
        {isFiltered ? 'No logs found' : 'No logs yet'}
      </h3>
      
      <p className="text-gray-600 dark:text-gray-400 text-center mb-6 max-w-md">
        {isFiltered
          ? 'Try adjusting your filters or search terms to find what you\'re looking for.'
          : 'Logs will appear here once they are uploaded to your storage.'}
      </p>
    
    </div>
  );
};