import { useState, useEffect } from 'react';
import { ICameraProps } from '@/types/CameraType';
import { cameraService } from '@/services/camera.service';
import { User } from '@supabase/supabase-js';

interface UseCamerasReturn {
  cameras: ICameraProps[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useCameras(user: User | null): UseCamerasReturn {
  const [cameras, setCameras] = useState<ICameraProps[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCameras = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      const data = await cameraService.fetchCameras();
      setCameras(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load cameras'));
      setCameras([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCameras();
  }, [user]);

  return { 
    cameras, 
    loading, 
    error,
    refetch: fetchCameras
  };
}