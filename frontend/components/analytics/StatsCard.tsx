import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  subtitle?: string;
  color?: 'violet' | 'blue' | 'emerald' | 'fuchsia' | 'amber' | 'rose';
}

const colorClasses = {
  violet: {
    gradient: 'from-violet-500/20 to-violet-600/20 dark:from-violet-500/20 dark:to-violet-600/20',
    border: 'border-violet-200 dark:border-violet-500/30',
    icon: 'text-violet-600 dark:text-violet-400',
    trend: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-50 dark:bg-violet-600/10',
  },
  blue: {
    gradient: 'from-blue-500/20 to-blue-600/20 dark:from-blue-500/20 dark:to-blue-600/20',
    border: 'border-blue-200 dark:border-blue-500/30',
    icon: 'text-blue-600 dark:text-blue-400',
    trend: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-600/10',
  },
  emerald: {
    gradient: 'from-emerald-500/20 to-emerald-600/20 dark:from-emerald-500/20 dark:to-emerald-600/20',
    border: 'border-emerald-200 dark:border-emerald-500/30',
    icon: 'text-emerald-600 dark:text-emerald-400',
    trend: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-600/10',
  },
  fuchsia: {
    gradient: 'from-fuchsia-500/20 to-fuchsia-600/20 dark:from-fuchsia-500/20 dark:to-fuchsia-600/20',
    border: 'border-fuchsia-200 dark:border-fuchsia-500/30',
    icon: 'text-fuchsia-600 dark:text-fuchsia-400',
    trend: 'text-fuchsia-600 dark:text-fuchsia-400',
    bg: 'bg-fuchsia-50 dark:bg-fuchsia-600/10',
  },
  amber: {
    gradient: 'from-amber-500/20 to-amber-600/20 dark:from-amber-500/20 dark:to-amber-600/20',
    border: 'border-amber-200 dark:border-amber-500/30',
    icon: 'text-amber-600 dark:text-amber-400',
    trend: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-600/10',
  },
  rose: {
    gradient: 'from-rose-500/20 to-rose-600/20 dark:from-rose-500/20 dark:to-rose-600/20',
    border: 'border-rose-200 dark:border-rose-500/30',
    icon: 'text-rose-600 dark:text-rose-400',
    trend: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-600/10',
  },
};

const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon: Icon,
  trend,
  subtitle,
  color = 'violet',
}) => {
  const colors = colorClasses[color];

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ${colors.border} bg-gray-50 dark:bg-gray-900 dark:${colors.gradient} backdrop-blur-xl p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl group`}
    >
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-100/50 to-transparent dark:from-white/5 dark:to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 rounded-xl ${colors.bg} ${colors.icon}`}>
            <Icon className="w-6 h-6" />
          </div>
          {trend && (
            <div className={`text-sm font-medium ${colors.trend} ${colors.bg} px-3 py-1 rounded-full`}>
              +{trend.value}
            </div>
          )}
        </div>

        <h3 className="text-gray-600 dark:text-gray-400 text-sm font-medium mb-2">{title}</h3>
        <p className="text-3xl font-bold text-gray-900 dark:text-gray-900 dark:text-white mb-1">{value}</p>
        {(trend?.label || subtitle) && (
          <p className="text-gray-500 dark:text-gray-500 text-sm">
            {trend?.label || subtitle}
          </p>
        )}
      </div>

      {/* Decorative element */}
      <div className={`absolute -right-4 -bottom-4 w-24 h-24 rounded-full ${colors.gradient} blur-2xl opacity-20 group-hover:opacity-30 transition-opacity`} />
    </div>
  );
};

export default StatsCard;