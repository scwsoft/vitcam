import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { DetectionEvent } from '@/types/detection';
import { Clock } from 'lucide-react';

interface DetectionTimelineProps {
  detections: DetectionEvent[];
}

const DetectionTimeline: React.FC<DetectionTimelineProps> = ({ detections }) => {
  const timeSeriesData = useMemo(() => {
    // Group detections by time intervals (e.g., hourly)
    const intervalMinutes = detections.length > 1000 ? 60 : detections.length > 200 ? 30 : 15;
    const timeMap = new Map<number, { count: number; totalConfidence: number }>();

    detections.forEach((detection) => {
      const timestamp = new Date(detection.timestamp).getTime();
      const intervalTime = Math.floor(timestamp / (intervalMinutes * 60 * 1000)) * intervalMinutes * 60 * 1000;

      if (!timeMap.has(intervalTime)) {
        timeMap.set(intervalTime, { count: 0, totalConfidence: 0 });
      }

      const stats = timeMap.get(intervalTime)!;
      stats.count++;
      stats.totalConfidence += detection.confidence || 0;
    });

    return Array.from(timeMap.entries())
      .map(([time, stats]) => ({
        time: new Date(time).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        detections: stats.count,
        confidence: Math.round((stats.totalConfidence / stats.count) * 100),
      }))
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [detections]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800/95 backdrop-blur-xl border border-gray-300 dark:border-gray-700/50 rounded-xl p-4 shadow-2xl">
          <p className="text-gray-700 dark:text-gray-300 font-medium mb-2">{payload[0].payload.time}</p>
          <div className="space-y-1">
            <p className="text-sm">
              <span className="text-violet-400">Detections:</span>{' '}
              <span className="text-gray-900 dark:text-white font-semibold">{payload[0].value}</span>
            </p>
            <p className="text-sm">
              <span className="text-fuchsia-400">Confidence:</span>{' '}
              <span className="text-gray-900 dark:text-white font-semibold">{payload[1].value}%</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800/50 bg-white dark:bg-gray-800/30 backdrop-blur-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Clock className="w-5 h-5 text-violet-400" />
            Detection Timeline
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Real-time detection activity over time</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-violet-500" />
            <span className="text-gray-600 dark:text-gray-400">Detections</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-fuchsia-500" />
            <span className="text-gray-600 dark:text-gray-400">Confidence</span>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={timeSeriesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorDetections" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorConfidence" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
          <XAxis
            dataKey="time"
            stroke="#64748b"
            style={{ fontSize: '12px' }}
            tickLine={false}
          />
          <YAxis
            yAxisId="left"
            stroke="#8b5cf6"
            style={{ fontSize: '12px' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="#ec4899"
            style={{ fontSize: '12px' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="detections"
            stroke="#8b5cf6"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorDetections)"
          />
          <Area
            yAxisId="right"
            type="monotone"
            dataKey="confidence"
            stroke="#ec4899"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorConfidence)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default DetectionTimeline;