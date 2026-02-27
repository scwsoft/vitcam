import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CameraFormData, CameraFormErrors, Camera } from '@/types/camera.types'
import { INITIAL_FORM_DATA, DETECTION_CLASSES } from '@/constants/camera.constants'
import { CameraService } from '@/services/camera.service'

export function useCameraForm(camera?: Camera | null, isEditing = false) {
  const [formData, setFormData] = useState<CameraFormData>(INITIAL_FORM_DATA)
  const [errors, setErrors] = useState<CameraFormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (camera && isEditing) {
      setFormData({
        name: camera.name || '',
        type: camera.type || '',
        url: camera.url || '',
        description: camera.description || '',
        odthreshold: camera.odthreshold || 50,
        is_detection: camera.is_detection || false,
        odclasses: CameraService.parseOdclassesFromDb(camera.odclasses),
        encoder: camera.encoder || '',
        resolution: camera.resolution || '1920x1080',
        fps: camera.fps || 30,
        rectype: camera.rectype || ''
      })
    }
  }, [camera, isEditing])

  const updateField = useCallback((field: keyof CameraFormData, value: any) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value }
      
      // When detection is disabled, reset to defaults
      if (field === 'is_detection' && !value) {
        newData.odthreshold = 50
        newData.odclasses = []
      }
      
      // When detection is enabled and no classes selected, auto-select all classes
      // This provides better UX - matching the default behavior when loading from DB
      if (field === 'is_detection' && value && prev.odclasses.length === 0) {
        newData.odclasses = Object.values(DETECTION_CLASSES)
      }
      
      return newData
    })
    
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
    
    if (field === 'is_detection' && !value) {
      setErrors(prev => ({
        ...prev,
        odthreshold: undefined,
        odclasses: undefined
      }))
    }
  }, [errors])

  const validateForm = useCallback((): boolean => {
    const newErrors: CameraFormErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Camera name is required'
    }

    if (!formData.type) {
      newErrors.type = 'Camera type is required'
    }

    if (!formData.url.trim()) {
      newErrors.url = 'Camera URL is required'
    } else {
      try {
        new URL(formData.url)
      } catch {
        newErrors.url = 'Please enter a valid URL'
      }
    }

    if (!formData.encoder) {
      newErrors.encoder = 'Encoder is required'
    }

    if (!formData.resolution) {
      newErrors.resolution = 'Resolution is required'
    }

    if (!formData.fps || formData.fps < 1) {
      newErrors.fps = 'FPS must be at least 1'
    }

    if (!formData.rectype) {
      newErrors.rectype = 'Recording type is required'
    }

    if (formData.is_detection) {
      if (formData.odthreshold < 1 || formData.odthreshold > 100) {
        newErrors.odthreshold = 'Threshold must be between 1-100'
      }
      // Note: odclasses validation removed - classes are optional
      // Empty classes defaults to all classes selected (per original implementation)
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData])

  const handleSubmit = async (cameraId?: string) => {
    if (!validateForm()) return { success: false }

    setSubmitting(true)
    try {
      if (isEditing && cameraId) {
        await CameraService.updateCamera(cameraId, formData)
      } else {
        await CameraService.createCamera(formData)
      }
      router.push('/camera')
      return { success: true }
    } catch (error) {
      console.error('Error saving camera:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to save camera' 
      }
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = useCallback(() => {
    setFormData(INITIAL_FORM_DATA)
    setErrors({})
  }, [])

  return {
    formData,
    errors,
    submitting,
    updateField,
    handleSubmit,
    resetForm
  }
}