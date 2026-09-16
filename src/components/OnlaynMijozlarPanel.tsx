'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, Banknote, Bike, ChevronDown, ChevronLeft, ChevronRight, Clock, CreditCard, ExternalLink, Globe, History,
  Loader2, MessageSquare, Package, Phone, Receipt, RefreshCw, ShieldCheck, Store, UserRound, X,
} from 'lucide-react'
import SearchBar from '@/components/ui/search-bar'
import { ManzilTugma } from '@/components/ManzilXarita'
import { manzilKorinishi, manzilQidiruvMatni } from '@/lib/xarita-havola'
import { toast } from 'sonner'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { useRuxsat } from '@/hooks/useRuxsat'
import { formatPhone, formatSana, formatSanaVaVaqt, formatSum } from '@/lib/utils'
import { FAOL_HOLATLAR, HOLAT_RANGI, holatNomi, tolovNomi, type OnlaynBuyurtma } from '@/lib/onlayn-buyurtma'
import type {
  ErpKarta, OnlaynMijozFiltri, OnlaynMijozQatori, OnlaynMijozRoyxat, OnlaynMijozTafsilot, OnlaynMijozTartibi,
} from '@/lib/onlayn-mijoz'

// Mijozlar › Onlayn mijozlar — onlayn do'konda ro'yxatdan o'tgan xaridorlar.
//
// Ro'yxat marketplace'dan keladi (ERP uni o'zida saqlamaydi). Mijoz bosilganda
// uning barcha buyurtmalari ochiladi; buyurtma bosilganda — to'liq chek:
// mahsulotlar, summa, to'lov, yetkazish, holat tarixi va ERP'dagi sotuv cheki.

const FILTRLAR: { kalit: OnlaynMijozFiltri; nomi: string }[] = [
  { kalit: 'hammasi', nomi: 'Hammasi' },
  { kalit: 'buyurtmali', nomi: 'Buyurtma berganlar' },
  { kalit: 'buyurtmasiz', nomi: 'Hali buyurtmasiz' },
]
const TARTIBLAR: { kalit: OnlaynMijozTartibi; nomi: string }[] = [
  { kalit: 'yangi', nomi: 'Yangi ro‘yxatdan o‘tganlar' },
  { kalit: 'oxirgi', nomi: 'Oxirgi buyurtma bo‘yicha' },
  { kalit: 'summa', nomi: 'Eng ko‘p xarid qilganlar' },
]

const miqdorMatni = (n: number) => String(Math.round(n * 1000) / 1000)
const birlikMatni = (b: string) => (b === 'DONA' ? 'dona' : b.toLowerCase())
const ismi = (m: { ism: string | null }) => m.ism?.trim() || 'Ismsiz xaridor'

