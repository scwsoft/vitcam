// utils/detection-images.utils.ts - COMPLETE TIMEZONE FIX

/**
 * Detection Images Utility Functions
 * 
 * COMPLETE FIX: Forces local timezone display in all scenarios
 */

/**
 * Detection type color mapping
 */
const DETECTION_TYPE_COLORS: Record<string, string> = {
  person: 'bg-blue-600',
  car: 'bg-green-600',
  truck: 'bg-orange-600',
  motorcycle: 'bg-purple-600',
  bicycle: 'bg-cyan-600',
  bus: 'bg-yellow-600',
  train: 'bg-red-600',
  all: 'bg-gray-600',
};

/**
 * Get color class for detection type badge
 */
export function getDetectionTypeColor(detectionType: string | undefined | null): string {
  if (!detectionType) {
    return DETECTION_TYPE_COLORS.all;
  }

  const type = detectionType.toLowerCase();
  return DETECTION_TYPE_COLORS[type] || DETECTION_TYPE_COLORS.all;
}

/**
 * Format detection type for display
 */
export function formatDetectionType(detectionType: string | undefined | null): string {
  if (!detectionType) {
    return 'Unknown';
  }

  if (detectionType.toLowerCase() === 'all') {
    return 'All Types';
  }

  return detectionType.charAt(0).toUpperCase() + detectionType.slice(1).toLowerCase();
}

/**
 * Format file size in bytes to human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
}

/**
 * Parse date string and convert to local timezone
 * CRITICAL FIX: Properly handles ISO strings with Z suffix (UTC)
 */
function parseAsLocalDate(dateString: string | Date): Date {
  if (dateString instanceof Date) {
    return dateString;
  }

  // Parse the ISO string - if it has a Z suffix, JavaScript automatically
  // converts it from UTC to local timezone
  return new Date(dateString);
}

/**
 * Format date to local datetime string
 * FIXED: Ensures local timezone display
 * Format: MM/DD/YYYY, H:MM AM/PM
 */
export function formatDate(dateString: string | Date): string {
  const date = parseAsLocalDate(dateString);

  // Manual formatting for full control
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  // Convert to 12-hour format
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 should be 12
  
  return `${month}/${day}/${year}, ${hours}:${minutes} ${ampm}`;
}

/**
 * Format date for display (without time)
 * Example: 11/25/2025
 */
export function formatDateOnly(dateString: string | Date): string {
  const date = parseAsLocalDate(dateString);

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();

  return `${month}/${day}/${year}`;
}

/**
 * Format time for display (without date)
 * Example: 1:44 PM
 */
export function formatTimeOnly(dateString: string | Date): string {
  const date = parseAsLocalDate(dateString);

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  hours = hours % 12;
  hours = hours ? hours : 12;
  
  return `${hours}:${minutes} ${ampm}`;
}

/**
 * Format date and time separately
 * Returns: { date: "11/25/2025", time: "1:44 PM" }
 */
export function formatDateTimeSeparate(dateString: string | Date): { date: string; time: string } {
  return {
    date: formatDateOnly(dateString),
    time: formatTimeOnly(dateString),
  };
}

/**
 * Format confidence as percentage
 */
export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

/**
 * Format time duration (milliseconds to readable format)
 */
export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Parse detection type from filename
 * Example: "20251124_174405_082590_tracker4_car.jpg" -> "car"
 */
export function parseDetectionTypeFromFilename(filename: string): string {
  const parts = filename.replace('.jpg', '').replace('.jpeg', '').split('_');
  
  if (parts.length >= 5) {
    const potentialType = parts[parts.length - 1].toLowerCase();
    
    const knownTypes = ['person', 'car', 'truck', 'motorcycle', 'bicycle', 'bus', 'train'];
    if (knownTypes.includes(potentialType)) {
      return potentialType;
    }
  }
  
  return 'unknown';
}

/**
 * Parse tracker ID from filename
 * Example: "20251124_174405_082590_tracker4_car.jpg" -> 4
 */
export function parseTrackerIdFromFilename(filename: string): number | null {
  const trackerMatch = filename.match(/tracker(\d+)/);
  return trackerMatch ? parseInt(trackerMatch[1], 10) : null;
}

