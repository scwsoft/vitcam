/**
 * DetectionPieChart Component
 * Pie chart showing detection distribution by object type
 */

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { Target, RefreshCw } from 'lucide-react';
import type { DetectionEvent } from '@/types/analytics.types';
import { getObjectChartData } from '@/utils/analytics.utils';

interface DetectionPieChartProps {
  events: DetectionEvent[];
  loading?: boolean;
}

export const DetectionPieChart = ({ events, loading }: DetectionPieChartProps) => {
  const pieData = getObjectChartData(events);

  if (loading) {
    return (
      <div className="rounded-2xl shadow-sm border dark:border-slate-700 p-6 backdrop-blur-sm bg-opacity-80 bg-white dark:bg-slate-800">
        <div className="flex items-center justify-center h-80">
          <RefreshCw className="w-8 h-8 animate-spin opacity-60" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl shadow-sm border dark:border-slate-700 p-6 backdrop-blur-sm bg-opacity-80 bg-white dark:bg-slate-800">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Detection Distribution
          </h3>
          <p className="text-sm opacity-70 text-gray-600 dark:text-gray-400">
            Percentage breakdown
          </p>
        </div>
      </div>

      <div className="h-80">
        {pieData.chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData.chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string, props: any) => [
                  `${value} (${props.payload.percentage.toFixed(1)}%)`,
                  name,
                ]}
                contentStyle={{
                  backgroundColor: 'rgba(141, 188, 221)',
                  border: 'none',
                  borderRadius: '8px',
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value) => <span className="text-sm">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Target className="w-12 h-12 opacity-30 mx-auto mb-3" />
              <p className="text-sm opacity-60 text-gray-600 dark:text-gray-400">
                No objects detected
              </p>
            </div>
          </div>
        )}
      </div>

      {pieData.totalAll > pieData.totalShown && (
        <div className="mt-4 text-xs text-center opacity-60 text-gray-600 dark:text-gray-400">
          Showing {pieData.totalShown.toLocaleString()} of {pieData.totalAll.toLocaleString()}{' '}
          objects (top categories only)
        </div>
      )}
    </div>
  );
};