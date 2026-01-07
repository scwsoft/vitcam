/**
 * Profile Management Hooks
 * @module hooks/useProfile
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { createClient } from '@/utils/supabase/client';
import type { Profile, UseProfileReturn } from '@/types/profile.types';

/**
 * Custom hook for Supabase client instance
 * @returns Supabase client instance
 */
export const useSupabaseClient = () => {
  return useMemo(() => createClient(), []);
};

/**
 * Custom hook for fetching and managing user profile
 * @param userId - User ID to fetch profile for
 * @returns Profile state and methods
 */
export const useProfile = (userId: string | undefined): UseProfileReturn => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = useSupabaseClient();

  const fetchProfile = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (fetchError) throw fetchError;

      setProfile(data);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch profile';
      console.error('Profile fetch error:', err);
      setError(errorMessage);
      toast.error('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  }, [userId, supabase]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return {
    profile,
    loading,
    error,
    refetch: fetchProfile,
    setProfile,
  };
};

/**
 * Custom hook for managing form state
 * @param initialData - Initial form data
 * @returns Form data state and handlers
 */
export const useFormState = <T extends Record<string, any>>(initialData: T) => {
  const [formData, setFormData] = useState<T>(initialData);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const updateField = useCallback(
    (field: keyof T) => (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
      const value = e.target.value;
      setFormData((prev) => ({ ...prev, [field]: value }));

      // Clear validation error for this field
      if (validationErrors[field as string]) {
        setValidationErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[field as string];
          return newErrors;
        });
      }
    },
    [validationErrors]
  );

  const resetForm = useCallback(() => {
    setFormData(initialData);
    setValidationErrors({});
  }, [initialData]);

  return {
    formData,
    setFormData,
    validationErrors,
    setValidationErrors,
    updateField,
    resetForm,
  };
};