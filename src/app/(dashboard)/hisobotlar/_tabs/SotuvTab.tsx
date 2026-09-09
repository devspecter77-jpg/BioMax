'use client'

import { formatSum } from '@/lib/utils'
import { Loader2, RotateCcw } from 'lucide-react'
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
import { KPICard } from '../_components/KPICard'
import { ReportSection } from '../_components/ReportSection'
import type { ReportTur } from '@/lib/hisobotlar'

interface SoatData {
  soat: number
  sotuv: number
  sotuvSoni: number
}

interface KunlikData {
  sana: string
  sotuv: number
  sotuvSoni: number
}

interface SotuvResponse {
  soatlar: SoatData[]
  kunlik: KunlikData[]
  jamiSotuv: number
  sotuvSoni: number
}

interface TopProduct {
  nomi: string
  revenue: number
}

interface KategoriyaItem {
  kategoriyaId: string
  nomi: string
  revenue: number
  qty: number
  foyda: number
  marginPercent: number
  productCount: number
  topProducts: TopProduct[]
}

interface KategoriyaData {
  kategoriyalar: KategoriyaItem[]
  jamiRevenue: number
}

interface ReturnsData {
  umumiy: {
    jamiQaytarish: number
    soni: number
    returnRate: number
    avgReturnValue: number
  }
  bySabab: Array<{ sabab: string; count: number; summa: number }>
  topReturnedProducts: Array<{
    tovarId: string
    nomi: string
    qtyReturned: number
    summa: number
  }>
  trend: Array<{ sana: string; count: number; summa: number }>
}

interface Props {
  filtrlar: { tur: ReportTur; dan: string; gacha: string; [key: string]: unknown }
  isKassir: boolean
}

