export type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface SystemLog {
  id: string;
  timestamp: string;
  level: LogLevel;
  category: string;
  subcategory?: string;
  message: string;
  camera_id?: string;
  session_id?: string;
  source_file?: string;
  details?: Record<string, unknown>;
  stack_trace?: string;
}

export interface LogFilters {
  level: string;
  category: string;
  subcategory: string;
  search: string;
  startDate: string;
  endDate: string;
  cameraId: string;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface LogLevelConfig {
  color: string;
  icon: React.ComponentType<{ className?: string }>;
  priority: number;
}

export interface UseSystemLogsReturn {
  logs: SystemLog[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  categories: string[];
  subcategories: string[];
  fetchLogs: () => Promise<void>;
  exportLogs: () => Promise<void>;
}

export interface UseAuthReturn {
  user: any;
  loading: boolean;
  error: string | null;
  checkAuth: () => Promise<void>;
  validateAuth: () => boolean;
}