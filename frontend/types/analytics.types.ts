/**
 * Analytics Types
 * Type definitions for the video analytics dashboard
 * UPDATED: Added detection_metadata field from analytics API
 */

/**
 * Detection metadata stored in JSONB column
 * Contains tracking information including track_duration
 */
export interface DetectionMetadata {
  track_duration?: number;          // Duration in seconds that the object was tracked
  first_seen?: string;               // ISO timestamp when tracking started
  last_seen?: string;                // ISO timestamp when tracking ended
  track_confidence_avg?: number;     // Average confidence score across all detections
  detection_count?: number;          // Number of individual detections in this track
  speed_kmh?: number;                // Calculated speed if available
  direction?: string;                // Direction of movement if calculated
  zone_crossings?: string[];         // Array of zone IDs that were crossed
  [key: string]: any;                // Allow additional custom metadata fields
}

export interface DetectionEvent {
  id: number;
  camera_id: number;
  camera_name: string;
  object_class_name: string;
  confidence: number;
  timestamp: string;
  bbox_x?: number;
  bbox_y?: number;
  bbox_width?: number;
  bbox_height?: number;
  tracker_id?: number | null;
  frame_url?: string | null;
  detection_metadata?: DetectionMetadata;  // NEW: JSONB metadata field
}

export interface PaginationInfo {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous?: boolean;
  next_cursor?: string | null;
  cursor?: string | null;
}

export interface DateRange {
  start: string;
  end: string;
}

export interface DashboardSummary {
  total_events: number;
  total_cameras: number;
  date_range: DateRange;
  stats: any[];
}

export interface Camera {
  id: number;
  name: string;
}

export interface DashboardData {
  summary: DashboardSummary;
  recent_events: DetectionEvent[];
  hourly_distribution: Record<string, number>;
  top_objects: [string, number][];
  cameras: Camera[];
  pagination?: PaginationInfo;
}

export interface AnalyticsResponse {
  success: boolean;
  data: DashboardData;
  message?: string;
  total_count?: number;
}

export interface ObjectCount {
  objectCounts: Record<string, number>;
  uniqueTotal: number;
  totalEvents: number;
}

export interface ChartDataItem {
  object: string;
  fullName: string;
  detections: number;
  color: string;
}

export interface PieChartDataItem {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

export interface CameraStats {
  id: number;
  name: string;
  unique_count: number;
  total_events: number;
  last_detection: string;
}

export interface DurationData {
  tracker_id: number;
  object_class: string;
  camera_name: string;
  duration_seconds: number;
  duration_display: string;
  detection_count: number;
  first_seen: Date;
  last_seen: Date;
  source: 'metadata' | 'calculated';  // NEW: Track the source of duration data
}

export interface DwellTimeChartData {
  object: string;
  fullName: string;
  avgDuration: number;
  avgDurationDisplay: string;
  count: number;
}

export type DateRangeOption = '1min' | '15min' | '30min' | '1h' | '24h' | '7d' | '30d';
