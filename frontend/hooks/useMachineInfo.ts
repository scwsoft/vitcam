// hooks/useMachineInfo.ts
import { useState, useEffect, useCallback, useRef } from 'react';

export interface MachineInfoData {
  cpu: {
    usage: number;
    temp: number;
    cores: number;
    model: string;
  };
  memory: {
    usage: number;
    total: string;
    free: string;
    used: string;
  };
  disk: {
    usage: number;
    total: string;
    free: string;
    used: string;
  };
  network: {
    status: 'active' | 'idle' | 'error';
    interfaces: Array<{
      name: string;
      address: string;
      status: string;
    }>;
  };
  system: {
    platform: string;
    arch: string;
    uptime: number;
    hostname: string;
    nodeVersion: string;
  };
  timestamp: string;
}

interface UseMachineInfoOptions {
  refreshInterval?: number; // in milliseconds
  enabled?: boolean;
  onError?: (error: Error) => void;
  retryAttempts?: number;
  retryDelay?: number;
}

interface UseMachineInfoReturn {
  data: MachineInfoData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  lastUpdated: Date | null;
}

export const useMachineInfo = (options: UseMachineInfoOptions = {}): UseMachineInfoReturn => {
  const {
    refreshInterval = 30000, // 30 seconds default
    enabled = true,
    onError,
    retryAttempts = 3,
    retryDelay = 10000
  } = options;

  const [data, setData] = useState<MachineInfoData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef<boolean>(true);
  
  // Store options in refs so interval always uses latest values
  const optionsRef = useRef({ retryAttempts, retryDelay, onError });
  useEffect(() => {
    optionsRef.current = { retryAttempts, retryDelay, onError };
  }, [retryAttempts, retryDelay, onError]);

  // Fetch function stored in ref so interval can always call latest version
  const fetchMachineInfoRef = useRef<(attempt?: number) => Promise<void>>();
  
  fetchMachineInfoRef.current = async (attempt = 1): Promise<void> => {
    if (!isMountedRef.current) return;

    try {
      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();

      setLoading(true);
      setError(null);

      const response = await fetch('/api/machine-info', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: abortControllerRef.current.signal,
        cache: 'no-cache'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const machineData: MachineInfoData = await response.json();
      
      if (isMountedRef.current) {
        setData(machineData);
        setLastUpdated(new Date());
        setError(null);
        console.log('Machine info updated at:', new Date().toISOString());
      }
      
    } catch (err) {
      // Don't treat abort as an error
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      if (!isMountedRef.current) return;

      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch machine info';
      
      // Retry logic
      if (attempt < optionsRef.current.retryAttempts) {
        console.warn(`Machine info fetch attempt ${attempt} failed, retrying...`, errorMessage);
        
        retryTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current && fetchMachineInfoRef.current) {
            fetchMachineInfoRef.current(attempt + 1);
          }
        }, optionsRef.current.retryDelay * attempt);
        
        return;
      }

      // Final error after all retries
      setError(errorMessage);
      if (optionsRef.current.onError) {
        optionsRef.current.onError(err instanceof Error ? err : new Error(errorMessage));
      }
      
      console.error('Failed to fetch machine info after all retries:', errorMessage);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const refetch = useCallback(async (): Promise<void> => {
    if (fetchMachineInfoRef.current) {
      await fetchMachineInfoRef.current();
    }
  }, []);

  // Setup interval for fetching - only recreate when interval or enabled changes
  useEffect(() => {
    isMountedRef.current = true;
    
    console.log('Setting up machine info polling with interval:', refreshInterval, 'enabled:', enabled);

    if (!enabled) {
      console.log('Polling disabled');
      return;
    }

    // Initial fetch
    if (fetchMachineInfoRef.current) {
      console.log('Performing initial fetch');
      fetchMachineInfoRef.current();
    }

    // Setup interval for subsequent fetches
    if (refreshInterval > 0) {
      console.log('Setting up interval for', refreshInterval, 'ms');
      intervalRef.current = setInterval(() => {
        console.log('Interval tick - fetching machine info at:', new Date().toISOString());
        if (fetchMachineInfoRef.current) {
          fetchMachineInfoRef.current();
        }
      }, refreshInterval);
    }

    // Cleanup function
    return () => {
      console.log('Cleaning up machine info polling');
      isMountedRef.current = false;
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [enabled, refreshInterval]); // Only depend on interval and enabled

  // Handle visibility change to resume when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabled && isMountedRef.current) {
        console.log('Tab became visible - fetching machine info');
        if (fetchMachineInfoRef.current) {
          fetchMachineInfoRef.current();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled]);

  return {
    data,
    loading,
    error,
    refetch,
    lastUpdated
  };
};

// Additional utility hooks for specific metrics
export const useCpuInfo = (options?: UseMachineInfoOptions) => {
  const { data, loading, error, refetch, lastUpdated } = useMachineInfo(options);
  
  return {
    cpu: data?.cpu || null,
    loading,
    error,
    refetch,
    lastUpdated
  };
};

export const useMemoryInfo = (options?: UseMachineInfoOptions) => {
  const { data, loading, error, refetch, lastUpdated } = useMachineInfo(options);
  
  return {
    memory: data?.memory || null,
    loading,
    error,
    refetch,
    lastUpdated
  };
};

export const useDiskInfo = (options?: UseMachineInfoOptions) => {
  const { data, loading, error, refetch, lastUpdated } = useMachineInfo(options);
  
  return {
    disk: data?.disk || null,
    loading,
    error,
    refetch,
    lastUpdated
  };
};

export const useNetworkInfo = (options?: UseMachineInfoOptions) => {
  const { data, loading, error, refetch, lastUpdated } = useMachineInfo(options);
  
  return {
    network: data?.network || null,
    loading,
    error,
    refetch,
    lastUpdated
  };
};

// Utility function to format uptime
export const formatUptime = (seconds: number): string => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
};

// Utility function to get status color classes
export const getStatusColors = (value: number) => {
  if (value < 50) return { bg: 'bg-blue-600', text: 'text-blue-600', ring: 'ring-blue-600/20' };
  if (value < 80) return { bg: 'bg-amber-500', text: 'text-amber-500', ring: 'ring-amber-500/20' };
  return { bg: 'bg-red-500', text: 'text-red-500', ring: 'ring-red-500/20' };
};

export const getTempColors = (temp: number) => {
  if (temp < 60) return { bg: 'bg-blue-600', text: 'text-blue-600', ring: 'ring-blue-600/20' };
  if (temp < 70) return { bg: 'bg-amber-500', text: 'text-amber-500', ring: 'ring-amber-500/20' };
  return { bg: 'bg-red-500', text: 'text-red-500', ring: 'ring-red-500/20' };
};