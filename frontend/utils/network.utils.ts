import { NETWORK_CONSTANTS, CONNECTION_TYPE_COLORS, SPEED_THRESHOLDS } from '@/constants/network.constants';
import { ConnectionType } from '@/types/network.types';

export const getConnectionTypeColor = (type: string | null): string => {
  if (!type) return CONNECTION_TYPE_COLORS.default;
  return CONNECTION_TYPE_COLORS[type as keyof typeof CONNECTION_TYPE_COLORS] || CONNECTION_TYPE_COLORS.default;
};

export const getSpeedColor = (speed: number): string => {
  if (speed >= SPEED_THRESHOLDS.FAST) {
    return 'text-green-600 dark:text-green-400';
  }
  if (speed >= SPEED_THRESHOLDS.MEDIUM) {
    return 'text-orange-600 dark:text-orange-400';
  }
  return 'text-red-600 dark:text-red-400';
};

export const formatTimestamp = (): string => {
  return new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const calculateSpeed = (bytes: number, durationMs: number): number => {
  const durationSeconds = durationMs / 1000;
  const bitsLoaded = bytes * NETWORK_CONSTANTS.BITS_PER_BYTE;
  const speedBps = bitsLoaded / durationSeconds;
  const speedMbps = speedBps / NETWORK_CONSTANTS.BYTES_PER_MEGABIT;
  return parseFloat(speedMbps.toFixed(2));
};