'use client'

import { useId } from 'react'
import { Plus, X } from 'lucide-react'
import { ORAM_CHEGARA, ORAM_TAKLIFLARI, birlikKasrlimi, birlikMatni } from '@/lib/birlik'
import { nomKaliti } from '@/lib/utils'
import { useBirlikTakliflari } from './BirlikTanlash'

// Qo'shimcha birliklar (o'ram): "1 karobka = 24 dona", "1 qop = 240 dona".
// Nomni o'zi yozadi (taklif ro'yxatdan ham tanlash mumkin); soni — ichida
// nechta asosiy birlik borligi.

export interface OramQatori { nomi: string; miqdor: string }

const inputCls = 'px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 transition'

export default function OramlarMaydoni({ asosiy, qatorlar, onChange }: {
  asosiy: string
  qatorlar: OramQatori[]
  onChange: (q: OramQatori[]) => void
}) {
  const royxatId = useId()
  const { oramlar: dokondagi } = useBirlikTakliflari()
  const asosiyMatn = birlikMatni(asosiy)
  const kasrli = birlikKasrlimi(asosiy)
  const band = new Set([nomKaliti(asosiyMatn), ...qatorlar.map(q => nomKaliti(q.nomi)).filter(Boolean)])
  // Taklif: do'konda ishlatilganlari avval, keyin odatiylari; allaqachon yozilgani chiqmaydi
  const takliflar = [...new Set([...dokondagi, ...ORAM_TAKLIFLARI])].filter(n => !band.has(nomKaliti(n)))

  const ozgartir = (i: number, maydon: keyof OramQatori, v: string) =>
    onChange(qatorlar.map((q, j) => (j === i ? { ...q, [maydon]: v } : q)))

  return (
    <div className="space-y-2">
      {qatorlar.map((q, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400 shrink-0">1</span>
          <input
            aria-label={`Qo'shimcha birlik nomi ${i + 1}`}
            value={q.nomi}
            onChange={e => ozgartir(i, 'nomi', e.target.value)}
            list={royxatId}
            maxLength={20}
            placeholder="karobka"
            className={`${inputCls} w-28 sm:w-36 min-w-0`}
          />
          <span className="text-sm text-gray-500 dark:text-gray-400 shrink-0">=</span>
          <input
            aria-label={`1 ${q.nomi || 'o‘ram'} ichida nechta ${asosiyMatn}`}
            value={q.miqdor}
            onChange={e => ozgartir(i, 'miqdor', e.target.value.replace(kasrli ? /[^0-9.,]/g : /\D/g, ''))}
            inputMode={kasrli ? 'decimal' : 'numeric'}
            placeholder="24"
            className={`${inputCls} w-20 sm:w-24 min-w-0 text-right tabular-nums`}
          />
          <span className="text-sm text-gray-700 dark:text-gray-300 shrink-0 truncate">{asosiyMatn}</span>
          <button
            type="button"
            onClick={() => onChange(qatorlar.filter((_, j) => j !== i))}
            title="Olib tashlash"
            className="ml-auto p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition shrink-0"
          >
            <X size={15} />
          </button>
        </div>
      ))}
      <datalist id={royxatId}>
        {takliflar.map(n => <option key={n} value={n} />)}
      </datalist>

      {qatorlar.length < ORAM_CHEGARA && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => onChange([...qatorlar, { nomi: '', miqdor: '' }])}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-dashed border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-300 text-xs font-medium hover:border-primary/50 hover:text-primary transition"
          >
            <Plus size={13} /> Qo‘shimcha birlik
          </button>
          {/* Bir bosishda tayyor nom bilan qator */}
          {takliflar.slice(0, 3).map(n => (
            <button
              key={n}
              type="button"
              onClick={() => onChange([...qatorlar, { nomi: n, miqdor: '' }])}
              className="px-2 py-1 rounded-lg bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-300 text-xs hover:bg-gray-200 dark:hover:bg-neutral-700 transition"
            >
              + {n}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
