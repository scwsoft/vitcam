/**
 * Avatar Upload Component
 * @module components/ProfileEdit/AvatarUpload
 */

'use client';

import React, { useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import { toast } from 'react-hot-toast';
import { Camera, Loader2 } from 'lucide-react';
import { validateFile } from '@/utils/validation.utils';
import { uploadAvatar, updateProfileAvatar } from '@/services/profile.service';
import { AVATAR_ACCEPT_TYPES, PREVIEW_CLEANUP_DELAY } from '@/constants/profile.constants';
import type { User, Profile } from '@/types/profile.types';
import { SupabaseClient } from '@supabase/supabase-js';

interface AvatarUploadProps {
  user: User | null;
  profile: Profile | null;
  supabase: SupabaseClient;
  onAvatarUpdate: (profile: Profile) => void;
}

/**
 * Avatar upload component with image preview and validation
 */
export const AvatarUpload: React.FC<AvatarUploadProps> = ({
  user,
  profile,
  supabase,
  onAvatarUpdate,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  /**
   * Handles avatar file selection and upload
   */
  const handleAvatarChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !user) return;

      const validationError = validateFile(file);
      if (validationError) {
        toast.error(validationError);
        return;
      }

      setIsUploading(true);
      let previewUrl: string | null = null;

      try {
        // Create preview
        previewUrl = URL.createObjectURL(file);
        setAvatarPreview(previewUrl);

        // Upload avatar
        const { publicUrl } = await uploadAvatar(
          supabase,
          user,
          file,
          profile?.avatar_url ?? null
        );

        // Update profile with new avatar URL
        await updateProfileAvatar(supabase, user.id, publicUrl);

        // Update local profile state
        const updatedProfile: Profile = {
          ...profile!,
          avatar_url: publicUrl,
          updated_at: new Date().toISOString(),
        };
        onAvatarUpdate(updatedProfile);

        toast.success('Avatar updated successfully!');
      } catch (error) {
        console.error('Avatar upload error:', error);

        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

        if (errorMessage.includes('bucket')) {
          toast.error('Storage not configured properly. Please contact support.');
        } else if (errorMessage.includes('Upload failed')) {
          toast.error('Failed to upload image. Please try a different file.');
        } else if (errorMessage.includes('publicUrl')) {
          toast.error('Upload succeeded but could not generate URL. Please refresh and try again.');
        } else {
          toast.error('Failed to update avatar. Please try again.');
        }

        // Reset preview on error
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
          setAvatarPreview(null);
        }
      } finally {
        setIsUploading(false);

        // Clean up preview URL after a delay
        setTimeout(() => {
          if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setAvatarPreview(null);
          }
        }, PREVIEW_CLEANUP_DELAY);

        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [user, profile, supabase, onAvatarUpdate]
  );

  /**
   * Triggers file input click
   */
  const handleAvatarClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /**
   * Handles avatar image load error
   */
  const handleImageError = useCallback(
    (currentAvatarUrl: string) => {
      console.error('Avatar image failed to load:', currentAvatarUrl);

      setAvatarPreview(null);

      if (profile && profile.avatar_url === currentAvatarUrl) {
        toast.error('Avatar image could not be loaded');

        // Clear broken avatar URL from database
        supabase
          .from('profiles')
          .update({ avatar_url: null })
          .eq('id', user?.id)
          .then(({ error }) => {
            if (error) console.error('Failed to clear broken avatar URL:', error);
          });

        onAvatarUpdate({ ...profile, avatar_url: null });
      }
    },
    [profile, supabase, user, onAvatarUpdate]
  );

  const currentAvatarUrl = avatarPreview || profile?.avatar_url;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-6">
      {/* Avatar Display */}
      <div className="relative flex-shrink-0">
        <div className="h-24 w-24 rounded-full overflow-hidden border-2 hover:border-opacity-70 transition-colors bg-gray-100 dark:bg-gray-800">
          {currentAvatarUrl ? (
            <Image
              src={currentAvatarUrl}
              alt="Profile avatar"
              width={96}
              height={96}
              className="h-full w-full object-cover"
              onError={() => handleImageError(currentAvatarUrl)}
              onLoad={() => console.log('Avatar loaded successfully:', currentAvatarUrl)}
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center opacity-60">
              <Camera className="h-8 w-8" />
            </div>
          )}
        </div>
        {isUploading && (
          <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-white animate-spin" />
          </div>
        )}
      </div>

      {/* Upload Controls */}
      <div className="flex-1">
        <button
          type="button"
          onClick={handleAvatarClick}
          disabled={isUploading}
          className="inline-flex items-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium hover:bg-opacity-10 hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:border-gray-600"
        >
          <Camera className="h-4 w-4 mr-2" />
          {isUploading ? 'Uploading...' : 'Change Avatar'}
        </button>
        <p className="mt-2 text-sm opacity-70">
          JPG, PNG or WebP. Max size 2MB.
        </p>
        {profile?.avatar_url && (
          <div className="mt-1">
            <p className="text-xs opacity-50">Avatar linked to your profile</p>
            {process.env.NODE_ENV === 'development' && (
              <p className="text-xs opacity-30 break-all">URL: {profile.avatar_url}</p>
            )}
          </div>
        )}
        {!profile?.avatar_url && !currentAvatarUrl && (
          <p className="mt-1 text-xs opacity-50">No avatar set</p>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={AVATAR_ACCEPT_TYPES}
        onChange={handleAvatarChange}
        className="hidden"
        aria-label="Upload avatar image"
      />
    </div>
  );
};