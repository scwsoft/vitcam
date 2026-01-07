import { User } from '@supabase/supabase-js';

export interface NetworkStats {
  downlink: number | null;
  effectiveType: string | null;
  rtt: number | null;
  saveData: boolean;
}

export interface SpeedTest {
  downloadSpeed: number | null;
  latency: number | null;
  isRunning: boolean;
}

export interface ConnectionHistoryItem {
  timestamp: string;
  downloadSpeed: number | null;
  latency: number | null;
  effectiveType: string | null;
}

export interface NetworkMonitorProps {
  user: User;
}

export interface AuthFormProps {
  onAuth: (user: User) => void;
}

export type ConnectionType = '4g' | '3g' | '2g' | 'slow-2g' | null;