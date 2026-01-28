/**
 * Video Analytics Dashboard Page
 * Main dashboard page integrating all analytics components
 * 
 * Architecture:
 * - Hooks: useAuth (authentication), useAnalytics (data management), useImageModal (UI state)
 * - Services: analytics.service (API calls)
 * - Utils: analytics.utils (data processing functions)
 * - Components: Modular UI components for each dashboard section
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

// Types

export default function VideoAnalyticsDashboard() {
  // Authentication state
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();

  /**
   * Authentication check
   */
  useEffect(() => {
    async function checkUser() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        setUser(session.user);
        router.push('/analytics');
      } else {
        router.push('/signin');
        return;
      }
      setAuthLoading(false);
    }
    checkUser();
  }, [router, supabase]);

  return (
     <></>
  );
}