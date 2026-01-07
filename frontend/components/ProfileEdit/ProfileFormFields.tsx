/**
 * Profile Form Fields Component
 * @module components/ProfileEdit/ProfileFormFields
 */

'use client';

import React from 'react';
import { USERNAME_MIN_LENGTH } from '@/constants/profile.constants';
import type { ProfileFormData, ValidationErrors } from '@/types/profile.types';

interface ProfileFormFieldsProps {
  formData: ProfileFormData;
  validationErrors: ValidationErrors;
  onFieldChange: (field: keyof ProfileFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
}

/**
 * Profile form input fields with validation
 */
export const ProfileFormFields: React.FC<ProfileFormFieldsProps> = ({
  formData,
  validationErrors,
  onFieldChange,
}) => {
  return (
    <div className="space-y-6">
      {/* Full Name Field */}
      <div>
        <label
          htmlFor="full_name"
          className="block text-sm font-medium mb-1 dark:text-gray-200"
        >
          Full Name
        </label>
        <input
          id="full_name"
          type="text"
          value={formData.full_name}
          onChange={onFieldChange('full_name')}
          data-testid="full-name-input"
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors dark:bg-gray-800 dark:border-gray-600 dark:text-white"
          placeholder="Enter your full name"
        />
      </div>

      {/* Username Field */}
      <div>
        <label
          htmlFor="username"
          className="block text-sm font-medium mb-1 dark:text-gray-200"
        >
          Username
        </label>
        <input
          id="username"
          type="text"
          value={formData.username}
          onChange={onFieldChange('username')}
          data-testid="username-input"
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:border-transparent transition-colors dark:bg-gray-800 dark:text-white ${
            validationErrors.username
              ? 'border-red-300 focus:ring-red-500 dark:border-red-500'
              : 'focus:ring-blue-500 dark:border-gray-600'
          }`}
          placeholder="Enter your username"
          aria-invalid={!!validationErrors.username}
          aria-describedby={validationErrors.username ? 'username-error' : 'username-help'}
        />
        {validationErrors.username && (
          <p
            id="username-error"
            className="mt-1 text-sm text-red-500 dark:text-red-400"
            role="alert"
          >
            {validationErrors.username}
          </p>
        )}
        <p
          id="username-help"
          className="mt-1 text-sm opacity-70 dark:text-gray-400"
        >
          Must be at least {USERNAME_MIN_LENGTH} characters. Letters, numbers, and underscores only.
        </p>
      </div>

      {/* Website Field */}
      <div>
        <label
          htmlFor="website"
          className="block text-sm font-medium mb-1 dark:text-gray-200"
        >
          Website
        </label>
        <input
          id="website"
          type="url"
          value={formData.website}
          onChange={onFieldChange('website')}
          data-testid="website-input"
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:border-transparent transition-colors dark:bg-gray-800 dark:text-white ${
            validationErrors.website
              ? 'border-red-300 focus:ring-red-500 dark:border-red-500'
              : 'focus:ring-blue-500 dark:border-gray-600'
          }`}
          placeholder="https://your-website.com"
          aria-invalid={!!validationErrors.website}
          aria-describedby={validationErrors.website ? 'website-error' : undefined}
        />
        {validationErrors.website && (
          <p
            id="website-error"
            className="mt-1 text-sm text-red-500 dark:text-red-400"
            role="alert"
          >
            {validationErrors.website}
          </p>
        )}
      </div>
    </div>
  );
};