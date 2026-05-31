"use client";

import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { NetworkMonitor } from '@/components/network/NetworkMonitor';
import { useRouter } from 'next/navigation';

export default function NetworkMonitorPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  
  if (loading) {
    return <LoadingSpinner />;
  }

  return user ? <NetworkMonitor user={user} /> : router.push('/signin');

}