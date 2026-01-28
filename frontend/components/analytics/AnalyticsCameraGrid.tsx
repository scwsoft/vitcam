/**
 * AnalyticsCameraGrid Component
 * Wrapper for camera performance grid display
 */

import React from 'react';
import { CameraStats } from '@/types/analytics.types';
import CameraGrid from '@/components/analytics/CameraGrid';

interface AnalyticsCameraGridProps {
  cameraStats: CameraStats[];
}

const AnalyticsCameraGrid: React.FC<AnalyticsCameraGridProps> = ({
  cameraStats,
}) => {
  if (cameraStats.length === 0) {
    return null;
  }

  return (
    <div>
      <CameraGrid cameraStats={cameraStats} />
    </div>
  );
};

export default AnalyticsCameraGrid;