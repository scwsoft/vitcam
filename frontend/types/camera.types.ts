export interface Camera {
  id: number
  name: string
  type: string
  url: string
  description?: string
  odthreshold: number
  is_detection: boolean
  odclasses: string
  encoder: string
  resolution: string
  fps: number
  rectype: string
  created_at?: string
  updated_at?: string
}

export interface CameraFormData {
  name: string
  type: string
  url: string
  description: string
  odthreshold: number
  is_detection: boolean
  odclasses: string[]
  encoder: string
  resolution: string
  fps: number
  rectype: string
}

export interface CameraFormErrors {
  name?: string
  type?: string
  url?: string
  description?: string
  odthreshold?: string
  is_detection?: string
  odclasses?: string
  encoder?: string
  resolution?: string
  fps?: string
  rectype?: string
}

export type CameraType = 'RTSP' | 'HTTP' | 'Youtube Live' 
export type RecordingType = 'continuous' | 'motion' | 'none' 
export type EncoderType = 'h264' | 'h265' | 'mjpeg' | 'vp8' | 'vp9'