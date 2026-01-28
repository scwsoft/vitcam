/**
 * AnalyticsError Component
 * Display error state with retry option
 */

import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface AnalyticsErrorProps {
  error: Error;
  onRetry?: () => void;
}

const AnalyticsError: React.FC<AnalyticsErrorProps> = ({ error, onRetry }) => {
  return (
    <div className="flex items-center justify-center min-h-[400px] bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full mx-auto px-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-red-200 dark:border-red-900/50 p-8">
          <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/20 rounded-full">
            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>

          <h3 className="text-xl font-semibold text-gray-900 dark:text-white text-center mb-2">
            Failed to Load Analytics
          </h3>

          <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
            {error.message || 'An unexpected error occurred while loading analytics data.'}
          </p>

          {onRetry && (
            <button
              onClick={onRetry}
              className="w-full px-4 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          )}

          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <p className="text-sm text-gray-500 dark:text-gray-500 text-center">
              If this problem persists, please check your database connection
              and table permissions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsError;