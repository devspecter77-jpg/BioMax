'use client'

import { formatSum } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useReportData } from '../_hooks/useReportData'
import type { ReportTur } from '@/lib/hisobotlar'

interface OmborTovar {
  tovarId: string
  nomi: string
  birlik: string
  qoldiq: number
  kelishNarxi: number
  jami_qiymat: number
  minQoldiq: number | null
  kritik: boolean
}

interface OmborResponse {
  tovarlar: OmborTovar[]
  jamiQiymat: number
  kritikCount: number
  tovarCount: number
}

interface Props {
  filtrlar: { tur: ReportTur; dan: string; gacha: string; [key: string]: unknown }
  isKassir: boolean
}

export function OmborTab({ filtrlar }: Props) {
  const { data, yuklanmoqda } = useReportData<OmborResponse>('/api/hisobotlar/ombor', filtrlar)

  if (yuklanmoqda) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-600 gap-3">
        <Loader2 className="animate-spin w-6 h-6 text-red-500" />
        <span>Yuklanmoqda...</span>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-8 text-center">
        <p className="text-gray-400 dark:text-gray-600">Ma&apos;lumot topilmadi</p>
      </div>
    )
  }

  const top10 = data.tovarlar.slice(0, 10)

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4">
          <p className="text-gray-500 dark:text-gray-500 text-xs">Jami qiymat</p>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            {formatSum(data.jamiQiymat)}
          </p>
        </div>
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4">
          <p className="text-gray-500 dark:text-gray-500 text-xs">Tovarlar</p>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            {data.tovarCount} ta
          </p>
        </div>
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4">
          <p className="text-gray-500 dark:text-gray-500 text-xs">Kritik qoldiq</p>
          <p
            className={`text-xl font-bold mt-1 ${
              data.kritikCount > 0
                ? 'text-red-600 dark:text-red-400'
                : 'text-green-600 dark:text-green-400'
            }`}
          >
            {data.kritikCount} ta
          </p>
        </div>
      </div>

      {/* Top 10 tovar by qoldiq qiymat */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
        <h2 className="text-gray-900 dark:text-gray-100 font-semibold mb-4">
          Top 10 — ombor qiymati bo&apos;yicha
        </h2>
        {top10.length === 0 ? (
          <p className="text-gray-400 dark:text-gray-600 text-center py-8">
            Ma&apos;lumot yo&apos;q
          </p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={top10}
                layout="vertical"
                margin={{ top: 5, right: 10, bottom: 5, left: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                <XAxis
                  type="number"
                  stroke="#6b7280"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => (v / 1000000).toFixed(1) + 'M'}
                />
                <YAxis
                  type="category"
                  dataKey="nomi"
                  stroke="#6b7280"
                  tick={{ fontSize: 10 }}
                  width={120}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '12px',
                    color: '#f9fafb',
                  }}
                  formatter={(v: number | undefined) => [formatSum(v ?? 0), 'Qiymat']}
                />
                <Bar dataKey="jami_qiymat" fill="#DC2626" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Kritik qoldiqlar */}
      {data.kritikCount > 0 && (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
          <div className="mb-4">
            <h2 className="text-gray-900 dark:text-gray-100 font-semibold">Kritik qoldiqlar</h2>
            <p className="text-gray-400 dark:text-gray-600 text-xs mt-0.5">
              Min qoldiqdan past tovarlar
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-neutral-800">
                  <th className="text-left pb-3 text-gray-500 dark:text-gray-500 font-medium">
                    Tovar
                  </th>
                  <th className="text-right pb-3 text-gray-500 dark:text-gray-500 font-medium">
                    Qoldiq
                  </th>
                  <th className="text-right pb-3 text-gray-500 dark:text-gray-500 font-medium">
                    Min
                  </th>
                  <th className="text-right pb-3 text-gray-500 dark:text-gray-500 font-medium">
                    Qiymat
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-neutral-800">
                {data.tovarlar
                  .filter((t) => t.kritik)
                  .map((t, i) => (
                    <tr key={i}>
                      <td className="py-2.5 text-gray-700 dark:text-gray-300 max-w-[180px] truncate">
                        {t.nomi}
                      </td>
                      <td className="py-2.5 text-right text-red-600 dark:text-red-400 font-semibold">
                        {t.qoldiq} {t.birlik}
                      </td>
                      <td className="py-2.5 text-right text-gray-500 dark:text-gray-500">
                        {t.minQoldiq ?? '—'}
                      </td>
                      <td className="py-2.5 text-right text-gray-900 dark:text-gray-100">
                        {formatSum(t.jami_qiymat)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* To'liq jadval */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
        <h2 className="text-gray-900 dark:text-gray-100 font-semibold mb-4">
          Barcha tovarlar ({data.tovarCount} ta)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-neutral-800">
                <th className="text-left pb-3 text-gray-500 dark:text-gray-500 font-medium">
                  Tovar
                </th>
                <th className="text-right pb-3 text-gray-500 dark:text-gray-500 font-medium">
                  Qoldiq
                </th>
                <th className="text-right pb-3 text-gray-500 dark:text-gray-500 font-medium">
                  Kelish narxi
                </th>
                <th className="text-right pb-3 text-gray-500 dark:text-gray-500 font-medium">
                  Jami qiymat
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-neutral-800">
              {data.tovarlar.map((t, i) => (
                <tr key={i} className={t.kritik ? 'bg-red-50/50 dark:bg-red-950/10' : ''}>
                  <td className="py-2.5 text-gray-700 dark:text-gray-300 max-w-[200px] truncate">
                    {t.nomi}
                    {t.kritik && (
                      <span className="ml-1.5 text-xs text-red-500 font-semibold">!</span>
                    )}
                  </td>
                  <td className="py-2.5 text-right text-gray-700 dark:text-gray-300">
                    {t.qoldiq} {t.birlik}
                  </td>
                  <td className="py-2.5 text-right text-gray-700 dark:text-gray-300">
                    {formatSum(t.kelishNarxi)}
                  </td>
                  <td className="py-2.5 text-right font-medium text-gray-900 dark:text-gray-100">
                    {formatSum(t.jami_qiymat)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
