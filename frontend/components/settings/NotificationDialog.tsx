import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle, X } from 'lucide-react';
import type { NotificationState } from '@/types/settings.types';
import { NOTIFICATION_AUTO_CLOSE_DELAY } from '@/constants/settings.constants';

interface NotificationDialogProps {
  notification: NotificationState;
  onClose: () => void;
}

const NotificationIcon = ({ type }: { type: NotificationState['type'] }) => {
  const iconClass = 'w-6 h-6 mr-3';
  
  switch (type) {
    case 'success':
      return <CheckCircle className={`${iconClass} text-green-600 dark:text-green-400`} />;
    case 'error':
      return <AlertCircle className={`${iconClass} text-red-600 dark:text-red-400`} />;
    default:
      return <AlertCircle className={`${iconClass} text-blue-600 dark:text-blue-400`} />;
  }
};

const getHeaderStyles = (type: NotificationState['type']) => {
  const baseStyles = 'px-6 py-4 rounded-t-xl';
  const typeStyles = {
    success: 'bg-green-50 dark:bg-green-900/20',
    error: 'bg-red-50 dark:bg-red-900/20',
    info: 'bg-blue-50 dark:bg-blue-900/20',
  };
  return `${baseStyles} ${typeStyles[type]}`;
};

const getTitleStyles = (type: NotificationState['type']) => {
  const baseStyles = 'text-lg font-semibold';
  const typeStyles = {
    success: 'text-green-900 dark:text-green-100',
    error: 'text-red-900 dark:text-red-100',
    info: 'text-blue-900 dark:text-blue-100',
  };
  return `${baseStyles} ${typeStyles[type]}`;
};

const getButtonStyles = (type: NotificationState['type']) => {
  const baseStyles = 'px-6 py-2 rounded-lg text-white font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 hover:scale-105';
  const typeStyles = {
    success: 'bg-green-600 hover:bg-green-700 focus:ring-green-500',
    error: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
    info: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
  };
  return `${baseStyles} ${typeStyles[type]}`;
};

export const NotificationDialog = ({ notification, onClose }: NotificationDialogProps) => {
  const { isOpen, title, message, type } = notification;

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && type === 'success') {
      const timer = setTimeout(onClose, NOTIFICATION_AUTO_CLOSE_DELAY);
      return () => clearTimeout(timer);
    }
  }, [isOpen, type, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative z-10 w-full max-w-md mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-2xl transform transition-all duration-200 scale-100 opacity-100">
        <div className={getHeaderStyles(type)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <NotificationIcon type={type} />
              <h3 className={getTitleStyles(type)}>{title}</h3>
            </div>
            <button
              onClick={onClose}
              className="ml-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="px-6 py-4">
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{message}</p>
        </div>
        
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 rounded-b-xl">
          <div className="flex justify-end">
            <button onClick={onClose} className={getButtonStyles(type)}>
              OK
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};