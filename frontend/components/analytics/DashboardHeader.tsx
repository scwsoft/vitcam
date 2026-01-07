/**
 * DashboardHeader Component
 * Dashboard title and action buttons
 */

import { RefreshCw, Zap } from 'lucide-react';

interface DashboardHeaderProps {
  isAutoRefresh: boolean;
  refreshing: boolean;
  onToggleAutoRefresh: () => void;
  onRefresh: () => void;
}

export const DashboardHeader = ({
  isAutoRefresh,
  refreshing,
  onToggleAutoRefresh,
  onRefresh,
}: DashboardHeaderProps) => {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Video Analytics Dashboard
        </h1>
        <p className="opacity-70 mt-1 text-gray-600 dark:text-gray-400">
          Real-time object detection insights
        </p>
      </div>

      <div className="flex items-center space-x-3">
        <button
          onClick={onToggleAutoRefresh}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all ${
            isAutoRefresh
              ? 'bg-green-500/20 border-green-500/50 text-green-600 dark:text-green-400'
              : 'border dark:border-slate-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          <Zap className={`w-4 h-4 ${isAutoRefresh ? 'text-green-500' : ''}`} />
          <span className="text-sm">Auto-refresh</span>
        </button>

        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="flex items-center space-x-2 px-4 py-2 rounded-xl border dark:border-slate-700 hover:bg-opacity-50 transition-all disabled:opacity-50 text-gray-700 dark:text-gray-300"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="text-sm">Refresh</span>
        </button>
      </div>
    </div>
  );
};