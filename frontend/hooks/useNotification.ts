import { useState, useCallback } from 'react';
import type { NotificationState, NotificationType } from '@/types/settings.types';

export const useNotification = () => {
  const [notification, setNotification] = useState<NotificationState>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });

  const showNotification = useCallback(
    (title: string, message: string, type: NotificationType = 'info') => {
      setNotification({ isOpen: true, title, message, type });
    },
    []
  );

  const hideNotification = useCallback(() => {
    setNotification(prev => ({ ...prev, isOpen: false }));
  }, []);

  return {
    notification,
    showNotification,
    hideNotification,
  };
};