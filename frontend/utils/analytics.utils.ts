/**
 * Analytics Utilities
 * Helper functions for analytics data processing
 * ULTIMATE COMPLETE VERSION: All functions including chart data helpers
 */

import type { DateRangeOption, DetectionEvent } from '@/types/analytics.types';

/**
 * Get milliseconds for a date range option
 * UPDATED: Added support for 1min, 15min, 30min
 */
export const getDateRangeMs = (range: DateRangeOption): number => {
  const rangeMap: Record<DateRangeOption, number> = {
    '1min': 60 * 1000,                    // 1 minute
    '15min': 15 * 60 * 1000,              // 15 minutes
    '30min': 30 * 60 * 1000,              // 30 minutes
    '1h': 60 * 60 * 1000,                 // 1 hour
    '24h': 24 * 60 * 60 * 1000,           // 24 hours
    '7d': 7 * 24 * 60 * 60 * 1000,        // 7 days
    '30d': 30 * 24 * 60 * 60 * 1000,      // 30 days
  };

  return rangeMap[range] || rangeMap['24h'];
};

/**
 * Format a Date object for API requests (ISO 8601 format)
 */
export const formatDateTimeForAPI = (date: Date): string => {
  return date.toISOString();
};

/**
 * Format a date for display
 */
export const formatDateTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Format a date for display (short version)
 */
export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Format a time for display
 */
export const formatTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Calculate duration in seconds between two dates
 */
export const calculateDuration = (start: Date | string, end: Date | string): number => {
  const startTime = typeof start === 'string' ? new Date(start).getTime() : start.getTime();
  const endTime = typeof end === 'string' ? new Date(end).getTime() : end.getTime();
  return Math.round((endTime - startTime) / 1000);
};

/**
 * Format duration in seconds to human-readable format
 */
export const formatDuration = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (remainingMinutes > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }
  
  return `${hours}h`;
};

/**
 * Get confidence level label
 */
export const getConfidenceLevel = (confidence: number): string => {
  if (confidence >= 85) return 'Excellent';
  if (confidence >= 70) return 'Good';
  if (confidence >= 50) return 'Fair';
  return 'Low';
};

/**
 * Get confidence level color class
 */
export const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 85) return 'text-emerald-500';
  if (confidence >= 70) return 'text-blue-500';
  if (confidence >= 50) return 'text-amber-500';
  return 'text-red-500';
};

/**
 * Truncate text to specified length
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * Group items by key
 */
export const groupBy = <T>(
  array: T[],
  keyFn: (item: T) => string
): Record<string, T[]> => {
  return array.reduce((result, item) => {
    const key = keyFn(item);
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(item);
    return result;
  }, {} as Record<string, T[]>);
};

/**
 * Calculate percentage
 */
export const calculatePercentage = (value: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
};

/**
 * Sort array by key
 */
