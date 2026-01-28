/**
 * AnalyticsLoadingState Component
 * Loading indicator for analytics page
 */

import React from 'react';

const AnalyticsLoadingState: React.FC = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-600 dark:text-gray-400 text-lg">
          Loading analytics...
        </p>
      </div>
    </div>
  );
};

export default AnalyticsLoadingState;