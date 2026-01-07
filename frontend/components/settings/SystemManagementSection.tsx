import { Trash2 } from 'lucide-react';

interface SystemManagementSectionProps {
  isSubmitting: boolean;
  onClearLogs: () => void;
  onClearAnalytics: () => void;
  onClearRecordings: () => void;
  onClearDetectionImages: () => void;
}

export const SystemManagementSection = ({
  isSubmitting,
  onClearLogs,
  onClearAnalytics,
  onClearRecordings,
  onClearDetectionImages,
}: SystemManagementSectionProps) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 lg:col-span-2">
      <div className="flex items-center mb-4">
        <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400 mr-2" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          System Management
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="font-medium text-gray-900 dark:text-white mb-2">System Logs</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Remove all system logs and diagnostic information from the database.
          </p>
          <button
            onClick={onClearLogs}
            disabled={isSubmitting}
            className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Clearing...' : 'Clear All Logs'}
          </button>
        </div>

        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="font-medium text-gray-900 dark:text-white mb-2">Recordings</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Delete all saved recordings, storage files, and associated metadata from the database.
          </p>
          <button
            onClick={onClearRecordings}
            disabled={isSubmitting}
            className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Clearing...' : 'Clear All Recordings'}
          </button>
        </div>

         <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="font-medium text-gray-900 dark:text-white mb-2">Analytics</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Remove all analytics information from the database.
          </p>
          <button
            onClick={onClearAnalytics}
            disabled={isSubmitting}
            className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Clearing...' : 'Clear All Analytics'}
          </button>
        </div>

        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="font-medium text-gray-900 dark:text-white mb-2">Detection Images</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Delete all detection images from storage. This will remove all captured object detection.
          </p>
          <button
            onClick={onClearDetectionImages}
            disabled={isSubmitting}
            className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Clearing...' : 'Clear All Detection Images'}
          </button>
        </div>

      </div>
    </div>
  );
};