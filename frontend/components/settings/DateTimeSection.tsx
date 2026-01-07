import { Calendar } from 'lucide-react';
import type { DateTimeSettings } from '@/types/settings.types';
import { DATE_FORMAT_OPTIONS, FORMAT_EXAMPLES } from '@/constants/settings.constants';

interface DateTimeSectionProps {
  settings: DateTimeSettings;
  onChange: (settings: DateTimeSettings) => void;
}

export const DateTimeSection = ({ settings, onChange }: DateTimeSectionProps) => {
  const handleToggle = (enabled: boolean) => {
    onChange({ ...settings, enabled });
  };

  const handleFormatChange = (format: string) => {
    onChange({ ...settings, format });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center mb-4">
        <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400 mr-2" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Date & Time Display
        </h2>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Show date and time on camera
          </span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => handleToggle(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-gray-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 dark:peer-checked:bg-blue-600" />
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Date Format
          </label>
          <select
            value={settings.format}
            onChange={(e) => handleFormatChange(e.target.value)}
            disabled={!settings.enabled}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {DATE_FORMAT_OPTIONS.map((format) => (
              <option key={format} value={format}>
                {format}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-md">
          <span className="text-xs text-gray-600 dark:text-gray-400">Preview:</span>
          <div className="text-sm font-mono text-gray-800 dark:text-gray-200 mt-1">
            {settings.enabled ? FORMAT_EXAMPLES[settings.format] || '2024-03-15 14:30:25' : 'Disabled'}
          </div>
        </div>
      </div>
    </div>
  );
};