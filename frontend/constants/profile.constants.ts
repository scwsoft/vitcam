/**
 * Profile Configuration Constants
 * @module constants/profile.constants
 */

/**
 * Maximum file size for avatar uploads (2MB)
 */
export const MAX_FILE_SIZE = 2 * 1024 * 1024;

/**
 * Allowed image file types for avatar upload
 */
export const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/**
 * Supabase storage bucket name for avatars
 */
export const AVATAR_BUCKET = 'avatars';

/**
 * Username validation constraints
 */
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

/**
 * File input accept attribute value
 */
export const AVATAR_ACCEPT_TYPES = ALLOWED_FILE_TYPES.join(',');

/**
 * Cache control header for uploaded avatars
 */
export const AVATAR_CACHE_CONTROL = '3600';

/**
 * Redirect delay after successful profile update (ms)
 */
export const POST_UPDATE_REDIRECT_DELAY = 1500;

/**
 * Preview URL cleanup delay (ms)
 */
export const PREVIEW_CLEANUP_DELAY = 1000;