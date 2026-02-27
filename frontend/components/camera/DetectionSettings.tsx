import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command'
import { Check, ChevronsUpDown, X, Zap } from 'lucide-react'
import { CameraFormData, CameraFormErrors } from '@/types/camera.types'
import { DETECTION_CLASSES } from '@/constants/camera.constants'

interface DetectionSettingsProps {
  formData: CameraFormData
  errors: CameraFormErrors
  onUpdate: (field: keyof CameraFormData, value: any) => void
}

export function DetectionSettings({ formData, errors, onUpdate }: DetectionSettingsProps) {
  const [isClassSelectorOpen, setIsClassSelectorOpen] = useState(false)

  const allClasses = Object.values(DETECTION_CLASSES)
  const allSelected = formData.odclasses.length === allClasses.length

  const handleClassSelect = (className: string) => {
    const currentClasses = formData.odclasses
    const newClasses = currentClasses.includes(className)
      ? currentClasses.filter(c => c !== className)
      : [...currentClasses, className]
    onUpdate('odclasses', newClasses)
  }

  const handleSelectAll = () => {
    onUpdate('odclasses', allSelected ? [] : allClasses)
  }

  const removeSelectedClass = (className: string) => {
    onUpdate('odclasses', formData.odclasses.filter(c => c !== className))
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-200 dark:border-slate-700 sticky top-8">
      <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-3">
        <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg">
          <Zap size={20} className="text-white" />
        </div>
        AI Detection Settings
      </h3>
      
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <Switch
            checked={formData.is_detection}
            onCheckedChange={(checked) => onUpdate('is_detection', checked)}
            className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-purple-500 data-[state=checked]:to-pink-600"
          />
          <Label className="text-base font-medium">Enable Object Detection</Label>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="odthreshold" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Detection Threshold (%)
            </Label>
            <Input
              id="odthreshold"
              type="number"
              min="1"
              max="100"
              value={formData.odthreshold}
              onChange={(e) => onUpdate('odthreshold', parseInt(e.target.value))}
              disabled={!formData.is_detection}
              className={`${
                !formData.is_detection 
                  ? 'opacity-50 cursor-not-allowed' 
                  : 'focus:ring-purple-500 focus:border-purple-500'
              } ${errors.odthreshold ? 'border-red-500' : ''}`}
            />
            {errors.odthreshold && (
              <p className="text-xs text-red-500">{errors.odthreshold}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Detection Classes
            </Label>
            <Popover open={isClassSelectorOpen} onOpenChange={setIsClassSelectorOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={isClassSelectorOpen}
                  className={`w-full justify-between ${
                    !formData.is_detection 
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'hover:border-purple-500 focus:border-purple-500 focus:ring-purple-500'
                  } ${errors.odclasses ? 'border-red-500' : ''}`}
                  disabled={!formData.is_detection}
                >
                  {formData.odclasses.length === 0 
                    ? "Select detection classes..." 
                    : allSelected
                    ? "All classes selected"
                    : `${formData.odclasses.length} class${formData.odclasses.length === 1 ? '' : 'es'} selected`
                  }
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search detection classes..." />
                  <CommandEmpty>No classes found.</CommandEmpty>
                  <CommandGroup className="max-h-64 overflow-auto">
                    <CommandItem
                      value="select all classes"
                      onSelect={handleSelectAll}
                      className="font-medium border-b"
                    >
                      <Check
                        className={`mr-2 h-4 w-4 ${allSelected ? "opacity-100" : "opacity-0"}`}
                      />
                      Select All Classes ({allClasses.length})
                    </CommandItem>
                    
                    {allClasses.map((name) => {
                      const isSelected = formData.odclasses.includes(name)
                      return (
                        <CommandItem
                          key={name}
                          value={name}
                          onSelect={() => handleClassSelect(name)}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${isSelected ? "opacity-100" : "opacity-0"}`}
                          />
                          {name}
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
            {errors.odclasses && (
              <p className="text-xs text-red-500">{errors.odclasses}</p>
            )}

            {formData.odclasses.length > 0 && formData.is_detection && (
              <div className="mt-3">
                {allSelected ? (
                  <Badge variant="outline" className="text-xs bg-gradient-to-r from-purple-500 to-pink-600 text-white border-0">
                    All classes selected ({formData.odclasses.length})
                  </Badge>
                ) : (
                  <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-3 bg-slate-50 dark:bg-slate-700 rounded-lg border">
                    {formData.odclasses.map((className) => (
                      <Badge
                        key={className}
                        variant="secondary"
                        className="text-xs flex items-center gap-1 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900 dark:to-pink-900"
                      >
                        {className}
                        <button
                          type="button"
                          onClick={() => removeSelectedClass(className)}
                          className="ml-1 hover:text-red-500 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}