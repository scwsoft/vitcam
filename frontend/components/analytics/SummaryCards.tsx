/**
 * SummaryCards Component
 * Key performance indicator cards for the dashboard
 */

import { Camera, Target, Eye, Zap } from 'lucide-react';
import type { DashboardData } from '@/types/analytics.types';
import { getUniqueObjectCounts } from '@/utils/analytics.utils';
import { CONFIDENCE_THRESHOLDS } from '@/constants/analytics.constants';

interface SummaryCardsProps {
  dashboardData: DashboardData | null;
  selectedCamera: string;
}

export const SummaryCards = ({ dashboardData, selectedCamera }: SummaryCardsProps) => {
  const events = dashboardData?.recent_events || [];
  const { objectCounts, uniqueTotal, totalEvents } = getUniqueObjectCounts(events);

  // Calculate active cameras from events
  const calculateActiveCameras = () => {
    if (!events || events.length === 0) {
      return 0;
    }

    // Get unique camera names from events
    const uniqueCameras = new Set<string>();
    events.forEach((event) => {
      if (event.camera_name) {
        uniqueCameras.add(event.camera_name);
      }
    });

    return uniqueCameras.size;
  };

  const activeCameras = calculateActiveCameras();

  // Calculate confidence metrics
  const calculateConfidenceMetrics = () => {
    if (!events || events.length === 0) {
      return { average: 0, min: 0, max: 0, label: 'Excellent' };
    }

    const confidences = events.map((e) => e.confidence * 100);
    const totalConfidence = events.reduce((sum, event) => sum + (event.confidence || 0), 0);
    const avgConfidence = (totalConfidence / events.length) * 100;
    const min = Math.min(...confidences);
    const max = Math.max(...confidences);

    let label = '';
    if (avgConfidence >= CONFIDENCE_THRESHOLDS.EXCELLENT) {
      label = 'Excellent';
    } else if (avgConfidence >= CONFIDENCE_THRESHOLDS.GOOD) {
      label = 'Good';
    }

    return { average: avgConfidence, min, max, label };
  };

  const confidenceMetrics = calculateConfidenceMetrics();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Card 1: Total Detections (Unique Objects) */}
      <div className="group relative overflow-hidden rounded-2xl shadow-sm border dark:border-slate-700 backdrop-blur-sm bg-opacity-80 hover:bg-opacity-90 transition-all duration-300 bg-white dark:bg-slate-800">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <p className="text-sm font-medium opacity-70 text-gray-700 dark:text-gray-300">
                  Total Detections
                </p>
                {selectedCamera !== 'all' && (
                  <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">
                    Filtered
                  </span>
                )}
              </div>
              <p className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">
                {uniqueTotal.toLocaleString()}
              </p>
              <div className="flex flex-col space-y-1">
                <span className="text-xs opacity-50 text-gray-600 dark:text-gray-400">
                  {totalEvents.toLocaleString()} detection events
                </span>
                {totalEvents > 0 && uniqueTotal > 0 && (
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-xs font-medium text-blue-700 dark:text-blue-300 w-fit">
                    <Target className="w-3 h-3" />
                    <span>{((uniqueTotal / totalEvents) * 100).toFixed(0)}% unique</span>
                  </span>
                )}
              </div>
            </div>
            <div className="p-3 bg-gradient-to-r from-violet-500 to-violet-600 rounded-xl flex-shrink-0">
              <Target className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Card 2: Active Cameras */}
      <div className="group relative overflow-hidden rounded-2xl shadow-sm border dark:border-slate-700 backdrop-blur-sm bg-opacity-80 hover:bg-opacity-90 transition-all duration-300 bg-white dark:bg-slate-800">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium opacity-70 text-gray-700 dark:text-gray-300">
                Active Cameras
              </p>
              <p className="text-3xl font-bold mt-1 text-gray-900 dark:text-white">
                {activeCameras.toLocaleString()}
              </p>
              {selectedCamera !== 'all' && (
                <div className="mt-2">
                  <span className="text-xs opacity-50 text-gray-600 dark:text-gray-400">
                    Viewing: {selectedCamera}
                  </span>
                </div>
              )}
            </div>
            <div className="p-3 bg-gradient-to-r from-cyan-500 to-cyan-600 rounded-xl">
              <Camera className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Card 3: Object Types */}
      <div className="group relative overflow-hidden rounded-2xl shadow-sm border dark:border-slate-700 backdrop-blur-sm bg-opacity-80 hover:bg-opacity-90 transition-all duration-300 bg-white dark:bg-slate-800">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium opacity-70 text-gray-700 dark:text-gray-300">
                Object Types
              </p>
              <p className="text-3xl font-bold mt-1 text-gray-900 dark:text-white">
                {Object.keys(objectCounts).length}
              </p>
            </div>
            <div className="p-3 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl">
              <Eye className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Card 4: Confidence Score */}
      <div className="group relative overflow-hidden rounded-2xl shadow-sm border dark:border-slate-700 backdrop-blur-sm bg-opacity-80 hover:bg-opacity-90 transition-all duration-300 bg-white dark:bg-slate-800">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium opacity-70 text-gray-700 dark:text-gray-300">
                Confidence Score
              </p>
              <p className="text-3xl font-bold mt-1 text-gray-900 dark:text-white">
                {events.length === 0 ? '0%' : `${confidenceMetrics.average.toFixed(1)}%`}
              </p>
              <div className="flex items-center space-x-2 mt-2">
                <span className="text-xs opacity-50 text-gray-600 dark:text-gray-400">
                  {events.length === 0
                    ? 'No detections'
                    : `${confidenceMetrics.min.toFixed(0)}%-${confidenceMetrics.max.toFixed(0)}% range`}
                </span>
                {events.length > 0 && confidenceMetrics.label && (
                  <span
                    className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      confidenceMetrics.average >= CONFIDENCE_THRESHOLDS.EXCELLENT
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    }`}
                  >
                    {confidenceMetrics.average >= CONFIDENCE_THRESHOLDS.EXCELLENT ? (
                      <Zap className="w-3 h-3" />
                    ) : (
                      <Target className="w-3 h-3" />
                    )}
                    <span>{confidenceMetrics.label}</span>
                  </span>
                )}
              </div>
            </div>
            <div className="p-3 bg-gradient-to-r from-amber-500 to-amber-600 rounded-xl">
              <Zap className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};