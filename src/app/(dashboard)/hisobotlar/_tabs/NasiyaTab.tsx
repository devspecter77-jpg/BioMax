'use client'

import { useState } from 'react'
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
import { NasiyaDrillDownModal } from '../_components/DrillDownModal'
import type { ReportTur } from '@/lib/hisobotlar'

interface AgingBucket {
  label: string
  count: number
  summa: number
}

interface TopQarzdor {
  nasiyaId: string
  mijozIsm: string
  qoldiq: number
  muddat: string | null
  kunlarOtgan: number
}

interface NasiyaResponse {
  agingBuckets: AgingBucket[]
  topQarzdorlar: TopQarzdor[]
  ochiqNasiyalar: number
  muddatiOtgan: number
  jamiQarz: number
}

interface NasiyaDrillDownItem {
  id: string
  mijoz: { id: string; ism: string; telefon: string | null; manzil: string | null }
  sotuv: { chekRaqami: string; sana: string } | null
  jamiQarz: number
  tolangan: number
  qoldiq: number
  muddat: string | null
  sana: string
  kechikkanKun: number
}

interface DrillDownData {
  bucket: string
  jamiQoldiq: number
  soni: number
  nasiyalar: NasiyaDrillDownItem[]
}

interface Props {
  filtrlar: { tur: ReportTur; dan: string; gacha: string; [key: string]: unknown }
  isKassir: boolean
}

const BUCKET_RANG: Record<string, string> = {
  kechikmagan: '#16a34a',
  '0-30 kun': '#D4A017',
  '31-60 kun': '#ea580c',
  '61-90 kun': '#DC2626',
  '90+ kun': '#7c3aed',
}

// Human-readable label → API bucket key
const LABEL_TO_BUCKET: Record<string, string> = {
  Kechikmagan: 'kechikmagan',
  '0-30 kun': 'b_0_30',
  '31-60 kun': 'b_31_60',
  '61-90 kun': 'b_61_90',
  '90+ kun': 'b_90_plus',
}

export function NasiyaTab({ filtrlar }: Props) {
  const { data, yuklanmoqda } = useReportData<NasiyaResponse>(
    '/api/hisobotlar/nasiya-aging',
    filtrlar,
  )

  // Drill-down state
  const [modalOchiq, setModalOchiq] = useState(false)
  const [drillSarlavha, setDrillSarlavha] = useState('')
  const [drillBucket, setDrillBucket] = useState('')
  const [drillYuklanmoqda, setDrillYuklanmoqda] = useState(false)
  const [drillData, setDrillData] = useState<DrillDownData | null>(null)

  async function bucketOch(label: string) {
    const bucketKey = LABEL_TO_BUCKET[label] ?? 'b_0_30'
    setDrillSarlavha(`Nasiya tahlil — ${label}`)
    setDrillBucket(bucketKey)
    setModalOchiq(true)
    setDrillData(null)
    setDrillYuklanmoqda(true)
    try {
      const res = await fetch(
        `/api/hisobotlar/nasiya/drill-down?bucket=${bucketKey}`,
      )
      if (!res.ok) throw new Error("Ma'lumot yuklanmadi")
      const json = (await res.json()) as DrillDownData
      setDrillData(json)
    } catch {
      setDrillData({ bucket: bucketKey, jamiQoldiq: 0, soni: 0, nasiyalar: [] })
    } finally {
      setDrillYuklanmoqda(false)
    }
  }

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
        <div className="text-center p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900">
          <p className="text-amber-700 dark:text-amber-400 text-sm font-medium">Ochiq nasiyalar</p>
          <p className="text-amber-700 dark:text-amber-400 font-bold text-2xl mt-1">
            {data.ochiqNasiyalar}
          </p>
        </div>
        <div className="text-center p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900">
          <p className="text-red-600 dark:text-red-400 text-sm font-medium">
            Muddati o&apos;tgan
          </p>
          <p className="text-red-600 dark:text-red-400 font-bold text-2xl mt-1">
            {data.muddatiOtgan}
          </p>
        </div>
        <div className="text-center p-3 bg-gray-50 dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700">
          <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Umumiy qarz</p>
          <p className="text-gray-900 dark:text-gray-100 font-bold text-xl mt-1">
            {formatSum(data.jamiQarz)}
          </p>
        </div>
      </div>

      {/* Aging buckets chart */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
        <div className="mb-4">
          <h2 className="text-gray-900 dark:text-gray-100 font-semibold">
            Nasiya yoshi (aging tahlil)
          </h2>
          <p className="text-gray-400 dark:text-gray-600 text-xs mt-0.5">
            Muddati o&apos;tgan kunlar bo&apos;yicha guruhlash &bull; Kartani bosib tafsilot ko&apos;ring
          </p>
        </div>
        {data.agingBuckets.length === 0 ? (
          <p className="text-gray-400 dark:text-gray-600 text-center py-8">
            Ochiq nasiya yo&apos;q
          </p>
        ) : (
          <>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.agingBuckets}
                  margin={{ top: 5, right: 10, bottom: 5, left: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="label" stroke="#6b7280" tick={{ fontSize: 11 }} />
                  <YAxis
                    stroke="#6b7280"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: number) =>
                      v >= 1000000 ? (v / 1000000).toFixed(1) + 'M' : String(v)
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '12px',
                      color: '#f9fafb',
                    }}
                    formatter={(v: number | undefined) => [formatSum(v ?? 0), 'Qarz']}
                  />
                  <Bar
                    dataKey="summa"
                    radius={[6, 6, 0, 0]}
                    fill="#DC2626"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Clickable bucket cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-4">
              {data.agingBuckets.map((b, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => void bucketOch(b.label)}
                  className="bg-gray-50 dark:bg-neutral-800 rounded-xl p-3 text-center cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-red-400"
                >
                  <p
                    className="text-xs font-semibold"
                    style={{ color: BUCKET_RANG[b.label] ?? '#6b7280' }}
                  >
                    {b.label}
                  </p>
                  <p className="text-gray-900 dark:text-gray-100 font-bold text-lg mt-1">
                    {b.count} ta
                  </p>
                  <p className="text-gray-500 dark:text-gray-500 text-xs">{formatSum(b.summa)}</p>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Top qarzdorlar */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
        <div className="mb-4">
          <h2 className="text-gray-900 dark:text-gray-100 font-semibold">
            Top qarzdorlar
          </h2>
          <p className="text-gray-400 dark:text-gray-600 text-xs mt-0.5">
            Eng katta qarz summasi bo&apos;yicha
          </p>
        </div>
        {data.topQarzdorlar.length === 0 ? (
          <p className="text-gray-400 dark:text-gray-600 text-center py-8">
            Qarzdor yo&apos;q
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
                    Qoldiq
                  </th>
                  <th className="text-right pb-3 text-gray-500 dark:text-gray-500 font-medium">
                    Muddat
                  </th>
                  <th className="text-right pb-3 text-gray-500 dark:text-gray-500 font-medium">
                    Kechikish
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-neutral-800">
                {data.topQarzdorlar.map((q, i) => (
                  <tr key={q.nasiyaId}>
                    <td className="py-2.5 text-gray-400 dark:text-gray-600">{i + 1}</td>
                    <td className="py-2.5 text-gray-700 dark:text-gray-300 max-w-[160px] truncate">
                      {q.mijozIsm}
                    </td>
                    <td className="py-2.5 text-right font-semibold text-red-600 dark:text-red-400">
                      {formatSum(q.qoldiq)}
                    </td>
                    <td className="py-2.5 text-right text-gray-500 dark:text-gray-500 text-xs">
                      {q.muddat ?? '—'}
                    </td>
                    <td className="py-2.5 text-right">
                      {q.kunlarOtgan > 0 ? (
                        <span
                          className={`text-xs font-semibold ${
                            q.kunlarOtgan > 60
                              ? 'text-red-600 dark:text-red-400'
                              : q.kunlarOtgan > 30
                                ? 'text-orange-600 dark:text-orange-400'
                                : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {q.kunlarOtgan} kun
                        </span>
                      ) : (
                        <span className="text-xs text-green-600 dark:text-green-400">
                          O&apos;z vaqtida
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drill-down modal */}
      {modalOchiq && (
        <NasiyaDrillDownModal
          open={modalOchiq}
          onClose={() => setModalOchiq(false)}
          sarlavha={drillSarlavha}
          bucket={drillBucket}
          jamiQoldiq={drillData?.jamiQoldiq ?? 0}
          soni={drillData?.soni ?? 0}
          nasiyalar={
            drillYuklanmoqda
              ? []
              : (drillData?.nasiyalar ?? [])
          }
        />
      )}

      {/* Loading overlay while drill-down fetching */}
      {modalOchiq && drillYuklanmoqda && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-6 py-4 flex items-center gap-3 shadow-xl pointer-events-auto">
            <Loader2 className="animate-spin w-5 h-5 text-red-500" />
            <span className="text-sm text-gray-700 dark:text-gray-300">Yuklanmoqda...</span>
          </div>
        </div>
      )}
    </div>
  )
}
