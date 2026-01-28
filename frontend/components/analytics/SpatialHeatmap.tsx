import React, { useMemo } from 'react';
import { DetectionEvent } from '@/types/detection';
import { Grid3x3 } from 'lucide-react';

interface SpatialHeatmapProps {
  detections: DetectionEvent[];
}

const SpatialHeatmap: React.FC<SpatialHeatmapProps> = ({ detections }) => {
  const heatmapData = useMemo(() => {
    const gridSize = 20; // 20x20 grid
    const grid: number[][] = Array(gridSize)
      .fill(0)
      .map(() => Array(gridSize).fill(0));

    detections.forEach((detection) => {
      if (detection.frame_width > 0 && detection.frame_height > 0) {
        // Normalize coordinates to grid
        const centerX = detection.bbox_x + detection.bbox_width / 2;
        const centerY = detection.bbox_y + detection.bbox_height / 2;

        const gridX = Math.floor((centerX / detection.frame_width) * gridSize);
        const gridY = Math.floor((centerY / detection.frame_height) * gridSize);

        if (gridX >= 0 && gridX < gridSize && gridY >= 0 && gridY < gridSize) {
          grid[gridY][gridX]++;
        }
      }
    });

    const maxValue = Math.max(...grid.flat());
    return { grid, maxValue };
  }, [detections]);

  const getHeatColor = (value: number, max: number) => {
    if (value === 0) return 'rgba(30, 41, 59, 0.3)'; // slate-800/30
    
    const intensity = value / max;
    if (intensity > 0.8) return '#dc2626'; // red-600
    if (intensity > 0.6) return '#f97316'; // orange-500
    if (intensity > 0.4) return '#f59e0b'; // amber-500
    if (intensity > 0.2) return '#10b981'; // emerald-500
    return '#3b82f6'; // blue-500
  };

  return (
    <div className="rounded-2xl border bg-gray-50 dark:bg-gray-900 backdrop-blur-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Grid3x3 className="w-5 h-5 text-blue-400" />
            Spatial Heatmap
          </h2>
          <p className="text-gray-900 dark:text-white  text-sm mt-1">Detection density across frame</p>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="aspect-video bg-slate-300/50 dark:bg-slate-900/50 rounded-xl p-4 relative">
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(20, 1fr)` }}>
          {heatmapData.grid.map((row, y) =>
            row.map((value, x) => (
              <div
                key={`${x}-${y}`}
                className="aspect-square rounded-sm transition-all duration-300 hover:scale-150 hover:z-10 relative group"
                style={{
                  backgroundColor: getHeatColor(value, heatmapData.maxValue),
                }}
              >
                {value > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs font-bold text-white drop-shadow-lg">
                      {value}
                    </span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Frame overlay */}
        <div className="absolute inset-4 border-2 border-dashed border-slate-600/30 rounded-lg pointer-events-none" />
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-between">
        <span className="text-gray-900 dark:text-white text-sm">Low</span>
        <div className="flex gap-1">
          <div className="w-8 h-3 rounded" style={{ backgroundColor: '#3b82f6' }} />
          <div className="w-8 h-3 rounded" style={{ backgroundColor: '#10b981' }} />
          <div className="w-8 h-3 rounded" style={{ backgroundColor: '#f59e0b' }} />
          <div className="w-8 h-3 rounded" style={{ backgroundColor: '#f97316' }} />
          <div className="w-8 h-3 rounded" style={{ backgroundColor: '#dc2626' }} />
        </div>
        <span className="text-gray-900 dark:text-white  text-sm">High</span>
      </div>
    </div>
  );
};

export default SpatialHeatmap;