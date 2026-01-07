import React from 'react';
import { RefreshCw } from 'lucide-react';

export const LoadingState: React.FC = () => (
  <div className="flex items-center justify-center py-16">
    <div className="text-center">
      <RefreshCw className="w-12 h-12 text-blue-600 dark:text-blue-400 animate-spin mx-auto mb-4" />
      <p className="text-gray-600 dark:text-gray-400 text-lg font-medium">
        Loading logs...
      </p>
    </div>
  </div>
);