import React from 'react';
import { ObjectClassStats } from '@/types/detection';
import { Package } from 'lucide-react';

interface ObjectDistributionProps {
  objectStats: ObjectClassStats[];
}

const ObjectDistribution: React.FC<ObjectDistributionProps> = ({ objectStats }) => {
  const maxCount = Math.max(...objectStats.map((s) => s.count));

  return (
    <div className="rounded-2xl border bg-gray-50 dark:bg-gray-900 backdrop-blur-xl p-6 h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Package className="w-5 h-5 text-fuchsia-400" />
            Object Distribution
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Detection count by class</p>
        </div>
      </div>

      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {objectStats.map((stat, index) => (
          <div
            key={stat.class_name}
            className="group"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: stat.color }}
                />
                <span className="text-gray-900 dark:text-gray-400 font-medium capitalize">
                  {stat.class_name}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-slate-400 text-sm">
                  {(stat.avg_confidence * 100).toFixed(1)}%
                </span>
                <span className="text-gray-900 dark:text-white font-semibold min-w-[40px] text-right">
                  {stat.count}
                </span>
              </div>
            </div>

            {/* Animated bar */}
            <div className="relative h-2 bg-slate-800/50 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: `${(stat.count / maxCount) * 100}%`,
                  backgroundColor: stat.color,
                  boxShadow: `0 0 20px ${stat.color}40`,
                }}
              >
                {/* Shimmer effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent shimmer" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(51, 65, 85, 0.3);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(139, 92, 246, 0.5);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(139, 92, 246, 0.7);
        }
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        .shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  );
};

export default ObjectDistribution;