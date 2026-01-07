import { NetworkMonitorProps } from '@/types/network.types';
import { useNetworkMonitor } from '@/hooks/useNetworkMonitor';
import { NetworkStatsPanel } from '@/components/network/NetworkStatsPanel';
import { SpeedTestPanel } from '@/components/network/SpeedTestPanel';
import { ConnectionHistoryTable } from '@/components/network/ConnectionHistoryTable';
import { InfoPanel } from '@/components/network/InfoPanel';

export const NetworkMonitor = ({ user }: NetworkMonitorProps) => {
  const { networkStats, speedTest, connectionHistory, runSpeedTest } = useNetworkMonitor();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Network Performance Monitor
          </h1>
          <p className="text-gray-600 dark:text-slate-400">
            Real-time bandwidth analytics and connection monitoring
          </p>
        </div>

        <NetworkStatsPanel stats={networkStats} />
        <SpeedTestPanel speedTest={speedTest} onRunTest={runSpeedTest} />
        <ConnectionHistoryTable history={connectionHistory} />
        <InfoPanel />
      </div>
    </div>
  );
};