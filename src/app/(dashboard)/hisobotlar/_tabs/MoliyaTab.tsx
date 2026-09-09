'use client'

import { TrendingUp, Sparkles, Receipt, DollarSign } from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { formatSum } from '@/lib/utils'
import { useReportData } from '../_hooks/useReportData'
import { KPICard } from '../_components/KPICard'
import { ReportSection } from '../_components/ReportSection'
import { SkeletonKPI, SkeletonChart } from '../_components/Skeletons'
import type { ReportTur } from '@/lib/hisobotlar'

interface PLData {
  joriy: {
    revenue: number
    cogs: number
    grossProfit: number
    opex: Record<string, number>
    netProfit: number
    margin: { gross: number; net: number }
  }
  trend: Array<{ sana: string; revenue: number; cogs: number; netProfit: number }>
}

interface Props {
  filtrlar: { tur: ReportTur; dan: string; gacha: string }
  isKassir: boolean
}

const OPEX_LABELS: Record<string, string> = {
  IJARA: 'Ijara',
  MAOSH: 'Maosh',
  TRANSPORT: 'Transport',
  KOMMUNAL: 'Kommunal',
  BOSHQA: 'Boshqa',
}

export function MoliyaTab({ filtrlar, isKassir }: Props) {
  const { data, yuklanmoqda, xato } = useReportData<PLData>(
    '/api/hisobotlar/moliya/p-and-l',
    filtrlar,
  )

  if (isKassir) {
    return (
      <div className="text-center text-gray-500 dark:text-gray-400 py-12">
        Ruxsat yo&apos;q
      </div>
    )
  }

  if (yuklanmoqda)
    return (
      <div className="space-y-4">
        <SkeletonKPI />
        <SkeletonChart />
      </div>
    )
  if (xato) return <div className="text-red-500 text-sm p-4">{xato}</div>
  if (!data) return null

  const { joriy, trend } = data

  return (
    <div className="space-y-6">
      {/* KPI KARTALAR */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={DollarSign}
          sarlavha="Daromad (Revenue)"
          qiymat={formatSum(joriy.revenue)}
          iconBg="bg-blue-500"
        />
        <KPICard
          icon={TrendingUp}
          sarlavha="Gross Profit"
          qiymat={formatSum(joriy.grossProfit)}
          qoshimcha={`Margin: ${joriy.margin.gross}%`}
          iconBg="bg-green-500"
        />
        <KPICard
          icon={Receipt}
          sarlavha="OPEX (Xarajatlar)"
          qiymat={formatSum(joriy.opex.total)}
          iconBg="bg-orange-500"
        />
        <KPICard
          icon={Sparkles}
          sarlavha="Net Profit (Sof foyda)"
          qiymat={formatSum(joriy.netProfit)}
          qoshimcha={`Margin: ${joriy.margin.net}%`}
          iconBg={joriy.netProfit >= 0 ? 'bg-green-600' : 'bg-red-500'}
          rang={
            joriy.netProfit >= 0
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400'
          }
        />
      </div>

      {/* P&L JADVAL */}
      <ReportSection sarlavha="P&L Statement" izoh="Joriy davr">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 dark:border-neutral-800">
              <tr className="text-gray-500 dark:text-gray-400 text-xs">
                <th className="text-left py-2 px-2"></th>
                <th className="text-right py-2 px-2">Joriy davr</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100 dark:border-neutral-800/50">
                <td className="py-2 px-2 text-gray-700 dark:text-gray-300">Daromad</td>
                <td className="text-right py-2 px-2 font-medium">
                  {formatSum(joriy.revenue)}
                </td>
              </tr>
              <tr className="border-b border-gray-100 dark:border-neutral-800/50">
                <td className="py-2 px-2 text-gray-500 dark:text-gray-400 pl-6">
                  (−) COGS (Tannarx)
                </td>
                <td className="text-right py-2 px-2 text-red-600">
                  -{formatSum(joriy.cogs)}
                </td>
              </tr>
              <tr className="border-b-2 border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800/30">
                <td className="py-2 px-2 font-semibold">Gross Profit</td>
                <td className="text-right py-2 px-2 font-bold text-green-600">
                  {formatSum(joriy.grossProfit)}
                </td>
              </tr>
              {Object.entries(OPEX_LABELS).map(([kateg, label]) => (
                <tr key={kateg} className="border-b border-gray-100 dark:border-neutral-800/50">
                  <td className="py-2 px-2 text-gray-500 dark:text-gray-400 pl-6">
                    (−) {label}
                  </td>
                  <td className="text-right py-2 px-2 text-red-600">
                    -{formatSum(joriy.opex[kateg] || 0)}
                  </td>
                </tr>
              ))}
              <tr className="border-b-2 border-gray-300 dark:border-neutral-700 bg-amber-50 dark:bg-amber-950/20">
                <td className="py-3 px-2 font-bold text-base">NET PROFIT (Sof foyda)</td>
                <td
                  className={`text-right py-3 px-2 font-bold text-base ${
                    joriy.netProfit >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {formatSum(joriy.netProfit)}
                </td>
              </tr>
              <tr>
                <td className="py-2 px-2 text-xs text-gray-400" colSpan={2}>
                  Gross margin:{' '}
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {joriy.margin.gross}%
                  </span>{' '}
                  · Net margin:{' '}
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {joriy.margin.net}%
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ReportSection>

      {/* TREND CHART */}
      <ReportSection
        sarlavha="Foyda dinamikasi"
        izoh="Daromad, Tannarx, Sof foyda — kunlar bo'yicha"
      >
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16A34A" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#16A34A" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="sana"
                stroke="#6b7280"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickFormatter={(v: string) => v.slice(5)}
              />
              <YAxis
                stroke="#6b7280"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickFormatter={(v: number) => (v / 1_000_000).toFixed(1) + 'M'}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '12px',
                  color: '#f9fafb',
                }}
                formatter={(v: number | string | undefined, name: string | undefined) => {
                  const labels: Record<string, string> = {
                    revenue: 'Daromad',
                    cogs: 'Tannarx',
                    netProfit: 'Sof foyda',
                  }
                  return [formatSum(Number(v ?? 0)), labels[name ?? ''] ?? name]
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#3B82F6"
                strokeWidth={2}
                fill="url(#revGrad)"
              />
              <Area
                type="monotone"
                dataKey="netProfit"
                stroke="#16A34A"
                strokeWidth={2}
                fill="url(#netGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ReportSection>
    </div>
  )
}
