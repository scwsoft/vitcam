import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Camera } from '@/types/camera.types'
import { CameraService } from '@/services/camera.service'
import { useAuth } from './useAuth'

export function useCameras() {
  const [cameras, setCameras] = useState<Camera[]>([])
  const [camerasEx, setCamerasEx] = useState<ICameraProps[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  const fetchCameras = useCallback(async () => {
    if (!user) return

    try {
      setLoading(true)
      setError(null)
      const data = await CameraService.getAllCameras()
      setCameras(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch cameras')
      console.error('Error fetching cameras:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchCameras()
  }, [fetchCameras])

  
  const fetchCamerasEx = useCallback(async () => {
    if (!user) return

    try {
      setLoading(true)
      setError(null)
      const data = await CameraService.fetchCameras()
      setCamerasEx(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch cameras')
      console.error('Error fetching cameras:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchCamerasEx()
  }, [fetchCamerasEx])

  const deleteCamera = async (id: number) => {
    try {
      await CameraService.deleteCamera(id)
      await fetchCameras()
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete camera'
      console.error('Error deleting camera:', err)
      return { success: false, error: message }
    }
  }

  return {
    cameras,
    camerasEx,
    loading,
    error,
    fetchCameras,
    fetchCamerasEx,
    deleteCamera
  }
}

export function useCamera(id?: string) {
  const [camera, setCamera] = useState<Camera | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!id || !user) return

    const fetchCamera = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await CameraService.getCameraById(id)
        setCamera(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch camera')
        console.error('Error fetching camera:', err)
        router.push('/camera')
      } finally {
        setLoading(false)
      }
    }

    fetchCamera()
  }, [id, user, router])

  return { camera, loading, error }
}