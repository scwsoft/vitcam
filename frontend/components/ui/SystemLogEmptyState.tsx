import React from 'react';
import { Database } from 'lucide-react';

export const EmptyState: React.FC = () => (
  <div className="flex items-center justify-center py-16">
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
        <Database className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        No Logs Found
      </h3>
      <p className="text-gray-600 dark:text-gray-400">
        Try adjusting your filters to see more results
      </p>
    </div>
  </div>
);