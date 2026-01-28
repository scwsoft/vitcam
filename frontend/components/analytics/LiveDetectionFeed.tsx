import React from 'react';
import { DetectionEvent } from '@/types/detection';
import { Radio, Camera, Clock } from 'lucide-react';
import Image from 'next/image';

interface LiveDetectionFeedProps {
  detections: DetectionEvent[];
}

const LiveDetectionFeed: React.FC<LiveDetectionFeedProps> = ({ detections }) => {
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
            <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
            Live Detection Feed
          </h2>
          <p className="text-gray-900 dark:text-white text-sm mt-1">Most recent detections</p>
        </div>
      </div>

      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {detections.map((detection, index) => (
          <div
            key={detection.id}
            className="group relative overflow-hidden rounded-xl border border-slate-800/50 bg-gray-50 dark:bg-gray-900 hover:bg-gray-50/50 transition-all duration-300 p-4"
            style={{
              animation: `slideIn 0.3s ease-out ${index * 0.05}s backwards`,
            }}
          >
            <div className="flex items-start gap-4">
              {/* Image Preview */}
              <div className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-slate-900/50">
                {detection.image_url ? (
                  <Image
                    src={detection.image_url}
                    alt={detection.object_class_name || 'Detection'}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Camera className="w-8 h-8 text-gray-900 dark:text-gray-400" />
                  </div>
                )}
                {/* Confidence badge */}
                <div className="absolute bottom-1 right-1 bg-slate-900/90 backdrop-blur-sm px-2 py-0.5 rounded text-xs font-semibold text-emerald-400">
                  {((detection.confidence || 0) * 100).toFixed(0)}%
                </div>
              </div>

              {/* Detection Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-gray-900 dark:text-white font-semibold capitalize truncate">
                    {detection.object_class_name || 'Unknown'}
                  </h3>
                  <span className="text-gray-900 dark:text-gray-400 text-xs whitespace-nowrap flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTimeAgo(detection.timestamp)}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-900 dark:text-gray-400 mb-2">
                  <Camera className="w-4 h-4" />
                  <span className="truncate">{detection.camera_name || `Camera ${detection.camera_id}`}</span>
                </div>

                {/* Position info */}
                <div className="flex items-center gap-3 text-xs text-gray-900 dark:text-gray-400">
                  <span>
                    Position: ({Math.round(detection.bbox_x)}, {Math.round(detection.bbox_y)})
                  </span>
                  <span>
                    Size: {Math.round(detection.bbox_width)}×{Math.round(detection.bbox_height)}
                  </span>
                </div>
              </div>
            </div>

            {/* Animated border on hover */}
            <div className="absolute inset-0 border-2 border-emerald-500/0 group-hover:border-emerald-500/20 rounded-xl transition-colors pointer-events-none" />
          </div>
        ))}

        {detections.length === 0 && (
          <div className="text-center py-12">
            <Radio className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 dark:text-white">No recent detections</p>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(51, 65, 85, 0.3);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(16, 185, 129, 0.5);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(16, 185, 129, 0.7);
        }
      `}</style>
    </div>
  );
};

export default LiveDetectionFeed;