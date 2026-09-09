'use client'

import { formatSum } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { useReportData } from '../_hooks/useReportData'
import type { ReportTur } from '@/lib/hisobotlar'

interface AbcTovar {
  tovarId: string
  nomi: string
  jami_summa: number
  jami_miqdor: number
  ulushi: number
  sinf: 'A' | 'B' | 'C'
}

interface DeadStockTovar {
  tovarId: string
  nomi: string
  qoldiq: number
  birlik: string
  oxirgiSotuv: string | null
  kunlarSon: number
}

interface AbcResponse {
  tovarlar: AbcTovar[]
  jamiSotuv: number
}

interface DeadStockResponse {
  tovarlar: DeadStockTovar[]
}

type TurnoverKlass = 'tez' | 'orta' | 'sekin' | 'yotib-qolgan'

interface TurnoverTovar {
  tovarId: string
  nomi: string
  birlik: string
  sotilganMiqdor: number
  kunlikOrtacha: number
  hozirgiQoldiq: number
  turnoverKun: number | null
  klass: TurnoverKlass
}

interface TurnoverUmumiy {
  ortachaTurnoverKun: number
  engTezKun: number
  engSekinKun: number
  tezSoni: number
  ortaSoni: number
  sekinSoni: number
  yotibQolganSoni: number
}

interface TurnoverResponse {
  umumiy: TurnoverUmumiy
  tovarlar: TurnoverTovar[]
}

interface Props {
  filtrlar: { tur: ReportTur; dan: string; gacha: string; [key: string]: unknown }
  isKassir: boolean
}

const SINF_RANG: Record<'A' | 'B' | 'C', string> = {
  A: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400',
  B: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
  C: 'bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-gray-400',
}

const KLASS_RANG: Record<TurnoverKlass, string> = {
  tez: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400',
  orta: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
  sekin: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  'yotib-qolgan': 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
}

const KLASS_LABEL: Record<TurnoverKlass, string> = {
  tez: 'Tez',
  orta: "O'rta",
  sekin: 'Sekin',
  'yotib-qolgan': 'Yotib qolgan',
}

