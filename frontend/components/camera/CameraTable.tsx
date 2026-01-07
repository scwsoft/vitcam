import { Camera } from '@/types/camera.types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Camera as CameraIcon, Edit, Trash2 } from 'lucide-react'
import { URLDisplay } from './URLDisplay'

interface CameraTableProps {
  cameras: Camera[]
  onEdit: (camera: Camera) => void
  onDelete: (id: number) => void
}

export function CameraTable({ cameras, onEdit, onDelete }: CameraTableProps) {
  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this camera?')) {
      onDelete(id)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700">
            <TableHead className="font-semibold text-slate-700 dark:text-slate-300">Name</TableHead>
            <TableHead className="font-semibold text-slate-700 dark:text-slate-300">Type</TableHead>
            <TableHead className="font-semibold text-slate-700 dark:text-slate-300">URL</TableHead>
            <TableHead className="font-semibold text-slate-700 dark:text-slate-300">Description</TableHead>
            <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cameras.map((camera) => (
            <TableRow 
              key={camera.id} 
              className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
            >
              <TableCell className="font-medium">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg">
                    <CameraIcon size={16} className="text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      {camera.name}
                    </div>
                    {camera.is_detection && (
                      <Badge 
                        variant="outline" 
                        className="text-xs mt-1 bg-gradient-to-r from-purple-500 to-pink-600 text-white border-0"
                      >
                        AI Detection
                      </Badge>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge 
                  variant="secondary" 
                  className="bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-900 dark:to-teal-900 text-emerald-800 dark:text-emerald-200 border-0"
                >
                  {camera.type}
                </Badge>
              </TableCell>
              <TableCell>
                <URLDisplay url={camera.url} />
              </TableCell>
              <TableCell className="max-w-sm">
                <div className="truncate text-slate-600 dark:text-slate-300" title={camera.description}>
                  {camera.description || '-'}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(camera)}
                    className="hover:bg-blue-100 dark:hover:bg-blue-900 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    <Edit size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(camera.id)}
                    className="hover:bg-red-100 dark:hover:bg-red-900 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}