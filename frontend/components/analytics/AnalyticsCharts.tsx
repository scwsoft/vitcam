/**
 * AnalyticsCharts Component
 * Visualization components for detection data
 */

import React from 'react';
import { DetectionEvent, ObjectClassStats } from '@/types/analytics.types';
import DetectionTimeline from '@/components/analytics/DetectionTimeline';
import ObjectDistribution from '@/components/analytics/ObjectDistribution';
import SpatialHeatmap from '@/components/analytics/SpatialHeatmap';
import LiveDetectionFeed from '@/components/analytics/LiveDetectionFeed';

interface AnalyticsChartsProps {
  detections: DetectionEvent[];
  objectStats: ObjectClassStats[];
  liveFeedLimit: number;
}

const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({
  detections,
  objectStats,
  liveFeedLimit,
}) => {
  return (
    <>
      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
        <div className="xl:col-span-2">
          <DetectionTimeline detections={detections} />
        </div>

        <div>
          <ObjectDistribution objectStats={objectStats} />
        </div>
      </div>

      {/* Secondary Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        <SpatialHeatmap detections={detections} />
        <LiveDetectionFeed detections={detections.slice(0, liveFeedLimit)} />
      </div>
    </>
  );
};

export default AnalyticsCharts;