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

// Hooks
import { useAnalytics } from '@/hooks/useAnalytics';
import { useCameras } from '@/hooks/useCamera';
import { useImageModal } from '@/hooks/useImageModal';

// Components
import {
  DashboardHeader,
  FilterControls,
  SummaryCards,
  ObjectBarChart,
  DetectionPieChart,
  CameraActivity,
  RecentDetections,
  LoadingState,
} from '@/components/analytics';

// Types
import type { DateRangeOption } from '@/types/analytics.types';

export default function VideoAnalyticsDashboard() {
  // Authentication state
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const { cameras } = useCameras();
  const supabase = createClient();
  const router = useRouter();

  // Custom hooks
  const {
    dashboardData,
    realtimeEvents,
    loading,
    refreshing,
    selectedDateRange,
    selectedCamera,
    isAutoRefresh,
    eventsPagination,
    eventsPage,
    setSelectedDateRange,
    setSelectedCamera,
    setIsAutoRefresh,
    handleRefresh,
    handleEventsNextPage,
    handleEventsPrevPage,
    handleEventsPageChange,
  } = useAnalytics(user?.id);

  const { selectedImage, showImageModal, openImageModal, closeImageModal } = useImageModal();

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
      } else {
        router.push('/signin');
        return;
      }
      setAuthLoading(false);
    }
    checkUser();
    setIsAutoRefresh(false);
  }, [router, supabase]);

  /**
   * Handle date range change
   */
  const handleDateRangeChange = (range: DateRangeOption) => {
    setSelectedDateRange(range);
  };

  /**
   * Handle camera filter change
   */
  const handleCameraChange = (camera: string) => {
    setSelectedCamera(camera);
  };

  /**
   * Handle camera filter clear
   */
  const handleClearCameraFilter = () => {
    setSelectedCamera('all');
  };

  // Show loading state while authenticating
  if (authLoading || loading) {
    return <LoadingState />;
  }

  const events = dashboardData?.recent_events || [];
  const cameraList = cameras || [];

  return (
    <div className="min-h-screen p-6 bg-gray-50 dark:bg-slate-900 transition-colors">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <DashboardHeader
          isAutoRefresh={isAutoRefresh}
          refreshing={refreshing}
          onToggleAutoRefresh={() => setIsAutoRefresh(!isAutoRefresh)}
          onRefresh={handleRefresh}
        />

        {/* Filters */}
        <FilterControls
          selectedDateRange={selectedDateRange}
          selectedCamera={selectedCamera}
          cameras={cameraList}
          onDateRangeChange={handleDateRangeChange}
          onCameraChange={handleCameraChange}
          onClearCameraFilter={handleClearCameraFilter}
        />

        {/* Summary Cards */}
        <SummaryCards dashboardData={dashboardData} selectedCamera={selectedCamera} />

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Unique Tracked Objects Bar Chart */}
          <ObjectBarChart
            events={events}
            selectedDateRange={selectedDateRange}
            selectedCamera={selectedCamera}
            loading={loading}
          />

          {/* Detection Distribution Pie Chart */}
          <DetectionPieChart events={events} loading={loading} />
        </div>

        {/* Camera Activity and Recent Detections Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Camera Activity Status */}
          <CameraActivity events={events} selectedCamera={selectedCamera} />

          {/* Recent Detections with Pagination */}
          <div className="lg:col-span-2">
            <RecentDetections
              events={events}
              pagination={eventsPagination}
              loading={loading}
              onNext={handleEventsNextPage}
              onPrev={handleEventsPrevPage}
              onPageChange={handleEventsPageChange}
              onImageClick={openImageModal}
            />
          </div>
        </div>
      </div>
    </div>
  );
}