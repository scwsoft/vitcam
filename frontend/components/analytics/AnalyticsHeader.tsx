/**
 * AnalyticsHeader Component
 * Page header with title, refresh, and export actions
 */

import React from 'react';
import { RefreshCw, Download } from 'lucide-react';

interface AnalyticsHeaderProps {
  onRefresh: () => void;
  onExport: () => void;
  refreshing: boolean;
}

const AnalyticsHeader: React.FC<AnalyticsHeaderProps> = ({
  onRefresh,
  onExport,
  refreshing,
}) => {
  return (
    <div className="border-b border-gray-200 dark:border-gray-800 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-[1800px] mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 dark:from-violet-400 dark:to-fuchsia-400 bg-clip-text text-transparent">
              Video Analytics
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Real-time detection insights and performance metrics
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-700 dark:text-gray-300 flex items-center gap-2 transition-all disabled:opacity-50"
              aria-label="Refresh analytics data"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
              />
              Refresh
            </button>

            <button
              onClick={onExport}
              className="px-4 py-2 bg-violet-50 hover:bg-violet-100 dark:bg-violet-600/10 dark:hover:bg-violet-600/20 border border-violet-200 dark:border-violet-500/30 rounded-xl text-violet-700 dark:text-violet-400 flex items-center gap-2 transition-all"
              aria-label="Export analytics data to CSV"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsHeader;