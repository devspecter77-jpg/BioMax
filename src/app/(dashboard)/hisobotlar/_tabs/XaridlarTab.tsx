'use client'

import { formatSum, formatPhone } from '@/lib/utils'
import { Loader2, ShoppingCart, CheckCircle, AlertCircle, Package } from 'lucide-react'
import { useReportData } from '../_hooks/useReportData'
import { KPICard } from '../_components/KPICard'
import type { ReportTur } from '@/lib/hisobotlar'

interface AgingEntry {
  count: number
  summa: number
}

interface XaridlarResponse {
  umumiy: {
    jamiXarid: number
    jamiTolangan: number
    jamiQarz: number
    xaridSoni: number
  }
  aging: {
    kechikmagan: AgingEntry
    b_0_30: AgingEntry
    b_31_60: AgingEntry
    b_61_90: AgingEntry
    b_90_plus: AgingEntry
  }
  topTaminotchilar: Array<{
    taminotchiId: string
    nomi: string
    kontaktShaxs: string | null
    telefon: string | null
    xaridSoni: number
    jamiQarz: number
    eskiQarzKunlar: number
  }>
}

interface Props {
  filtrlar: { tur: ReportTur; dan: string; gacha: string; [key: string]: unknown }
  isKassir: boolean
}

interface BucketCardProps {
  label: string
  count: number
  summa: number
  rang: string
  borderRang: string
  bgRang: string
}

function BucketCard({ label, count, summa, rang, borderRang, bgRang }: BucketCardProps) {
  return (
    <div
      className={`rounded-xl p-3 text-center border ${bgRang} ${borderRang}`}
    >
      <p className={`text-xs font-semibold ${rang}`}>{label}</p>
      <p className="text-gray-900 dark:text-gray-100 font-bold text-lg mt-1">
        {count} ta
      </p>
      <p className="text-gray-500 dark:text-gray-400 text-xs">{formatSum(summa)}</p>
    </div>
  )
}

export function XaridlarTab({ filtrlar }: Props) {
  const { data, yuklanmoqda } = useReportData<XaridlarResponse>(
    '/api/hisobotlar/xaridlar/payables-aging',
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

  const { umumiy, aging, topTaminotchilar } = data

  return (
    <div className="space-y-4">
      {/* 4 KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={ShoppingCart}
          sarlavha="Jami xarid"
          qiymat={formatSum(umumiy.jamiXarid)}
          iconBg="bg-blue-500"
        />
        <KPICard
          icon={CheckCircle}
          sarlavha="Jami to'langan"
          qiymat={formatSum(umumiy.jamiTolangan)}
          iconBg="bg-green-500"
        />
        <KPICard
          icon={AlertCircle}
          sarlavha="Jami qarz"
          qiymat={formatSum(umumiy.jamiQarz)}
          iconBg="bg-red-500"
          rang="text-red-600 dark:text-red-400"
        />
        <KPICard
          icon={Package}
          sarlavha="Xarid soni"
          qiymat={String(umumiy.xaridSoni)}
          iconBg="bg-purple-500"
        />
      </div>

      {/* 5 aging bucket cards */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
        <div className="mb-4">
          <h2 className="text-gray-900 dark:text-gray-100 font-semibold">
            Ta&apos;minotchi qarzlari (payables aging)
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
            Xarid sanasidan kechikkan kunlar bo&apos;yicha guruhlash
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <BucketCard
            label="Kechikmagan"
            count={aging.kechikmagan.count}
            summa={aging.kechikmagan.summa}
            rang="text-green-700 dark:text-green-400"
            borderRang="border-green-200 dark:border-green-900"
            bgRang="bg-green-50 dark:bg-green-950/40"
          />
          <BucketCard
            label="0-30 kun"
            count={aging.b_0_30.count}
            summa={aging.b_0_30.summa}
            rang="text-blue-700 dark:text-blue-400"
            borderRang="border-blue-200 dark:border-blue-900"
            bgRang="bg-blue-50 dark:bg-blue-950/40"
          />
          <BucketCard
            label="31-60 kun"
            count={aging.b_31_60.count}
            summa={aging.b_31_60.summa}
            rang="text-amber-700 dark:text-amber-400"
            borderRang="border-amber-200 dark:border-amber-900"
            bgRang="bg-amber-50 dark:bg-amber-950/40"
          />
          <BucketCard
            label="61-90 kun"
            count={aging.b_61_90.count}
            summa={aging.b_61_90.summa}
            rang="text-orange-700 dark:text-orange-400"
            borderRang="border-orange-200 dark:border-orange-900"
            bgRang="bg-orange-50 dark:bg-orange-950/40"
          />
          <BucketCard
            label="90+ kun"
            count={aging.b_90_plus.count}
            summa={aging.b_90_plus.summa}
            rang="text-red-700 dark:text-red-400"
            borderRang="border-red-200 dark:border-red-900"
            bgRang="bg-red-50 dark:bg-red-950/40"
          />
        </div>
      </div>

      {/* Top 20 ta'minotchilar */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
        <div className="mb-4">
          <h2 className="text-gray-900 dark:text-gray-100 font-semibold">
            Top ta&apos;minotchilar (qarz bo&apos;yicha)
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
            Eng katta qarzdan boshlab, top 20 ta
          </p>
        </div>
        {topTaminotchilar.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            Ta&apos;minotchi qarzi yo&apos;q
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-neutral-800 text-xs text-gray-500 dark:text-gray-400">
                  <th className="text-left pb-3 font-medium">#</th>
                  <th className="text-left pb-3 font-medium">Nomi</th>
                  <th className="text-left pb-3 font-medium">Kontakt shaxs</th>
                  <th className="text-left pb-3 font-medium">Telefon</th>
                  <th className="text-right pb-3 font-medium">Xarid soni</th>
                  <th className="text-right pb-3 font-medium">Qarz</th>
                  <th className="text-right pb-3 font-medium">Eng eski (kun)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-neutral-800">
                {topTaminotchilar.map((t, i) => (
                  <tr key={t.taminotchiId}>
                    <td className="py-2.5 text-gray-500 dark:text-gray-400 text-xs">
                      {i + 1}
                    </td>
                    <td className="py-2.5 text-gray-900 dark:text-gray-100 font-medium max-w-[140px] truncate">
                      {t.nomi}
                    </td>
                    <td className="py-2.5 text-gray-600 dark:text-gray-400 text-xs max-w-[120px] truncate">
                      {t.kontaktShaxs ?? <span className="text-gray-300">&mdash;</span>}
                    </td>
                    <td className="py-2.5 text-xs">
                      {t.telefon ? (
                        <a
                          href={`tel:${t.telefon.replace(/\s/g, '')}`}
                          className="text-blue-500 hover:text-blue-600"
                        >
                          {formatPhone(t.telefon)}
                        </a>
                      ) : (
                        <span className="text-gray-300">&mdash;</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right text-gray-600 dark:text-gray-400">
                      {t.xaridSoni}
                    </td>
                    <td className="py-2.5 text-right font-semibold text-red-600 dark:text-red-400">
                      {formatSum(t.jamiQarz)}
                    </td>
                    <td className="py-2.5 text-right">
                      <span
                        className={`text-xs font-medium ${
                          t.eskiQarzKunlar > 90
                            ? 'text-red-600 dark:text-red-400'
                            : t.eskiQarzKunlar > 60
                              ? 'text-orange-600 dark:text-orange-400'
                              : t.eskiQarzKunlar > 30
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {t.eskiQarzKunlar} kun
                      </span>
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