export const sortBy = <T>(
  array: T[],
  keyFn: (item: T) => number | string,
  order: 'asc' | 'desc' = 'asc'
): T[] => {
  return [...array].sort((a, b) => {
    const aVal = keyFn(a);
    const bVal = keyFn(b);
    
    if (order === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });
};

/**
 * Get unique values from array
 */
export const getUniqueValues = <T>(array: T[], keyFn?: (item: T) => any): T[] => {
  if (!keyFn) {
    return Array.from(new Set(array));
  }
  
  const seen = new Set();
  return array.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

/**
 * Get unique object counts from detection events
 * Counts unique tracked objects by class name
 * Used by: SummaryCards component
 * 
 * @param events - Array of detection events
 * @returns Object with objectCounts, uniqueTotal, and totalEvents
 */
export const getUniqueObjectCounts = (events: DetectionEvent[]) => {
  if (!events || events.length === 0) {
    return {
      objectCounts: {},
      uniqueTotal: 0,
      totalEvents: 0,
    };
  }

  // Count unique tracker_ids per object class
  const trackersByClass = new Map<string, Set<number>>();
  
  events.forEach(event => {
    const className = event.object_class_name || 'Unknown';
    const trackerId = event.tracker_id;
    
    if (trackerId !== null && trackerId !== undefined) {
      if (!trackersByClass.has(className)) {
        trackersByClass.set(className, new Set());
      }
      trackersByClass.get(className)!.add(trackerId);
    }
  });

  // Convert to object counts
  const objectCounts: Record<string, number> = {};
  let uniqueTotal = 0;

  trackersByClass.forEach((trackerIds, className) => {
    const count = trackerIds.size;
    objectCounts[className] = count;
    uniqueTotal += count;
  });

  return {
    objectCounts,
    uniqueTotal,
    totalEvents: events.length,
  };
};

/**
 * Get unique recent detections by deduplicating based on tracker_id
 * Keeps only the most recent detection for each unique tracker_id
 * Used by: ObjectBarChart and other components
 * 
 * @param events - Array of detection events
 * @returns Array of deduplicated detection events
 */
export const getUniqueRecentDetections = (events: DetectionEvent[]): DetectionEvent[] => {
  if (!events || events.length === 0) {
    return [];
  }

  // Create a map to store the most recent event for each tracker_id
  const uniqueDetections = new Map<number, DetectionEvent>();

  events.forEach(event => {
    const trackerId = event.tracker_id;
    
    if (trackerId !== null && trackerId !== undefined) {
      const existing = uniqueDetections.get(trackerId);
      
      if (!existing) {
        // First time seeing this tracker_id
        uniqueDetections.set(trackerId, event);
      } else {
        // Compare timestamps and keep the more recent one
        const existingTime = new Date(existing.timestamp).getTime();
        const currentTime = new Date(event.timestamp).getTime();
        
        if (currentTime > existingTime) {
          uniqueDetections.set(trackerId, event);
        }
      }
    }
  });

  // Convert map values back to array
  return Array.from(uniqueDetections.values());
};

/**
 * Get unique tracker counts by object class
 * Similar to getUniqueObjectCounts but returns in a different format
 * Used by: ObjectBarChart component
 * 
 * @param events - Array of detection events
 * @returns Map of object class name to count of unique trackers
 */
export const getUniqueTrackerCountsByObject = (
  events: DetectionEvent[]
): Map<string, Set<number>> => {
  const trackersByClass = new Map<string, Set<number>>();

  if (!events || events.length === 0) {
    return trackersByClass;
  }

  // First, deduplicate by tracker_id (same as RecentDetections)
  const uniqueDetections = getUniqueRecentDetections(events);

  // Then count how many unique tracker_ids per object class
  uniqueDetections.forEach(event => {
    const className = event.object_class_name || 'Unknown';
    const trackerId = event.tracker_id;

    if (trackerId !== null && trackerId !== undefined) {
      if (!trackersByClass.has(className)) {
        trackersByClass.set(className, new Set());
      }
      trackersByClass.get(className)!.add(trackerId);
    }
  });

  return trackersByClass;
};

/**
 * Get object chart data for pie charts and other visualizations
 * Processes events and returns data formatted for chart libraries with colors and percentages
 * Used by: DetectionPieChart component
 * 
 * @param events - Array of detection events
 * @returns Object with chartData array, totalAll, and totalShown
 */
export const getObjectChartData = (events: DetectionEvent[]) => {
  // Define color palette for pie chart
  const CHART_COLORS = [
    '#8b5cf6', // violet
    '#06b6d4', // cyan
    '#10b981', // emerald
    '#f59e0b', // amber
    '#ef4444', // red
    '#ec4899', // pink
    '#6366f1', // indigo
    '#84cc16', // lime
  ];

  if (!events || events.length === 0) {
    return {
      chartData: [],
      totalAll: 0,
      totalShown: 0,
    };
  }

  // Get unique object counts
  const { objectCounts, uniqueTotal } = getUniqueObjectCounts(events);

  // Convert to array and sort by value (descending)
  const sortedData = Object.entries(objectCounts)
    .map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1), // Capitalize first letter
      value,
    }))
    .sort((a, b) => b.value - a.value);

  // Limit to top 8 categories to avoid clutter
  const MAX_CATEGORIES = 8;
  const topData = sortedData.slice(0, MAX_CATEGORIES);

  // Calculate totals
  const totalAll = uniqueTotal;
  const totalShown = topData.reduce((sum, item) => sum + item.value, 0);

  // Calculate percentages and add colors
  const chartData = topData.map((item, index) => ({
    name: item.name,
    value: item.value,
    percentage: (item.value / totalAll) * 100,
    color: CHART_COLORS[index % CHART_COLORS.length],
  }));

  return {
    chartData,
    totalAll,
    totalShown,
  };
};

/**
 * Calculate average confidence for events
 * 
 * @param events - Array of detection events
 * @returns Average confidence value
 */
export const calculateAverageConfidence = (events: DetectionEvent[]): number => {
  if (!events || events.length === 0) {
    return 0;
  }

  const sum = events.reduce((acc, event) => acc + (event.confidence || 0), 0);
  return Math.round((sum / events.length) * 100) / 100;
};

/**
 * Get events within a time window
 * 
 * @param events - Array of detection events
 * @param startTime - Start time (Date or ISO string)
 * @param endTime - End time (Date or ISO string)
 * @returns Filtered events within the time window
 */
export const getEventsInTimeWindow = (
  events: DetectionEvent[],
  startTime: Date | string,
  endTime: Date | string
): DetectionEvent[] => {
  if (!events || events.length === 0) {
    return [];
  }

  const start = typeof startTime === 'string' ? new Date(startTime).getTime() : startTime.getTime();
  const end = typeof endTime === 'string' ? new Date(endTime).getTime() : endTime.getTime();

  return events.filter(event => {
    const eventTime = new Date(event.timestamp).getTime();
    return eventTime >= start && eventTime <= end;
  });
};

/**
 * Count events by camera
 * 
 * @param events - Array of detection events
 * @returns Map of camera name to event count
 */
