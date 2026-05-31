'use client';

/**
 * Video Analytics Page
 * Dashboard for real-time video detection analytics and insights
 */

import React from 'react';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAnalyticsFilters } from '@/hooks/useAnalyticsFilters';
import { useAnalyticsStats } from '@/hooks/useAnalyticsStats';
import { useAnalyticsExport } from '@/hooks/useAnalyticsExport';
import { ANALYTICS_CONFIG } from '@/constants/analytics.constants';
import { createClient } from '@/utils/supabase/client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';


// Components
import AnalyticsHeader from '@/components/analytics/AnalyticsHeader';
import AnalyticsFilters from '@/components/analytics/AnalyticsFilters';
import AnalyticsMetrics from '@/components/analytics/AnalyticsMetrics';
import AnalyticsCharts from '@/components/analytics/AnalyticsCharts';
import AnalyticsCameraGrid from '@/components/analytics/AnalyticsCameraGrid';
import AnalyticsLoadingState from '@/components/analytics/AnalyticsLoadingState';
import AnalyticsError from '@/components/analytics/AnalyticsError';

const VideoAnalyticsPage: React.FC = () => {
  const { filters, setFilters } = useAnalyticsFilters();
  const { detections, loading, refreshing, error, refresh } = useAnalytics(filters);
  const { stats, cameraStats, objectStats } = useAnalyticsStats(detections);
  const { exportToCSV } = useAnalyticsExport(detections);
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);
  
  
  // Authentication check
  useEffect(() => {
    let mounted = true;

    async function checkUser() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (session?.user) {
          setAuthLoading(false);
        } else {
          router.push('/signin');
        }
      } catch (error) {
        console.error('Auth check error:', error);
        if (mounted) {
          router.push('/signin');
        }
      }
    }
    checkUser();

    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  if (loading) {
    return <AnalyticsLoadingState />;
  }

  if (error) {
    return <AnalyticsError error={error} onRetry={refresh} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <AnalyticsHeader
        onRefresh={refresh}
        onExport={exportToCSV}
        refreshing={refreshing}
      />

      <div className="max-w-[1800px] mx-auto px-6 py-8">
        <div className="mb-8">
          <AnalyticsFilters filters={filters} onFiltersChange={setFilters} />
        </div>

        <AnalyticsMetrics stats={stats} />

        <AnalyticsCharts
          detections={detections}
          objectStats={objectStats}
          liveFeedLimit={ANALYTICS_CONFIG.LIVE_FEED_LIMIT}
        />

        <AnalyticsCameraGrid cameraStats={cameraStats} />
      </div>
    </div>
  );
};

export default VideoAnalyticsPage;