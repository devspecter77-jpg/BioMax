'use client'
import type { LucideIcon } from 'lucide-react'

interface Props {
  icon: LucideIcon
  sarlavha: string
  qiymat: string
  qoshimcha?: string
  trend?: React.ReactNode
  iconBg: string
  rang?: string
}

export function KPICard({
  icon: Icon,
  sarlavha,
  qiymat,
  qoshimcha,
  trend,
  iconBg,
  rang = 'text-gray-900 dark:text-gray-100',
}: Props) {
  return (
    <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-gray-500 dark:text-gray-400 text-xs">{sarlavha}</p>
          <p className={`text-xl font-bold mt-1 ${rang}`}>{qiymat}</p>
          {qoshimcha && (
            <p className="text-gray-500 dark:text-gray-400 text-xs">{qoshimcha}</p>
          )}
          {trend && <div className="mt-1">{trend}</div>}
        </div>
        <div
          className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center shrink-0`}
        >
          <Icon size={18} className="text-white" />
        </div>
      </div>
    </div>
  )
}
