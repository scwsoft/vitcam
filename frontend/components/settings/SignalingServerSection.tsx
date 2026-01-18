import { Server, Wifi, WifiOff, AlertCircle } from 'lucide-react';
import type { SignalingServerConfig, ValidationErrors } from '@/types/settings.types';
import { WEBSOCKET_URL_EXAMPLES } from '@/constants/settings.constants';

interface SignalingServerSectionProps {
  config: SignalingServerConfig;
  errors: ValidationErrors;
  connected: boolean;
  onConfigChange: (config: SignalingServerConfig) => void;
  onValidateField: (field: string, value: string) => void;
  onConnect: () => void;
}

export const SignalingServerSection = ({
  config,
  errors,
  connected,
  onConfigChange,
  onValidateField,
  onConnect,
}: SignalingServerSectionProps) => {
  const handleFieldChange = (field: keyof SignalingServerConfig, value: string) => {
    onConfigChange({ ...config, [field]: value });
  };

  const isFormValid = !errors.ip && !errors.port;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Server className="w-6 h-6 text-blue-600 dark:text-blue-400 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            ViTCam Server
          </h2>
        </div>
        <div className="flex items-center">
          {connected ? (
            <div className="flex items-center text-green-600 dark:text-green-400">
              <Wifi className="w-5 h-5 mr-2" />
              <span className="text-sm font-medium">Connected</span>
            </div>
          ) : (
            <div className="flex items-center text-gray-400 dark:text-gray-500">
              <WifiOff className="w-5 h-5 mr-2" />
              <span className="text-sm font-medium">Disconnected</span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Server URL
          </label>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Protocol
              </label>
              <select
                value={config.protocol}
                onChange={(e) => handleFieldChange('protocol', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="ws">ws://</option>
                <option value="wss">wss://</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                IP Address / Hostname
              </label>
              <input
                type="text"
                value={config.ip}
                onChange={(e) => handleFieldChange('ip', e.target.value)}
                onBlur={(e) => onValidateField('ip', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                  errors.ip
                    ? 'border-red-300 dark:border-red-600 focus:ring-red-500'
                    : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
                }`}
                placeholder="192.168.68.109"
              />
              {errors.ip && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400 flex items-center">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {errors.ip}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Port
              </label>
              <input
                type="text"
                value={config.port}
                onChange={(e) => handleFieldChange('port', e.target.value)}
                onBlur={(e) => onValidateField('port', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                  errors.port
                    ? 'border-red-300 dark:border-red-600 focus:ring-red-500'
                    : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
                }`}
                placeholder="8765"
              />
              {errors.port && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400 flex items-center">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {errors.port}
                </p>
              )}
            </div>
          </div>

          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="font-medium">Examples:</span>
            <div className="mt-1 space-y-1">
              {WEBSOCKET_URL_EXAMPLES.map((example) => (
                <div key={example}>• {example}</div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={onConnect}
            disabled={!isFormValid}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Connect
          </button>
        </div>
      </div>
    </div>
  );
};