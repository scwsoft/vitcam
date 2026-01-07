/**
 * Profile Edit Page
 * @module app/profile/edit/page
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { useSupabaseClient, useProfile } from '@/hooks/useProfile';
import { logStorageConfiguration } from '@/services/profile.service';
import { ProfileEditForm } from '@/components/ProfileEdit';
import type { User, Profile } from '@/types/profile.types';

/**
 * Profile Edit Page Component
 * Manages authentication state and renders profile edit form
 */
const ProfileEditPage: React.FC = () => {
  const router = useRouter();
  const supabase = useSupabaseClient();

  // State
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(true);

  // Fetch user and profile
  const { profile, loading: profileLoading, setProfile } = useProfile(user?.id);

  /**
   * Authenticates user and checks storage configuration
   */
  useEffect(() => {
    const authenticateUser = async () => {
      try {
        const {
          data: { user: authenticatedUser },
          error,
        } = await supabase.auth.getUser();

        if (error) throw error;

        setUser(authenticatedUser);

        // Log storage configuration in development
        await logStorageConfiguration(supabase);
      } catch (error) {
        console.error('Auth error:', error);
        toast.error('Failed to authenticate user');
        router.push('/login');
      } finally {
        setIsAuthenticating(false);
      }
    };

    authenticateUser();
  }, [supabase, router]);

  /**
   * Handles profile updates from child components
   */
  const handleProfileUpdate = useCallback(
    (updatedProfile: Profile) => {
      setProfile(updatedProfile);
    },
    [setProfile]
  );

  // Loading state
  if (isAuthenticating || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-2" />
          <p className="opacity-70 dark:text-gray-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  // Authentication error state
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center dark:bg-gray-900">
        <div className="text-center">
          <p className="text-red-500 dark:text-red-400 mb-4">Authentication required</p>
          <button
            onClick={() => router.push('/login')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // Profile not found state
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center dark:bg-gray-900">
        <div className="text-center">
          <p className="text-red-500 dark:text-red-400 mb-4">Profile not found</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  // Main render
  return (
    <div className="min-h-screen py-8 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <ProfileEditForm
          user={user}
          profile={profile}
          supabase={supabase}
          onProfileUpdate={handleProfileUpdate}
        />
      </div>
    </div>
  );
};

export default ProfileEditPage;