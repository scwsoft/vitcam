'use client'

import { Brain, Cpu, Layers, SlidersHorizontal, Tag } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { CameraFormData, CameraFormErrors } from '@/types/camera.types'
import {
  DETECTION_CLASSES,
  DETECTION_TYPE_OPTIONS,
  MODEL_SIZE_OPTIONS,
} from '@/constants/camera.constants'

interface DetectionSettingsProps {
  formData: CameraFormData
  errors: CameraFormErrors
  onUpdate: (field: keyof CameraFormData, value: any) => void
}

const ALL_CLASS_NAMES = Object.values(DETECTION_CLASSES)

export function DetectionSettings({ formData, errors, onUpdate }: DetectionSettingsProps) {
  const toggleClass = (className: string) => {
    const updated = formData.odclasses.includes(className)
      ? formData.odclasses.filter((c) => c !== className)
      : [...formData.odclasses, className]
    onUpdate('odclasses', updated)
  }

  const toggleAllClasses = () => {
    const allSelected = formData.odclasses.length === ALL_CLASS_NAMES.length
    onUpdate('odclasses', allSelected ? [] : [...ALL_CLASS_NAMES])
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-200 dark:border-slate-700 space-y-6 sticky top-6">
      {/* Header */}
      <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-3">
        <div className="p-2 bg-gradient-to-r from-violet-500 to-purple-600 rounded-lg">
          <Brain size={20} className="text-white" />
        </div>
        AI Detection Settings
      </h3>

      {/* Enable Detection toggle */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-700/50">
        <div className="space-y-0.5">
          <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Enable AI Detection
          </Label>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Run object detection on this camera feed
          </p>
        </div>
        <Switch
          checked={formData.is_detection}
          onCheckedChange={(checked) => onUpdate('is_detection', checked)}
        />
      </div>

      {/* All detection fields — only visible when detection is enabled */}
      {formData.is_detection && (
        <>
          {/* Model Size */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Cpu size={14} />
              Model Size
            </Label>
            <div className="grid grid-cols-1 gap-2">
              {MODEL_SIZE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onUpdate('modelsize', option.value)}
                  className={cn(
                    'flex items-center justify-between px-4 py-3 rounded-lg border text-left transition-all duration-150',
                    formData.modelsize === option.value
                      ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300'
                      : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 text-slate-700 dark:text-slate-300',
                  )}
                >
                  <span className="font-medium text-sm">{option.label}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 text-right max-w-[60%]">
                    {option.description}
                  </span>
                </button>
              ))}
            </div>
            {errors.modelsize && (
              <p className="text-xs text-red-500 mt-1">{errors.modelsize}</p>
            )}
          </div>

          {/* Detection Type */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Layers size={14} />
              Detection Type
            </Label>
            <div className="grid grid-cols-1 gap-2">
              {DETECTION_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onUpdate('detectiontype', option.value)}
                  className={cn(
                    'flex items-center justify-between px-4 py-3 rounded-lg border text-left transition-all duration-150',
                    formData.detectiontype === option.value
                      ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300'
                      : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 text-slate-700 dark:text-slate-300',
                  )}
                >
                  <span className="font-medium text-sm">{option.label}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 text-right max-w-[60%]">
                    {option.description}
                  </span>
                </button>
              ))}
            </div>
            {errors.detectiontype && (
              <p className="text-xs text-red-500 mt-1">{errors.detectiontype}</p>
            )}
          </div>

          {/* Confidence Threshold */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <SlidersHorizontal size={14} />
                Confidence Threshold
              </Label>
              <Badge variant="secondary" className="font-mono text-xs">
                {formData.odthreshold}%
              </Badge>
            </div>
            <Slider
              value={[formData.odthreshold]}
              min={1}
              max={100}
              step={1}
              onValueChange={([val]) => onUpdate('odthreshold', val)}
              className="w-full"
            />
            {errors.odthreshold && (
              <p className="text-xs text-red-500">{errors.odthreshold}</p>
            )}
          </div>

          {/* Detection Classes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Tag size={14} />
                Detection Classes
              </Label>
              <button
                type="button"
                onClick={toggleAllClasses}
                className="text-xs text-violet-600 dark:text-violet-400 hover:underline"
              >
                {formData.odclasses.length === ALL_CLASS_NAMES.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-600 p-2 space-y-1">
              {ALL_CLASS_NAMES.map((cls) => {
                const selected = formData.odclasses.includes(cls)
                return (
                  <button
                    key={cls}
                    type="button"
                    onClick={() => toggleClass(cls)}
                    className={cn(
                      'w-full text-left px-3 py-1.5 rounded-md text-xs transition-colors',
                      selected
                        ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-medium'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700',
                    )}
                  >
                    {cls}
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {formData.odclasses.length} of {ALL_CLASS_NAMES.length} classes selected
            </p>
            {errors.odclasses && (
              <p className="text-xs text-red-500">{errors.odclasses}</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}