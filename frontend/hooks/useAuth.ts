import { useState, useCallback, useEffect, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { UseAuthReturn } from '@/types/system-logs.types';

export const useAuth = (): UseAuthReturn => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => {
    try {
      return createClient();
    } catch (error) {
      console.error('Failed to initialize Supabase client:', error);
      return null;
    }
  }, []);

  const checkAuth = useCallback(async () => {
    if (!supabase) {
      setError('Failed to initialize database connection');
      setLoading(false);
      return;
    }

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError && !authError.message.includes('session_not_found')) {
        throw authError;
      }

      setUser(user);
      setError(user ? null : 'Please sign in to access system logs');
    } catch (err: any) {
      console.error('Authentication check failed:', err);
      setError(err?.message || 'Authentication failed');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const validateAuth = useCallback(() => {
    if (!user) {
      setError('Authentication required. Please sign in to continue.');
      return false;
    }
    return true;
  }, [user]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return { user, loading, error, checkAuth, validateAuth };
};