import { Bug, Info, AlertTriangle, AlertCircle, Zap } from 'lucide-react';
import type { LogLevel, LogLevelConfig } from '@/types/system-logs.types';

export const LOG_LEVELS: Record<LogLevel, LogLevelConfig> = {
  DEBUG: {
    color: 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600',
    icon: Bug,
    priority: 1,
  },
  INFO: {
    color: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-700',
    icon: Info,
    priority: 2,
  },
  WARNING: {
    color: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900 dark:text-amber-300 dark:border-amber-700',
    icon: AlertTriangle,
    priority: 3,
  },
  ERROR: {
    color: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900 dark:text-red-300 dark:border-red-700',
    icon: AlertCircle,
    priority: 4,
  },
  CRITICAL: {
    color: 'bg-red-200 text-red-900 border-red-400 dark:bg-red-800 dark:text-red-200 dark:border-red-600',
    icon: Zap,
    priority: 5,
  },
};

export const DEFAULT_PAGE_SIZE = 50;
export const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];
export const MAX_PAGES_DISPLAY = 7;

export const INITIAL_FILTERS = {
  level: '',
  category: '',
  subcategory: '',
  search: '',
  startDate: '',
  endDate: '',
  cameraId: '',
};