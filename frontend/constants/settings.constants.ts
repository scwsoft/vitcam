export const DATE_FORMAT_OPTIONS = [
  'YYYY-MM-DD HH:mm:ss',
  'DD/MM/YYYY HH:mm:ss',
  'MM/DD/YYYY HH:mm:ss',
  'DD-MM-YYYY HH:mm',
  'YYYY/MM/DD HH:mm',
  'MMM DD, YYYY HH:mm',
] as const;

export const FORMAT_EXAMPLES: Record<string, string> = {
  'YYYY-MM-DD HH:mm:ss': '2024-03-15 14:30:25',
  'DD/MM/YYYY HH:mm:ss': '15/03/2024 14:30:25',
  'MM/DD/YYYY HH:mm:ss': '03/15/2024 14:30:25',
  'DD-MM-YYYY HH:mm': '15-03-2024 14:30',
  'YYYY/MM/DD HH:mm': '2024/03/15 14:30',
  'MMM DD, YYYY HH:mm': 'Mar 15, 2024 14:30',
};

export const DEFAULT_SIGNALING_SERVER = {
  protocol: 'ws' as const,
  ip: 'localhost',
  port: '8765',
  name: '',
};

export const DEFAULT_DATETIME_SETTINGS = {
  enabled: true,
  format: 'YYYY-MM-DD HH:mm:ss',
};

export const WEBSOCKET_URL_EXAMPLES = [
  'ws://192.168.68.109:8765',
  'wss://192.168.68.109:8765',
  'ws://localhost:8765',
];

export const NOTIFICATION_AUTO_CLOSE_DELAY = 3000;

export const VALIDATION_MESSAGES = {
  INVALID_IP: 'Please enter a valid IP address or hostname',
  INVALID_PORT: 'Port must be a number between 1 and 65535',
  REQUIRED_FIELD: 'This field is required',
};