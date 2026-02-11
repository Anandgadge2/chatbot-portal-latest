'use client';

import { LucideIcon } from 'lucide-react';
import { ArrowUpRight, ArrowDownRight, TrendingUp } from 'lucide-react';

interface KPITileProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'indigo';
  trend?: {
    value: number;
    isPositive: boolean;
  };
  onClick?: () => void;
  className?: string;
}

const colorClasses = {
  blue: {
    bg: 'from-blue-500 to-blue-600',
    icon: 'bg-blue-100 text-blue-600',
    hover: 'hover:from-blue-600 hover:to-blue-700'
  },
  green: {
    bg: 'from-green-500 to-green-600',
    icon: 'bg-green-100 text-green-600',
    hover: 'hover:from-green-600 hover:to-green-700'
  },
  yellow: {
    bg: 'from-yellow-500 to-yellow-600',
    icon: 'bg-yellow-100 text-yellow-600',
    hover: 'hover:from-yellow-600 hover:to-yellow-700'
  },
  red: {
    bg: 'from-red-500 to-red-600',
    icon: 'bg-red-100 text-red-600',
    hover: 'hover:from-red-600 hover:to-red-700'
  },
  purple: {
    bg: 'from-purple-500 to-purple-600',
    icon: 'bg-purple-100 text-purple-600',
    hover: 'hover:from-purple-600 hover:to-purple-700'
  },
  indigo: {
    bg: 'from-indigo-500 to-indigo-600',
    icon: 'bg-indigo-100 text-indigo-600',
    hover: 'hover:from-indigo-600 hover:to-indigo-700'
  }
};

export default function KPITile({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  trend,
  onClick,
  className = ''
}: KPITileProps) {
  const colors = colorClasses[color];

  return (
    <div
      onClick={onClick}
      className={`
        relative overflow-hidden rounded-xl shadow-lg 
        bg-gradient-to-br ${colors.bg} ${onClick ? `${colors.hover} cursor-pointer` : ''}
        text-white p-6 
        transform transition-all duration-200 
        ${onClick ? 'hover:scale-105 hover:shadow-2xl' : ''}
        ${className}
      `}
    >
      {/* Background Pattern */}
      <div className="absolute top-0 right-0 w-32 h-32 opacity-10">
        <div className="absolute inset-0 transform rotate-12">
          <Icon className="w-full h-full" />
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 rounded-lg ${colors.icon}`}>
            <Icon className="w-6 h-6" />
          </div>
          {trend && (
            <div className={`flex items-center space-x-1 text-xs font-semibold ${
              trend.isPositive ? 'text-green-200' : 'text-red-200'
            }`}>
              {trend.isPositive ? (
                <ArrowUpRight className="w-4 h-4" />
              ) : (
                <ArrowDownRight className="w-4 h-4" />
              )}
              <span>{Math.abs(trend.value)}%</span>
            </div>
          )}
        </div>

        <div className="space-y-1">
          <h3 className="text-sm font-medium text-white text-opacity-90">
            {title}
          </h3>
          <p className="text-3xl font-bold tracking-tight">
            {value}
          </p>
          {subtitle && (
            <p className="text-sm text-white text-opacity-80 flex items-center">
              <TrendingUp className="w-3 h-3 mr-1" />
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Shine Effect on Hover */}
      {onClick && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 hover:opacity-10 transform -skew-x-12 transition-all duration-700" />
      )}
    </div>
  );
}
