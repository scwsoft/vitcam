/**
 * Profile Edit Form Component
 * @module components/ProfileEdit/ProfileEditForm
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { Loader2, Save, X } from 'lucide-react';
import { validateForm, sanitizeFormData } from '@/utils/validation.utils';
import { isUsernameAvailable, updateProfile } from '@/services/profile.service';
import { POST_UPDATE_REDIRECT_DELAY } from '@/constants/profile.constants';
import { AvatarUpload } from './AvatarUpload';
import { ProfileFormFields } from './ProfileFormFields';
import type {
  User,
  Profile,
  ProfileFormData,
  ValidationErrors,
  ProfileUpdatePayload,
} from '@/types/profile.types';
import { SupabaseClient } from '@supabase/supabase-js';

interface ProfileEditFormProps {
  user: User;
  profile: Profile;
  supabase: SupabaseClient;
  onProfileUpdate: (profile: Profile) => void;
}

/**
 * Main profile edit form component
 */
export const ProfileEditForm: React.FC<ProfileEditFormProps> = ({
  user,
  profile,
  supabase,
  onProfileUpdate,
}) => {
  const router = useRouter();

  // Form state
  const [formData, setFormData] = useState<ProfileFormData>({
    full_name: '',
    username: '',
    website: '',
  });
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Populate form when profile loads
  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        username: profile.username || '',
        website: profile.website || '',
      });
    }
  }, [profile]);

  /**
   * Handles form field changes
   */
  const handleFieldChange = useCallback(
    (field: keyof ProfileFormData) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const value = e.target.value;
        setFormData((prev) => ({ ...prev, [field]: value }));

        // Clear validation error for this field
        if (validationErrors[field]) {
          setValidationErrors((prev) => {
            const newErrors = { ...prev };
            delete newErrors[field];
            return newErrors;
          });
        }
      },
    [validationErrors]
  );

  /**
   * Handles avatar update
   */
  const handleAvatarUpdate = useCallback(
    (updatedProfile: Profile) => {
      onProfileUpdate(updatedProfile);
    },
    [onProfileUpdate]
  );

  /**
   * Handles form submission
   */
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (isSubmitting) return;

      // Validate form
      const errors = validateForm(formData);
      setValidationErrors(errors);

      if (Object.keys(errors).length > 0) {
        toast.error('Please fix the validation errors');
        return;
      }

      setIsSubmitting(true);

      try {
        // Check if username is taken (if changed)
        if (formData.username && formData.username !== profile.username) {
          const available = await isUsernameAvailable(
            supabase,
            formData.username,
            user.id
          );

          if (!available) {
            setValidationErrors({ username: 'Username is already taken' });
            toast.error('Username is already taken');
            return;
          }
        }

        // Sanitize and prepare payload
        const sanitized = sanitizeFormData(formData);
        const payload: ProfileUpdatePayload = {
          full_name: sanitized.full_name || null,
          username: sanitized.username || null,
          website: sanitized.website || null,
          updated_at: new Date().toISOString(),
        };

        // Update profile
        await updateProfile(supabase, user.id, payload);

        // Update local state
        const updatedProfile: Profile = {
          ...profile,
          ...sanitized,
          updated_at: payload.updated_at,
        };
        onProfileUpdate(updatedProfile);

        toast.success('Profile updated successfully!');

        // Redirect after success
        setTimeout(() => {
          router.push('/profile/edit');
        }, POST_UPDATE_REDIRECT_DELAY);
      } catch (error) {
        console.error('Profile update error:', error);
        toast.error('Failed to update profile. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData, profile, user, supabase, isSubmitting, onProfileUpdate, router]
  );

  /**
   * Handles form cancellation
   */
  const handleCancel = useCallback(() => {
    router.back();
  }, [router]);

  return (
    <div className="shadow-sm rounded-lg border dark:border-gray-700 dark:bg-gray-900">
      {/* Header */}
      <div className="px-6 py-4 border-b dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold dark:text-white">Edit Profile</h1>
          <button
            onClick={handleCancel}
            className="hover:bg-opacity-10 hover:bg-gray-500 transition-colors p-1 rounded-full dark:hover:bg-gray-600"
            aria-label="Close"
          >
            <X className="h-6 w-6 dark:text-gray-300" />
          </button>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Avatar Section */}
        <AvatarUpload
          user={user}
          profile={profile}
          supabase={supabase}
          onAvatarUpdate={handleAvatarUpdate}
        />

        {/* Form Fields */}
        <ProfileFormFields
          formData={formData}
          validationErrors={validationErrors}
          onFieldChange={handleFieldChange}
        />

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end space-y-3 sm:space-y-0 sm:space-x-4 pt-6 border-t dark:border-gray-700">
          <button
            type="button"
            onClick={handleCancel}
            className="w-full sm:w-auto px-4 py-2 text-sm font-medium border rounded-md hover:bg-opacity-10 hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            data-testid="save-button"
            className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};