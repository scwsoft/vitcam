export type NotificationType = 'success' | 'error' | 'info';

export interface NotificationState {
  isOpen: boolean;
  title: string;
  message: string;
  type: NotificationType;
}

export interface SignalingServerConfig {
  protocol: 'ws' | 'wss';
  ip: string;
  port: string;
  name: string;
}

export interface DateTimeSettings {
  enabled: boolean;
  format: string;
}

export interface GeneralSettings {
  signalingServer: SignalingServerConfig;
  dateTimeSettings: DateTimeSettings;
}

export interface ValidationErrors {
  [key: string]: string;
}

export interface WebSocketState {
  connected: boolean;
  instance: WebSocket | null;
}