'use client'

import { useEffect } from 'react'
import { X, Phone } from 'lucide-react'
import { formatSum, formatSana, formatPhone } from '@/lib/utils'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'

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

interface Props {
  open: boolean
  onClose: () => void
  sarlavha: string
  bucket: string
  jamiQoldiq: number
  soni: number
  nasiyalar: NasiyaDrillDownItem[]
}

const BUCKET_LABELS: Record<string, string> = {
  kechikmagan: 'Kechikmagan',
  b_0_30: '0-30 kun',
  b_31_60: '31-60 kun',
  b_61_90: '61-90 kun',
  b_90_plus: '90+ kun',
}

export function NasiyaDrillDownModal({
  open,
  onClose,
  sarlavha,
  bucket,
  jamiQoldiq,
  soni,
  nasiyalar,
}: Props) {
  useBodyScrollLock(open)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-labelledby="drilldown-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40"
    >
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl dark:border dark:border-neutral-800 w-full max-w-3xl max-h-[90vh] flex flex-col">
        <header className="p-5 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <h2
              id="drilldown-title"
              className="text-gray-900 dark:text-gray-100 font-semibold"
            >
              {sarlavha}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              {BUCKET_LABELS[bucket] ?? bucket} &bull; {soni} ta &bull; Jami
              qoldiq:{' '}
              <span className="font-medium text-red-600">
                {formatSum(jamiQoldiq)}
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Yopish"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800"
          >
            <X size={18} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4">
          {nasiyalar.length === 0 ? (
            <p className="text-center py-12 text-gray-400 dark:text-gray-600">
              Bu bucketda nasiya yo&apos;q
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 dark:text-gray-500 border-b border-gray-200 dark:border-neutral-800">
                  <th className="text-left py-2 px-2">Mijoz</th>
                  <th className="text-left py-2 px-2">Telefon</th>
                  <th className="text-right py-2 px-2">Qoldiq</th>
                  <th className="text-right py-2 px-2">Muddat</th>
                  <th className="text-right py-2 px-2">Kechikkan</th>
                </tr>
              </thead>
              <tbody>
                {nasiyalar.map((n) => (
                  <tr
                    key={n.id}
                    className="border-b border-gray-100 dark:border-neutral-800/50"
                  >
                    <td className="py-2 px-2">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {n.mijoz.ism}
                      </div>
                      {n.mijoz.manzil && (
                        <div className="text-xs text-gray-400">
                          {n.mijoz.manzil}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-2">
                      {n.mijoz.telefon ? (
                        <a
                          href={`tel:${n.mijoz.telefon.replace(/\s/g, '')}`}
                          className="text-blue-500 hover:text-blue-600 text-xs inline-flex items-center gap-1"
                        >
                          <Phone size={12} />
                          {formatPhone(n.mijoz.telefon)}
                        </a>
                      ) : (
                        <span className="text-gray-300">&mdash;</span>
                      )}
                    </td>
                    <td className="text-right py-2 px-2 text-red-600 font-semibold">
                      {formatSum(n.qoldiq)}
                    </td>
                    <td className="text-right py-2 px-2 text-gray-500 text-xs">
                      {n.muddat ? formatSana(n.muddat) : <span className="text-gray-300">&mdash;</span>}
                    </td>
                    <td className="text-right py-2 px-2 text-amber-600 text-xs font-medium">
                      {n.kechikkanKun > 0 ? `${n.kechikkanKun} kun` : <span className="text-gray-300">&mdash;</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