/**
 * Parse timestamp from filename and return as Date object
 * FIXED: Treats filename timestamp as UTC and converts to local
 * Example: "20251124_174405_082590_tracker4_car.jpg" -> Date object (converted to local)
 */
export function parseTimestampFromFilename(filename: string): Date {
  const parts = filename.split('_');
  
  if (parts.length >= 2) {
    const datePart = parts[0]; // YYYYMMDD
    const timePart = parts[1]; // HHMMSS
    
    try {
      const year = datePart.substring(0, 4);
      const month = datePart.substring(4, 6);
      const day = datePart.substring(6, 8);
      
      const hours = timePart.substring(0, 2);
      const minutes = timePart.substring(2, 4);
      const seconds = timePart.substring(4, 6);
      
      // Create UTC ISO string with Z suffix
      const utcString = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
      
      // Parse it - JavaScript will automatically convert UTC to local timezone
      return new Date(utcString);
    } catch (error) {
      console.error('Failed to parse timestamp from filename:', filename, error);
    }
  }
  
  return new Date();
}

/**
 * Generate a unique filename for downloaded images
 */
export function generateDownloadFilename(
  cameraName: string,
  detectionType: string,
  timestamp: string | Date
): string {
  const date = parseAsLocalDate(timestamp);
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  const dateStr = `${year}${month}${day}`;
  const timeStr = `${hours}${minutes}${seconds}`;
  
  const sanitizedCameraName = cameraName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const sanitizedType = detectionType.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  
  return `${sanitizedCameraName}_${sanitizedType}_${dateStr}_${timeStr}.jpg`;
}

/**
 * Check if a date string is valid
 */
export function isValidDate(dateString: string): boolean {
  if (!dateString) return false;
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Compare two dates (for sorting)
 */
export function compareDates(a: string | Date, b: string | Date, ascending = true): number {
  const dateA = parseAsLocalDate(a);
  const dateB = parseAsLocalDate(b);
  
  const result = dateA.getTime() - dateB.getTime();
  return ascending ? result : -result;
}

/**
 * Get relative time string (e.g., "2 hours ago") - LOCAL time
 */
export function getRelativeTime(dateString: string | Date): string {
  const date = parseAsLocalDate(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay > 7) {
    return formatDate(date);
  } else if (diffDay > 0) {
    return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  } else if (diffHour > 0) {
    return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
  } else if (diffMin > 0) {
    return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
}

/**
 * Truncate text to specified length
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Validate detection type
 */
export function isValidDetectionType(type: string): boolean {
  const validTypes = ['all', 'person', 'car', 'truck', 'motorcycle', 'bicycle', 'bus', 'train'];
  return validTypes.includes(type.toLowerCase());
}

/**
 * Convert date to local datetime string for datetime-local input
 * Example: Date object -> "2025-11-25T13:44"
 */
export function toLocalDateTimeString(date: Date | string): string {
  const d = parseAsLocalDate(date);
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Format for display in a compact way
 * Example: "Nov 25, 1:44 PM"
 */
export function formatDateCompact(dateString: string | Date): string {
  const date = parseAsLocalDate(dateString);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const day = date.getDate();
  
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  hours = hours % 12;
  hours = hours ? hours : 12;

  return `${month} ${day}, ${hours}:${minutes} ${ampm}`;
}

/**
 * Debug function to show how a timestamp is being interpreted
 */
export function debugTimestamp(dateString: string | Date): void {
  console.log('=== TIMESTAMP DEBUG ===');
  console.log('Input:', dateString);
  
  const date = parseAsLocalDate(dateString);
  
  console.log('Parsed Date:', date);
  console.log('Local String:', date.toString());
  console.log('ISO String:', date.toISOString());
  console.log('Formatted:', formatDate(date));
  console.log('Year:', date.getFullYear());
  console.log('Month:', date.getMonth() + 1);
  console.log('Day:', date.getDate());
  console.log('Hours:', date.getHours());
  console.log('Minutes:', date.getMinutes());
  console.log('Seconds:', date.getSeconds());
  console.log('Timezone Offset (minutes):', date.getTimezoneOffset());
  console.log('======================');
}