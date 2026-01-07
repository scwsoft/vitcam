import { Download, RefreshCw } from 'lucide-react';
import { SpeedTest } from '@/types/network.types';
import { getSpeedColor } from '@/utils/network.utils';

interface SpeedTestPanelProps {
  speedTest: SpeedTest;
  onRunTest: () => void;
}

export const SpeedTestPanel = ({ speedTest, onRunTest }: SpeedTestPanelProps) => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Download className="w-6 h-6 text-green-600 dark:text-green-400" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Speed Test
            </h2>
            <p className="text-gray-600 dark:text-slate-400">
              Measure your actual network performance
            </p>
          </div>
        </div>
        <button
          onClick={onRunTest}
          disabled={speedTest.isRunning}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${speedTest.isRunning ? 'animate-spin' : ''}`} />
          {speedTest.isRunning ? 'Testing...' : 'Run Test'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-6 border border-gray-200 dark:border-slate-600">
          <div className="text-gray-600 dark:text-slate-400 mb-2">Download Speed</div>
          <div
            className={`text-3xl font-bold ${
              speedTest.downloadSpeed
                ? getSpeedColor(speedTest.downloadSpeed)
                : 'text-gray-400 dark:text-slate-500'
            }`}
          >
            {speedTest.isRunning && !speedTest.downloadSpeed
              ? 'Testing...'
              : speedTest.downloadSpeed
              ? `${speedTest.downloadSpeed}`
              : '--'}
          </div>
          <div className="text-gray-500 dark:text-slate-400 text-sm mt-1">Mbps</div>
        </div>

        <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-6 border border-gray-200 dark:border-slate-600">
          <div className="text-gray-600 dark:text-slate-400 mb-2">Latency</div>
          <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
            {speedTest.isRunning && !speedTest.latency
              ? 'Testing...'
              : speedTest.latency
              ? `${speedTest.latency}`
              : '--'}
          </div>
          <div className="text-gray-500 dark:text-slate-400 text-sm mt-1">ms</div>
        </div>
      </div>
    </div>
  );
};