function HolatBelgisi({ b }: { b: Pick<OnlaynBuyurtma, 'holati' | 'yetkazish'> }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${HOLAT_RANGI[b.holati]}`}>
      {holatNomi(b.holati, b.yetkazish)}
    </span>
  )
}

function ErpKartaBelgisi({ karta }: { karta: ErpKarta | null | undefined }) {
  if (!karta) return null
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 dark:bg-neutral-800 px-1.5 py-0.5 text-[11px] font-medium text-gray-600 dark:text-gray-400" title="Do‘kondagi mijoz kartasi (telefon bo‘yicha)">
      <Store size={11} aria-hidden /> Do‘kon kartasi · {karta.sotuvSoni} xarid
    </span>
  )
}

export default function OnlaynMijozlarPanel({ onErpKarta }: { onErpKarta?: (mijozId: string) => void }) {
  const [qidiruv, setQidiruv] = useState('')
  const [filtr, setFiltr] = useState<OnlaynMijozFiltri>('hammasi')
  const [tartib, setTartib] = useState<OnlaynMijozTartibi>('yangi')
  const [sahifa, setSahifa] = useState(1)
  const [data, setData] = useState<OnlaynMijozRoyxat | null>(null)
  const [yuklanmoqda, setYuklanmoqda] = useState(true)
  const [xato, setXato] = useState<string | null>(null)
  const [tanlangan, setTanlangan] = useState<string | null>(null)

  const yukla = useCallback(async () => {
    setYuklanmoqda(true)
    try {
      const p = new URLSearchParams({ filtr, tartib })
      if (qidiruv.trim()) p.set('q', qidiruv.trim())
      if (sahifa > 1) p.set('sahifa', String(sahifa))
      const r = await fetch(`/api/onlayn-mijozlar?${p}`, { cache: 'no-store' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setXato(j.xato ?? 'Onlayn mijozlar yuklanmadi'); return }
      setXato(null)
      setData(j)
    } catch {
      setXato('Internet aloqasini tekshiring')
    } finally {
      setYuklanmoqda(false)
    }
  }, [qidiruv, filtr, tartib, sahifa])

  useEffect(() => { void yukla() }, [yukla])

  // Filtr o'zgarsa — birinchi sahifadan
  function filtrniOzgartir(f: () => void) {
    f()
    setSahifa(1)
  }

  const st = data?.statistika
  const sahifalar = data ? Math.max(1, Math.ceil(data.jami / data.sahifaHajmi)) : 1
  const boshi = data && data.jami > 0 ? (data.sahifa - 1) * data.sahifaHajmi + 1 : 0
  const oxiri = data ? Math.min(data.jami, data.sahifa * data.sahifaHajmi) : 0

  return (
    <div className="space-y-4">
      {/* Ko'rsatkichlar */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { nomi: 'Ro‘yxatdan o‘tgan', qiymat: st?.jami, izoh: st ? `7 kunda +${st.yangi7}` : '' },
          { nomi: 'Buyurtma berganlar', qiymat: st?.buyurtmali, izoh: st && st.jami ? `${Math.round((st.buyurtmali / st.jami) * 100)}% i` : '' },
          { nomi: 'Faol buyurtmasi bor', qiymat: st?.faolBuyurtmali, izoh: 'hozir yo‘lda yoki yig‘ilmoqda' },
        ].map(k => (
          <div key={k.nomi} className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-2.5 sm:px-4 sm:py-3 min-w-0">
            <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 truncate">{k.nomi}</p>
            <p className="text-lg sm:text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{k.qiymat ?? '—'}</p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate hidden sm:block">{k.izoh}</p>
          </div>
        ))}
      </div>

      {/* Qidiruv va filtrlar */}
      <div className="flex flex-col lg:flex-row gap-2.5 lg:items-center">
        <SearchBar
          value={qidiruv}
          onChange={v => filtrniOzgartir(() => setQidiruv(v))}
          placeholder="Ism yoki telefon raqami bo‘yicha qidirish..."
          className="flex-1"
        />
        <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-0.5">
          {FILTRLAR.map(f => (
            <button
              key={f.kalit} type="button" onClick={() => filtrniOzgartir(() => setFiltr(f.kalit))} aria-pressed={filtr === f.kalit}
              className={`shrink-0 px-3.5 py-2 rounded-xl text-sm font-medium transition ${
                filtr === f.kalit
                  ? 'bg-red-600 text-white'
                  : 'bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-800'
              }`}
            >
              {f.nomi}
            </button>
          ))}
        </div>
        <label className="shrink-0">
          <span className="sr-only">Tartib</span>
          <select
            id="onlayn-mijoz-tartib" value={tartib} onChange={e => filtrniOzgartir(() => setTartib(e.target.value as OnlaynMijozTartibi))}
            className="w-full lg:w-auto px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            {TARTIBLAR.map(t => <option key={t.kalit} value={t.kalit}>{t.nomi}</option>)}
          </select>
        </label>
      </div>

      {xato ? (
        <div className="rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50/60 dark:bg-red-950/10 p-6 text-center">
          <AlertTriangle size={26} className="mx-auto text-red-500" aria-hidden />
          <p className="mt-2 font-medium text-red-700 dark:text-red-400">{xato}</p>
          <p className="mt-1 text-sm text-red-600/80 dark:text-red-400/80">Onlayn do‘kon serveri javob bermadi. Birozdan keyin qayta urinib ko‘ring.</p>
          <button type="button" onClick={() => void yukla()} className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-red-200 dark:border-red-900/50 px-4 py-2 text-sm font-medium text-red-700 dark:text-red-400 hover:bg-red-100/60 dark:hover:bg-red-950/30">
            <RefreshCw size={14} aria-hidden /> Qayta yuklash
          </button>
        </div>
      ) : !data && yuklanmoqda ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-primary" /></div>
      ) : data && data.mijozlar.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-neutral-700 py-14 text-center">
          <Globe size={28} className="mx-auto text-gray-300 dark:text-neutral-600" aria-hidden />
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {qidiruv.trim() || filtr !== 'hammasi' ? 'Shu shartlar bo‘yicha mijoz topilmadi' : 'Onlayn do‘konda hali hech kim ro‘yxatdan o‘tmagan'}
          </p>
        </div>
      ) : data && (
        <div className={`space-y-3 transition-opacity ${yuklanmoqda ? 'opacity-60' : ''}`}>
          {/* Kompyuter — jadval */}
          <div className="hidden md:block bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-neutral-800 border-b border-gray-200 dark:border-neutral-800 text-xs text-gray-500 dark:text-gray-400">
                    <th className="text-left font-medium px-4 py-3">Mijoz</th>
                    <th className="text-left font-medium px-4 py-3 whitespace-nowrap">Telefon</th>
                    <th className="text-left font-medium px-4 py-3 whitespace-nowrap">Ro‘yxatdan o‘tgan</th>
                    <th className="text-center font-medium px-4 py-3">Buyurtmalar</th>
                    <th className="text-right font-medium px-4 py-3 whitespace-nowrap">Xarid summasi</th>
                    <th className="text-right font-medium px-4 py-3 whitespace-nowrap">Oxirgi buyurtma</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                  {data.mijozlar.map(m => (
                    <tr key={m.id} onClick={() => setTanlangan(m.id)} className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition ${m.faol ? '' : 'opacity-60'}`}>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => setTanlangan(m.id)} className="flex items-center gap-3 text-left min-w-0">
                          <MijozAvatar m={m} />
                          <span className="min-w-0">
                            <span className="block font-medium text-gray-900 dark:text-gray-100 truncate">{ismi(m)}</span>
                            <span className="mt-0.5 flex flex-wrap gap-1">
                              <ErpKartaBelgisi karta={m.erpKarta} />
                              {!m.tasdiqlangan && <span className="rounded-md bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">tasdiqlanmagan</span>}
                              {!m.faol && <span className="rounded-md bg-gray-100 dark:bg-neutral-800 px-1.5 py-0.5 text-[11px] font-medium text-gray-600 dark:text-gray-400">bloklangan</span>}
                            </span>
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-gray-700 dark:text-gray-300">{formatPhone(m.telefon)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400">{formatSana(m.yaratilgan)}</td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{m.buyurtmaSoni}</span>
                        {m.faolSoni > 0 && <span className="ml-1.5 rounded-full bg-red-50 dark:bg-red-950/40 px-1.5 py-0.5 text-[11px] font-semibold text-red-700 dark:text-red-400">{m.faolSoni} faol</span>}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap font-semibold tabular-nums text-gray-900 dark:text-gray-100">{m.xaridSumma > 0 ? formatSum(m.xaridSumma) : <span className="font-normal text-gray-400">—</span>}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap text-gray-600 dark:text-gray-400">{m.oxirgiBuyurtma ? formatSana(m.oxirgiBuyurtma) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Telefon — kartalar */}
          <div className="md:hidden grid gap-2">
            {data.mijozlar.map(m => (
              <button
                key={m.id} type="button" onClick={() => setTanlangan(m.id)}
                className={`w-full text-left bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-3.5 ${m.faol ? '' : 'opacity-60'}`}
              >
                <span className="flex items-start gap-3">
                  <MijozAvatar m={m} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium text-gray-900 dark:text-gray-100 truncate">{ismi(m)}</span>
                      {m.faolSoni > 0 && <span className="shrink-0 rounded-full bg-red-50 dark:bg-red-950/40 px-1.5 py-0.5 text-[11px] font-semibold text-red-700 dark:text-red-400">{m.faolSoni} faol</span>}
                    </span>
                    <span className="block font-mono text-sm text-gray-600 dark:text-gray-400">{formatPhone(m.telefon)}</span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                      <span><b className="tabular-nums text-gray-800 dark:text-gray-200">{m.buyurtmaSoni}</b> buyurtma</span>
                      {m.xaridSumma > 0 && <span className="tabular-nums font-semibold text-gray-800 dark:text-gray-200">{formatSum(m.xaridSumma)}</span>}
                      <span>{formatSana(m.yaratilgan)} dan</span>
                    </span>
                    {m.erpKarta && <span className="mt-1.5 block"><ErpKartaBelgisi karta={m.erpKarta} /></span>}
                  </span>
                </span>
              </button>
            ))}
          </div>

          {/* Sahifalash */}
          <div className="flex items-center justify-between gap-3 text-sm text-gray-500 dark:text-gray-400">
            <span className="tabular-nums">{data.jami} ta mijozdan {boshi}–{oxiri}</span>
            {sahifalar > 1 && (
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setSahifa(s => Math.max(1, s - 1))} disabled={sahifa <= 1 || yuklanmoqda} aria-label="Oldingi sahifa" className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-2 disabled:opacity-40">
                  <ChevronLeft size={16} />
                </button>
                <span className="px-2 tabular-nums">{sahifa} / {sahifalar}</span>
                <button type="button" onClick={() => setSahifa(s => Math.min(sahifalar, s + 1))} disabled={sahifa >= sahifalar || yuklanmoqda} aria-label="Keyingi sahifa" className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-2 disabled:opacity-40">
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {tanlangan && (
        <MijozOynasi
          id={tanlangan}
          onYopish={() => setTanlangan(null)}
          onErpKarta={onErpKarta ? id => { setTanlangan(null); onErpKarta(id) } : undefined}
        />
      )}
    </div>
  )
}

