'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  ArrowRightLeft, Car, Check, History, KeyRound, Laptop, Loader2, Package, Pencil, Plus, Shirt, Smartphone,
  Trash2, TriangleAlert, Undo2, Wrench, X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useConfirm } from '@/components/ConfirmProvider'
import { formatSana, formatSum } from '@/lib/utils'
import {
  MULK_HOLATI_MALUMOTI, MULK_TURI_MALUMOTI, MULK_TURLARI, kunlarSoni,
  type MulkHolati, type MulkTuri, type YakunAmali,
} from '@/lib/xodim-mulk'

// Xodimga biriktirilgan mulk: mashina, telefon, kalit... Qo'lidagilari tepada,
// qaytarilgan / yo'qolgan / o'tkazilganlari "Tarix"da — yozuv o'chmaydi.

interface Mulk {
  id: string
  turi: MulkTuri
  nomi: string
  raqami: string | null
  qiymati: number | null
  berilganSana: string
  berilganHolat: string | null
  izoh: string | null
  holati: MulkHolati
  yakunSana: string | null
  yakunIzoh: string | null
  yaratgan: { ism: string } | null
  yakunlagan: { ism: string } | null
}

interface Javob {
  mulklar: Mulk[]
  xulosa: { qolidagiSoni: number; qolidagiQiymati: number; tarixSoni: number }
  boshqaraOladi: boolean
}

export interface XodimTanlov { id: string; ism: string; faol: boolean }

export const TURI_BELGISI: Record<MulkTuri, LucideIcon> = {
  TRANSPORT: Car, TELEFON: Smartphone, KOMPYUTER: Laptop, ASBOB: Wrench, KALIT: KeyRound, KIYIM: Shirt, BOSHQA: Package,
}

const inputCls =
  'w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500'

const bugun = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tashkent' })
const sanaKiritma = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Asia/Tashkent' })

const boshForma = { turi: 'TRANSPORT' as MulkTuri, nomi: '', raqami: '', qiymati: '', berilganSana: '', berilganHolat: '', izoh: '' }

