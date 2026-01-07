import { VALIDATION_MESSAGES } from '@/constants/settings.constants';
import type { SignalingServerConfig, ValidationErrors } from '@/types/settings.types';

export const isValidIP = (ip: string): boolean => {
  if (!ip.trim()) return false;
  
  // Allow localhost and domain names
  if (ip === 'localhost' || /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(ip)) {
    return true;
  }
  
  // Validate IPv4
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Pattern.test(ip)) return false;
  
  return ip.split('.').every(octet => {
    const num = parseInt(octet, 10);
    return num >= 0 && num <= 255;
  });
};

export const isValidPort = (port: string): boolean => {
  if (!port.trim()) return false;
  const portNum = parseInt(port, 10);
  return !isNaN(portNum) && portNum >= 1 && portNum <= 65535;
};

export const validateSignalingServer = (
  config: SignalingServerConfig
): ValidationErrors => {
  const errors: ValidationErrors = {};

  if (!isValidIP(config.ip)) {
    errors.ip = VALIDATION_MESSAGES.INVALID_IP;
  }

  if (!isValidPort(config.port)) {
    errors.port = VALIDATION_MESSAGES.INVALID_PORT;
  }

  return errors;
};

export const buildWebSocketUrl = (config: SignalingServerConfig): string => {
  return `${config.protocol}://${config.ip}:${config.port}`;
};