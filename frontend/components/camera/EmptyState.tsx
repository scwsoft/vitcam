import { Button } from '@/components/ui/button'
import { Camera, Plus } from 'lucide-react'

interface EmptyStateProps {
  onAddCamera: () => void
}

export function EmptyState({ onAddCamera }: EmptyStateProps) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700">
      <div className="text-center py-16 px-8">
        <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900 rounded-full flex items-center justify-center">
          <Camera size={48} className="text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-2">
          No cameras configured
        </h3>
        <p className="text-slate-600 dark:text-slate-300 mb-8 text-lg">
          Get started by adding your first security camera to the system
        </p>
        <Button 
          onClick={onAddCamera}
          className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
        >
          <Plus size={18} className="mr-2" />
          Add Your First Camera
        </Button>
      </div>
    </div>
  )
}