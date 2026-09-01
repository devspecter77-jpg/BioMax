'use client'
import type { ReportTur } from '@/lib/hisobotlar'

interface Props {
  tur: ReportTur
  dan: string
  gacha: string
  isKassir?: boolean
  onChange: (patch: { tur?: ReportTur; dan?: string; gacha?: string }) => void
}

const inputCls =
  'px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-gray-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500'

const btnCls = (active: boolean) =>
  `px-4 py-2 rounded-xl text-sm font-medium transition ${
    active
      ? 'bg-red-600 text-white'
      : 'bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-800'
  }`

export function ReportFilter({ tur, dan, gacha, onChange }: Props) {
  const presets: Array<[string, ReportTur]> = [
    ['Bugun', 'kunlik'],
    ['Hafta', 'haftalik'],
    ['Oy', 'oylik'],
    ['Yil', 'yillik'],
  ]
  return (
    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:items-center">
      <div className="flex flex-wrap gap-2">
        {presets.map(([label, t]) => (
          <button key={t} onClick={() => onChange({ tur: t })} className={btnCls(tur === t)}>
            {label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 sm:ml-auto">
        <input
          type="date"
          value={dan}
          onChange={(e) => onChange({ dan: e.target.value })}
          className={`${inputCls} flex-1 min-w-0 sm:flex-none`}
          aria-label="Boshlanish sanasi"
        />
        <span className="text-gray-400 dark:text-gray-600 shrink-0">—</span>
        <input
          type="date"
          value={gacha}
          onChange={(e) => onChange({ gacha: e.target.value })}
          className={`${inputCls} flex-1 min-w-0 sm:flex-none`}
          aria-label="Tugash sanasi"
        />
      </div>
    </div>
  )
}
