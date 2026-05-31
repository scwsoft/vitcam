import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CameraFormData, CameraFormErrors, Camera } from '@/types/camera.types'
import { INITIAL_FORM_DATA, DETECTION_CLASSES, CUSTOM_DETECTION_CLASSES } from '@/constants/camera.constants'
import { CameraService } from '@/services/camera.service'

const STANDARD_CLASS_NAMES = Object.values(DETECTION_CLASSES)
const CUSTOM_CLASS_NAMES = Object.values(CUSTOM_DETECTION_CLASSES)

/** Returns the full class list for a given modelsize. */
function getDefaultClasses(modelsize: string): string[] {
  return modelsize === 'Custom' ? [...CUSTOM_CLASS_NAMES] : [...STANDARD_CLASS_NAMES]
}

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
        odclasses: CameraService.parseOdclassesFromDb(camera.odclasses, camera.modelsize),
        encoder: camera.encoder || '',
        resolution: camera.resolution || '1920x1080',
        fps: camera.fps || 30,
        rectype: camera.rectype || '',
        modelsize: camera.modelsize || 'Nano',
        detectiontype: camera.detectiontype || 'BoundingBox',
      })
    }
  }, [camera, isEditing])

  const updateField = useCallback(
    (field: keyof CameraFormData, value: any) => {
      setFormData((prev) => {
        const newData = { ...prev, [field]: value }

        // Turning detection OFF — reset detection-related fields
        if (field === 'is_detection' && !value) {
          newData.odthreshold = 50
          newData.odclasses = []
        }

        // Turning detection ON — auto-select all classes for current modelsize
        if (field === 'is_detection' && value && prev.odclasses.length === 0) {
          newData.odclasses = getDefaultClasses(prev.modelsize)
        }

        // Switching modelsize — reset odclasses to the new model's full class list
        // (only when detection is active so the selection stays coherent)
        if (field === 'modelsize' && prev.is_detection) {
          newData.odclasses = getDefaultClasses(value)
        }

        // Custom model does not support Segmentation — fall back to BoundingBox
        if (field === 'modelsize' && value === 'Custom' && prev.detectiontype === 'Segmentation') {
          newData.detectiontype = 'BoundingBox'
        }

        return newData
      })

      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }))
      }

      if (field === 'is_detection' && !value) {
        setErrors((prev) => ({
          ...prev,
          odthreshold: undefined,
          odclasses: undefined,
        }))
      }
    },
    [errors],
  )

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

    if (!formData.modelsize) {
      newErrors.modelsize = 'Model size is required'
    }

    if (!formData.detectiontype) {
      newErrors.detectiontype = 'Detection type is required'
    } else if (formData.modelsize === 'Custom' && formData.detectiontype === 'Segmentation') {
      newErrors.detectiontype = 'Segmentation is not supported with the Custom model'
    }

    if (formData.is_detection) {
      if (formData.odthreshold < 1 || formData.odthreshold > 100) {
        newErrors.odthreshold = 'Threshold must be between 1–100'
      }
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
        error: error instanceof Error ? error.message : 'Failed to save camera',
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
    isCustomModel: formData.modelsize === 'Custom',
    updateField,
    handleSubmit,
    resetForm,
  }
}