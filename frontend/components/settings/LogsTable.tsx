import React from 'react';
import { Eye, Clock } from 'lucide-react';
import { LogLevelBadge } from '@/components/ui/LogLevelBadge';
import type { SystemLog } from '@/types/system-logs.types';

interface LogsTableProps {
  logs: SystemLog[];
  onViewDetails: (log: SystemLog) => void;
}

export const LogsTable: React.FC<LogsTableProps> = ({ logs, onViewDetails }) => {
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

  const truncateText = (text: string, maxLength: number): string => {
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <tr>
            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Timestamp
            </th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Level
            </th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Category
            </th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Message
            </th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Camera
            </th>
            <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
          {logs.map((log) => (
            <tr
              key={log.id}
              className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <Clock className="w-4 h-4 mr-2 text-gray-400" />
                  {formatTimestamp(log.timestamp)}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <LogLevelBadge level={log.level} />
              </td>
              <td className="px-6 py-4">
                <div className="text-sm">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {log.category}
                  </div>
                  {log.subcategory && (
                    <div className="text-gray-500 dark:text-gray-400 text-xs">
                      {log.subcategory}
                    </div>
                  )}
                </div>
              </td>
              <td className="px-6 py-4">
                <p className="text-sm text-gray-900 dark:text-white max-w-md">
                  {truncateText(log.message, 100)}
                </p>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {log.camera_id ? (
                  <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                    {log.camera_id}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400 dark:text-gray-600">
                    -
                  </span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-center">
                <button
                  onClick={() => onViewDetails(log)}
                  className="inline-flex items-center px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg text-sm font-medium transition-colors"
                >
                  <Eye className="w-4 h-4 mr-1.5" />
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};