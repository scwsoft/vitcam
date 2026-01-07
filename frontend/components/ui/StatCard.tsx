import { type LucideIcon } from 'lucide-react'

interface StatCardProps {
  icon: LucideIcon
  title: string
  value: string | number
  subtitle?: string
  iconColor?: string
  trend?: {
    value: number
    isPositive: boolean
  }
}

export function StatCard({ 
  icon: Icon, 
  title, 
  value, 
  subtitle, 
  iconColor = 'text-violet-600',
  trend 
}: StatCardProps) {
  return (
    <div className="rounded-2xl shadow-sm border p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <Icon className={`w-5 h-5 ${iconColor}`} />
          <span className="text-sm opacity-70">{title}</span>
        </div>
        {trend && (
          <span className={`text-xs font-medium ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {trend.isPositive ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>
      <p className="text-3xl font-bold">{value}</p>
      {subtitle && <p className="text-xs opacity-60 mt-1">{subtitle}</p>}
    </div>
  )
}