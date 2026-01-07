/**
 * CameraActivity Component
 * Displays camera activity status and unique object counts
 */

import { Clock } from 'lucide-react';
import type { DetectionEvent } from '@/types/analytics.types';
import { getCameraUniqueObjects, timeAgo } from '@/utils/analytics.utils';

interface CameraActivityProps {
  events: DetectionEvent[];
  selectedCamera: string;
}

export const CameraActivity = ({ events, selectedCamera }: CameraActivityProps) => {
  const cameraData = getCameraUniqueObjects(events);
  const filteredData =
    selectedCamera === 'all'
      ? cameraData
      : cameraData.filter((c) => c.name === selectedCamera);

  return (
    <div className="rounded-2xl shadow-sm border dark:border-slate-700 p-6 backdrop-blur-sm bg-opacity-80 transition-all duration-300 bg-white dark:bg-slate-800">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Activity Status</h3>
          <p className="text-sm opacity-70 text-gray-600 dark:text-gray-400">
            Unique objects tracked
            {selectedCamera !== 'all' && ` - ${selectedCamera}`}
          </p>
        </div>
        <Clock className="w-5 h-5 opacity-60" />
      </div>

      <div className="h-80 overflow-y-auto space-y-3">
        {filteredData.length > 0 ? (
          filteredData
            .slice()
            .sort((a, b) => b.unique_count - a.unique_count)
            .map((camera) => {
              const lastDetection = camera.last_detection;
              const isActive =
                lastDetection &&
                new Date().getTime() - new Date(lastDetection).getTime() < 3600000;

              return (
                <div
                  key={camera.id}
                  className="p-3 rounded-xl border dark:border-slate-700 backdrop-blur-sm bg-opacity-50"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm text-gray-900 dark:text-white">
                      {camera.name}
                    </span>
                    <div className="flex items-center space-x-1">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          isActive ? 'bg-green-400' : 'bg-gray-400'
                        }`}
                      ></div>
                      <span className="text-xs opacity-70 text-gray-600 dark:text-gray-400">
                        {isActive ? 'Active' : 'Idle'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs opacity-70 text-gray-600 dark:text-gray-400">
                    <span>{camera.unique_count.toLocaleString()} unique objects</span>
                    <span>{lastDetection ? timeAgo(lastDetection) : 'No data'}</span>
                  </div>
                  <div className="text-xs opacity-50 mt-1 text-gray-500 dark:text-gray-500">
                    {camera.total_events.toLocaleString()} total events
                  </div>
                </div>
              );
            })
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Clock className="w-12 h-12 opacity-30 mx-auto mb-3" />
              <p className="text-sm opacity-60 text-gray-600 dark:text-gray-400">
                {selectedCamera !== 'all'
                  ? `No activity for ${selectedCamera}`
                  : 'No camera activity'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};