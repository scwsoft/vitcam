import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CameraFormData, CameraFormErrors } from '@/types/camera.types'
import { 
  CAMERA_TYPES, 
  ENCODER_TYPES, 
  RESOLUTION_OPTIONS, 
  FPS_OPTIONS, 
  RECORDING_TYPES 
} from '@/constants/camera.constants'

interface CameraFormFieldsProps {
  formData: CameraFormData
  errors: CameraFormErrors
  onUpdate: (field: keyof CameraFormData, value: any) => void
}

export function CameraFormFields({ formData, errors, onUpdate }: CameraFormFieldsProps) {
  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <div className="space-y-2">
        <Label htmlFor="name" className="text-sm font-medium">
          Camera Name <span className="text-red-500">*</span>
        </Label>
        <Input
          id="name"
          placeholder="Enter camera name"
          value={formData.name}
          onChange={(e) => onUpdate('name', e.target.value)}
          className={errors.name ? 'border-red-500' : ''}
        />
        {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="type" className="text-sm font-medium">
          Camera Type <span className="text-red-500">*</span>
        </Label>
        <Select 
          key={`type-${formData.type}`}
          value={formData.type} 
          onValueChange={(value) => onUpdate('type', value)}
        >
          <SelectTrigger className={errors.type ? 'border-red-500' : ''}>
            <SelectValue placeholder="Select camera type" />
          </SelectTrigger>
          <SelectContent>
            {CAMERA_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.type && <p className="text-xs text-red-500">{errors.type}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="url" className="text-sm font-medium">
          Camera URL <span className="text-red-500">*</span>
        </Label>
        <Input
          id="url"
          type="url"
          placeholder="rtsp://username:password@192.168.1.100:554/stream"
          value={formData.url}
          onChange={(e) => onUpdate('url', e.target.value)}
          className={errors.url ? 'border-red-500' : ''}
        />
        {errors.url && <p className="text-xs text-red-500">{errors.url}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description" className="text-sm font-medium">
          Description
        </Label>
        <Textarea
          id="description"
          placeholder="Enter camera description"
          value={formData.description}
          onChange={(e) => onUpdate('description', e.target.value)}
          rows={3}
        />
      </div>

      {/* Stream Configuration */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="encoder" className="text-sm font-medium">
            Encoder <span className="text-red-500">*</span>
          </Label>
          <Select 
            key={`encoder-${formData.encoder}`}
            value={formData.encoder} 
            onValueChange={(value) => onUpdate('encoder', value)}
          >
            <SelectTrigger className={errors.encoder ? 'border-red-500' : ''}>
              <SelectValue placeholder="Select encoder" />
            </SelectTrigger>
            <SelectContent>
              {ENCODER_TYPES.map((encoder) => (
                <SelectItem key={encoder.value} value={encoder.value}>
                  {encoder.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.encoder && <p className="text-xs text-red-500">{errors.encoder}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="resolution" className="text-sm font-medium">
            Resolution <span className="text-red-500">*</span>
          </Label>
          <Select 
            key={`resolution-${formData.resolution}`}
            value={formData.resolution} 
            onValueChange={(value) => onUpdate('resolution', value)}
          >
            <SelectTrigger className={errors.resolution ? 'border-red-500' : ''}>
              <SelectValue placeholder="Select resolution" />
            </SelectTrigger>
            <SelectContent>
              {RESOLUTION_OPTIONS.map((res) => (
                <SelectItem key={res.value} value={res.value}>
                  {res.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.resolution && <p className="text-xs text-red-500">{errors.resolution}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="fps" className="text-sm font-medium">
            FPS <span className="text-red-500">*</span>
          </Label>
          <Select 
            key={`fps-${formData.fps}`}
            value={formData.fps.toString()} 
            onValueChange={(value) => onUpdate('fps', parseInt(value))}
          >
            <SelectTrigger className={errors.fps ? 'border-red-500' : ''}>
              <SelectValue placeholder="Select FPS" />
            </SelectTrigger>
            <SelectContent>
              {FPS_OPTIONS.map((fps) => (
                <SelectItem key={fps.value} value={fps.value.toString()}>
                  {fps.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.fps && <p className="text-xs text-red-500">{errors.fps}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="rectype" className="text-sm font-medium">
            Recording Type <span className="text-red-500">*</span>
          </Label>
          <Select 
            key={`rectype-${formData.rectype}`}
            value={formData.rectype} 
            onValueChange={(value) => onUpdate('rectype', value)}
          >
            <SelectTrigger className={errors.rectype ? 'border-red-500' : ''}>
              <SelectValue placeholder="Select recording type" />
            </SelectTrigger>
            <SelectContent>
              {RECORDING_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.rectype && <p className="text-xs text-red-500">{errors.rectype}</p>}
        </div>
      </div>
    </div>
  )
}