/**
 * ObjectBarChart Component - TRULY SYNCHRONIZED VERSION
 * Bar chart showing unique tracked objects by type
 * 
 * CRITICAL FIX: Now counts objects EXACTLY the same way as RecentDetections
 * - RecentDetections shows: uniqueDetections.length
 * - ObjectBarChart must show: Sum of unique tracker_ids per object class
 * - Both must equal each other!
 */

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { Target, RefreshCw } from 'lucide-react';
import type { DetectionEvent } from '@/types/analytics.types';
import { getUniqueRecentDetections } from '@/utils/analytics.utils';
import { CHART_COLORS, MAX_CHART_ITEMS } from '@/constants/analytics.constants';

interface ObjectBarChartProps {
  events: DetectionEvent[];
  selectedDateRange: string;
  selectedCamera: string;
  loading?: boolean;
}

/**
 * Count unique tracker_ids per object class
 * This is the CORE function that must match RecentDetections logic
 */
function getUniqueTrackerCountsByObject(events: DetectionEvent[]) {
  // First, deduplicate by tracker_id (same as RecentDetections)
  const uniqueDetections = getUniqueRecentDetections(events);
  
  // Then count how many unique tracker_ids per object class
  const objectTrackerMap = new Map<string, Set<number>>();
  
  uniqueDetections.forEach((event) => {
    const objectClass = event.object_class_name;
    if (!objectClass || event.tracker_id === null || event.tracker_id === undefined) return;
    
    if (!objectTrackerMap.has(objectClass)) {
      objectTrackerMap.set(objectClass, new Set());
    }
    objectTrackerMap.get(objectClass)!.add(event.tracker_id);
  });
  
  // Convert to plain object
  const objectCounts: Record<string, number> = {};
  let totalUniqueObjects = 0;
  
  objectTrackerMap.forEach((trackerIds, objectClass) => {
    const count = trackerIds.size;
    objectCounts[objectClass] = count;
    totalUniqueObjects += count;
  });
  
  return {
    objectCounts,
    totalUniqueObjects,
    uniqueDetections, // Also return this for validation
  };
}

/**
 * Prepare bar chart data
 */
function prepareBarChartData(objectCounts: Record<string, number>) {
  if (Object.keys(objectCounts).length === 0) {
    return { chartData: [], totalShown: 0, totalAll: 0, hiddenCount: 0 };
  }

  // Sort by count and take top items
  const sortedObjects = Object.entries(objectCounts)
    .filter(([name, count]) => count > 0 && name && name.trim() !== '')
    .sort((a, b) => b[1] - a[1]);

  if (sortedObjects.length === 0) {
    return { chartData: [], totalShown: 0, totalAll: 0, hiddenCount: 0 };
  }

  const topItems = sortedObjects.slice(0, MAX_CHART_ITEMS);
  const chartData = topItems.map(([name, count], index) => ({
    object: name.length > 12 ? `${name.substring(0, 10)}...` : name,
    fullName: name,
    detections: count,
    color: CHART_COLORS[index % CHART_COLORS.length],
  }));

  const totalShown = topItems.reduce((sum, [_, count]) => sum + count, 0);
  const totalAll = sortedObjects.reduce((sum, [_, count]) => sum + count, 0);
  const hiddenCount = sortedObjects.length - topItems.length;

  return { chartData, totalShown, totalAll, hiddenCount };
}

export const ObjectBarChart = ({
  events,
  selectedDateRange,
  selectedCamera,
  loading,
}: ObjectBarChartProps) => {
  // CRITICAL: Use the exact same logic as RecentDetections
  const { objectCounts, totalUniqueObjects, uniqueDetections } = getUniqueTrackerCountsByObject(events);
  const chartData = prepareBarChartData(objectCounts);

  // Validation: These MUST be equal
  const isSync = totalUniqueObjects === uniqueDetections.length;
  
  // Debug logging (remove in production)
  if (process.env.NODE_ENV === 'development' && !isSync) {
    console.error('🔴 SYNC ERROR:', {
      barChartTotal: totalUniqueObjects,
      recentDetectionsTotal: uniqueDetections.length,
      rawEvents: events.length,
    });
  }

  const getDateRangeLabel = () => {
    const labels: Record<string, string> = {
      '1h': 'last hour',
      '24h': 'last 24 hours',
      '7d': 'last 7 days',
      '30d': 'last 30 days',
    };
    return labels[selectedDateRange] || 'selected period';
  };

  if (loading) {
    return (
      <div className="lg:col-span-2 rounded-2xl shadow-sm border dark:border-slate-700 p-6 backdrop-blur-sm bg-opacity-80 bg-white dark:bg-slate-800">
        <div className="flex items-center justify-center h-80">
          <RefreshCw className="w-8 h-8 animate-spin opacity-60" />
        </div>
      </div>
    );
  }

  return (
    <div className="lg:col-span-2 rounded-2xl shadow-sm border dark:border-slate-700 p-6 backdrop-blur-sm bg-opacity-80 bg-white dark:bg-slate-800">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Unique Tracked Objects
          </h3>
          <p className="text-sm opacity-70 text-gray-600 dark:text-gray-400">
            {totalUniqueObjects} unique objects tracked by ID in {getDateRangeLabel()}
            {selectedCamera !== 'all' && ` from ${selectedCamera}`}
          </p>
          {process.env.NODE_ENV === 'development' && !isSync && (
            <p className="text-xs text-red-500 mt-1">
              ⚠️ Sync error: Chart shows {totalUniqueObjects} but should show {uniqueDetections.length}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end space-y-1">
          <div className="text-xs opacity-60 text-gray-600 dark:text-gray-400">
            {uniqueDetections.length} unique objects
          </div>
          <div className="text-xs opacity-60 text-gray-600 dark:text-gray-400">
            {chartData.chartData.length > 0
              ? `Top ${chartData.chartData.length} of ${Object.keys(objectCounts).length} types`
              : '0 types'}
          </div>
          {chartData.hiddenCount > 0 && (
            <div className="text-xs px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded">
              +{chartData.hiddenCount} more types ({(chartData.totalAll - chartData.totalShown).toLocaleString()}{' '}
              objects)
            </div>
          )}
        </div>
      </div>

      <div className="h-80">
        {chartData.chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData.chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis
                dataKey="object"
                fontSize={12}
                angle={-35}
                textAnchor="end"
                height={60}
                interval={0}
              />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip
                formatter={(value) => [value, 'Unique Objects']}
                labelFormatter={(label, payload) => {
                  if (payload && payload[0] && payload[0].payload) {
                    return `${payload[0].payload.fullName}`;
                  }
                  return label;
                }}
                contentStyle={{
                  backgroundColor: 'rgba(141, 188, 221)',
                  border: 'none',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="detections" radius={[6, 6, 0, 0]} barSize={100}>
                {chartData.chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Target className="w-12 h-12 opacity-30 mx-auto mb-3" />
              <p className="text-sm opacity-60 text-gray-600 dark:text-gray-400">
                No unique tracked objects detected
              </p>
              <p className="text-xs opacity-40 text-gray-600 dark:text-gray-400 mt-2">
                {events.length > 0 
                  ? 'Objects must have a tracker_id to be counted'
                  : 'No detection events in selected time range'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};