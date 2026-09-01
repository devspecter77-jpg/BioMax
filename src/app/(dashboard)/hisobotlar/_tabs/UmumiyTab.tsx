'use client'

import { formatSum } from '@/lib/utils'
import { ShoppingBag, TrendingUp, Receipt, Sparkles, Loader2 } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { useReportData } from '../_hooks/useReportData'
import type { ReportTur } from '@/lib/hisobotlar'

interface HisobotData {
  isKassir: boolean
  jamiSotuv: number
  jamiXarajat: number
  jamiDaromad: number
  soFoyda: number
  sotuvSoni: number
  ochiqNasiyalar: number
  muddatiOtgan: number
  jamiNasiyaQarz: number
  topTovarlar: { nomi: string; jami_miqdor: number; jami_summa: number }[]
  grafikData: { sana: string; sotuv: number; sotuvSoni: number }[]
  xarajatlarKategoriya: Record<string, number>
}

interface Props {
  filtrlar: { tur: ReportTur; dan: string; gacha: string; [key: string]: unknown }
  isKassir: boolean
}

// Hardcoded colors — safe for both light and dark mode (no CSS variables)
const PIE_RANGLAR = ['#DC2626', '#D4A017', '#2563eb', '#16a34a', '#7c3aed', '#0891b2', '#ea580c']

