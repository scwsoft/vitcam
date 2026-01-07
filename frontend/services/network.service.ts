import { NETWORK_CONSTANTS } from '@/constants/network.constants';
import { calculateSpeed } from '@/utils/network.utils';

export class NetworkService {
  static async measureDownloadSpeed(): Promise<number | null> {
    try {
      const startTime = performance.now();
      const response = await fetch(NETWORK_CONSTANTS.SPEED_TEST_URL, {
        cache: 'no-cache',
      });
      await response.blob();
      const endTime = performance.now();

      const duration = endTime - startTime;
      return calculateSpeed(NETWORK_CONSTANTS.TEST_FILE_SIZE_BYTES, duration);
    } catch (error) {
      console.error('Download speed measurement failed:', error);
      return null;
    }
  }

  static async measureLatency(): Promise<number | null> {
    try {
      const startTime = performance.now();
      await fetch(NETWORK_CONSTANTS.LATENCY_TEST_URL, {
        cache: 'no-cache',
        method: 'HEAD',
      });
      const endTime = performance.now();
      return Math.round(endTime - startTime);
    } catch (error) {
      console.error('Latency measurement failed:', error);
      return null;
    }
  }

  static getNetworkInfo() {
    if (!('connection' in navigator)) {
      return null;
    }

    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;

    if (!connection) {
      return null;
    }

    return {
      downlink: connection.downlink || null,
      effectiveType: connection.effectiveType || null,
      rtt: connection.rtt || null,
      saveData: connection.saveData || false,
    };
  }
}