export function SotuvTab({ filtrlar, isKassir }: Props) {
  const { data, yuklanmoqda } = useReportData<SotuvResponse>('/api/hisobotlar/soatlar', filtrlar)
  const kategoriya = useReportData<KategoriyaData>(
    '/api/hisobotlar/sotuv/kategoriya',
    filtrlar,
  )
  const { data: returns } = useReportData<ReturnsData>(
    '/api/hisobotlar/sotuv/returns',
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

  // Peak soat aniqlash
  const peakSoat = data.soatlar.length > 0
    ? data.soatlar.reduce((prev, curr) => (curr.sotuv > prev.sotuv ? curr : prev))
    : null

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4">
          <p className="text-gray-500 dark:text-gray-400 text-xs">Jami sotuv</p>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            {formatSum(data.jamiSotuv)}
          </p>
          <p className="text-gray-500 dark:text-gray-400 text-xs">{data.sotuvSoni} ta sotuv</p>
        </div>
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4">
          <p className="text-gray-500 dark:text-gray-400 text-xs">Peak soat</p>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            {peakSoat !== null ? `${peakSoat.soat}:00` : '—'}
          </p>
          <p className="text-gray-500 dark:text-gray-400 text-xs">
            {peakSoat !== null ? formatSum(peakSoat.sotuv) : ''}
          </p>
        </div>
      </div>

      {/* Soatlik heatmap (bar chart) */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
        <h2 className="text-gray-900 dark:text-gray-100 font-semibold mb-4">
          Soatlik sotuv (peak hours)
        </h2>
        {data.soatlar.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            Ma&apos;lumot yo&apos;q
          </p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.soatlar}
                margin={{ top: 5, right: 10, bottom: 5, left: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="soat"
                  stroke="#6b7280"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => `${v}:00`}
                />
                <YAxis
                  stroke="#6b7280"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => (v / 1000000).toFixed(1) + 'M'}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '12px',
                    color: '#f9fafb',
                  }}
                  labelFormatter={(label) => `${label}:00 — ${Number(label) + 1}:00`}
                  formatter={(v: number | undefined) => [formatSum(v ?? 0), 'Sotuv']}
                />
                <Bar dataKey="sotuv" fill="#DC2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Kunlik sotuv grafigi */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
        <h2 className="text-gray-900 dark:text-gray-100 font-semibold mb-4">
          Kunlik sotuv dinamikasi
        </h2>
        {data.kunlik.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            Ma&apos;lumot yo&apos;q
          </p>
        ) : (
          <div className="h-48 sm:h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.kunlik}
                margin={{ top: 5, right: 10, bottom: 5, left: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="sana" stroke="#6b7280" tick={{ fontSize: 11 }} />
                <YAxis
                  stroke="#6b7280"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => (v / 1000000).toFixed(1) + 'M'}
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
                <Bar dataKey="sotuv" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* KASSIR ko'ra olmaydi — yashirin info */}
      {!isKassir && (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
          <h2 className="text-gray-900 dark:text-gray-100 font-semibold mb-4">
            Kunlik tafsilot
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-neutral-800">
                  <th className="text-left pb-3 text-gray-500 dark:text-gray-400 font-medium">Sana</th>
                  <th className="text-right pb-3 text-gray-500 dark:text-gray-400 font-medium">
                    Sotuvlar
                  </th>
                  <th className="text-right pb-3 text-gray-500 dark:text-gray-400 font-medium">
                    Summa
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-neutral-800">
                {data.kunlik.map((row, i) => (
                  <tr key={i}>
                    <td className="py-2.5 text-gray-700 dark:text-gray-300">{row.sana}</td>
                    <td className="py-2.5 text-right text-gray-700 dark:text-gray-300">
                      {row.sotuvSoni} ta
                    </td>
                    <td className="py-2.5 text-right font-medium text-gray-900 dark:text-gray-100">
                      {formatSum(row.sotuv)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Kategoriya bo'yicha sotuv — foyda/margin KASSIR ko'ra olmaydi */}
      {!isKassir && (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
          <div className="mb-4">
            <h2 className="text-gray-900 dark:text-gray-100 font-semibold">
              Kategoriya bo&apos;yicha sotuv
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
              Revenue, foyda va margin kategoriya kesimida
            </p>
          </div>

          {kategoriya.yuklanmoqda ? (
            <div className="flex items-center justify-center h-24 gap-2 text-gray-500 dark:text-gray-400">
              <Loader2 className="animate-spin w-4 h-4 text-red-500" />
              <span className="text-sm">Yuklanmoqda...</span>
            </div>
          ) : !kategoriya.data || kategoriya.data.kategoriyalar.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              Ma&apos;lumot yo&apos;q
            </p>
          ) : (
            <>
              {/* Horizontal bar chart */}
              <div className="h-48 mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={kategoriya.data.kategoriyalar.slice(0, 8)}
                    margin={{ top: 5, right: 40, bottom: 5, left: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                    <XAxis
                      type="number"
                      stroke="#6b7280"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v: number) => (v / 1000000).toFixed(1) + 'M'}
                    />
                    <YAxis
                      type="category"
                      dataKey="nomi"
                      stroke="#6b7280"
                      tick={{ fontSize: 11 }}
                      width={90}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1f2937',
                        border: '1px solid #374151',
                        borderRadius: '12px',
                        color: '#f9fafb',
                      }}
                      formatter={(v: number | undefined) => [formatSum(v ?? 0), 'Revenue']}
                    />
                    <Bar dataKey="revenue" fill="#7c3aed" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Jadval */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-neutral-800">
                      <th className="text-left pb-3 text-gray-500 dark:text-gray-400 font-medium">
                        Kategoriya
                      </th>
                      <th className="text-right pb-3 text-gray-500 dark:text-gray-400 font-medium">
                        Revenue
                      </th>
                      <th className="text-right pb-3 text-gray-500 dark:text-gray-400 font-medium">
                        Qty
                      </th>
                      <th className="text-right pb-3 text-gray-500 dark:text-gray-400 font-medium">
                        Foyda
                      </th>
                      <th className="text-right pb-3 text-gray-500 dark:text-gray-400 font-medium">
                        Margin
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-neutral-800">
                    {kategoriya.data.kategoriyalar.map((k) => (
                      <tr key={k.kategoriyaId}>
                        <td className="py-2.5 text-gray-700 dark:text-gray-300 max-w-[140px] truncate">
                          <div>{k.nomi}</div>
                          {k.topProducts.length > 0 && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {k.topProducts[0].nomi}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 text-right font-medium text-gray-900 dark:text-gray-100">
                          {formatSum(k.revenue)}
                        </td>
                        <td className="py-2.5 text-right text-gray-600 dark:text-gray-400">
                          {k.qty}
                        </td>
                        <td className="py-2.5 text-right text-gray-700 dark:text-gray-300">
                          {formatSum(k.foyda)}
                        </td>
                        <td className="py-2.5 text-right">
                          <span
                            className={`text-xs font-semibold ${
                              k.marginPercent >= 20
                                ? 'text-green-600 dark:text-green-400'
                                : k.marginPercent >= 10
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {k.marginPercent.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Qaytarishlar tahlili — KASSIR ko'ra olmaydi */}
      {!isKassir && returns && returns.umumiy.soni > 0 && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              icon={RotateCcw}
              sarlavha="Jami qaytarish"
              qiymat={formatSum(returns.umumiy.jamiQaytarish)}
              iconBg="bg-red-500"
            />
            <KPICard
              icon={RotateCcw}
              sarlavha="Qaytarish soni"
              qiymat={`${returns.umumiy.soni} ta`}
              iconBg="bg-orange-500"
            />
            <KPICard
              icon={RotateCcw}
              sarlavha="Return rate"
              qiymat={`${returns.umumiy.returnRate}%`}
              iconBg="bg-amber-500"
            />
            <KPICard
              icon={RotateCcw}
              sarlavha="O'rtacha"
              qiymat={formatSum(returns.umumiy.avgReturnValue)}
              iconBg="bg-purple-500"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ReportSection sarlavha="Qaytarish sababi bo'yicha">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-500 border-b border-gray-200 dark:border-neutral-800">
                    <tr>
                      <th className="text-left py-2 px-2">Sabab</th>
                      <th className="text-right py-2 px-2">Soni</th>
                      <th className="text-right py-2 px-2">Summa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returns.bySabab.map((s, i) => (
                      <tr
                        key={i}
                        className="border-b border-gray-100 dark:border-neutral-800/50"
                      >
                        <td className="py-2 px-2 text-gray-700 dark:text-gray-300">
                          {s.sabab}
                        </td>
                        <td className="text-right py-2 px-2">{s.count}</td>
                        <td className="text-right py-2 px-2 text-red-600">
                          {formatSum(s.summa)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ReportSection>

            <ReportSection sarlavha="Eng ko'p qaytarilgan tovarlar">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-500 border-b border-gray-200 dark:border-neutral-800">
                    <tr>
                      <th className="text-left py-2 px-2">Tovar</th>
                      <th className="text-right py-2 px-2">Miqdor</th>
                      <th className="text-right py-2 px-2">Summa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returns.topReturnedProducts.map((t) => (
                      <tr
                        key={t.tovarId}
                        className="border-b border-gray-100 dark:border-neutral-800/50"
                      >
                        <td className="py-2 px-2 text-gray-700 dark:text-gray-300">
                          {t.nomi}
                        </td>
                        <td className="text-right py-2 px-2">{t.qtyReturned}</td>
                        <td className="text-right py-2 px-2 text-red-600">
                          {formatSum(t.summa)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ReportSection>
          </div>
        </>
      )}
    </div>
  )
}
