export function timeAgo(timestamp: string): string {
  const now = new Date().getTime()
  const past = new Date(timestamp).getTime()
  const diffMs = now - past
  
  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return `${seconds}s ago`
}

export function formatConfidence(confidence: number): string {
  return `${(confidence * 100).toFixed(1)}%`
}

export function truncateText(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text
}


/**
 * Format Utilities
 * Common formatting functions for the application
 */

/**
 * Format bytes to human-readable size (MB, GB, TB)
 * @param bytes - The number of bytes to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with appropriate unit
 * 
 * @example
 * formatBytes(770336737.28) // "734.77 MB"
 * formatBytes(1073741824) // "1.00 GB"
 * formatBytes(1099511627776) // "1.00 TB"
 */
export const formatBytes = (bytes: number, decimals: number = 2): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  const value = parseFloat((bytes / Math.pow(k, i)).toFixed(decimals));
  
  return `${value} ${sizes[i]}`;
};

/**
 * Format duration in seconds to human-readable format
 * @param seconds - Duration in seconds
 * @returns Formatted string (e.g., "1h 23m 45s", "5m 30s", "45s")
 * 
 * @example
 * formatDuration(3665) // "1h 1m 5s"
 * formatDuration(125) // "2m 5s"
 * formatDuration(45) // "45s"
 */
export const formatDuration = (seconds: number): string => {
  if (seconds < 60) {
    return `${Math.floor(seconds)}s`;
  }
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0) parts.push(`${secs}s`);
  
  return parts.join(' ');
};

/**
 * Format number with thousand separators
 * @param value - Number to format
 * @returns Formatted string with commas
 * 
 * @example
 * formatNumber(1234567) // "1,234,567"
 * formatNumber(1000) // "1,000"
 */
export const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('en-US').format(value);
};

/**
 * Format percentage with specified decimal places
 * @param value - Number between 0-100
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage string
 * 
 * @example
 * formatPercentage(75.5) // "75.5%"
 * formatPercentage(33.333, 2) // "33.33%"
 */
export const formatPercentage = (value: number, decimals: number = 1): string => {
  return `${value.toFixed(decimals)}%`;
};