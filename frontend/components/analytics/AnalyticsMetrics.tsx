/**
 * AnalyticsMetrics Component
 * Key metrics dashboard cards
 */

import React from 'react';
import { TrendingUp, Camera, Activity, Eye } from 'lucide-react';
import { AnalyticsStats } from '@/types/analytics.types';
import StatsCard from '@/components/analytics/StatsCard';

interface AnalyticsMetricsProps {
  stats: AnalyticsStats;
}

const AnalyticsMetrics: React.FC<AnalyticsMetricsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
      <StatsCard
        title="Total Detections"
        value={stats.totalDetections.toLocaleString()}
        icon={Activity}
        trend={{ value: stats.recentDetections, label: 'last hour' }}
        color="violet"
      />

      <StatsCard
        title="Active Cameras"
        value={stats.uniqueCameras.toString()}
        icon={Camera}
        color="blue"
      />

      <StatsCard
        title="Avg Confidence"
        value={`${(stats.avgConfidence * 100).toFixed(1)}%`}
        icon={TrendingUp}
        color="emerald"
      />

      <StatsCard
        title="Object Classes"
        value={stats.uniqueObjects.toString()}
        icon={Eye}
        color="fuchsia"
      />

      <StatsCard
        title="Recent Activity"
        value={stats.recentDetections.toLocaleString()}
        icon={Activity}
        subtitle="Last hour"
        color="amber"
      />
    </div>
  );
};

export default AnalyticsMetrics;