export function TovarlarTab({ filtrlar, isKassir }: Props) {
  const abc = useReportData<AbcResponse>('/api/hisobotlar/abc', filtrlar)
  const dead = useReportData<DeadStockResponse>('/api/hisobotlar/dead-stock', filtrlar)
  const turnover = useReportData<TurnoverResponse>('/api/hisobotlar/tovarlar/turnover', filtrlar)

  const yuklanmoqda = abc.yuklanmoqda || dead.yuklanmoqda

  if (yuklanmoqda) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500 dark:text-gray-400 gap-3">
        <Loader2 className="animate-spin w-6 h-6 text-red-500" />
        <span>Yuklanmoqda...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ABC tahlil */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
        <div className="mb-4">
          <h2 className="text-gray-900 dark:text-gray-100 font-semibold">ABC tahlil</h2>
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
            A — top 80% daromad, B — keyingi 15%, C — qolgan 5%
          </p>
        </div>

        {!abc.data || abc.data.tovarlar.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            Ma&apos;lumot yo&apos;q
          </p>
        ) : (
          <>
            {/* Summary chips */}
            <div className="flex gap-3 mb-4 flex-wrap">
              {(['A', 'B', 'C'] as const).map((sinf) => {
                const count = abc.data!.tovarlar.filter((t) => t.sinf === sinf).length
                return (
                  <div
                    key={sinf}
                    className={`px-3 py-1.5 rounded-xl text-sm font-semibold ${SINF_RANG[sinf]}`}
                  >
                    {sinf} — {count} ta tovar
                  </div>
                )
              })}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-neutral-800">
                    <th className="text-left pb-3 text-gray-500 dark:text-gray-400 font-medium">
                      Tovar
                    </th>
                    <th className="text-right pb-3 text-gray-500 dark:text-gray-400 font-medium">
                      Sotuv
                    </th>
                    <th className="text-right pb-3 text-gray-500 dark:text-gray-400 font-medium">
                      Ulush
                    </th>
                    <th className="text-center pb-3 text-gray-500 dark:text-gray-400 font-medium">
                      Sinf
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-neutral-800">
                  {abc.data.tovarlar.map((t, i) => (
                    <tr key={i}>
                      <td className="py-2.5 text-gray-700 dark:text-gray-300 max-w-[200px] truncate">
                        {t.nomi}
                      </td>
                      <td className="py-2.5 text-right font-medium text-gray-900 dark:text-gray-100">
                        {formatSum(t.jami_summa)}
                      </td>
                      <td className="py-2.5 text-right text-gray-600 dark:text-gray-400">
                        {t.ulushi.toFixed(1)}%
                      </td>
                      <td className="py-2.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-bold ${SINF_RANG[t.sinf]}`}
                        >
                          {t.sinf}
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

      {/* Dead stock */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
        <div className="mb-4">
          <h2 className="text-gray-900 dark:text-gray-100 font-semibold">Dead Stock</h2>
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
            30+ kun sotilmagan tovarlar
          </p>
        </div>

        {!dead.data || dead.data.tovarlar.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            Dead stock topilmadi
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-neutral-800">
                  <th className="text-left pb-3 text-gray-500 dark:text-gray-400 font-medium">
                    Tovar
                  </th>
                  <th className="text-right pb-3 text-gray-500 dark:text-gray-400 font-medium">
                    Qoldiq
                  </th>
                  <th className="text-right pb-3 text-gray-500 dark:text-gray-400 font-medium">
                    Oxirgi sotuv
                  </th>
                  <th className="text-right pb-3 text-gray-500 dark:text-gray-400 font-medium">
                    Kunlar
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-neutral-800">
                {dead.data.tovarlar.map((t, i) => (
                  <tr key={i}>
                    <td className="py-2.5 text-gray-700 dark:text-gray-300 max-w-[180px] truncate">
                      {t.nomi}
                    </td>
                    <td className="py-2.5 text-right text-gray-700 dark:text-gray-300">
                      {t.qoldiq} {t.birlik}
                    </td>
                    <td className="py-2.5 text-right text-gray-500 dark:text-gray-400">
                      {t.oxirgiSotuv ?? '—'}
                    </td>
                    <td className="py-2.5 text-right">
                      <span
                        className={`text-xs font-semibold ${
                          t.kunlarSon > 60
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {t.kunlarSon} kun
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stock turnover — faqat KASSIR bo'lmaganlar uchun */}
      {!isKassir && (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
          <div className="mb-4">
            <h2 className="text-gray-900 dark:text-gray-100 font-semibold">
              Stock Turnover (Aylanish tezligi)
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
              Har bir tovar necha kunda sotilishini ko&apos;rsatadi
            </p>
          </div>

          {turnover.yuklanmoqda ? (
            <div className="flex items-center justify-center h-24 gap-2 text-gray-500 dark:text-gray-400">
              <Loader2 className="animate-spin w-4 h-4 text-red-500" />
              <span className="text-sm">Yuklanmoqda...</span>
            </div>
          ) : !turnover.data ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              Ma&apos;lumot yo&apos;q
            </p>
          ) : (
            <>
              {/* KPI cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                <div className="bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/30 rounded-xl p-3 text-center">
                  <p className="text-green-700 dark:text-green-400 text-2xl font-bold">
                    {turnover.data.umumiy.tezSoni}
                  </p>
                  <p className="text-green-600 dark:text-green-500 text-xs mt-0.5">Tez (&lt;7 kun)</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-xl p-3 text-center">
                  <p className="text-blue-700 dark:text-blue-400 text-2xl font-bold">
                    {turnover.data.umumiy.ortaSoni}
                  </p>
                  <p className="text-blue-600 dark:text-blue-500 text-xs mt-0.5">O&apos;rta (7-30)</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl p-3 text-center">
                  <p className="text-amber-700 dark:text-amber-400 text-2xl font-bold">
                    {turnover.data.umumiy.sekinSoni}
                  </p>
                  <p className="text-amber-600 dark:text-amber-500 text-xs mt-0.5">Sekin (30-60)</p>
                </div>
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl p-3 text-center">
                  <p className="text-red-700 dark:text-red-400 text-2xl font-bold">
                    {turnover.data.umumiy.yotibQolganSoni}
                  </p>
                  <p className="text-red-600 dark:text-red-500 text-xs mt-0.5">Yotib qolgan (60+)</p>
                </div>
              </div>

              {/* O'rtacha */}
              <div className="flex gap-4 mb-4 text-sm text-gray-500 dark:text-gray-400">
                <span>
                  O&apos;rtacha:{' '}
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {turnover.data.umumiy.ortachaTurnoverKun} kun
                  </span>
                </span>
                <span>
                  Eng tez:{' '}
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    {turnover.data.umumiy.engTezKun} kun
                  </span>
                </span>
                <span>
                  Eng sekin:{' '}
                  <span className="font-semibold text-red-600 dark:text-red-400">
                    {turnover.data.umumiy.engSekinKun} kun
                  </span>
                </span>
              </div>

              {/* Jadval */}
              {turnover.data.tovarlar.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-6">
                  Tovarlar topilmadi
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-neutral-800">
                        <th className="text-left pb-3 text-gray-500 dark:text-gray-400 font-medium">
                          Tovar
                        </th>
                        <th className="text-right pb-3 text-gray-500 dark:text-gray-400 font-medium">
                          Sotilgan
                        </th>
                        <th className="text-right pb-3 text-gray-500 dark:text-gray-400 font-medium">
                          Kun/o&apos;rtacha
                        </th>
                        <th className="text-right pb-3 text-gray-500 dark:text-gray-400 font-medium">
                          Qoldiq
                        </th>
                        <th className="text-right pb-3 text-gray-500 dark:text-gray-400 font-medium">
                          Turnover
                        </th>
                        <th className="text-center pb-3 text-gray-500 dark:text-gray-400 font-medium">
                          Klass
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-neutral-800">
                      {turnover.data.tovarlar.map((t) => (
                        <tr key={t.tovarId}>
                          <td className="py-2.5 text-gray-700 dark:text-gray-300 max-w-[160px] truncate">
                            {t.nomi}
                          </td>
                          <td className="py-2.5 text-right text-gray-600 dark:text-gray-400">
                            {t.sotilganMiqdor} {t.birlik}
                          </td>
                          <td className="py-2.5 text-right text-gray-600 dark:text-gray-400">
                            {t.kunlikOrtacha}
                          </td>
                          <td className="py-2.5 text-right text-gray-700 dark:text-gray-300">
                            {t.hozirgiQoldiq} {t.birlik}
                          </td>
                          <td className="py-2.5 text-right font-medium text-gray-900 dark:text-gray-100">
                            {t.turnoverKun !== null ? `${t.turnoverKun} kun` : '—'}
                          </td>
                          <td className="py-2.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-semibold ${KLASS_RANG[t.klass]}`}
                            >
                              {KLASS_LABEL[t.klass]}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