export const countEventsByCamera = (events: DetectionEvent[]): Map<string, number> => {
  const counts = new Map<string, number>();

  if (!events || events.length === 0) {
    return counts;
  }

  events.forEach(event => {
    const cameraName = event.camera_name || 'Unknown';
    counts.set(cameraName, (counts.get(cameraName) || 0) + 1);
  });

  return counts;
};

/**
 * Get top N objects by count
 * 
 * @param events - Array of detection events
 * @param limit - Maximum number of objects to return
 * @returns Array of [className, count] tuples sorted by count
 */
export const getTopObjects = (
  events: DetectionEvent[],
  limit: number = 10
): Array<[string, number]> => {
  const { objectCounts } = getUniqueObjectCounts(events);

  return Object.entries(objectCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
};

/**
 * Get hourly distribution of events
 * Used by: Dashboard analytics for hourly charts
 * 
 * @param events - Array of detection events
 * @returns Object mapping hour (0-23) to event count
 */
export const getHourlyDistribution = (events: DetectionEvent[]): Record<string, number> => {
  const distribution: Record<string, number> = {};
  
  // Initialize all hours to 0
  for (let i = 0; i < 24; i++) {
    distribution[String(i)] = 0;
  }

  if (!events || events.length === 0) {
    return distribution;
  }

  events.forEach(event => {
    const hour = new Date(event.timestamp).getHours();
    distribution[String(hour)]++;
  });

  return distribution;
};

/**
 * Get camera activity status
 * Determines which cameras are active based on recent events
 * 
 * @param events - Array of detection events
 * @param thresholdMinutes - Minutes to consider "active" (default: 5)
 * @returns Map of camera name to active status
 */
export const getCameraActivityStatus = (
  events: DetectionEvent[],
  thresholdMinutes: number = 5
): Map<string, boolean> => {
  const activityStatus = new Map<string, boolean>();

  if (!events || events.length === 0) {
    return activityStatus;
  }

  const now = Date.now();
  const threshold = thresholdMinutes * 60 * 1000;

  events.forEach(event => {
    const cameraName = event.camera_name || 'Unknown';
    const eventTime = new Date(event.timestamp).getTime();
    const isRecent = (now - eventTime) <= threshold;

    // If we haven't seen this camera yet, or this event is more recent, update status
    if (!activityStatus.has(cameraName) || isRecent) {
      activityStatus.set(cameraName, isRecent);
    }
  });

  return activityStatus;
};

/**
 * Get unique objects detected per camera
 * Returns camera-specific data with unique object counts
 * Used by: CameraActivity component
 * 
 * @param events - Array of detection events
 * @returns Array of camera data objects
 */
export const getCameraUniqueObjects = (events: DetectionEvent[]) => {
  if (!events || events.length === 0) {
    return [];
  }

  // Group events by camera
  const cameraGroups = groupBy(events, (event) => event.camera_name || 'Unknown');

  // For each camera, calculate unique objects
  const cameraData = Object.entries(cameraGroups).map(([cameraName, cameraEvents], index) => {
    // Get unique tracker IDs for this camera
    const uniqueTrackers = new Set<number>();
    const objectCounts: Record<string, number> = {};

    cameraEvents.forEach(event => {
      const trackerId = event.tracker_id;
      const objectClass = event.object_class_name || 'Unknown';

      if (trackerId !== null && trackerId !== undefined) {
        uniqueTrackers.add(trackerId);
        
        // Count unique objects per class
        if (!objectCounts[objectClass]) {
          objectCounts[objectClass] = 0;
        }
        objectCounts[objectClass]++;
      }
    });

    // Get most recent event time for this camera
    const latestEvent = cameraEvents.reduce((latest, current) => {
      const latestTime = new Date(latest.timestamp).getTime();
      const currentTime = new Date(current.timestamp).getTime();
      return currentTime > latestTime ? current : latest;
    }, cameraEvents[0]);

    // Determine if camera is active (has events in last 5 minutes)
    const now = Date.now();
    const lastEventTime = new Date(latestEvent.timestamp).getTime();
    const isActive = (now - lastEventTime) <= 5 * 60 * 1000; // 5 minutes

    // Return structure matching CameraActivity component expectations
    return {
      id: `camera-${index}`,
      name: cameraName,
      unique_count: uniqueTrackers.size,
      total_events: cameraEvents.length,
      object_counts: objectCounts,
      last_detection: latestEvent.timestamp,
      is_active: isActive,
    };
  });

  // Sort by number of unique objects (descending)
  return cameraData.sort((a, b) => b.unique_count - a.unique_count);
};

/**
 * Format a timestamp as relative time (e.g., "2 minutes ago")
 * Used by: CameraActivity component
 * 
 * @param timestamp - ISO timestamp string or Date
 * @returns Relative time string
 */
export const timeAgo = (timestamp: string | Date): string => {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }

  const weeks = Math.floor(days / 7);
  if (weeks < 4) {
    return `${weeks}w ago`;
  }

  const months = Math.floor(days / 30);
  return `${months}mo ago`;
};