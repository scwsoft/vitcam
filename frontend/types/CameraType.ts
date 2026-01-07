interface ICameraProps {
    Name: string,
    Url: string,
    IsRealTimeDetection:boolean,
    SignalingServer: string,
  }
  

  interface Camera {
  id: number
  name: string
  type: string
  url: string
  description: string
  odthredshold: number
  is_detection: boolean
  odclasses: string
  encoder: string
  resolution: string
  fps: number
  rectype: string
}

interface CameraFormData {
  name: string
  type: string
  url: string
  description: string
  odthredshold: number
  is_detection: boolean
  odclasses: string
  encoder: string
  resolution: string
  fps: number
  rectype: string
}

