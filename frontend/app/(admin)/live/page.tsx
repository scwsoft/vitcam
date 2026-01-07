"use client";

import { useAuth } from '@/hooks/useAuth';
import { useCameras } from '@/hooks/useCamera';
import { LoadingState, ErrorState, EmptyState, CameraGrid } from '@/components/videos';

export default function LiveViewPage() {
  const { user, loading: authLoading } = useAuth();
  const { camerasEx, loading: camerasLoading, error, refetch, refetchEx } = useCameras(user);

  // Show loading state during authentication or camera fetch
  if (authLoading || camerasLoading) {
    return <LoadingState />;
  }

  // Show error state with retry option
  if (error) {
    return <ErrorState error={error} onRetry={refetchEx} />;
  }

  // Show empty state when no cameras configured
  if (camerasEx.length === 0) {
    return <EmptyState />;
  }

  // Render camera grid
  return <CameraGrid cameras={camerasEx} />;
}