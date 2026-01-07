import React from 'react';
import { X, Eye, AlertTriangle } from 'lucide-react';
import { LogLevelBadge } from '@/components/ui/LogLevelBadge';
import type { SystemLog } from '@/types/system-logs.types';

interface LogDetailModalProps {
  log: SystemLog | null;
  isOpen: boolean;
  onClose: () => void;
}

export const LogDetailModal: React.FC<LogDetailModalProps> = ({
  log,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !log) return null;

  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-blue-600 dark:bg-blue-500">
              <Eye className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Log Details
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-all hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-8rem)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Information */}
            <div className="p-6 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                Basic Information
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                    Timestamp
                  </label>
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                    {formatTimestamp(log.timestamp)}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                    Level
                  </label>
                  <LogLevelBadge level={log.level} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                    Category
                  </label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {log.category}
                  </p>
                </div>
                {log.subcategory && (
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                      Subcategory
                    </label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {log.subcategory}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Context */}
            <div className="p-6 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                Context
              </h3>
              <div className="space-y-4">
                {log.camera_id && (
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                      Camera ID
                    </label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {log.camera_id}
                    </p>
                  </div>
                )}
                {log.session_id && (
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                      Session ID
                    </label>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-mono text-xs break-all">
                      {log.session_id}
                    </p>
                  </div>
                )}
                {log.source_file && (
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                      Source File
                    </label>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-mono text-xs break-all">
                      {log.source_file}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Message */}
          <div className="mt-6 p-6 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
              Message
            </h3>
            <div className="p-4 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap font-mono">
                {log.message}
              </p>
            </div>
          </div>

          {/* Details */}
          {log.details && (
            <div className="mt-6 p-6 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                Details
              </h3>
              <div className="p-4 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <pre className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap overflow-x-auto font-mono">
                  {JSON.stringify(log.details, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Stack Trace */}
          {log.stack_trace && (
            <div className="mt-6 p-6 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center mb-4">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
                <h3 className="text-sm font-medium text-gray-900 dark:text-white uppercase tracking-wider">
                  Stack Trace
                </h3>
              </div>
              <div className="p-4 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <pre className="text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap overflow-x-auto font-mono">
                  {log.stack_trace}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};