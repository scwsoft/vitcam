/**
 * LoadingState Component
 * Loading indicator for the dashboard
 */

import { RefreshCw } from 'lucide-react';

export const LoadingState = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
      <div className="text-center">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 opacity-60 text-gray-600 dark:text-gray-400" />
        <p className="opacity-60 text-gray-700 dark:text-gray-300">Loading dashboard...</p>
      </div>
    </div>
  );
};