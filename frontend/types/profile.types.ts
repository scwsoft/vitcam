/**
 * Profile Type Definitions
 * @module types/profile.types
 */

import type { User } from '@supabase/auth-helpers-nextjs';

/**
 * User profile data structure
 */
export interface Profile {
  id: string;
  updated_at: string | null;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  website: string | null;
}

/**
 * Profile form data structure
 */
export interface ProfileFormData {
  full_name: string;
  username: string;
  website: string;
}

/**
 * Form validation error structure
 */
export interface ValidationErrors {
  [key: string]: string;
}

/**
 * Profile update payload
 */
export interface ProfileUpdatePayload {
  full_name: string | null;
  username: string | null;
  website: string | null;
  updated_at: string;
}

/**
 * Avatar upload response
 */
export interface AvatarUploadResponse {
  publicUrl: string;
  path: string;
}

/**
 * Profile hook return type
 */
export interface UseProfileReturn {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  setProfile: React.Dispatch<React.SetStateAction<Profile | null>>;
}

/**
 * Re-export User type for convenience
 */
export type { User };