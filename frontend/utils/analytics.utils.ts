/**
 * Analytics Utilities
 * Pure functions for data transformation and calculations
 */

import {
  DetectionEvent,
  CameraStats,
  ObjectClassStats,
  AnalyticsStats,
  AnalyticsFilters,
  TimeRange,
} from '@/types/analytics.types';
import { TIME_RANGES, CHART_COLORS } from '@/constants/analytics.constants';

/**
 * Calculate time range start date based on filter
 */
export const calculateTimeRangeStart = (
  timeRange: TimeRange,
  customStart?: Date
): Date => {
  const now = new Date();

  if (timeRange === 'custom' && customStart) {
    return customStart;
  }

  const offset = TIME_RANGES[timeRange.toUpperCase() as keyof typeof TIME_RANGES] || TIME_RANGES.DAY;
  return new Date(now.getTime() - offset);
};

/**
 * Calculate aggregate statistics from detections
 */
export const calculateStats = (detections: DetectionEvent[]): AnalyticsStats => {
  const totalDetections = detections.length;

  if (totalDetections === 0) {
    return {
      totalDetections: 0,
      uniqueCameras: 0,
      avgConfidence: 0,
      uniqueObjects: 0,
      recentDetections: 0,
    };
  }

  const uniqueCameras = new Set(detections.map((d) => d.camera_id)).size;
  const avgConfidence =
    detections.reduce((sum, d) => sum + (d.confidence || 0), 0) / totalDetections;
  const uniqueObjects = new Set(detections.map((d) => d.object_class_name)).size;

  // Recent activity (last hour)
  const oneHourAgo = new Date(Date.now() - TIME_RANGES.HOUR);
  const recentDetections = detections.filter(
    (d) => new Date(d.timestamp) > oneHourAgo
  ).length;

  return {
    totalDetections,
    uniqueCameras,
    avgConfidence,
    uniqueObjects,
    recentDetections,
  };
};

/**
 * Transform detections into camera statistics
 */
export const calculateCameraStats = (
  detections: DetectionEvent[]
): CameraStats[] => {
  const cameraMap = new Map<number, CameraStats>();

  detections.forEach((detection) => {
    const cameraId = detection.camera_id;

    if (!cameraMap.has(cameraId)) {
      cameraMap.set(cameraId, {
        camera_id: cameraId,
        camera_name: detection.camera_name || `Camera ${cameraId}`,
        total_detections: 0,
        avg_confidence: 0,
        last_detection: detection.timestamp,
        active_objects: [],
      });
    }

    const stats = cameraMap.get(cameraId)!;
    stats.total_detections++;
    stats.avg_confidence += detection.confidence || 0;

    if (
      detection.object_class_name &&
      !stats.active_objects.includes(detection.object_class_name)
    ) {
      stats.active_objects.push(detection.object_class_name);
    }
  });

  // Calculate averages
  cameraMap.forEach((stats) => {
    stats.avg_confidence = stats.avg_confidence / stats.total_detections;
  });

  return Array.from(cameraMap.values());
};

/**
 * Calculate object class distribution statistics
 */
export const calculateObjectStats = (
  detections: DetectionEvent[]
): ObjectClassStats[] => {
  const objectMap = new Map<
    string,
    { count: number; totalConfidence: number }
  >();

  detections.forEach((detection) => {
    const className = detection.object_class_name || 'Unknown';

    if (!objectMap.has(className)) {
      objectMap.set(className, { count: 0, totalConfidence: 0 });
    }

    const stats = objectMap.get(className)!;
    stats.count++;
    stats.totalConfidence += detection.confidence || 0;
  });

  return Array.from(objectMap.entries())
    .map(([class_name, stats], index) => ({
      class_name,
      count: stats.count,
      avg_confidence: stats.totalConfidence / stats.count,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }))
    .sort((a, b) => b.count - a.count);
};

/**
 * Generate CSV export data from detections
 */
export const generateCSVContent = (detections: DetectionEvent[]): string => {
  const headers = ['Timestamp', 'Camera', 'Object Class', 'Confidence', 'Position'];
  
  const rows = detections.map((d) => [
    d.timestamp,
    d.camera_name || d.camera_id.toString(),
    d.object_class_name || 'Unknown',
    d.confidence?.toFixed(2) || '0',
    `(${d.bbox_x}, ${d.bbox_y})`,
  ]);

  return [headers, ...rows].map((row) => row.join(',')).join('\n');
};

/**
 * Trigger CSV file download
 */
export const downloadCSV = (content: string, filename: string): void => {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};