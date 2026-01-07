'use client';

import { Settings, Save } from 'lucide-react';
import { useSettings, useNotification, useWebSocket } from '@/hooks/settings.index';
import {
  NotificationDialog,
  SignalingServerSection,
  DateTimeSection,
  SystemManagementSection,
} from '@/components/settings';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';


export default function GeneralSettings() {
  const {
    loading,
    isSubmitting,
    signalingServer,
    dateTimeSettings,
    errors,
    setSignalingServer,
    setDateTimeSettings,
    validateField,
    isFormValid,
    saveSettings,
    clearLogs,
    clearAnalytics,
    clearRecordings,
    clearDetectionImages,
  } = useSettings();

  const { notification, showNotification, hideNotification } = useNotification();
  const { user } = useAuth();
  const router = useRouter();  

  const { wsState, connect } = useWebSocket({
    onConnected: () => {
      showNotification('Connected', 'Successfully connected to signaling server', 'success');
    },
    onDisconnected: () => {
      showNotification('Disconnected', 'Connection to signaling server lost', 'info');
    },
    onError: (error) => {
      showNotification('Connection Failed', error, 'error');
    },
  });

  const handleConnect = () => {
    connect(signalingServer);
  };

  const handleSaveSettings = async () => {
    const success = await saveSettings();
    if (success) {
      showNotification('Settings Saved', 'Your settings have been saved successfully', 'success');
    } else {
      showNotification('Save Failed', 'Failed to save settings. Please try again.', 'error');
    }
  };

  const handleClearLogs = async () => {
    const success = await clearLogs();
    if (success) {
      showNotification('Logs Cleared', 'All system logs have been cleared successfully', 'success');
    } else {
      showNotification('Clear Failed', 'Failed to clear logs. Please try again.', 'error');
    }
  };

  const handleClearRecordings = async () => {
    const success = await clearRecordings();
    if (success) {
      showNotification('Recordings Cleared', 'All recordings have been deleted successfully', 'success');
    } else {
      showNotification('Clear Failed', 'Failed to clear recordings. Please try again.', 'error');
    }
  };

  const handleClearAnalytics = async () => {
    const success = await clearAnalytics();
    if (success) {
      showNotification('Analytics Cleared', 'All analytics data have been deleted successfully', 'success');
    } else {
      showNotification('Clear Failed', 'Failed to clear analytics data. Please try again.', 'error');
    }
  };

  const handleClearDetectionImages = async () => {
    const success = await clearDetectionImages();
    if (success) {
      showNotification('Detection Images Cleared', 'All detection images have been deleted successfully', 'success');
    } else {
      showNotification('Clear Failed', 'Failed to clear detection images. Please try again.', 'error');
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return user ? (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center">
            <Settings className="w-8 h-8 text-blue-600 dark:text-blue-400 mr-3" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">General Settings</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Configure your system preferences and connections
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SignalingServerSection
            config={signalingServer}
            errors={errors}
            connected={wsState.connected}
            onConfigChange={setSignalingServer}
            onValidateField={validateField}
            onConnect={handleConnect}
          />

          <DateTimeSection
            settings={dateTimeSettings}
            onChange={setDateTimeSettings}
          />

          <SystemManagementSection
            isSubmitting={isSubmitting}
            onClearLogs={handleClearLogs}
            onClearAnalytics={handleClearAnalytics}
            onClearRecordings={handleClearRecordings}
            onClearDetectionImages={handleClearDetectionImages}
          />
        </div>

        <div className="mt-6">
          <div className="flex justify-end space-x-3">
            <button
              onClick={handleSaveSettings}
              disabled={isSubmitting || !isFormValid()}
              className="flex items-center px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5 mr-2" />
              {isSubmitting ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>

      <NotificationDialog notification={notification} onClose={hideNotification} />
    </div>
  ) : 
  router.push('/signin');
}