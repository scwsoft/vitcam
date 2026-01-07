import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { settingsService } from '@/services/settings.service';
import { validateSignalingServer } from '@/utils/settings.utils';
import {
  DEFAULT_SIGNALING_SERVER,
  DEFAULT_DATETIME_SETTINGS,
} from '@/constants/settings.constants';
import type {
  SignalingServerConfig,
  DateTimeSettings,
  ValidationErrors,
} from '@/types/settings.types';

export const useSettings = () => {
  const router = useRouter();
  const supabase = createClient();
  const isMounted = useRef(true);

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [signalingServer, setSignalingServer] = useState<SignalingServerConfig>(
    DEFAULT_SIGNALING_SERVER
  );
  const [dateTimeSettings, setDateTimeSettings] = useState<DateTimeSettings>(
    DEFAULT_DATETIME_SETTINGS
  );
  const [errors, setErrors] = useState<ValidationErrors>({});

  // Fetch user and settings
  useEffect(() => {
    const fetchUserAndSettings = async () => {
      try {
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

        if (authError || !authUser) {
          console.error('Auth error:', authError);
          // CRITICAL: Set loading to false before redirecting
          if (isMounted.current) {
            setLoading(false);
          }
          router.push('/login');
          return;
        }

        if (!isMounted.current) {
          setLoading(false);
          return;
        }

        setUser(authUser);

        const settings = await settingsService.getSettings(authUser.id);
        
        if (settings && isMounted.current) {
          setSignalingServer(settings.signalingServer || DEFAULT_SIGNALING_SERVER);
          setDateTimeSettings(settings.dateTimeSettings || DEFAULT_DATETIME_SETTINGS);
        } else {
          // No settings found, use defaults (first time user)
          console.log('No existing settings found, using defaults');
        }
      } catch (error) {
        console.error('Error fetching user/settings:', error);
        // Continue with defaults even if there's an error
      } finally {
        // ALWAYS set loading to false
        if (isMounted.current) {
          setLoading(false);
        }
      }
    };

    fetchUserAndSettings();

    return () => {
      isMounted.current = false;
    };
  }, [router, supabase]);

  // Validate field
  const validateField = useCallback((field: string, value: string) => {
    const tempConfig = { ...signalingServer, [field]: value };
    const validationErrors = validateSignalingServer(tempConfig);
    
    setErrors(prev => {
      const newErrors = { ...prev };
      if (validationErrors[field]) {
        newErrors[field] = validationErrors[field];
      } else {
        delete newErrors[field];
      }
      return newErrors;
    });
  }, [signalingServer]);

  // Check if form is valid
  const isFormValid = useCallback(() => {
    const validationErrors = validateSignalingServer(signalingServer);
    return Object.keys(validationErrors).length === 0;
  }, [signalingServer]);

  // Save settings
  const saveSettings = useCallback(async () => {
    if (!user || !isFormValid()) return false;

    setIsSubmitting(true);
    try {
      const success = await settingsService.saveSettings(user.id, {
        signalingServer,
        dateTimeSettings,
      });
      return success;
    } catch (error) {
      console.error('Error saving settings:', error);
      return false;
    } finally {
      if (isMounted.current) {
        setIsSubmitting(false);
      }
    }
  }, [user, signalingServer, dateTimeSettings, isFormValid]);

  // Clear logs
  const clearLogs = useCallback(async () => {
    if (!user) return false;

    setIsSubmitting(true);
    try {
      const success = await settingsService.clearLogs(user.id);
      return success;
    } catch (error) {
      console.error('Error clearing logs:', error);
      return false;
    } finally {
      if (isMounted.current) {
        setIsSubmitting(false);
      }
    }
  }, [user]);

  // Clear recordings
  const clearRecordings = useCallback(async () => {
    if (!user) return false;

    setIsSubmitting(true);
    try {
      const success = await settingsService.clearRecordings(user.id);
      return success;
    } catch (error) {
      console.error('Error clearing recordings:', error);
      return false;
    } finally {
      if (isMounted.current) {
        setIsSubmitting(false);
      }
    }
  }, [user]);

  // Clear recordings
  const clearAnalytics = useCallback(async () => {
    if (!user) return false;

    setIsSubmitting(true);
    try {
      const success = await settingsService.clearAnalytics(user.id);
      return success;
    } catch (error) {
      console.error('Error clearing analytics:', error);
      return false;
    } finally {
      if (isMounted.current) {
        setIsSubmitting(false);
      }
    }
  }, [user]);

  // Clear detection images
  const clearDetectionImages = useCallback(async () => {
    if (!user) return false;

    setIsSubmitting(true);
    try {
      const success = await settingsService.clearDetectionImages(user.id);
      return success;
    } catch (error) {
      console.error('Error clearing detection images:', error);
      return false;
    } finally {
      if (isMounted.current) {
        setIsSubmitting(false);
      }
    }
  }, [user]);


  return {
    user,
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
  };
};