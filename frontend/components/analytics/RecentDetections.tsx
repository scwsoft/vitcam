/**
 * RecentDetections Component
 * Displays recent unique detections with pagination
 */

import { Activity, Target, RefreshCw } from 'lucide-react';
import type { DetectionEvent, PaginationInfo } from '@/types/analytics.types';
import { getUniqueRecentDetections } from '@/utils/analytics.utils';
import { timeAgo } from '@/utils/analytics.utils';
import { PaginationControls } from './PaginationControls';

interface RecentDetectionsProps {
  events: DetectionEvent[];
  pagination: PaginationInfo | null;
  loading: boolean;
  onNext: () => void;
  onPrev: () => void;
  onPageChange: (page: number) => void;
  onImageClick: (imageUrl: string) => void;
}

export const RecentDetections = ({
  events,
  pagination,
  loading,
  onNext,
  onPrev,
  onPageChange,
  onImageClick,
}: RecentDetectionsProps) => {
  const uniqueDetections = getUniqueRecentDetections(events);

  return (
    <div className="rounded-2xl shadow-sm border dark:border-slate-700 p-6 backdrop-blur-sm bg-opacity-80 bg-white dark:bg-slate-800">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Recent Unique Detections
          </h3>
          <p className="text-sm opacity-70 text-gray-600 dark:text-gray-400">
            {uniqueDetections.length} unique tracked objects
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Activity className="w-5 h-5 opacity-60" />
          {loading && <RefreshCw className="w-4 h-4 animate-spin opacity-60" />}
        </div>
      </div>

      <div className="relative">
        {uniqueDetections.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {uniqueDetections.slice(0, 9).map((event) => (
                <div
                  key={event.id}
                  className="rounded-xl border dark:border-slate-700 backdrop-blur-sm bg-opacity-50 hover:bg-opacity-70 transition-all overflow-hidden"
                >
                  {/* Frame Image */}
                  {event.frame_url && (
                    <div
                      className="relative w-full h-40 bg-gray-900 cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => onImageClick(event.frame_url!)}
                    >
                      <img
                        src={event.frame_url}
                        alt={`Detection of ${event.object_class_name}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                        Click to enlarge
                      </div>
                    </div>
                  )}

                  {/* Detection Info */}
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Target className="w-5 h-5 text-violet-600" />
                        <span className="font-medium text-gray-900 dark:text-white">
                          {event.object_class_name}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-green-600">
                        {(event.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-sm opacity-70 text-gray-600 dark:text-gray-400">
                      <p>Camera: {event.camera_name}</p>
                      {event.tracker_id && <p>Tracker ID: {event.tracker_id}</p>}
                      <p className="text-xs mt-1">{timeAgo(event.timestamp)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <PaginationControls
              pagination={pagination}
              onNext={onNext}
              onPrev={onPrev}
              onPageChange={onPageChange}
              loading={loading}
            />
          </>
        ) : (
          <div className="text-center py-8">
            <Target className="w-12 h-12 opacity-30 mx-auto mb-3" />
            <p className="opacity-60 text-gray-600 dark:text-gray-400">No recent detections</p>
          </div>
        )}
      </div>
    </div>
  );
};