export function UmumiyTab({ filtrlar, isKassir }: Props) {
  const { data, yuklanmoqda } = useReportData<HisobotData>('/api/hisobotlar', filtrlar)

  // Build pie data from xarajatlarKategoriya
  const pieData = data
    ? Object.entries(data.xarajatlarKategoriya).map(([kat, summa]) => ({
        name: kat.toLowerCase(),
        value: summa,
      }))
    : []

  // Total xarajat sum for donut center label
  const pieTotal = pieData.reduce((acc, d) => acc + d.value, 0)

  if (yuklanmoqda) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-600 gap-3">
        <Loader2 className="animate-spin w-6 h-6 text-red-500" />
        <span>Yuklanmoqda...</span>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-4">
      {/* Asosiy ko'rsatkichlar */}
      <div className={`grid gap-4 ${isKassir ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2 lg:grid-cols-4'}`}>
        {[
          {
            icon: ShoppingBag,
            sarlavha: 'Jami sotuv',
            qiymat: formatSum(data.jamiSotuv),
            iconBg: 'bg-red-500',
            rang: 'text-gray-900 dark:text-gray-100',
            qosh: `${data.sotuvSoni} ta`,
            hidden: false,
          },
          {
            icon: TrendingUp,
            sarlavha: 'Daromad',
            qiymat: formatSum(data.jamiDaromad),
            iconBg: 'bg-blue-500',
            rang: 'text-gray-900 dark:text-gray-100',
            hidden: isKassir,
          },
          {
            icon: Receipt,
            sarlavha: 'Xarajatlar',
            qiymat: formatSum(data.jamiXarajat),
            iconBg: 'bg-orange-500',
            rang: 'text-red-600',
            hidden: isKassir,
          },
          {
            icon: Sparkles,
            sarlavha: 'Sof foyda',
            qiymat: formatSum(data.soFoyda),
            iconBg: data.soFoyda >= 0 ? 'bg-green-500' : 'bg-red-500',
            rang: data.soFoyda >= 0 ? 'text-green-600' : 'text-red-600',
            hidden: isKassir,
          },
        ]
          .filter((s) => !s.hidden)
          .map((s, i) => {
            const Icon = s.icon
            return (
              <div
                key={i}
                className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-gray-500 dark:text-gray-500 text-xs">{s.sarlavha}</p>
                    <p className={`text-xl font-bold mt-1 ${s.rang}`}>{s.qiymat}</p>
                    {'qosh' in s && s.qosh && (
                      <p className="text-gray-400 dark:text-gray-600 text-xs">{s.qosh}</p>
                    )}
                  </div>
                  <div
                    className={`w-10 h-10 ${s.iconBg} rounded-xl flex items-center justify-center shrink-0`}
                  >
                    <Icon size={18} className="text-white" />
                  </div>
                </div>
              </div>
            )
          })}
      </div>

      {/* Sotuv grafigi — BarChart with dark-mode safe Tooltip */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
        <h2 className="text-gray-900 dark:text-gray-100 font-semibold mb-4">Sotuv dinamikasi</h2>
        <div className="h-48 sm:h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.grafikData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
              {/* Hardcoded stroke — dark-friendly */}
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="sana" stroke="#6b7280" tick={{ fontSize: 11 }} />
              <YAxis
                stroke="#6b7280"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => (v / 1000000).toFixed(1) + 'M'}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '12px',
                  color: '#f9fafb',
                }}
                formatter={(v: number | undefined) => [formatSum(v ?? 0), 'Sotuv']}
              />
              <Bar dataKey="sotuv" fill="#DC2626" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top tovarlar */}
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
          <h2 className="text-gray-900 dark:text-gray-100 font-semibold mb-4">Top 10 tovar</h2>
          {data.topTovarlar.length === 0 ? (
            <p className="text-gray-400 dark:text-gray-600 text-center py-8">
              Ma&apos;lumot yo&apos;q
            </p>
          ) : (
            <div className="space-y-2">
              {data.topTovarlar.map((t, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-5 h-5 bg-red-50 text-red-600 rounded text-xs font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-800 dark:text-gray-200 text-sm truncate">{t.nomi}</p>
                    <div className="h-1.5 bg-gray-100 dark:bg-neutral-800 rounded-full mt-1">
                      <div
                        className="h-1.5 bg-red-500 rounded-full"
                        style={{
                          width: `${(t.jami_summa / data.topTovarlar[0].jami_summa) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-green-600 text-xs font-semibold shrink-0">
                    {formatSum(t.jami_summa)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Xarajatlar tarkibi — Donut chart (KASSIR ko'rmaydi) */}
        {!isKassir && pieData.length > 0 && (
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
            <h2 className="text-gray-900 dark:text-gray-100 font-semibold mb-4">
              Xarajatlar tarkibi
            </h2>
            <div className="h-64 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_RANGLAR[i % PIE_RANGLAR.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number | undefined) => [formatSum(v ?? 0), '']}
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '12px',
                      color: '#f9fafb',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Donut center label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-gray-400 dark:text-gray-500 text-xs">Jami</span>
                <span className="text-gray-900 dark:text-gray-100 text-sm font-bold leading-tight">
                  {formatSum(pieTotal)}
                </span>
              </div>
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {pieData.map((d, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: PIE_RANGLAR[i % PIE_RANGLAR.length] }}
                  />
                  <span className="text-gray-600 dark:text-gray-400 text-xs capitalize">
                    {d.name}
                  </span>
                  <span className="text-gray-900 dark:text-gray-100 text-xs font-medium">
                    {formatSum(d.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Nasiya holati — boxes with hardcoded background colors for dark mode safety */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
        <h2 className="text-gray-900 dark:text-gray-100 font-semibold mb-4">Nasiya holati</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="text-center p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40">
            <p className="text-amber-700 dark:text-amber-400 text-sm font-medium">Ochiq nasiyalar</p>
            <p className="text-amber-700 dark:text-amber-400 font-bold text-2xl mt-1">
              {data.ochiqNasiyalar}
            </p>
          </div>
          <div className="text-center p-3 rounded-xl bg-red-50 dark:bg-red-950/40">
            <p className="text-red-600 dark:text-red-400 text-sm font-medium">
              Muddati o&apos;tgan
            </p>
            <p className="text-red-600 dark:text-red-400 font-bold text-2xl mt-1">
              {data.muddatiOtgan}
            </p>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-neutral-800 rounded-xl">
            <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Umumiy qarz</p>
            <p className="text-gray-900 dark:text-gray-100 font-bold text-xl mt-1">
              {formatSum(data.jamiNasiyaQarz)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
