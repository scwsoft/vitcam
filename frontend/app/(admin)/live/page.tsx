"use client";

import { useAuth } from '@/hooks/useAuth';
import { useCameras } from '@/hooks/useCamera';
import { LoadingState, ErrorState, EmptyState, CameraGrid } from '@/components/videos';

export default function LiveViewPage() {
  const { user, loading: authLoading } = useAuth();
  const { camerasEx, loading: camerasLoading, error, refetch, refetchEx } = useCameras(user);

  // Read STUN servers from environment variable
  const stunServersEnv = process.env.NEXT_PUBLIC_STUN_SERVERS;
  let stunServers: string[] = [];
  
  if (stunServersEnv) {
    // Parse comma-separated STUN servers
    stunServers = stunServersEnv
      .split(',')
      .map(url => url.trim())
      .filter(url => url.length > 0);
    console.log(`[LiveViewPage] Loaded ${stunServers.length} STUN server(s) from environment`);
  } else {
    console.warn('[LiveViewPage] NEXT_PUBLIC_STUN_SERVERS not configured');
  }

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

  // Render camera grid with STUN servers
  return <CameraGrid cameras={camerasEx} stunServers={stunServers} />;
}