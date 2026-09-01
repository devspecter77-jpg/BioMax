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

interface MijozStat {
  mijozId: string
  ism: string
  sotuvSoni: number
  jamiSotuv: number
  oxirgiSotuv: string | null
}

interface MijozlarResponse {
  topMijozlar: MijozStat[]
  jamiMijozlar: number
  aktivMijozlar: number
  o_rtachaSotuv: number
}

interface Props {
  filtrlar: { tur: ReportTur; dan: string; gacha: string; [key: string]: unknown }
  isKassir: boolean
}

export function MijozlarTab({ filtrlar }: Props) {
  const { data, yuklanmoqda } = useReportData<MijozlarResponse>(
    '/api/hisobotlar/mijozlar',
    filtrlar,
  )

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

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4">
          <p className="text-gray-500 dark:text-gray-500 text-xs">Jami mijozlar</p>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            {data.jamiMijozlar} ta
          </p>
        </div>
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4">
          <p className="text-gray-500 dark:text-gray-500 text-xs">Aktiv mijozlar</p>
          <p className="text-xl font-bold text-green-600 dark:text-green-400 mt-1">
            {data.aktivMijozlar} ta
          </p>
        </div>
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4">
          <p className="text-gray-500 dark:text-gray-500 text-xs">O&apos;rtacha sotuv</p>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            {formatSum(data.o_rtachaSotuv)}
          </p>
        </div>
      </div>

      {/* Top mijozlar chart */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
        <h2 className="text-gray-900 dark:text-gray-100 font-semibold mb-4">
          Top 10 mijoz (sotuv bo&apos;yicha)
        </h2>
        {data.topMijozlar.length === 0 ? (
          <p className="text-gray-400 dark:text-gray-600 text-center py-8">
            Ma&apos;lumot yo&apos;q
          </p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.topMijozlar.slice(0, 10)}
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
                  tick={{ fontSize: 10 }}
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

      {/* Top mijozlar jadval */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
        <h2 className="text-gray-900 dark:text-gray-100 font-semibold mb-4">
          Mijozlar reytingi
        </h2>
        {data.topMijozlar.length === 0 ? (
          <p className="text-gray-400 dark:text-gray-600 text-center py-8">
            Ma&apos;lumot yo&apos;q
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-neutral-800">
                  <th className="text-left pb-3 text-gray-500 dark:text-gray-500 font-medium">
                    #
                  </th>
                  <th className="text-left pb-3 text-gray-500 dark:text-gray-500 font-medium">
                    Mijoz
                  </th>
                  <th className="text-right pb-3 text-gray-500 dark:text-gray-500 font-medium">
                    Sotuvlar
                  </th>
                  <th className="text-right pb-3 text-gray-500 dark:text-gray-500 font-medium">
                    Jami summa
                  </th>
                  <th className="text-right pb-3 text-gray-500 dark:text-gray-500 font-medium">
                    Oxirgi sotuv
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-neutral-800">
                {data.topMijozlar.map((m, i) => (
                  <tr key={m.mijozId}>
                    <td className="py-2.5 text-gray-400 dark:text-gray-600">{i + 1}</td>
                    <td className="py-2.5 text-gray-700 dark:text-gray-300 max-w-[160px] truncate">
                      {m.ism}
                    </td>
                    <td className="py-2.5 text-right text-gray-700 dark:text-gray-300">
                      {m.sotuvSoni} ta
                    </td>
                    <td className="py-2.5 text-right font-medium text-gray-900 dark:text-gray-100">
                      {formatSum(m.jamiSotuv)}
                    </td>
                    <td className="py-2.5 text-right text-gray-500 dark:text-gray-500 text-xs">
                      {m.oxirgiSotuv ?? '—'}
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
