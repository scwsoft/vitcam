// hooks/useWebRTC.ts
import { useRef, useCallback, useState } from 'react';

interface WebRTCConfig {
  iceServers?: RTCIceServer[];
  onTrack?: (event: RTCTrackEvent) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onIceConnectionStateChange?: (state: RTCIceConnectionState) => void;
  onDataChannel?: (channel: RTCDataChannel) => void;
}

export function useWebRTC(config: WebRTCConfig = {}) {
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [iceConnectionState, setIceConnectionState] = useState<RTCIceConnectionState>('new');

  const initializePeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    const pc = new RTCPeerConnection({
      iceServers: config.iceServers || [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    // Set up event handlers
    pc.ontrack = (event) => {
      config.onTrack?.(event);
    };

    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
      config.onConnectionStateChange?.(pc.connectionState);
    };

    pc.oniceconnectionstatechange = () => {
      setIceConnectionState(pc.iceConnectionState);
      config.onIceConnectionStateChange?.(pc.iceConnectionState);
    };

    pc.ondatachannel = (event) => {
      config.onDataChannel?.(event.channel);
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [config]);

  const createOffer = useCallback(async () => {
    if (!peerConnectionRef.current) {
      throw new Error('Peer connection not initialized');
    }

    const offer = await peerConnectionRef.current.createOffer();
    await peerConnectionRef.current.setLocalDescription(offer);
    return offer;
  }, []);

  const createAnswer = useCallback(async () => {
    if (!peerConnectionRef.current) {
      throw new Error('Peer connection not initialized');
    }

    const answer = await peerConnectionRef.current.createAnswer();
    await peerConnectionRef.current.setLocalDescription(answer);
    return answer;
  }, []);

  const setRemoteDescription = useCallback(async (description: RTCSessionDescriptionInit) => {
    if (!peerConnectionRef.current) {
      throw new Error('Peer connection not initialized');
    }

    await peerConnectionRef.current.setRemoteDescription(description);
  }, []);

  const addIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    if (!peerConnectionRef.current) {
      throw new Error('Peer connection not initialized');
    }

    await peerConnectionRef.current.addIceCandidate(candidate);
  }, []);

  const createDataChannel = useCallback((label: string, options?: RTCDataChannelInit) => {
    if (!peerConnectionRef.current) {
      throw new Error('Peer connection not initialized');
    }

    return peerConnectionRef.current.createDataChannel(label, options);
  }, []);

  const close = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
      setConnectionState('closed');
      setIceConnectionState('closed');
    }
  }, []);

  const getStats = useCallback(async () => {
    if (!peerConnectionRef.current) {
      throw new Error('Peer connection not initialized');
    }

    return await peerConnectionRef.current.getStats();
  }, []);

  return {
    peerConnection: peerConnectionRef.current,
    connectionState,
    iceConnectionState,
    initializePeerConnection,
    createOffer,
    createAnswer,
    setRemoteDescription,
    addIceCandidate,
    createDataChannel,
    close,
    getStats
  };
}

// hooks/useWebSocket.ts
import { useRef, useCallback, useState, useEffect } from 'react';

interface WebSocketConfig {
  url: string;
  onOpen?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  onMessage?: (data: any) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export function useWebSocket(config: WebSocketConfig) {
  const websocketRef = useRef<WebSocket | null>(null);
  const [readyState, setReadyState] = useState<number>(WebSocket.CLOSED);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      return websocketRef.current;
    }

    const ws = new WebSocket(config.url);

    ws.onopen = (event) => {
      setReadyState(WebSocket.OPEN);
      setReconnectAttempts(0);
      config.onOpen?.(event);
    };

    ws.onclose = (event) => {
      setReadyState(WebSocket.CLOSED);
      config.onClose?.(event);

      // Auto-reconnect logic
      if (
        !event.wasClean &&
        config.maxReconnectAttempts &&
        reconnectAttempts < config.maxReconnectAttempts
      ) {
        const delay = config.reconnectInterval || 3000;
        reconnectTimeoutRef.current = setTimeout(() => {
          setReconnectAttempts(prev => prev + 1);
          connect();
        }, delay);
      }
    };

    ws.onerror = (event) => {
      setReadyState(WebSocket.CLOSED);
      config.onError?.(event);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        config.onMessage?.(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
        config.onMessage?.(event.data);
      }
    };

    websocketRef.current = ws;
    setReadyState(ws.readyState);
    return ws;
  }, [config, reconnectAttempts]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
      setReadyState(WebSocket.CLOSED);
    }
  }, []);

  const send = useCallback((data: any) => {
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      websocketRef.current.send(message);
      return true;
    }
    return false;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    websocket: websocketRef.current,
    readyState,
    reconnectAttempts,
    connect,
    disconnect,
    send
  };
}

// utils/webrtcUtils.ts
export interface BitrateConfig {
  max_bitrate: number;
  resolution: [number, number];
  fps: number;
  crf: number;
}

export interface WebRTCStats {
  bytesReceived: number;
  packetsReceived: number;
  framesDecoded: number;
  currentBitrate: number;
  timestamp: number;
}

export class WebRTCStatsCollector {
  private lastStats: WebRTCStats | null = null;
  private statsHistory: WebRTCStats[] = [];
  private maxHistoryLength: number;

  constructor(maxHistoryLength = 60) {
    this.maxHistoryLength = maxHistoryLength;
  }

