import { ConnectionHistoryItem } from '@/types/network.types';
import { getSpeedColor, getConnectionTypeColor } from '@/utils/network.utils';

interface ConnectionHistoryTableProps {
  history: ConnectionHistoryItem[];
}

export const ConnectionHistoryTable = ({ history }: ConnectionHistoryTableProps) => {
  if (history.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
        Test History
      </h2>
      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-slate-600">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-slate-700">
            <tr>
              <th className="text-left py-3 px-4 text-gray-700 dark:text-slate-300 font-medium">
                Time
              </th>
              <th className="text-left py-3 px-4 text-gray-700 dark:text-slate-300 font-medium">
                Download
              </th>
              <th className="text-left py-3 px-4 text-gray-700 dark:text-slate-300 font-medium">
                Latency
              </th>
              <th className="text-left py-3 px-4 text-gray-700 dark:text-slate-300 font-medium">
                Connection
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-slate-600">
            {history
              .slice()
              .reverse()
              .map((test, index) => (
                <tr
                  key={index}
                  className="hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <td className="py-3 px-4 text-gray-700 dark:text-slate-300">
                    {test.timestamp}
                  </td>
                  <td
                    className={`py-3 px-4 font-semibold ${
                      test.downloadSpeed
                        ? getSpeedColor(test.downloadSpeed)
                        : 'text-gray-400 dark:text-slate-500'
                    }`}
                  >
                    {test.downloadSpeed ? `${test.downloadSpeed} Mbps` : 'Failed'}
                  </td>
                  <td className="py-3 px-4 text-purple-600 dark:text-purple-400">
                    {test.latency ? `${test.latency} ms` : 'N/A'}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${getConnectionTypeColor(
                        test.effectiveType
                      )} bg-gray-100 dark:bg-slate-600`}
                    >
                      {test.effectiveType?.toUpperCase() || 'Unknown'}
                    </span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};