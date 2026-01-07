import React from 'react';
import { LOG_LEVELS } from '@/constants/system-logs.constants';
import type { LogLevel } from '@/types/system-logs.types';

interface LogLevelBadgeProps {
  level: LogLevel;
  showIcon?: boolean;
  className?: string;
}

export const LogLevelBadge: React.FC<LogLevelBadgeProps> = ({
  level,
  showIcon = false,
  className = '',
}) => {
  const config = LOG_LEVELS[level] || LOG_LEVELS.INFO;
  const Icon = config.icon;

  return (
    <div
      className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium border ${config.color} ${className}`}
    >
      {showIcon && <Icon className="w-3.5 h-3.5 mr-1.5" />}
      {level}
    </div>
  );
};