export default function XodimMulkPanel({ xodimId, xodimIsmi, xodimlar, onOzgardi }: {
  xodimId: string
  xodimIsmi: string
  /** O'tkazish uchun — shu doiradagi xodimlar */
  xodimlar: XodimTanlov[]
  /** Asosiy ro'yxatdagi sonlar yangilansin */
  onOzgardi?: () => void
}) {
  const confirm = useConfirm()
  const [data, setData] = useState<Javob | null>(null)
  const [xato, setXato] = useState<string | null>(null)
  const [forma, setForma] = useState<typeof boshForma | null>(null)
  const [tahrirId, setTahrirId] = useState<string | null>(null)
  const [amal, setAmal] = useState<{ mulkId: string; turi: YakunAmali; sana: string; izoh: string; yangiXodimId: string } | null>(null)
  const [band, setBand] = useState(false)
  const [tarixOchiq, setTarixOchiq] = useState(false)

  const yukla = useCallback(async () => {
    try {
      const r = await fetch(`/api/xodimlar/${xodimId}/mulk`, { cache: 'no-store' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setXato(j.xato ?? 'Mulklar yuklanmadi'); return }
      setXato(null)
      setData(j)
    } catch {
      setXato('Tarmoq xatosi')
    }
  }, [xodimId])

  useEffect(() => { void yukla() }, [yukla])

  function yangiOch() {
    setAmal(null)
    setTahrirId(null)
    setForma({ ...boshForma, berilganSana: bugun() })
  }

  function tahrirOch(m: Mulk) {
    setAmal(null)
    setTahrirId(m.id)
    setForma({
      turi: m.turi, nomi: m.nomi, raqami: m.raqami ?? '', qiymati: m.qiymati ? String(m.qiymati) : '',
      berilganSana: sanaKiritma(m.berilganSana), berilganHolat: m.berilganHolat ?? '', izoh: m.izoh ?? '',
    })
  }

  async function saqla(e: React.FormEvent) {
    e.preventDefault()
    if (!forma) return
    if (forma.nomi.trim().length < 2) { toast.error('Mulk nomini yozing'); return }
    setBand(true)
    try {
      const r = await fetch(tahrirId ? `/api/xodimlar/${xodimId}/mulk/${tahrirId}` : `/api/xodimlar/${xodimId}/mulk`, {
        method: tahrirId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...forma, qiymati: forma.qiymati.replace(/\s/g, '') || null }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.xato ?? 'Saqlanmadi'); return }
      toast.success(tahrirId ? 'Ma’lumot yangilandi' : `«${forma.nomi.trim()}» ${xodimIsmi} ga biriktirildi`)
      setForma(null)
      setTahrirId(null)
      await yukla()
      onOzgardi?.()
    } catch {
      toast.error('Tarmoq xatosi')
    } finally {
      setBand(false)
    }
  }

  async function amalniBajar(m: Mulk) {
    if (!amal) return
    if (amal.turi === 'YOQOLGAN' && amal.izoh.trim().length < 3) { toast.error('Nima bo‘lganini yozing'); return }
    if (amal.turi === 'OTKAZISH' && !amal.yangiXodimId) { toast.error('Qaysi xodimga o‘tkazilishini tanlang'); return }
    setBand(true)
    try {
      const r = await fetch(`/api/xodimlar/${xodimId}/mulk/${m.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amal: amal.turi, sana: amal.sana || null, izoh: amal.izoh.trim() || null, yangiXodimId: amal.yangiXodimId || undefined }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.xato ?? 'Bajarilmadi'); return }
      toast.success(
        amal.turi === 'QAYTARISH' ? `«${m.nomi}» qaytarib olindi`
          : amal.turi === 'YOQOLGAN' ? `«${m.nomi}» yo‘qolgan deb belgilandi`
          : `«${m.nomi}» ${j.kimga ?? 'boshqa xodim'} ga o‘tkazildi`,
      )
      setAmal(null)
      await yukla()
      onOzgardi?.()
    } catch {
      toast.error('Tarmoq xatosi')
    } finally {
      setBand(false)
    }
  }

  async function ochir(m: Mulk) {
    const ok = await confirm({
      title: 'Yozuvni o‘chirish',
      message: `«${m.nomi}» yozuvi butunlay o‘chiriladi. Faqat xato kiritilgan bo‘lsa o‘chiring — qaytarib olingan bo‘lsa «Qaytarib olish»ni tanlang, shunda tarix saqlanadi.`,
      confirmText: 'O‘chirish',
      danger: true,
    })
    if (!ok) return
    setBand(true)
    try {
      const r = await fetch(`/api/xodimlar/${xodimId}/mulk/${m.id}`, { method: 'DELETE' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.xato ?? 'O‘chirilmadi'); return }
      toast.success('O‘chirildi')
      await yukla()
      onOzgardi?.()
    } finally {
      setBand(false)
    }
  }

  if (xato) return <p className="py-10 text-center text-sm text-red-600">{xato}</p>
  if (!data) return <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin text-primary" /></div>

  const qolida = data.mulklar.filter(m => m.holati === 'BERILGAN')
  const tarix = data.mulklar.filter(m => m.holati !== 'BERILGAN')
  const boshqa = xodimlar.filter(x => x.faol && x.id !== xodimId)
  const tm = forma ? MULK_TURI_MALUMOTI[forma.turi] : null

  return (
    <div className="space-y-4">
      {/* Xulosa */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-gray-900 dark:text-gray-100">
            Qo‘lida: <b className="tabular-nums">{data.xulosa.qolidagiSoni} ta</b>
            {data.xulosa.qolidagiQiymati > 0 && <span className="text-gray-500 dark:text-gray-400"> · qiymati <b className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatSum(data.xulosa.qolidagiQiymati)}</b></span>}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Ishdan ketganda nima qaytarilishi kerakligi shu ro‘yxatdan ko‘rinadi</p>
        </div>
        {data.boshqaraOladi && !forma && (
          <button type="button" onClick={yangiOch} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90">
            <Plus size={15} aria-hidden /> Mulk biriktirish
          </button>
        )}
      </div>

      {/* Biriktirish / tahrirlash formasi */}
      {forma && tm && (
        <form onSubmit={saqla} className="rounded-2xl border border-gray-200 dark:border-neutral-700 bg-gray-50/70 dark:bg-neutral-800/40 p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{tahrirId ? 'Ma’lumotni tuzatish' : `${xodimIsmi} ga mulk biriktirish`}</p>
            <button type="button" onClick={() => { setForma(null); setTahrirId(null) }} aria-label="Yopish" className="p-1 text-gray-400 hover:text-gray-600"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5" role="radiogroup" aria-label="Mulk turi">
            {MULK_TURLARI.map(t => {
              const Belgi = TURI_BELGISI[t]
              const tanlangan = forma.turi === t
              return (
                <button
                  key={t} type="button" role="radio" aria-checked={tanlangan}
                  onClick={() => setForma(f => f && { ...f, turi: t })}
                  className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[11px] font-medium transition ${
                    tanlangan ? 'border-primary bg-red-50 dark:bg-red-950/30 text-primary' : 'border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  }`}
                >
                  <Belgi size={18} aria-hidden />
                  <span className="truncate max-w-full">{MULK_TURI_MALUMOTI[t].label}</span>
                </button>
              )
            })}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Nomi *</span>
              <input id="mulk-nomi" value={forma.nomi} onChange={e => setForma(f => f && { ...f, nomi: e.target.value })} placeholder={tm.nomNamuna} maxLength={120} required className={inputCls} />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{tm.raqamLabel}</span>
              <input id="mulk-raqami" value={forma.raqami} onChange={e => setForma(f => f && { ...f, raqami: e.target.value })} placeholder={tm.raqamNamuna} maxLength={60} className={`${inputCls} font-mono`} />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Qiymati (so‘m)</span>
              <input id="mulk-qiymati" value={forma.qiymati} onChange={e => setForma(f => f && { ...f, qiymati: e.target.value.replace(/[^\d]/g, '') })} inputMode="numeric" placeholder="ixtiyoriy" className={inputCls} />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Berilgan sana</span>
              <input id="mulk-sana" type="date" value={forma.berilganSana} max={bugun()} onChange={e => setForma(f => f && { ...f, berilganSana: e.target.value })} className={inputCls} />
            </label>
            <label className="block sm:col-span-2">
              <span className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Topshirilgandagi holati</span>
              <input id="mulk-holat" value={forma.berilganHolat} onChange={e => setForma(f => f && { ...f, berilganHolat: e.target.value })} placeholder={forma.turi === 'TRANSPORT' ? 'Masalan: probeg 84 000 km, orqa bamper tirnalgan' : 'Masalan: yangi, qutisi bilan'} maxLength={300} className={inputCls} />
            </label>
            <label className="block sm:col-span-2">
              <span className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Izoh</span>
              <input id="mulk-izoh" value={forma.izoh} onChange={e => setForma(f => f && { ...f, izoh: e.target.value })} placeholder="Masalan: faqat yetkazib berish uchun" maxLength={500} className={inputCls} />
            </label>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => { setForma(null); setTahrirId(null) }} className="px-4 py-2 rounded-xl border border-gray-300 dark:border-neutral-700 text-sm text-gray-600 dark:text-gray-400">Bekor</button>
            <button type="submit" disabled={band} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium disabled:opacity-60">
              {band ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} {tahrirId ? 'Saqlash' : 'Biriktirish'}
            </button>
          </div>
        </form>
      )}

      {/* Qo'lidagi mulk */}
      {qolida.length === 0 ? (
        !forma && (
          <div className="rounded-2xl border border-dashed border-gray-300 dark:border-neutral-700 py-10 text-center">
            <Package size={26} className="mx-auto text-gray-300 dark:text-neutral-600" aria-hidden />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Hozir {xodimIsmi} ga hech narsa biriktirilmagan</p>
          </div>
        )
      ) : (
        <ul className="space-y-2">
          {qolida.map(m => {
            const Belgi = TURI_BELGISI[m.turi]
            const amalShu = amal?.mulkId === m.id ? amal : null
            return (
              <li key={m.id} className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
                <div className="flex items-start gap-3 p-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400" aria-hidden>
                    <Belgi size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{m.nomi}</p>
                      {m.raqami && (
                        <span className={`font-mono text-xs px-1.5 py-0.5 rounded-md ${m.turi === 'TRANSPORT' ? 'border-2 border-gray-800 dark:border-gray-300 text-gray-900 dark:text-gray-100 font-bold uppercase tracking-wide' : 'bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300'}`}>
                          {m.raqami}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {MULK_TURI_MALUMOTI[m.turi].label} · {formatSana(m.berilganSana)} dan beri, <span className="tabular-nums">{kunlarSoni(m.berilganSana)} kun</span>
                      {m.qiymati ? <> · <span className="tabular-nums">{formatSum(m.qiymati)}</span></> : null}
                    </p>
                    {m.berilganHolat && <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Berilganda: {m.berilganHolat}</p>}
                    {m.izoh && <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{m.izoh}</p>}
                    {m.yaratgan && <p className="text-[11px] text-gray-400 mt-1">Kiritgan: {m.yaratgan.ism}</p>}
                  </div>
                </div>

                {data.boshqaraOladi && !amalShu && (
                  <div className="flex flex-wrap gap-1 border-t border-gray-100 dark:border-neutral-800 px-2.5 py-2">
                    <AmalTugma belgi={Undo2} matn="Qaytarib olish" onClick={() => setAmal({ mulkId: m.id, turi: 'QAYTARISH', sana: bugun(), izoh: '', yangiXodimId: '' })} />
                    {boshqa.length > 0 && <AmalTugma belgi={ArrowRightLeft} matn="Boshqa xodimga" onClick={() => setAmal({ mulkId: m.id, turi: 'OTKAZISH', sana: bugun(), izoh: '', yangiXodimId: '' })} />}
                    <AmalTugma belgi={TriangleAlert} matn="Yo‘qoldi / buzildi" xavfli onClick={() => setAmal({ mulkId: m.id, turi: 'YOQOLGAN', sana: bugun(), izoh: '', yangiXodimId: '' })} />
                    <span className="flex-1" />
                    <button type="button" onClick={() => tahrirOch(m)} title="Tahrirlash" aria-label={`${m.nomi} — tahrirlash`} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-neutral-800"><Pencil size={14} /></button>
                    <button type="button" onClick={() => void ochir(m)} disabled={band} title="Xato kiritilgan bo‘lsa o‘chirish" aria-label={`${m.nomi} — o‘chirish`} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"><Trash2 size={14} /></button>
                  </div>
                )}

                {amalShu && (
                  <div className={`border-t px-3.5 py-3 space-y-2.5 ${amalShu.turi === 'YOQOLGAN' ? 'border-red-100 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/10' : 'border-gray-100 dark:border-neutral-800 bg-gray-50/70 dark:bg-neutral-800/40'}`}>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {amalShu.turi === 'QAYTARISH' ? 'Qaytarib olish' : amalShu.turi === 'YOQOLGAN' ? 'Yo‘qolgan yoki buzilgan deb belgilash' : 'Boshqa xodimga o‘tkazish'}
                    </p>
                    <div className="grid sm:grid-cols-[minmax(0,1fr)_auto] gap-2">
                      {amalShu.turi === 'OTKAZISH' && (
                        <select id="mulk-yangi-xodim" value={amalShu.yangiXodimId} onChange={e => setAmal(a => a && { ...a, yangiXodimId: e.target.value })} className={`${inputCls} sm:col-span-2`}>
                          <option value="">Kimga o‘tkaziladi?</option>
                          {boshqa.map(x => <option key={x.id} value={x.id}>{x.ism}</option>)}
                        </select>
                      )}
                      <input
                        id="mulk-amal-izoh" value={amalShu.izoh} onChange={e => setAmal(a => a && { ...a, izoh: e.target.value })} maxLength={300}
                        placeholder={amalShu.turi === 'QAYTARISH' ? 'Qanday holatda qaytardi (ixtiyoriy)' : amalShu.turi === 'YOQOLGAN' ? 'Nima bo‘ldi? (majburiy)' : 'Topshirilgandagi holati (ixtiyoriy)'}
                        className={inputCls}
                      />
                      <input id="mulk-amal-sana" type="date" value={amalShu.sana} max={bugun()} onChange={e => setAmal(a => a && { ...a, sana: e.target.value })} className={inputCls} aria-label="Sana" />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button type="button" onClick={() => setAmal(null)} className="px-3.5 py-1.5 rounded-xl border border-gray-300 dark:border-neutral-700 text-sm text-gray-600 dark:text-gray-400">Bekor</button>
                      <button type="button" onClick={() => void amalniBajar(m)} disabled={band} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-white text-sm font-medium disabled:opacity-60 ${amalShu.turi === 'YOQOLGAN' ? 'bg-red-600' : 'bg-primary'}`}>
                        {band ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Tasdiqlash
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Tarix */}
      {tarix.length > 0 && (
        <section>
          <button type="button" onClick={() => setTarixOchiq(v => !v)} aria-expanded={tarixOchiq} className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 hover:text-gray-700">
            <History size={12} aria-hidden /> Tarix — {tarix.length} ta yozuv {tarixOchiq ? '▴' : '▾'}
          </button>
          {tarixOchiq && (
            <ul className="mt-2 rounded-2xl border border-gray-200 dark:border-neutral-800 divide-y divide-gray-100 dark:divide-neutral-800">
              {tarix.map(m => {
                const Belgi = TURI_BELGISI[m.turi]
                const hm = MULK_HOLATI_MALUMOTI[m.holati]
                return (
                  <li key={m.id} className="flex items-start gap-3 px-3.5 py-2.5">
                    <Belgi size={16} className="mt-0.5 shrink-0 text-gray-400" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {m.nomi}
                        {m.raqami && <span className="ml-1.5 font-mono text-xs text-gray-500">{m.raqami}</span>}
                        <span className={`ml-2 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${hm.badge}`}>{hm.label}</span>
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                        {formatSana(m.berilganSana)} → {m.yakunSana ? formatSana(m.yakunSana) : '—'}
                        {m.yakunSana && ` (${kunlarSoni(m.berilganSana, m.yakunSana)} kun)`}
                        {m.yakunlagan && ` · ${m.yakunlagan.ism}`}
                      </p>
                      {m.yakunIzoh && <p className="text-xs text-gray-600 dark:text-gray-400">{m.yakunIzoh}</p>}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}

function AmalTugma({ belgi: Belgi, matn, onClick, xavfli }: { belgi: LucideIcon; matn: string; onClick: () => void; xavfli?: boolean }) {
  return (
    <button
      type="button" onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${xavfli ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800'}`}
    >
      <Belgi size={14} aria-hidden /> {matn}
    </button>
  )
}
