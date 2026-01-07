'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { useCameras } from '@/hooks/useCamera'
import { CameraTable, EmptyState, LoadingState } from '@/components/camera'
import { useAuth } from '@/hooks/useAuth';

export default function CameraManagementPage() {
  const router = useRouter()
  const { cameras, loading, deleteCamera } = useCameras()
  const { user, loading: authLoading, error: authError } = useAuth();

  const handleAddCamera = () => {
    router.push('/camera/add')
  }

  const handleEdit = (camera: any) => {
    router.push(`/camera/edit/${camera.id}`)
  }

  const handleDelete = async (id: number) => {
    const result = await deleteCamera(id)
    if (!result.success) {
      alert(result.error || 'Failed to delete camera')
    }
  }

  if (loading && !authError) {
    return <LoadingState />
  }

  return  user ? (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-700">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
              Camera Management
            </h1>
            <p className="text-slate-600 dark:text-slate-300 text-lg">
              Manage your security cameras and detection settings
            </p>
          </div>
          
          <Button 
            onClick={handleAddCamera} 
            className="group bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
          >
            <Plus size={18} className="mr-2 group-hover:rotate-90 transition-transform duration-200" />
            Add Camera
          </Button>
        </div>

        {cameras.length === 0 ? (
          <EmptyState onAddCamera={handleAddCamera} />
        ) : (
          <CameraTable 
            cameras={cameras} 
            onEdit={handleEdit} 
            onDelete={handleDelete} 
          />
        )}
      </div>
    </div>
  ) : router.push('/signin');
}