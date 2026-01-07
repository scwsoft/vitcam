/**
 * Validation Utilities
 * @module utils/validation.utils
 */

import {
  USERNAME_MIN_LENGTH,
  USERNAME_REGEX,
  MAX_FILE_SIZE,
  ALLOWED_FILE_TYPES,
} from '@/constants/profile.constants';
import type { ProfileFormData, ValidationErrors } from '@/types/profile.types';

/**
 * Validates a URL string
 * @param url - URL string to validate
 * @returns true if valid URL, false otherwise
 */
export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validates profile form data
 * @param data - Profile form data to validate
 * @returns Object containing validation errors
 */
export const validateForm = (data: ProfileFormData): ValidationErrors => {
  const errors: ValidationErrors = {};

  // Username validation
  if (data.username) {
    if (!USERNAME_REGEX.test(data.username)) {
      errors.username =
        'Username can only contain letters, numbers, and underscores';
    } else if (data.username.length < USERNAME_MIN_LENGTH) {
      errors.username = `Username must be at least ${USERNAME_MIN_LENGTH} characters long`;
    }
  }

  // Website validation
  if (data.website && data.website.trim() && !isValidUrl(data.website)) {
    errors.website = 'Please enter a valid URL';
  }

  return errors;
};

/**
 * Validates an uploaded file
 * @param file - File to validate
 * @returns Error message if invalid, null if valid
 */
export const validateFile = (file: File): string | null => {
  if (!ALLOWED_FILE_TYPES.includes(file.type as any)) {
    return 'Please select a valid image file (JPEG, PNG, or WebP)';
  }

  if (file.size > MAX_FILE_SIZE) {
    return 'File size must be less than 2MB';
  }

  return null;
};

/**
 * Sanitizes form data by trimming whitespace
 * @param data - Profile form data to sanitize
 * @returns Sanitized profile form data
 */
export const sanitizeFormData = (
  data: ProfileFormData
): ProfileFormData => ({
  full_name: data.full_name.trim(),
  username: data.username.trim(),
  website: data.website.trim(),
});