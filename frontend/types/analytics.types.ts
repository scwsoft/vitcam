/**
 * Analytics Type Definitions
 * Core types for video analytics features
 */

export interface DetectionEvent {
  id: string;
  camera_id: number;
  camera_name?: string;
  object_class_name: string;
  confidence: number;
  timestamp: string;
  bbox_x: number;
  bbox_y: number;
  bbox_width: number;
  bbox_height: number;
  unique_tracker_id?: string;
}

export interface CameraStats {
  camera_id: number;
  camera_name: string;
  total_detections: number;
  avg_confidence: number;
  last_detection: string;
  active_objects: string[];
}

export interface ObjectClassStats {
  class_name: string;
  count: number;
  avg_confidence: number;
  color: string;
}

export interface AnalyticsStats {
  totalDetections: number;
  uniqueCameras: number;
  avgConfidence: number;
  uniqueObjects: number;
  recentDetections: number;
}

export interface AnalyticsFilters {
  cameraIds: number[];
  objectClasses: string[];
  confidenceMin: number;
  timeRange: TimeRange;
  startDate?: Date;
  endDate?: Date;
}

export type TimeRange = 'hour' | 'day' | 'week' | 'month' | 'custom';

export interface AnalyticsExportData {
  timestamp: string;
  camera: string | number;
  objectClass: string;
  confidence: string;
  position: string;
}