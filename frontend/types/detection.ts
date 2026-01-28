export interface DetectionEvent {
  id: number;
  camera_id: number;
  camera_name: string | null;
  camera_url: string | null;
  timestamp: string;
  object_class_id: number | null;
  object_class_name: string | null;
  confidence: number | null;
  bbox_x: number;
  bbox_y: number;
  bbox_width: number;
  bbox_height: number;
  frame_width: number;
  frame_height: number;
  session_id: string | null;
  detection_metadata: Record<string, any>;
  created_at: string;
  image_url: string | null;
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

export interface TimeSeriesData {
  timestamp: string;
  count: number;
  avg_confidence: number;
}

export interface HeatmapData {
  x: number;
  y: number;
  intensity: number;
}

export interface AnalyticsFilters {
  cameraIds: number[];
  objectClasses: string[];
  confidenceMin: number;
  timeRange: 'hour' | 'day' | 'week' | 'month' | 'custom';
  startDate?: Date;
  endDate?: Date;
}