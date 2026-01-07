import { useState, useCallback, useRef, useEffect } from 'react';
import type { SignalingServerConfig, WebSocketState } from '@/types/settings.types';
import { buildWebSocketUrl } from '@/utils/settings.utils';

interface UseWebSocketOptions {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: string) => void;
}

export const useWebSocket = ({
  onConnected,
  onDisconnected,
  onError,
}: UseWebSocketOptions = {}) => {
  const [wsState, setWsState] = useState<WebSocketState>({
    connected: false,
    instance: null,
  });
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    setWsState({ connected: false, instance: null });
  }, []);

  const connect = useCallback(
    (config: SignalingServerConfig) => {
      disconnect();

      try {
        const url = buildWebSocketUrl(config);
        const ws = new WebSocket(url);

        ws.onopen = () => {
          console.log('WebSocket connected:', url);
          setWsState({ connected: true, instance: ws });
          onConnected?.();
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          onError?.('Failed to connect to signaling server');
        };

        ws.onclose = () => {
          console.log('WebSocket disconnected');
          setWsState({ connected: false, instance: null });
          onDisconnected?.();
        };

        wsRef.current = ws;
      } catch (error) {
        console.error('WebSocket connection error:', error);
        onError?.('Invalid WebSocket configuration');
      }
    },
    [disconnect, onConnected, onDisconnected, onError]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    wsState,
    connect,
    disconnect,
  };
};