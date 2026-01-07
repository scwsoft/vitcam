import { RefreshCw } from 'lucide-react';

export const LoadingSpinner = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
      <div className="flex items-center gap-3 text-gray-700 dark:text-white">
        <RefreshCw className="w-6 h-6 animate-spin" />
        <span className="text-lg">Loading...</span>
      </div>
    </div>
  );
};