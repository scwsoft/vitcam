'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Camera, Save, Settings } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useCamera } from '@/hooks/useCamera'
import { useCameraForm } from '@/hooks/useCameraForm'
import { CameraFormFields, DetectionSettings, LoadingState } from '@/components/camera'

interface EditCameraPageProps {
  params: Promise<{ id: string }>
}

export default function EditCameraPage({ params }: EditCameraPageProps) {
  const { id } = use(params)
  const router = useRouter()
  const { loading: authLoading } = useAuth()
  const { camera, loading: cameraLoading } = useCamera(id)
  const { formData, errors, submitting, updateField, handleSubmit } = useCameraForm(camera, true)
 
  const onSubmit = async (e) => {
    e.preventDefault()
   
    const result = await handleSubmit(id)
   
    if (!result.success && result.error) {
      alert(result.error)
    }

  }

  if (authLoading || cameraLoading) {
    return <LoadingState />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-700">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push('/camera')}
            className="mb-4 hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            <ArrowLeft size={18} className="mr-2" />
            Back to Cameras
          </Button>
          
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
              Edit Camera
            </h1>
            <p className="text-slate-600 dark:text-slate-300 text-lg">
              Update camera configuration and detection settings
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit}>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Left Column - Camera Information */}
            <div className="xl:col-span-2 space-y-6">
              <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-200 dark:border-slate-700">
                <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg">
                    <Camera size={20} className="text-white" />
                  </div>
                  Camera Information
                </h3>
                <CameraFormFields 
                  formData={formData} 
                  errors={errors} 
                  onUpdate={updateField} 
                />
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-200 dark:border-slate-700">
                <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg">
                    <Settings size={20} className="text-white" />
                  </div>
                  Stream Configuration
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  Configure video stream settings for optimal performance
                </p>
              </div>
            </div>

            {/* Right Column - AI Detection Settings */}
            <div className="xl:col-span-1">
              <DetectionSettings 
                formData={formData} 
                errors={errors} 
                onUpdate={updateField} 
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-6 mt-6 border-t border-slate-200 dark:border-slate-700">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/camera')}
              className="hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Cancel
            </Button>
            
            <Button 
              type="submit" 
              disabled={submitting} 
              className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={16} className="mr-2" />
                  Update Camera
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}