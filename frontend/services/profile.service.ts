/**
 * Profile Service
 * @module services/profile.service
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  AVATAR_BUCKET,
  AVATAR_CACHE_CONTROL,
} from '@/constants/profile.constants';
import type {
  Profile,
  ProfileUpdatePayload,
  AvatarUploadResponse,
  User,
} from '@/types/profile.types';

/**
 * Checks if avatars bucket exists in Supabase storage
 * @param supabase - Supabase client instance
 * @returns Promise resolving to boolean indicating bucket existence
 */
export const checkAvatarBucketExists = async (
  supabase: SupabaseClient
): Promise<boolean> => {
  const { data: buckets } = await supabase.storage.listBuckets();
  return buckets?.some((bucket) => bucket.name === AVATAR_BUCKET) ?? false;
};

/**
 * Logs storage configuration in development mode
 * @param supabase - Supabase client instance
 */
export const logStorageConfiguration = async (
  supabase: SupabaseClient
): Promise<void> => {
  if (process.env.NODE_ENV !== 'development') return;

  console.log('Checking Supabase storage configuration...');
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();

  if (bucketError) {
    console.error('Storage bucket error:', bucketError);
    return;
  }

  console.log('Available buckets:', buckets?.map((b) => b.name));
  const avatarBucket = buckets?.find((b) => b.name === AVATAR_BUCKET);

  if (avatarBucket) {
    console.log('Avatar bucket found:', avatarBucket);
  } else {
    console.warn(`Avatar bucket '${AVATAR_BUCKET}' not found!`);
  }
};

/**
 * Extracts filename from avatar URL
 * @param avatarUrl - Avatar URL to extract filename from
 * @returns Filename or null
 */
const extractFilenameFromUrl = (avatarUrl: string): string | null => {
  const urlParts = avatarUrl.split('/');
  const fileName = urlParts[urlParts.length - 1];
  return fileName?.startsWith('avatar-') ? fileName : null;
};

/**
 * Removes old avatar from storage
 * @param supabase - Supabase client instance
 * @param avatarUrl - URL of avatar to remove
 */
const removeOldAvatar = async (
  supabase: SupabaseClient,
  avatarUrl: string
): Promise<void> => {
  try {
    const oldFileName = extractFilenameFromUrl(avatarUrl);

    if (oldFileName) {
      const { error: removeError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .remove([oldFileName]);

      if (removeError) {
        console.warn('Could not remove old avatar:', removeError);
      }
    }
  } catch (cleanupError) {
    console.warn('Error during avatar cleanup:', cleanupError);
  }
};

/**
 * Generates unique filename for avatar
 * @param userId - User ID
 * @param file - File to generate name for
 * @returns Generated filename
 */
const generateAvatarFilename = (userId: string, file: File): string => {
  const fileExt = file.name.split('.').pop() || 'jpg';
  return `avatar-${userId}-${Date.now()}.${fileExt}`;
};

/**
 * Uploads avatar to Supabase storage
 * @param supabase - Supabase client instance
 * @param user - User object
 * @param file - File to upload
 * @param currentAvatarUrl - Current avatar URL (if any)
 * @returns Promise resolving to avatar upload response
 */
export const uploadAvatar = async (
  supabase: SupabaseClient,
  user: User,
  file: File,
  currentAvatarUrl: string | null
): Promise<AvatarUploadResponse> => {
  // Check if avatars bucket exists
  const bucketExists = await checkAvatarBucketExists(supabase);
  if (!bucketExists) {
    console.warn('Avatars bucket not found. Make sure to create the avatars bucket in Supabase.');
    throw new Error('Storage bucket not configured. Please contact support.');
  }

  // Remove old avatar if it exists
  if (currentAvatarUrl) {
    await removeOldAvatar(supabase, currentAvatarUrl);
  }

  // Generate unique filename
  const fileName = generateAvatarFilename(user.id, file);

  // Upload new file
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(fileName, file, {
      cacheControl: AVATAR_CACHE_CONTROL,
      upsert: false,
    });

  if (uploadError) {
    console.error('Upload error details:', uploadError);
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  if (!uploadData?.path) {
    throw new Error('Upload succeeded but no file path returned');
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(AVATAR_BUCKET)
    .getPublicUrl(uploadData.path);

  if (!urlData?.publicUrl) {
    throw new Error('Could not generate public URL for uploaded file');
  }

  console.log('Generated avatar URL:', urlData.publicUrl);

  return {
    publicUrl: urlData.publicUrl,
    path: uploadData.path,
  };
};

/**
 * Updates profile with new avatar URL
 * @param supabase - Supabase client instance
 * @param userId - User ID
 * @param avatarUrl - New avatar URL
 * @returns Promise resolving to updated profile
 */
export const updateProfileAvatar = async (
  supabase: SupabaseClient,
  userId: string,
  avatarUrl: string
): Promise<void> => {
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (updateError) {
    console.error('Profile update error:', updateError);
    throw new Error(`Failed to update profile: ${updateError.message}`);
  }
};

/**
 * Checks if username is available
 * @param supabase - Supabase client instance
 * @param username - Username to check
 * @param currentUserId - Current user ID to exclude from check
 * @returns Promise resolving to boolean indicating availability
 */
export const isUsernameAvailable = async (
  supabase: SupabaseClient,
  username: string,
  currentUserId: string
): Promise<boolean> => {
  const { data: existingUser } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .neq('id', currentUserId)
    .single();

  return !existingUser;
};

/**
 * Updates user profile
 * @param supabase - Supabase client instance
 * @param userId - User ID
 * @param payload - Profile update payload
 * @returns Promise resolving when update is complete
 */
export const updateProfile = async (
  supabase: SupabaseClient,
  userId: string,
  payload: ProfileUpdatePayload
): Promise<void> => {
  const { error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', userId);

  if (error) {
    console.error('Profile update error:', error);
    throw error;
  }
};

/**
 * Clears broken avatar URL from profile
 * @param supabase - Supabase client instance
 * @param userId - User ID
 */
export const clearBrokenAvatarUrl = async (
  supabase: SupabaseClient,
  userId: string
): Promise<void> => {
  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', userId);

  if (error) {
    console.error('Failed to clear broken avatar URL:', error);
  }
};