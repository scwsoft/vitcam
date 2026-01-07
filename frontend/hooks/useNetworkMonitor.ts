import { useState, useEffect, useCallback } from 'react';
import { NetworkStats, SpeedTest, ConnectionHistoryItem } from '@/types/network.types';
import { NetworkService } from '@/services/network.service';
import { formatTimestamp } from '@/utils/network.utils';

export const useNetworkMonitor = () => {
  const [networkStats, setNetworkStats] = useState<NetworkStats>({
    downlink: null,
    effectiveType: null,
    rtt: null,
    saveData: false,
  });

  const [speedTest, setSpeedTest] = useState<SpeedTest>({
    downloadSpeed: null,
    latency: null,
    isRunning: false,
  });

  const [connectionHistory, setConnectionHistory] = useState<ConnectionHistoryItem[]>([]);

  const updateNetworkInfo = useCallback(() => {
    const info = NetworkService.getNetworkInfo();
    if (info) {
      setNetworkStats(info);
    }
  }, []);

  const runSpeedTest = useCallback(async () => {
    setSpeedTest((prev) => ({ ...prev, isRunning: true }));

    try {
      const [downloadSpeed, latency] = await Promise.all([
        NetworkService.measureDownloadSpeed(),
        NetworkService.measureLatency(),
      ]);

      setSpeedTest({
        downloadSpeed,
        latency,
        isRunning: false,
      });

      const historyItem: ConnectionHistoryItem = {
        timestamp: formatTimestamp(),
        downloadSpeed,
        latency,
        effectiveType: networkStats.effectiveType,
      };

      setConnectionHistory((prev) => [...prev, historyItem]);
    } catch (error) {
      console.error('Speed test failed:', error);
      setSpeedTest({
        downloadSpeed: null,
        latency: null,
        isRunning: false,
      });
    }
  }, [networkStats.effectiveType]);

  useEffect(() => {
    updateNetworkInfo();

    if ('connection' in navigator) {
      const connection = (navigator as any).connection || 
                        (navigator as any).mozConnection || 
                        (navigator as any).webkitConnection;

      if (connection) {
        connection.addEventListener('change', updateNetworkInfo);
        return () => {
          connection.removeEventListener('change', updateNetworkInfo);
        };
      }
    }
  }, [updateNetworkInfo]);

  return {
    networkStats,
    speedTest,
    connectionHistory,
    runSpeedTest,
  };
};