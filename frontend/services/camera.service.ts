import { createClient } from '@/utils/supabase/client'
import { Camera, CameraFormData } from '@/types/camera.types'
import { DETECTION_CLASSES, CUSTOM_DETECTION_CLASSES } from '@/constants/camera.constants'

const supabase = createClient()

/** Pick the right class map based on model size. */
function getClassMap(modelsize?: string): typeof DETECTION_CLASSES | typeof CUSTOM_DETECTION_CLASSES {
  return modelsize === 'Custom' ? CUSTOM_DETECTION_CLASSES : modelsize === 'Edge' ? CUSTOM_DETECTION_CLASSES : DETECTION_CLASSES
}

export class CameraService {
  static readonly baseUrl = '/api/cameras'

  static async fetchCameras(accessToken?: string): Promise<ICameraProps[]> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
    }

    const response = await fetch(this.baseUrl, {
      method: 'GET',
      headers,
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch cameras: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return this.validateCameras(data)
  }

  static validateCameras(cameras: ICameraProps[]): ICameraProps[] {
    return cameras.filter(
      (camera) =>
        camera.Name &&
        camera.Url &&
        typeof camera.IsRealTimeDetection === 'boolean' &&
        camera.SignalingServer,
    )
  }

  static async getAllCameras(): Promise<Camera[]> {
    const { data, error } = await supabase
      .from('camera')
      .select('*')
      .order('id', { ascending: true })

    if (error) throw error
    return data || []
  }

  static async getCameraById(id: string): Promise<Camera> {
    const { data, error } = await supabase
      .from('camera')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    if (!data) throw new Error('Camera not found')
    return data
  }

  static async createCamera(formData: CameraFormData): Promise<Camera> {
    const payload = this.transformFormDataToPayload(formData)

    const { data, error } = await supabase
      .from('camera')
      .insert([payload])
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async updateCamera(id: string, formData: CameraFormData): Promise<Camera> {
    const payload = this.transformFormDataToPayload(formData)

    const { data, error } = await supabase
      .from('camera')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async deleteCamera(id: number): Promise<void> {
    const { error } = await supabase.from('camera').delete().eq('id', id)

    if (error) throw error
  }

  private static transformFormDataToPayload(formData: CameraFormData) {
    const classMap = getClassMap(formData.modelsize)
    const allClassNames = Object.values(classMap)
    const isAllSelected = formData.odclasses.length === allClassNames.length

    let odclassesString = ''

    if (isAllSelected) {
      // All classes selected → store all IDs for this class map
      odclassesString = Object.keys(classMap).join(',')
    } else if (formData.odclasses.length > 0) {
      // Specific classes selected → resolve names → IDs within the correct map
      const selectedClassIds = formData.odclasses
        .map((className) => {
          const entry = Object.entries(classMap).find(([, name]) => name === className)
          return entry ? entry[0] : null
        })
        .filter((id): id is string => id !== null)

      odclassesString = selectedClassIds.join(',')
    }
    // else: no classes selected → empty string

    return {
      name: formData.name,
      type: formData.type,
      url: formData.url,
      description: formData.description,
      odthreshold: formData.odthreshold,
      is_detection: formData.is_detection,
      odclasses: odclassesString,
      encoder: formData.encoder,
      resolution: formData.resolution,
      fps: formData.fps,
      rectype: formData.rectype,
      modelsize: formData.modelsize,
      detectiontype: formData.detectiontype,
    }
  }

  /**
   * Parse comma-separated class IDs from the DB back into class name strings.
   * Pass `modelsize` so the correct class map is used for the lookup.
   */
  static parseOdclassesFromDb(odclasses: string, modelsize?: string): string[] {
    const classMap = getClassMap(modelsize)

    // Empty → default to ALL classes for this model
    if (!odclasses || odclasses.trim() === '') {
      return Object.values(classMap)
    }

    return odclasses
      .split(',')
      .map((cls) => cls.trim())
      .filter(Boolean)
      .map((id) => {
        const classId = parseInt(id)
        return classMap[classId as keyof typeof classMap] ?? ''
      })
      .filter((name) => name !== '')
  }
}