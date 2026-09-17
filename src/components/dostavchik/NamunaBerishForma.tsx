'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Minus, PackagePlus, PenLine, Plus, Search, Trash2 } from 'lucide-react'
import { miqdorMatni } from '@/lib/dostavchik'

// Namuna berish: tovarni katalogdan qidirib tanlash yoki katalogda yo'q
// narsani qo'lda yozish. Bir xil tovar ikki marta tanlansa miqdori oshadi.

interface Qator {
  kalit: string
  tovarId: string | null
  nomi: string
  birlik: string | null
  miqdor: number
}

interface TopilganTovar {
  id: string
  nomi: string
  birlik: string
  shtrixKod: string | null
  qoldiq?: number
}

const inputCls =
  'w-full px-3 py-2.5 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500'

let kalitSanoq = 0
const yangiKalit = () => `q${++kalitSanoq}`

export default function NamunaBerishForma({ dostavchikId, dostavchikIsmi, onBerildi, onBekor }: {
  dostavchikId: string
  dostavchikIsmi: string
  onBerildi: () => void
  onBekor: () => void
}) {
  const [qidiruv, setQidiruv] = useState('')
  const [topildi, setTopildi] = useState<TopilganTovar[]>([])
  const [qidirilmoqda, setQidirilmoqda] = useState(false)
  const [qatorlar, setQatorlar] = useState<Qator[]>([])
  const [izoh, setIzoh] = useState('')
  const [band, setBand] = useState(false)
  const qidiruvRef = useRef<HTMLInputElement>(null)

  // Katalogdan qidirish — yozish to'xtagach
  useEffect(() => {
    const q = qidiruv.trim()
    if (q.length < 2) { setTopildi([]); return }
    const boshqaruv = new AbortController()
    const t = setTimeout(async () => {
      setQidirilmoqda(true)
      try {
        const j = await fetch(`/api/tovarlar?q=${encodeURIComponent(q)}&limit=8`, { signal: boshqaruv.signal, cache: 'no-store' })
        const d = await j.json().catch(() => ({}))
        setTopildi(j.ok ? (d.tovarlar ?? []) : [])
      } catch {
        // bekor qilingan yoki tarmoq — ro'yxat o'zgarmaydi
      } finally {
        if (!boshqaruv.signal.aborted) setQidirilmoqda(false)
      }
    }, 250)
    return () => { clearTimeout(t); boshqaruv.abort() }
  }, [qidiruv])

  function tovarQosh(t: TopilganTovar) {
    setQatorlar(q => {
      const bor = q.find(x => x.tovarId === t.id)
      if (bor) return q.map(x => (x.tovarId === t.id ? { ...x, miqdor: x.miqdor + 1 } : x))
      return [...q, { kalit: yangiKalit(), tovarId: t.id, nomi: t.nomi, birlik: t.birlik, miqdor: 1 }]
    })
    setQidiruv('')
    setTopildi([])
    qidiruvRef.current?.focus()
  }

  function qoldaQosh() {
    const nomi = qidiruv.trim()
    if (nomi.length < 2) {
      toast.error('Namuna nomini yozing')
      qidiruvRef.current?.focus()
      return
    }
    setQatorlar(q => [...q, { kalit: yangiKalit(), tovarId: null, nomi, birlik: null, miqdor: 1 }])
    setQidiruv('')
    setTopildi([])
    qidiruvRef.current?.focus()
  }

  const miqdorOzgartir = (kalit: string, qiymat: number) =>
    setQatorlar(q => q.map(x => (x.kalit === kalit ? { ...x, miqdor: Math.max(0.001, Math.round(qiymat * 1000) / 1000) } : x)))

  async function ber() {
    if (qatorlar.length === 0) {
      toast.error('Kamida bitta namuna qo‘shing')
      return
    }
    setBand(true)
    try {
      const j = await fetch(`/api/namuna-tovar/dostavchiklar/${dostavchikId}/namuna`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ izoh, qatorlar: qatorlar.map(({ tovarId, nomi, miqdor }) => ({ tovarId, nomi, miqdor })) }),
      })
      const d = await j.json().catch(() => ({}))
      if (!j.ok) {
        toast.error(d.xato ?? 'Namuna yozilmadi')
        return
      }
      toast.success(`${dostavchikIsmi}ga ${d.soni} xil namuna yozildi`)
      onBerildi()
    } catch {
      toast.error('Internet aloqasini tekshiring')
    } finally {
      setBand(false)
    }
  }

  const tanishNomlar = new Set(topildi.map(t => t.nomi.toLowerCase()))
  const qoldaTaklif = qidiruv.trim().length >= 2 && !tanishNomlar.has(qidiruv.trim().toLowerCase())

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-gray-50/60 dark:bg-neutral-800/20 p-3.5 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
        <PackagePlus size={17} className="text-primary" /> Namuna berish
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-3 text-gray-400 pointer-events-none" />
        <input
          ref={qidiruvRef}
          id="namuna-qidiruv"
          value={qidiruv}
          onChange={e => setQidiruv(e.target.value)}
          onKeyDown={e => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            if (topildi[0]) tovarQosh(topildi[0])
            else if (qoldaTaklif) qoldaQosh()
          }}
          placeholder="Tovar nomi yoki shtrix-kod"
          autoComplete="off"
          aria-label="Tovar qidirish"
          className={`${inputCls} pl-9`}
        />
        {qidirilmoqda && <Loader2 size={15} className="absolute right-3 top-3 animate-spin text-gray-400" />}

        {(topildi.length > 0 || qoldaTaklif) && (
          <ul className="absolute z-10 mt-1 w-full max-h-72 overflow-y-auto rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg py-1">
            {topildi.map(t => (
              <li key={t.id}>
                <button type="button" onClick={() => tovarQosh(t)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-neutral-800 flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-sm text-gray-900 dark:text-gray-100 truncate">{t.nomi}</span>
                    {t.shtrixKod && <span className="block text-xs text-gray-400 font-mono">{t.shtrixKod}</span>}
                  </span>
                  {typeof t.qoldiq === 'number' && (
                    <span className="shrink-0 text-xs text-gray-500 tabular-nums">qoldiq {miqdorMatni(t.qoldiq, t.birlik)}</span>
                  )}
                </button>
              </li>
            ))}
            {qoldaTaklif && (
              <li className={topildi.length ? 'border-t border-gray-100 dark:border-neutral-800' : ''}>
                <button type="button" onClick={qoldaQosh}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-neutral-800 flex items-center gap-2 text-sm">
                  <PenLine size={15} className="text-gray-400 shrink-0" />
                  <span className="min-w-0 truncate">Qo‘lda yozish: <b className="text-gray-900 dark:text-gray-100">«{qidiruv.trim()}»</b></span>
                </button>
              </li>
            )}
          </ul>
        )}
      </div>

      {qatorlar.length > 0 ? (
        <ul className="divide-y divide-gray-100 dark:divide-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          {qatorlar.map(q => (
            <li key={q.kalit} className="flex items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-900 dark:text-gray-100 truncate">{q.nomi}</p>
                <p className="text-xs text-gray-500">{q.tovarId ? 'Katalogdan' : 'Qo‘lda yozilgan'}</p>
              </div>
              <div className="flex items-center rounded-lg border border-gray-200 dark:border-neutral-700 shrink-0">
                <button type="button" onClick={() => miqdorOzgartir(q.kalit, q.miqdor - 1)} disabled={q.miqdor <= 1}
                  aria-label="Kamaytirish" className="w-8 h-8 flex items-center justify-center text-gray-500 disabled:opacity-30">
                  <Minus size={14} />
                </button>
                <input
                  value={String(q.miqdor)}
                  onChange={e => {
                    const v = Number(e.target.value.replace(',', '.'))
                    if (Number.isFinite(v) && v > 0) miqdorOzgartir(q.kalit, v)
                  }}
                  inputMode="decimal"
                  aria-label={`${q.nomi} miqdori`}
                  className="w-12 text-center text-sm tabular-nums bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none"
                />
                <button type="button" onClick={() => miqdorOzgartir(q.kalit, q.miqdor + 1)}
                  aria-label="Ko‘paytirish" className="w-8 h-8 flex items-center justify-center text-gray-500">
                  <Plus size={14} />
                </button>
              </div>
              <button type="button" onClick={() => setQatorlar(x => x.filter(y => y.kalit !== q.kalit))}
                aria-label={`${q.nomi} — olib tashlash`}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 shrink-0">
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Qidiring va tanlang. Katalogda bo‘lmasa, nomini yozib «Qo‘lda yozish»ni bosing.
        </p>
      )}

      <input value={izoh} onChange={e => setIzoh(e.target.value)} maxLength={300}
        id="namuna-izoh" aria-label="Izoh"
        placeholder="Izoh (ixtiyoriy): masalan «15-sentabr partiyasi»" className={inputCls} />

      <div className="flex gap-2">
        <button type="button" onClick={onBekor} disabled={band}
          className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-neutral-800">
          Bekor qilish
        </button>
        <button type="button" onClick={() => void ber()} disabled={band || qatorlar.length === 0}
          className="flex-[2] py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
          {band && <Loader2 size={15} className="animate-spin" />}
          {qatorlar.length > 0 ? `${qatorlar.length} xil namunani berish` : 'Namuna berish'}
        </button>
      </div>
    </div>
  )
}
