import { Wifi, Signal, Download, Zap, Gauge } from 'lucide-react';
import { NetworkStats } from '@/types/network.types';
import { StatCard } from '@/components/ui/StatCard';
import { getConnectionTypeColor } from '@/utils/network.utils';

interface NetworkStatsPanelProps {
  stats: NetworkStats;
}

export const NetworkStatsPanel = ({ stats }: NetworkStatsPanelProps) => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <Wifi className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Network Information
          </h2>
          <p className="text-gray-600 dark:text-slate-400">
            Current connection details from your browser
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Signal}
          label="Connection Type"
          value={stats.effectiveType?.toUpperCase() || 'Unknown'}
          valueClassName={getConnectionTypeColor(stats.effectiveType)}
        />

        <StatCard
          icon={Download}
          label="Estimated Downlink"
          value={stats.downlink ? `${stats.downlink} Mbps` : 'N/A'}
          valueClassName="text-blue-600 dark:text-blue-400"
        />

        <StatCard
          icon={Zap}
          label="Round Trip Time"
          value={stats.rtt ? `${stats.rtt} ms` : 'N/A'}
          valueClassName="text-purple-600 dark:text-purple-400"
        />

        <StatCard
          icon={Gauge}
          label="Data Saver"
          value={stats.saveData ? 'ON' : 'OFF'}
          valueClassName={
            stats.saveData
              ? 'text-orange-600 dark:text-orange-400'
              : 'text-green-600 dark:text-green-400'
          }
        />
      </div>
    </div>
  );
};