function MijozAvatar({ m }: { m: Pick<OnlaynMijozQatori, 'ism'> }) {
  const harf = m.ism?.trim().charAt(0).toUpperCase()
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/30 text-sm font-semibold text-primary" aria-hidden>
      {harf || <UserRound size={16} />}
    </span>
  )
}

// ─── Bitta mijoz ─────────────────────────────────────────────────────────────

type BuyurtmaFiltri = 'hammasi' | 'faol' | 'bajarilgan' | 'bekor'

function MijozOynasi({ id, onYopish, onErpKarta }: { id: string; onYopish: () => void; onErpKarta?: (id: string) => void }) {
  useBodyScrollLock(true)
  const ruxsat = useRuxsat()
  const [m, setM] = useState<OnlaynMijozTafsilot | null>(null)
  const [xato, setXato] = useState<string | null>(null)
  const [ochiq, setOchiq] = useState<Set<string>>(new Set())
  const [bFiltr, setBFiltr] = useState<BuyurtmaFiltri>('hammasi')

  useEffect(() => {
    let bekor = false
    fetch(`/api/onlayn-mijozlar/${encodeURIComponent(id)}`, { cache: 'no-store' })
      .then(async r => {
        const d = await r.json().catch(() => ({}))
        if (bekor) return
        if (!r.ok) { setXato(d.xato ?? 'Mijoz ma’lumotlari yuklanmadi'); return }
        setM(d)
        // Bitta buyurtma bo'lsa — chek darhol ochiq
        if (d.buyurtmalar?.length === 1) setOchiq(new Set([d.buyurtmalar[0].raqam]))
      })
      .catch(() => { if (!bekor) setXato('Internet aloqasini tekshiring') })
    return () => { bekor = true }
  }, [id])

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onYopish() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onYopish])

  // Aniq nuqtani saqlash — marketplace'ga yoziladi, oynadagi ma'lumot ham darhol yangilanadi
  async function nuqtaYubor(url: string, lat: number, lng: number): Promise<{ lat: number; lng: number } | null> {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lat, lng }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.xato ?? 'Nuqta saqlanmadi'); return null }
      toast.success('Aniq nuqta saqlandi — kuryer shu joyga boradi')
      return j
    } catch {
      toast.error('Tarmoq xatosi')
      return null
    }
  }

  const manzilNuqtasiniSaqla = ruxsat.bor('mijozlar.tahrirlash') ? (manzilId: string) => async (lat: number, lng: number) => {
    const n = await nuqtaYubor(`/api/onlayn-mijozlar/${encodeURIComponent(id)}/manzil/${encodeURIComponent(manzilId)}`, lat, lng)
    if (n) setM(x => x && { ...x, manzillar: x.manzillar.map(a => (a.id === manzilId ? { ...a, lat: n.lat, lng: n.lng } : a)) })
    return !!n
  } : null

  const buyurtmaNuqtasiniSaqla = ruxsat.bor('onlayn-buyurtmalar.boshqarish') ? (raqam: string) => async (lat: number, lng: number) => {
    const n = await nuqtaYubor(`/api/onlayn-buyurtmalar/${encodeURIComponent(raqam)}/nuqta`, lat, lng)
    if (n) setM(x => x && { ...x, buyurtmalar: x.buyurtmalar.map(b => (b.raqam === raqam ? { ...b, lat: n.lat, lng: n.lng } : b)) })
    return !!n
  } : null

  const almashtir = (raqam: string) => setOchiq(s => {
    const n = new Set(s)
    if (n.has(raqam)) n.delete(raqam)
    else n.add(raqam)
    return n
  })

  const buyurtmalar = (m?.buyurtmalar ?? []).filter(b =>
    bFiltr === 'hammasi' ? true
      : bFiltr === 'faol' ? FAOL_HOLATLAR.includes(b.holati)
      : bFiltr === 'bajarilgan' ? b.holati === 'BAJARILGAN'
      : b.holati === 'BEKOR' || b.holati === 'QAYTARILGAN')

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={e => { if (e.target === e.currentTarget) onYopish() }}>
      <div role="dialog" aria-modal="true" aria-label="Onlayn mijoz" className="bg-gray-50 dark:bg-neutral-950 w-full sm:max-w-3xl max-h-[94dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 bg-white/95 dark:bg-neutral-900/95 backdrop-blur border-b border-gray-100 dark:border-neutral-800">
          {m ? (
            <div className="flex items-center gap-3 min-w-0">
              <MijozAvatar m={m} />
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{ismi(m)}</p>
                <a href={`tel:${m.telefon}`} className="inline-flex items-center gap-1 font-mono text-sm text-primary"><Phone size={13} aria-hidden />{formatPhone(m.telefon)}</a>
              </div>
            </div>
          ) : <span className="font-semibold text-gray-900 dark:text-gray-100">Onlayn mijoz</span>}
          <button type="button" onClick={onYopish} aria-label="Yopish" className="p-2 -mr-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-neutral-800"><X size={20} /></button>
        </div>

        {xato ? (
          <p className="p-8 text-center text-red-600">{xato}</p>
        ) : !m ? (
          <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-primary" /></div>
        ) : (
          <div className="p-4 sm:p-5 space-y-4">
            {/* Xulosa */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { nomi: 'Buyurtmalar', qiymat: String(m.xulosa.buyurtmaSoni), izoh: m.xulosa.faolSoni ? `${m.xulosa.faolSoni} tasi faol` : m.xulosa.bekorSoni ? `${m.xulosa.bekorSoni} bekor` : '' },
                { nomi: 'Topshirilgan', qiymat: String(m.xulosa.bajarilganSoni), izoh: '' },
                { nomi: 'Jami xarid', qiymat: formatSum(m.xulosa.xaridSumma), izoh: 'topshirilganlar' },
                { nomi: 'O‘rtacha chek', qiymat: m.xulosa.ortachaChek ? formatSum(m.xulosa.ortachaChek) : '—', izoh: '' },
              ].map(k => (
                <div key={k.nomi} className="rounded-2xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 px-3 py-2.5 min-w-0">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{k.nomi}</p>
                  <p className="font-bold tabular-nums text-gray-900 dark:text-gray-100 truncate">{k.qiymat}</p>
                  {k.izoh && <p className="text-[11px] text-gray-400 truncate">{k.izoh}</p>}
                </div>
              ))}
            </div>

            {/* Hisob va do'kon kartasi */}
            <div className="grid sm:grid-cols-2 gap-2">
              <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 p-3.5 text-sm space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Hisob</p>
                <p className="text-gray-700 dark:text-gray-300">Ro‘yxatdan o‘tgan: <b className="font-medium text-gray-900 dark:text-gray-100">{formatSanaVaVaqt(m.yaratilgan)}</b></p>
                <p className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                  <ShieldCheck size={14} className={m.tasdiqlangan ? 'text-emerald-600' : 'text-amber-500'} aria-hidden />
                  {m.tasdiqlangan ? 'Telefon SMS kod bilan tasdiqlangan' : 'Telefon hali tasdiqlanmagan'}
                </p>
                {!m.faol && <p className="text-red-600 dark:text-red-400 font-medium">Hisob bloklangan</p>}
              </div>
              <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 p-3.5 text-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Do‘kondagi kartasi</p>
                {m.erpKarta ? (
                  <>
                    <p className="mt-1 text-gray-900 dark:text-gray-100 font-medium">{m.erpKarta.ism}</p>
                    <p className="text-gray-500 dark:text-gray-400">{m.erpKarta.sotuvSoni} ta xarid (kassa va onlayn)</p>
                    {onErpKarta && (
                      <button type="button" onClick={() => onErpKarta(m.erpKarta!.id)} className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-gray-100 dark:bg-neutral-800 px-3 py-1.5 text-sm font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-neutral-700">
                        <Store size={14} aria-hidden /> Kartani ochish
                      </button>
                    )}
                  </>
                ) : (
                  <p className="mt-1 text-gray-500 dark:text-gray-400">Hali yo‘q — birinchi buyurtma topshirilganda telefon raqami bo‘yicha avtomatik ochiladi.</p>
                )}
              </div>
            </div>

            {/* Manzillar */}
            {m.manzillar.length > 0 && (
              <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Saqlangan manzillar</p>
                <ul className="space-y-2">
                  {m.manzillar.map(a => (
                    <li key={a.id} className="text-sm">
                      <p className="text-gray-900 dark:text-gray-100 ml-5">
                        <b className="font-medium">{a.nomi}</b>
                        {a.asosiy && <span className="ml-1.5 rounded bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">asosiy</span>}
                      </p>
                      <ManzilTugma
                        sarlavha={`${ismi(m)} — ${a.nomi}`}
                        manzil={manzilKorinishi([a.viloyat, a.tuman, a.manzil])}
                        qidiruvMatni={manzilQidiruvMatni([a.manzil, a.tuman, a.viloyat])}
                        moljal={a.moljal}
                        lat={a.lat} lng={a.lng}
                        telefon={m.telefon}
                        onNuqtaSaqla={manzilNuqtasiniSaqla?.(a.id)}
                      />
                      {a.moljal && <p className="text-xs text-gray-500 ml-5">Mo‘ljal: {a.moljal}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Buyurtmalar */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 px-1">Buyurtmalar va cheklar</h3>
                {m.buyurtmalar.length > 1 && (
                  <div className="flex gap-1 overflow-x-auto">
                    {([['hammasi', 'Hammasi'], ['faol', 'Faol'], ['bajarilgan', 'Topshirilgan'], ['bekor', 'Bekor']] as const).map(([k, nomi]) => (
                      <button
                        key={k} type="button" onClick={() => setBFiltr(k)} aria-pressed={bFiltr === k}
                        className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium transition ${bFiltr === k ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : 'bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 text-gray-600 dark:text-gray-400'}`}
                      >
                        {nomi}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {m.buyurtmalar.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                  <Package size={24} className="mx-auto mb-2 text-gray-300 dark:text-neutral-600" aria-hidden />
                  Bu mijoz hali buyurtma bermagan
                </p>
              ) : buyurtmalar.length === 0 ? (
                <p className="rounded-2xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 py-8 text-center text-sm text-gray-500">Bu turdagi buyurtma yo‘q</p>
              ) : (
                buyurtmalar.map(b => (
                  <BuyurtmaCheki
                    key={b.raqam} b={b} ochiq={ochiq.has(b.raqam)} onAlmashtir={() => almashtir(b.raqam)}
                    boshqaraOladi={ruxsat.bor('onlayn-buyurtmalar')}
                    telefon={m.telefon}
                    onNuqtaSaqla={buyurtmaNuqtasiniSaqla?.(b.raqam)}
                  />
                ))
              )}
              {m.jamiBuyurtma > m.buyurtmalar.length && (
                <p className="text-center text-xs text-gray-500">So‘nggi {m.buyurtmalar.length} ta buyurtma ko‘rsatildi (jami {m.jamiBuyurtma})</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Chek ────────────────────────────────────────────────────────────────────

function BuyurtmaCheki({ b, ochiq, onAlmashtir, boshqaraOladi, telefon, onNuqtaSaqla }: {
  b: OnlaynBuyurtma; ochiq: boolean; onAlmashtir: () => void; boshqaraOladi: boolean
  telefon?: string | null
  onNuqtaSaqla?: (lat: number, lng: number) => Promise<boolean>
}) {
  const mahsulotSoni = b.qatorlar.length
  return (
    <div className={`rounded-2xl border bg-white dark:bg-neutral-900 overflow-hidden ${ochiq ? 'border-gray-300 dark:border-neutral-700 shadow-sm' : 'border-gray-200 dark:border-neutral-800'}`}>
      <button type="button" onClick={onAlmashtir} aria-expanded={ochiq} className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition">
        <Receipt size={18} className="shrink-0 text-gray-400" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">{b.raqam}</span>
            <HolatBelgisi b={b} />
          </span>
          <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {formatSanaVaVaqt(b.yaratilgan)} · {mahsulotSoni} xil mahsulot · {b.yetkazish === 'KURYER' ? 'yetkazish' : 'olib ketish'}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatSum(b.jamiSumma)}</span>
        </span>
        <ChevronDown size={18} className={`shrink-0 text-gray-400 transition-transform ${ochiq ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      {ochiq && (
        <div className="border-t border-dashed border-gray-300 dark:border-neutral-700">
          {/* Mahsulotlar — chek ko'rinishida */}
          <div className="px-4 py-3">
            <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-x-4 pb-1.5 text-[11px] uppercase tracking-wide text-gray-400">
              <span>Mahsulot</span><span className="text-right">Miqdor</span><span className="text-right">Narx</span><span className="text-right">Jami</span>
            </div>
            <ul className="divide-y divide-gray-100 dark:divide-neutral-800">
              {b.qatorlar.map(q => (
                <li key={q.id} className="py-2 text-sm sm:grid sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:gap-x-4 sm:items-baseline">
                  <span className="block text-gray-900 dark:text-gray-100">{q.nomi}</span>
                  <span className="sm:hidden mt-0.5 flex items-baseline justify-between gap-3 tabular-nums">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{miqdorMatni(q.miqdor)} {birlikMatni(q.birlik)} × {formatSum(q.birlikNarxi)}</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{formatSum(q.jami)}</span>
                  </span>
                  <span className="hidden sm:block text-right tabular-nums text-gray-600 dark:text-gray-400 whitespace-nowrap">{miqdorMatni(q.miqdor)} {birlikMatni(q.birlik)}</span>
                  <span className="hidden sm:block text-right tabular-nums text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatSum(q.birlikNarxi)}</span>
                  <span className="hidden sm:block text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">{formatSum(q.jami)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 border-t border-dashed border-gray-300 dark:border-neutral-700 pt-2 text-sm space-y-1">
              <div className="flex justify-between text-gray-600 dark:text-gray-400"><span>Mahsulotlar</span><span className="tabular-nums">{formatSum(b.mahsulotSumma)}</span></div>
              <div className="flex justify-between text-gray-600 dark:text-gray-400"><span>Yetkazish</span><span className="tabular-nums">{b.yetkazishNarx > 0 ? formatSum(b.yetkazishNarx) : 'bepul'}</span></div>
              <div className="flex justify-between font-bold text-base text-gray-900 dark:text-gray-100 pt-1"><span>Jami</span><span className="tabular-nums">{formatSum(b.jamiSumma)}</span></div>
            </div>
          </div>

          {/* To'lov va yetkazish */}
          <div className="grid sm:grid-cols-2 gap-2 px-4 pb-3 text-sm">
            <div className="rounded-xl bg-gray-50 dark:bg-neutral-800/50 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">To‘lov</p>
              <p className="flex items-center gap-1.5 text-gray-800 dark:text-gray-200">
                {b.tolovUsuli === 'KARTA_YETKAZISHDA' ? <CreditCard size={14} aria-hidden /> : <Banknote size={14} aria-hidden />} {tolovNomi(b.tolovUsuli)}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 dark:bg-neutral-800/50 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">{b.yetkazish === 'KURYER' ? 'Yetkazish' : 'Olib ketish'}</p>
              {b.yetkazish === 'KURYER' ? (
                <>
                  <p className="flex items-center gap-1.5 text-xs text-gray-500 mb-0.5"><Bike size={12} aria-hidden /> Kuryer</p>
                  <ManzilTugma
                    sarlavha={`${b.raqam} — yetkazish manzili`}
                    manzil={manzilKorinishi([b.hudud, b.manzilMatni]) || '—'}
                    qidiruvMatni={manzilQidiruvMatni([b.manzilMatni, b.hudud])}
                    moljal={b.moljal}
                    lat={b.lat} lng={b.lng}
                    telefon={b.aloqaTel || telefon}
                    onNuqtaSaqla={onNuqtaSaqla}
                  />
                  {b.moljal && <p className="text-xs text-gray-500 mt-0.5 ml-5">Mo‘ljal: {b.moljal}</p>}
                </>
              ) : (
                <p className="flex items-center gap-1.5 text-gray-800 dark:text-gray-200"><Store size={14} aria-hidden /> Do‘kondan o‘zi oladi</p>
              )}
              {b.vaqtOraligi && <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400"><Clock size={12} aria-hidden />{b.vaqtOraligi}</p>}
              <p className="mt-1 text-xs text-gray-500">Qabul qiluvchi: {b.aloqaIsm ?? '—'} · <span className="font-mono">{formatPhone(b.aloqaTel)}</span></p>
            </div>
          </div>

          {(b.izoh || b.bekorSababi) && (
            <div className="px-4 pb-3 space-y-2 text-sm">
              {b.izoh && <p className="flex gap-2 rounded-xl bg-blue-50 dark:bg-blue-950/20 px-3 py-2 text-blue-800 dark:text-blue-300"><MessageSquare size={15} className="mt-0.5 shrink-0" aria-hidden />{b.izoh}</p>}
              {b.bekorSababi && <p className="rounded-xl bg-gray-100 dark:bg-neutral-800 px-3 py-2 text-gray-700 dark:text-gray-300">Bekor sababi: {b.bekorSababi}</p>}
            </div>
          )}

          {/* Holat tarixi */}
          {b.tarix.length > 0 && (
            <div className="px-4 pb-3">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5"><History size={12} aria-hidden /> Holat tarixi</p>
              <ol className="relative ml-1.5 border-l border-gray-200 dark:border-neutral-700 space-y-2">
                {b.tarix.map((t, i) => (
                  <li key={i} className="pl-3.5 relative text-sm">
                    <span className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-neutral-900 ${i === b.tarix.length - 1 ? 'bg-primary' : 'bg-gray-300 dark:bg-neutral-600'}`} aria-hidden />
                    <span className="font-medium text-gray-900 dark:text-gray-100">{holatNomi(t.holati, b.yetkazish)}</span>
                    <span className="ml-2 text-xs text-gray-500 tabular-nums">{formatSanaVaVaqt(t.sana)}</span>
                    {(t.izoh || (t.kim && t.kim !== 'tizim')) && (
                      <span className="block text-xs text-gray-500">{[t.izoh, t.kim && t.kim !== 'tizim' && t.kim !== 'mijoz' ? t.kim : null].filter(Boolean).join(' · ')}</span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* ERP'dagi chek va boshqaruv */}
          <div className="flex flex-wrap gap-2 border-t border-gray-100 dark:border-neutral-800 bg-gray-50/60 dark:bg-neutral-950/30 px-4 py-3">
            {b.erp?.sotuv ? (
              <a href={`/chek/${encodeURIComponent(b.erp.sotuv.chekRaqami)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:underline">
                <Receipt size={15} aria-hidden /> Sotuv cheki: {b.erp.sotuv.chekRaqami} <ExternalLink size={12} aria-hidden />
              </a>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-1 py-2 text-xs text-gray-500">
                {b.holati === 'BAJARILGAN' ? 'ERP’da sotuv cheki topilmadi (onlayn sotuvdan oldingi buyurtma)' : 'Sotuv cheki buyurtma topshirilganda yaratiladi'}
              </span>
            )}
            {boshqaraOladi && (
              <Link href={`/onlayn-buyurtmalar?raqam=${encodeURIComponent(b.raqam)}`} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 sm:ml-auto">
                <Globe size={15} aria-hidden /> Onlayn buyurtmalarda ochish
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
