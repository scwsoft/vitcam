import React from 'react';
import { CameraStats } from '@/types/detection';
import { Camera, Activity, TrendingUp, Clock } from 'lucide-react';

interface CameraGridProps {
  cameraStats: CameraStats[];
}

const CameraGrid: React.FC<CameraGridProps> = ({ cameraStats }) => {
  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className="rounded-2xl border bg-gray-50 dark:bg-gray-900 backdrop-blur-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Camera className="w-5 h-5 text-blue-400" />
            Camera Performance
          </h2>
          <p className=" text-gray-900 dark:text-white text-sm mt-1">Individual camera statistics</p>
        </div>
      </div>

      {cameraStats.length === 0 ? (
        <div className="text-center py-12">
          <Camera className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No camera data available</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {cameraStats.map((camera, index) => (
            <div
              key={camera.camera_id}
              className="group relative overflow-hidden rounded-xl border border-slate-800/50 bg-gray-50 dark:bg-gray-900 hover:bg-gray-50/50 hover:to-slate-50/40 p-5 transition-all duration-300 hover:scale-[1.02]"
              style={{
                animation: `fadeIn 0.3s ease-out ${index * 0.05}s backwards`,
              }}
            >
              {/* Camera icon badge */}
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <Camera className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full">
                  <Activity className="w-3 h-3" />
                  Active
                </div>
              </div>

              {/* Camera name */}
              <h3 className="text-gray-900 font-semibold text-lg mb-4 truncate">
                {camera.camera_name}
              </h3>

              {/* Stats */}
              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-900 dark:text-slate-400 text-sm">Detections</span>
                  <span className="text-gray-900 dark:text-white font-bold">{camera.total_detections.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-900 dark:text-slate-400 text-sm flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    Confidence
                  </span>
                  <span className="text-gray-900 dark:text-white font-bold">
                    {(camera.avg_confidence * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-900 dark:text-slate-400 text-sm flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Last seen
                  </span>
                  <span className="text-gray-900 dark:text-slate-300 text-sm">
                    {formatTimeAgo(camera.last_detection)}
                  </span>
                </div>
              </div>

              {/* Active objects */}
              <div>
                <p className="text-gray-900 dark:text-slate-400 text-xs mb-2">Detected objects:</p>
                <div className="flex flex-wrap gap-1">
                  {camera.active_objects.slice(0, 3).map((obj) => (
                    <span
                      key={obj}
                      className="text-xs px-2 py-1 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 capitalize"
                    >
                      {obj}
                    </span>
                  ))}
                  {camera.active_objects.length > 3 && (
                    <span className="text-xs px-2 py-1 rounded-full bg-slate-400/50 dark:text-slate-400">
                      +{camera.active_objects.length - 3}
                    </span>
                  )}
                </div>
              </div>

              {/* Decorative gradient */}
              <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-blue-500/20 rounded-full blur-2xl group-hover:bg-blue-500/30 transition-all" />
              
              {/* Hover border effect */}
              <div className="absolute inset-0 border-2 border-blue-500/0 group-hover:border-blue-500/20 rounded-xl transition-colors pointer-events-none" />
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default CameraGrid;