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

interface KassirStat {
  kassirId: string
  ism: string
  sotuvSoni: number
  jamiSotuv: number
  jamiDaromad: number
  o_rtachaCek: number
}

interface KassirlarResponse {
  kassirlar: KassirStat[]
  jamiSotuv: number
  sotuvSoni: number
}

interface Props {
  filtrlar: { tur: ReportTur; dan: string; gacha: string; [key: string]: unknown }
  isKassir: boolean
}

export function KassirlarTab({ filtrlar }: Props) {
  const { data, yuklanmoqda } = useReportData<KassirlarResponse>(
    '/api/hisobotlar/kassirlar',
    filtrlar,
  )

  if (yuklanmoqda) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500 dark:text-gray-400 gap-3">
        <Loader2 className="animate-spin w-6 h-6 text-red-500" />
        <span>Yuklanmoqda...</span>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-8 text-center">
        <p className="text-gray-500 dark:text-gray-400">Ma&apos;lumot topilmadi</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4">
          <p className="text-gray-500 dark:text-gray-400 text-xs">Jami sotuv</p>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            {formatSum(data.jamiSotuv)}
          </p>
        </div>
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4">
          <p className="text-gray-500 dark:text-gray-400 text-xs">Sotuvlar soni</p>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            {data.sotuvSoni} ta
          </p>
        </div>
      </div>

      {/* Kassirlar chart */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
        <h2 className="text-gray-900 dark:text-gray-100 font-semibold mb-4">
          Kassirlar reytingi (sotuv bo&apos;yicha)
        </h2>
        {data.kassirlar.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            Ma&apos;lumot yo&apos;q
          </p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.kassirlar}
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
                  dataKey="ism"
                  stroke="#6b7280"
                  tick={{ fontSize: 11 }}
                  width={100}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '12px',
                    color: '#f9fafb',
                  }}
                  formatter={(v: number | undefined) => [formatSum(v ?? 0), 'Jami sotuv']}
                />
                <Bar dataKey="jamiSotuv" fill="#DC2626" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Kassirlar tafsilot jadval */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
        <h2 className="text-gray-900 dark:text-gray-100 font-semibold mb-4">
          Kassirlar tafsiloti
        </h2>
        {data.kassirlar.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            Ma&apos;lumot yo&apos;q
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-neutral-800">
                  <th className="text-left pb-3 text-gray-500 dark:text-gray-400 font-medium">
                    Kassir
                  </th>
                  <th className="text-right pb-3 text-gray-500 dark:text-gray-400 font-medium">
                    Sotuvlar
                  </th>
                  <th className="text-right pb-3 text-gray-500 dark:text-gray-400 font-medium">
                    Jami sotuv
                  </th>
                  <th className="text-right pb-3 text-gray-500 dark:text-gray-400 font-medium">
                    Daromad
                  </th>
                  <th className="text-right pb-3 text-gray-500 dark:text-gray-400 font-medium">
                    O&apos;rtacha cek
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-neutral-800">
                {data.kassirlar.map((k, i) => (
                  <tr key={k.kassirId}>
                    <td className="py-2.5 text-gray-700 dark:text-gray-300">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded text-xs font-bold flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        {k.ism}
                      </div>
                    </td>
                    <td className="py-2.5 text-right text-gray-700 dark:text-gray-300">
                      {k.sotuvSoni} ta
                    </td>
                    <td className="py-2.5 text-right font-medium text-gray-900 dark:text-gray-100">
                      {formatSum(k.jamiSotuv)}
                    </td>
                    <td className="py-2.5 text-right text-green-600 dark:text-green-400">
                      {formatSum(k.jamiDaromad)}
                    </td>
                    <td className="py-2.5 text-right text-gray-600 dark:text-gray-400">
                      {formatSum(k.o_rtachaCek)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