  async collectStats(peerConnection: RTCPeerConnection): Promise<WebRTCStats | null> {
    try {
      const stats = await peerConnection.getStats();
      let inboundStats: any = null;

      stats.forEach((report) => {
        if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
          inboundStats = report;
        }
      });

      if (!inboundStats) {
        return null;
      }

      const currentStats: WebRTCStats = {
        bytesReceived: inboundStats.bytesReceived || 0,
        packetsReceived: inboundStats.packetsReceived || 0,
        framesDecoded: inboundStats.framesDecoded || 0,
        currentBitrate: 0,
        timestamp: Date.now()
      };

      // Calculate bitrate if we have previous stats
      if (this.lastStats) {
        const timeDiff = (currentStats.timestamp - this.lastStats.timestamp) / 1000;
        const bytesDiff = currentStats.bytesReceived - this.lastStats.bytesReceived;
        currentStats.currentBitrate = Math.round((bytesDiff * 8) / timeDiff);
      }

      // Update history
      this.statsHistory.push(currentStats);
      if (this.statsHistory.length > this.maxHistoryLength) {
        this.statsHistory.shift();
      }

      this.lastStats = currentStats;
      return currentStats;
    } catch (error) {
      console.error('Error collecting WebRTC stats:', error);
      return null;
    }
  }

  getAverageBitrate(seconds = 10): number {
    if (this.statsHistory.length < 2) {
      return 0;
    }

    const now = Date.now();
    const cutoff = now - (seconds * 1000);
    const recentStats = this.statsHistory.filter(stat => stat.timestamp > cutoff);

    if (recentStats.length < 2) {
      return this.lastStats?.currentBitrate || 0;
    }

    const totalBitrate = recentStats.reduce((sum, stat) => sum + stat.currentBitrate, 0);
    return Math.round(totalBitrate / recentStats.length);
  }

  getStatsHistory(): WebRTCStats[] {
    return [...this.statsHistory];
  }

  reset(): void {
    this.lastStats = null;
    this.statsHistory = [];
  }
}

export const BITRATE_CONFIGS: Record<string, BitrateConfig> = {
  small_screen: {
    max_bitrate: 140000,
    resolution: [320, 240],
    fps: 15,
    crf: 28
  },
  full_screen: {
    max_bitrate: 1200000,
    resolution: [640, 480],
    fps: 25,
    crf: 23
  }
};

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatBitrate(bps: number): string {
  if (bps === 0) return '0 bps';
  
  const k = 1000;
  const sizes = ['bps', 'kbps', 'Mbps', 'Gbps'];
  const i = Math.floor(Math.log(bps) / Math.log(k));
  
  return parseFloat((bps / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function detectScreenSize(): 'small_screen' | 'full_screen' {
  if (typeof window === 'undefined') {
    return 'full_screen';
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const isMobile = width <= 768 || height <= 600;
  
  return isMobile ? 'small_screen' : 'full_screen';
}

export function isFullscreenSupported(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }

  return !!(
    document.fullscreenEnabled ||
    (document as any).webkitFullscreenEnabled ||
    (document as any).mozFullScreenEnabled ||
    (document as any).msFullscreenEnabled
  );
}

// components/ConnectionStatus.tsx
import React from 'react';

interface ConnectionStatusProps {
  status: 'disconnected' | 'connecting' | 'connected' | 'failed';
  className?: string;
}

export function ConnectionStatus({ status, className = '' }: ConnectionStatusProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          text: 'Connected',
          className: 'status-connected',
          icon: '🟢'
        };
      case 'connecting':
        return {
          text: 'Connecting...',
          className: 'status-connecting',
          icon: '🟡'
        };
      case 'failed':
        return {
          text: 'Failed',
          className: 'status-failed',
          icon: '🔴'
        };
      default:
        return {
          text: 'Disconnected',
          className: 'status-disconnected',
          icon: '⚫'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <span className={`status-indicator ${config.className} ${className}`}>
      <span className="mr-1">{config.icon}</span>
      {config.text}
    </span>
  );
}

// components/BitrateChart.tsx
import React, { useEffect, useRef } from 'react';
import { WebRTCStats } from '../utils/webrtcUtils';

interface BitrateChartProps {
  stats: WebRTCStats[];
  width?: number;
  height?: number;
  className?: string;
}

export function BitrateChart({ stats, width = 300, height = 100, className = '' }: BitrateChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || stats.length < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Calculate scale
    const maxBitrate = Math.max(...stats.map(s => s.currentBitrate));
    const minBitrate = Math.min(...stats.map(s => s.currentBitrate));
    const bitrateRange = maxBitrate - minBitrate || 1;

    // Draw grid
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    
    // Horizontal grid lines
    for (let i = 0; i <= 4; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw bitrate line
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();

    stats.forEach((stat, index) => {
      const x = (width / (stats.length - 1)) * index;
      const y = height - ((stat.currentBitrate - minBitrate) / bitrateRange) * height;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw points
    ctx.fillStyle = '#3b82f6';
    stats.forEach((stat, index) => {
      const x = (width / (stats.length - 1)) * index;
      const y = height - ((stat.currentBitrate - minBitrate) / bitrateRange) * height;
      
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, 2 * Math.PI);
      ctx.fill();
    });
  }, [stats, width, height]);

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="border border-gray-200 rounded"
      />
    </div>
  );
}