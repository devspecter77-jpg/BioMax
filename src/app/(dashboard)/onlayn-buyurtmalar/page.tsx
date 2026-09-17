'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import {
  AlertTriangle, Banknote, Bike, Info, Receipt, Lock, CreditCard, Globe, Loader2, MessageSquare,
  Phone, RefreshCw, Search, Settings, Store, User, X, Clock, Package, Truck, MapPinCheck, Navigation, CheckCircle2,
} from 'lucide-react'
import { formatSanaVaVaqt } from '@/lib/utils'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { useRuxsat } from '@/hooks/useRuxsat'
import { useJonli, type JonliJavob } from '@/hooks/useJonli'
import { transportNomi, type TransportTuri } from '@/lib/dostavchik'
import { YetkazishBelgisi } from '@/components/dostavchik/DostavchikOynasi'
import { ManzilTugma } from '@/components/ManzilXarita'
import { googleYonalish, manzilKorinishi, manzilQidiruvMatni, yandexNavigator } from '@/lib/xarita-havola'
import {
  FAOL_HOLATLAR, HOLAT_RANGI, amalNomi, holatNomi, tolovNomi,
  type OnlaynBuyurtma, type OnlaynHolat, type OnlaynRoyxat,
} from '@/lib/onlayn-buyurtma'

// Onlayn do'kon buyurtmalari — qabul qilish va yetkazishgacha kuzatish.
//
// Jonli: qisqa belgi 3 soniyada so'raladi. Saytda yangi buyurtma tushsa yoki
// biror buyurtma holati (yoki dostavchigi) o'zgarsa, ro'yxat va ochiq oyna
// sahifani yangilamasdan yangilanadi; yangi buyurtmada ovozli signal chiqadi.
//
// Dostavchik (rol DOSTAVCHIK) shu sahifada faqat o'ziga biriktirilganlarini
// ko'radi va "Yo'lga chiqdim / Yetib keldim / Topshirdim" tugmalarini bosadi.

type Tab = 'FAOL' | OnlaynHolat
const TABLAR: { kalit: Tab; nomi: string }[] = [
  { kalit: 'FAOL', nomi: 'Faol' },
  { kalit: 'YANGI', nomi: 'Yangi' },
  { kalit: 'TASDIQLANGAN', nomi: 'Tasdiqlangan' },
  { kalit: 'YIGILMOQDA', nomi: 'Yig‘ilmoqda' },
  { kalit: 'YOLDA', nomi: 'Yo‘lda / tayyor' },
  { kalit: 'BAJARILGAN', nomi: 'Bajarilgan' },
  { kalit: 'BEKOR', nomi: 'Bekor' },
]
const JONLI_MS = 3_000

interface OnlaynBelgi extends JonliJavob {
  yangiSoni: number | null
  oxirgi: { raqam: string; yaratilgan: string } | null
  faolYetkazish: number
}

/** Qisqa ikki tonli signal — fayl yuklamasdan (brauzer ruxsat bermasa jim o'tadi). */
function signalBer() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    ;[880, 1175].forEach((chastota, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      const boshi = ctx.currentTime + i * 0.18
      o.type = 'sine'
      o.frequency.value = chastota
      g.gain.setValueAtTime(0.0001, boshi)
      g.gain.exponentialRampToValueAtTime(0.18, boshi + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, boshi + 0.3)
      o.connect(g).connect(ctx.destination)
      o.start(boshi)
      o.stop(boshi + 0.32)
    })
    setTimeout(() => void ctx.close(), 900)
  } catch {
    // Ovoz ixtiyoriy
  }
}

const som = (n: number) => `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} so'm`
const telMatni = (t: string) => {
  const r = t.replace(/\D/g, '').slice(-9)
  return r.length === 9 ? `+998 ${r.slice(0, 2)} ${r.slice(2, 5)} ${r.slice(5, 7)} ${r.slice(7)}` : t
}

function HolatBelgisi({ b }: { b: Pick<OnlaynBuyurtma, 'holati' | 'yetkazish'> }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${HOLAT_RANGI[b.holati]}`}>
      {holatNomi(b.holati, b.yetkazish)}
    </span>
  )
}

export default function OnlaynBuyurtmalarPage() {
  const { data: session } = useSession()
  const admin = (session?.user as { rol?: string } | undefined)?.rol === 'ADMIN'

  const [tab, setTab] = useState<Tab>('FAOL')
  const [qidiruv, setQidiruv] = useState('')
  const [royxat, setRoyxat] = useState<OnlaynRoyxat | null>(null)
  const [yuklanmoqda, setYuklanmoqda] = useState(true)
  const [xato, setXato] = useState<string | null>(null)
  const [tanlangan, setTanlangan] = useState<string | null>(null)
  const [sozlamaOchiq, setSozlamaOchiq] = useState(false)
  const [yangilanish, setYangilanish] = useState(0)

  // `?raqam=MP-...` — boshqa sahifadan (masalan Mijozlar › Onlayn) to'g'ridan-to'g'ri buyurtmani ochish
  useEffect(() => {
    const raqam = new URLSearchParams(window.location.search).get('raqam')
    if (raqam && /^MP-\d{4}-\d{5,}$/.test(raqam)) setTanlangan(raqam)
  }, [])

  const yukla = useCallback(async (jim = false) => {
    if (!jim) setYuklanmoqda(true)
    try {
      const p = new URLSearchParams({ holat: tab })
      if (qidiruv.trim()) p.set('q', qidiruv.trim())
      const j = await fetch(`/api/onlayn-buyurtmalar?${p}`, { cache: 'no-store' })
      const d = await j.json().catch(() => ({}))
      if (!j.ok) {
        setXato(d.xato ?? 'Buyurtmalar yuklanmadi')
        return
      }
      setXato(null)
      setRoyxat(d as OnlaynRoyxat)
    } catch {
      setXato('Internet aloqasini tekshiring')
    } finally {
      setYuklanmoqda(false)
    }
  }, [tab, qidiruv])

  useEffect(() => {
    const t = setTimeout(() => { void yukla() }, qidiruv ? 350 : 0)
    return () => clearTimeout(t)
  }, [yukla, qidiruv])

  // Jonli: belgi o'zgarsa ro'yxat va ochiq oyna jim yangilanadi
  useJonli<OnlaynBelgi>('/api/onlayn-buyurtmalar/belgi', (yangi, oldingi) => {
    void yukla(true)
    setYangilanish(x => x + 1)
    if (yangi.oxirgi && yangi.oxirgi.raqam !== oldingi.oxirgi?.raqam) {
      signalBer()
      const raqam = yangi.oxirgi.raqam
      toast.info(`Yangi onlayn buyurtma: ${raqam}`, {
        action: { label: 'Ochish', onClick: () => setTanlangan(raqam) },
        duration: 10_000,
      })
    } else if (yangi.yangiSoni === null && yangi.faolYetkazish > oldingi.faolYetkazish) {
      // Dostavchik: unga yangi buyurtma biriktirildi
      signalBer()
      toast.info('Sizga yangi buyurtma biriktirildi')
    }
  }, JONLI_MS)

  const sonlar = royxat?.sonlar ?? {}
  const faolSoni = FAOL_HOLATLAR.reduce((s, h) => s + (sonlar[h] ?? 0), 0)
  const dostavchikRejimi = royxat?.dostavchikRejimi ?? (session?.user as { rol?: string } | undefined)?.rol === 'DOSTAVCHIK'

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            {dostavchikRejimi ? <Truck size={22} className="text-primary" /> : <Globe size={22} className="text-primary" />}
            {dostavchikRejimi ? 'Mening buyurtmalarim' : 'Onlayn buyurtmalar'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5 flex items-center gap-1.5">
            <span className="relative inline-flex h-2 w-2 shrink-0" aria-hidden>
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60 animate-ping motion-reduce:animate-none" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            {dostavchikRejimi
              ? 'Sizga biriktirilgan buyurtmalar. Yo‘lga chiqqanda, manzilga yetganda va topshirganda tugmani bosing.'
              : 'Saytdan kelgan buyurtmalar jonli tushadi — tasdiqlang, yig‘ing va yetkazing. Mijoz har bosqichda xabar oladi.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void yukla()}
            className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 dark:border-neutral-700 rounded-xl text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition"
            aria-label="Yangilash"
          >
            <RefreshCw size={16} className={yuklanmoqda ? 'animate-spin' : ''} />
          </button>
          {admin && (
            <button
              onClick={() => setSozlamaOchiq(true)}
              className="flex items-center gap-2 px-3.5 py-2.5 border border-gray-200 dark:border-neutral-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition"
            >
              <Settings size={16} /> Sayt sozlamalari
            </button>
          )}
        </div>
      </div>

      {!dostavchikRejimi && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-900/40 bg-blue-50/60 dark:bg-blue-950/10 px-3 py-2.5 text-sm text-blue-800 dark:text-blue-300 flex gap-2">
          <Info size={17} className="shrink-0 mt-0.5" />
          <span>
            <b>Tasdiqlash</b> mahsulotni omborda band qiladi — saytda boshqa xaridor uni ololmaydi.{' '}
            <b>Topshirildi</b> bosilganda ERP’da avtomatik sotuv yoziladi: chek, ombor chiqimi, mijoz kartasi va ballar.
          </span>
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {TABLAR.map(t => {
            const soni = t.kalit === 'FAOL' ? faolSoni : (sonlar[t.kalit] ?? 0)
            const faol = tab === t.kalit
            return (
              <button
                key={t.kalit}
                onClick={() => setTab(t.kalit)}
                className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition ${
                  faol ? 'bg-primary text-white' : 'bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800'
                }`}
              >
                {t.nomi}
                {soni > 0 && (
                  <span className={`min-w-5 px-1.5 rounded-full text-xs tabular-nums ${faol ? 'bg-white/25' : t.kalit === 'YANGI' ? 'bg-red-600 text-white' : 'bg-gray-100 dark:bg-neutral-800'}`}>
                    {soni}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <label className="relative lg:ml-auto lg:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={qidiruv}
            onChange={e => setQidiruv(e.target.value)}
            placeholder="Raqam, telefon yoki ism"
            suppressHydrationWarning
            className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </label>
      </div>

      {xato ? (
        <div className="rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50/60 dark:bg-red-950/10 p-6 text-center">
          <AlertTriangle size={26} className="mx-auto text-red-500" />
          <p className="mt-2 font-medium text-red-700 dark:text-red-400">{xato}</p>
          <button onClick={() => void yukla()} className="mt-3 text-sm font-semibold text-primary">Qayta urinish</button>
        </div>
      ) : yuklanmoqda && !royxat ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-primary" /></div>
      ) : !royxat || royxat.buyurtmalar.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <Package size={32} className="mx-auto text-gray-300 dark:text-neutral-700" />
          <p className="mt-2 text-sm">{qidiruv ? 'Hech narsa topilmadi' : dostavchikRejimi ? 'Sizga hozircha buyurtma biriktirilmagan' : 'Bu bo‘limda buyurtma yo‘q'}</p>
        </div>
      ) : (
        <div className="grid gap-2.5">
          {royxat.buyurtmalar.map(b => (
            <button
              key={b.id}
              onClick={() => setTanlangan(b.raqam)}
              className={`text-left bg-white dark:bg-neutral-900 border rounded-2xl p-4 hover:border-gray-300 dark:hover:border-neutral-700 transition ${
                b.holati === 'YANGI' ? 'border-red-200 dark:border-red-900/50 ring-1 ring-red-100 dark:ring-red-950' : 'border-gray-200 dark:border-neutral-800'
              }`}
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">{b.raqam}</span>
                    <HolatBelgisi b={b} />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{formatSanaVaVaqt(b.yaratilgan)}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900 dark:text-gray-100 tabular-nums">{som(b.jamiSumma)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{b.qatorlar.length} xil mahsulot · {tolovNomi(b.tolovUsuli).split(' ')[0]}</p>
                </div>
              </div>
              <div className="mt-3 grid sm:grid-cols-3 gap-x-4 gap-y-1.5 text-sm text-gray-700 dark:text-gray-300">
                <span className="flex items-center gap-1.5 min-w-0"><User size={14} className="text-gray-400 shrink-0" /><span className="truncate">{b.aloqaIsm ?? '—'} · {telMatni(b.aloqaTel)}</span></span>
                <span className="flex items-center gap-1.5 min-w-0">
                  {b.yetkazish === 'KURYER' ? <Bike size={14} className="text-gray-400 shrink-0" /> : <Store size={14} className="text-gray-400 shrink-0" />}
                  <span className="truncate">{b.yetkazish === 'KURYER' ? [b.hudud, b.manzilMatni].filter(Boolean).join(', ') : 'Olib ketish'}</span>
                </span>
                {b.vaqtOraligi && <span className="flex items-center gap-1.5 min-w-0"><Clock size={14} className="text-gray-400 shrink-0" /><span className="truncate">{b.vaqtOraligi}</span></span>}
              </div>
              {b.dostavchik && !dostavchikRejimi && (
                <div className="mt-2.5 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 min-w-0">
                  <Truck size={14} className="text-gray-400 shrink-0" />
                  <span className="truncate">{b.dostavchik.ism}</span>
                  <YetkazishBelgisi holat={b.dostavchik.holati} />
                </div>
              )}
              {dostavchikRejimi && b.dostavchik && (
                <div className="mt-2.5"><YetkazishBelgisi holat={b.dostavchik.holati} /></div>
              )}
            </button>
          ))}
          {royxat.jami > royxat.buyurtmalar.length && (
            <p className="text-center text-xs text-gray-500 py-2">So‘nggi {royxat.buyurtmalar.length} tasi ko‘rsatilgan (jami {royxat.jami}). Qidiruvdan foydalaning.</p>
          )}
        </div>
      )}

      {tanlangan && (
        <BuyurtmaModal
          raqam={tanlangan}
          yangilanish={yangilanish}
          onYopish={() => setTanlangan(null)}
          onOzgardi={() => void yukla(true)}
        />
      )}
      {sozlamaOchiq && <SozlamaModal onYopish={() => setSozlamaOchiq(false)} />}
    </div>
  )
}

// ─── Buyurtma tafsiloti ──────────────────────────────────────────────────────

function BuyurtmaModal({ raqam, yangilanish, onYopish, onOzgardi }: { raqam: string; yangilanish: number; onYopish: () => void; onOzgardi: () => void }) {
  useBodyScrollLock(true)
  const { data: session } = useSession()
  const meId = (session?.user as { id?: string } | undefined)?.id
  const [b, setB] = useState<OnlaynBuyurtma | null>(null)
  const [xato, setXato] = useState<string | null>(null)
  const [band, setBand] = useState<OnlaynHolat | null>(null)
  const [bekorOchiq, setBekorOchiq] = useState(false)
  const [sabab, setSabab] = useState('')

  // Ochilganda va jonli belgi o'zgarganda (boshqa xodim yoki dostavchik holatni o'zgartirdi)
  useEffect(() => {
    let bekor = false
    fetch(`/api/onlayn-buyurtmalar/${encodeURIComponent(raqam)}`, { cache: 'no-store' })
      .then(async j => {
        const d = await j.json().catch(() => ({}))
        if (bekor) return
        if (!j.ok) setXato(d.xato ?? 'Buyurtma ochilmadi')
        else { setXato(null); setB(d) }
      })
      .catch(() => { if (!bekor) setXato('Internet aloqasini tekshiring') })
    return () => { bekor = true }
  }, [raqam, yangilanish])

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !band) onYopish() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onYopish, band])

  async function ozgartir(holat: OnlaynHolat) {
    if (holat === 'BEKOR' && sabab.trim().length < 3) {
      toast.error('Bekor qilish sababini yozing')
      return
    }
    setBand(holat)
    try {
      const j = await fetch(`/api/onlayn-buyurtmalar/${encodeURIComponent(raqam)}/holat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holat, sabab: holat === 'BEKOR' ? sabab.trim() : undefined }),
      })
      const d = await j.json().catch(() => ({}))
      if (!j.ok) {
        toast.error(d.xato ?? 'Holat o‘zgarmadi')
        return
      }
      // Holat javobida dostavchik yo'q — keyingi jonli yangilanish uni ham yangilaydi
      setB(x => ({ ...d, dostavchik: x?.dostavchik ?? null }))
      setBekorOchiq(false)
      toast.success(`${d.raqam}: ${holatNomi(d.holati, d.yetkazish)}${d.xabarYuboriladi ? ' — mijozga xabar yuborilmoqda' : ''}`)
      onOzgardi()
    } catch {
      toast.error('Internet aloqasini tekshiring')
    } finally {
      setBand(null)
    }
  }

  // Holatni o'zgartirish va bekor qilish — alohida ruxsatlar (server ham tekshiradi)
  const ruxsat = useRuxsat()
  const oldinga = ruxsat.bor('onlayn-buyurtmalar.boshqarish') ? b?.keyingiHolatlar?.filter(h => h !== 'BEKOR') ?? [] : []
  const bekorMumkin = ruxsat.bor('onlayn-buyurtmalar.bekor') && (b?.keyingiHolatlar?.includes('BEKOR') ?? false)
  // Buyurtma shu foydalanuvchiga biriktirilgan — dostavchik tugmalari
  const menikimi = !!meId && b?.dostavchik?.id === meId && ruxsat.bor('onlayn-buyurtmalar.yetkazish')

  async function yetibKeldim() {
    setBand('YOLDA')
    try {
      const j = await fetch(`/api/onlayn-buyurtmalar/${encodeURIComponent(raqam)}/yetkazish`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amal: 'YETIB_KELDI' }),
      })
      const d = await j.json().catch(() => ({}))
      if (!j.ok) { toast.error(d.xato ?? 'Belgilanmadi'); return }
      setB(x => x && { ...x, dostavchik: d.dostavchik })
      toast.success('Manzilga yetib kelganingiz belgilandi')
      onOzgardi()
    } catch {
      toast.error('Internet aloqasini tekshiring')
    } finally {
      setBand(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={e => { if (e.target === e.currentTarget && !band) onYopish() }}>
      <div role="dialog" aria-modal="true" aria-label={`Buyurtma ${raqam}`} className="bg-white dark:bg-neutral-900 w-full sm:max-w-2xl max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 bg-white/95 dark:bg-neutral-900/95 backdrop-blur border-b border-gray-100 dark:border-neutral-800">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-lg text-gray-900 dark:text-gray-100">{raqam}</span>
            {b && <HolatBelgisi b={b} />}
          </div>
          <button onClick={onYopish} aria-label="Yopish" className="p-2 -mr-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-neutral-800"><X size={20} /></button>
        </div>

        {xato ? (
          <p className="p-8 text-center text-red-600">{xato}</p>
        ) : !b ? (
          <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-primary" /></div>
        ) : (
          <div className="p-5 space-y-5">
            {/* Mijoz va yetkazish */}
            <div className="grid sm:grid-cols-2 gap-3">
              <Blok sarlavha="Mijoz">
                <p className="font-medium text-gray-900 dark:text-gray-100">{b.aloqaIsm ?? '—'}</p>
                <a href={`tel:${b.aloqaTel}`} className="mt-1 inline-flex items-center gap-1.5 font-mono text-primary font-semibold"><Phone size={14} />{telMatni(b.aloqaTel)}</a>
              </Blok>
              <Blok sarlavha={b.yetkazish === 'KURYER' ? 'Yetkazish' : 'Olib ketish'}>
                {b.yetkazish === 'KURYER' ? (
                  <>
                    <ManzilTugma
                      sarlavha={`${b.raqam} — yetkazish manzili`}
                      manzil={manzilKorinishi([b.hudud, b.manzilMatni])}
                      qidiruvMatni={manzilQidiruvMatni([b.manzilMatni, b.hudud])}
                      moljal={b.moljal}
                      lat={b.lat} lng={b.lng}
                      telefon={b.aloqaTel}
                      onNuqtaSaqla={ruxsat.bor('onlayn-buyurtmalar.boshqarish') ? async (lat, lng) => {
                        try {
                          const j = await fetch(`/api/onlayn-buyurtmalar/${encodeURIComponent(b.raqam)}/nuqta`, {
                            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lat, lng }),
                          })
                          const d = await j.json().catch(() => ({}))
                          if (!j.ok) { toast.error(d.xato ?? 'Nuqta saqlanmadi'); return false }
                          toast.success('Aniq nuqta saqlandi — kuryer shu joyga boradi')
                          setB(x => x && { ...x, lat: d.lat, lng: d.lng })
                          return true
                        } catch {
                          toast.error('Tarmoq xatosi')
                          return false
                        }
                      } : undefined}
                    />
                    {b.moljal && <p className="text-sm text-gray-500 mt-0.5 ml-5">Mo‘ljal: {b.moljal}</p>}
                  </>
                ) : (
                  <p className="text-gray-900 dark:text-gray-100">Mijoz do‘kondan o‘zi oladi</p>
                )}
                {b.vaqtOraligi && <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300"><Clock size={14} />{b.vaqtOraligi}</p>}
              </Blok>
            </div>

            {b.yetkazish === 'KURYER' && (
              <DostavchikBlok b={b} boshqara={ruxsat.bor('onlayn-buyurtmalar.kuryer')} onOzgardi={d => { setB(x => x && { ...x, dostavchik: d }); onOzgardi() }} />
            )}

            {b.izoh && (
              <div className="flex gap-2 rounded-xl bg-blue-50 dark:bg-blue-950/20 px-3.5 py-2.5 text-sm text-blue-800 dark:text-blue-300">
                <MessageSquare size={16} className="shrink-0 mt-0.5" /> {b.izoh}
              </div>
            )}

            {/* Mahsulotlar */}
            <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
              <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                {b.qatorlar.map(q => (
                  <div key={q.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="text-gray-900 dark:text-gray-100 truncate">{q.nomi}</p>
                      <p className="text-xs text-gray-500 tabular-nums">{q.miqdor} {q.birlik.toLowerCase()} × {som(q.birlikNarxi)}</p>
                    </div>
                    <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100 shrink-0">{som(q.jami)}</span>
                  </div>
                ))}
              </div>
              <div className="bg-gray-50 dark:bg-neutral-800/40 px-4 py-3 text-sm space-y-1">
                <div className="flex justify-between text-gray-600 dark:text-gray-400"><span>Mahsulotlar</span><span className="tabular-nums">{som(b.mahsulotSumma)}</span></div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400"><span>Yetkazish</span><span className="tabular-nums">{b.yetkazishNarx > 0 ? som(b.yetkazishNarx) : 'bepul'}</span></div>
                <div className="flex justify-between font-bold text-base text-gray-900 dark:text-gray-100 pt-1"><span>Jami</span><span className="tabular-nums">{som(b.jamiSumma)}</span></div>
                <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400 pt-1">
                  {b.tolovUsuli === 'KARTA_YETKAZISHDA' ? <CreditCard size={14} /> : <Banknote size={14} />} {tolovNomi(b.tolovUsuli)}
                </div>
              </div>
            </div>

            {/* ERP izi */}
            {b.erp && (b.erp.rezerv !== 'YOQ' || b.erp.sotuv) && (
              <div className="flex flex-wrap gap-2">
                {b.erp.sotuv && (
                  <a href={`/chek/${encodeURIComponent(b.erp.sotuv.chekRaqami)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:underline">
                    <Receipt size={15} /> ERP sotuvi: {b.erp.sotuv.chekRaqami}
                  </a>
                )}
                {b.erp.rezerv === 'FAOL' && (
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-sm font-medium text-blue-700 dark:text-blue-400">
                    <Lock size={15} /> Mahsulotlar omborda band qilingan
                  </span>
                )}
                {b.erp.rezerv === 'MUDDATI_OTGAN' && (
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm font-medium text-amber-700 dark:text-amber-400">
                    <AlertTriangle size={15} /> Band muddati o‘tgan — keyingi bosqichda yangilanadi
                  </span>
                )}
              </div>
            )}
            {b.holati === 'QAYTARILGAN' && (
              <p className="rounded-xl bg-amber-50 dark:bg-amber-950/20 px-3.5 py-2.5 text-sm text-amber-800 dark:text-amber-400">
                Qaytarilgan mahsulotni kassadagi <b>Qaytarish</b> bo‘limida chek bo‘yicha rasmiylashtiring — shunda ombor qoldig‘i va pul qaytadi.
              </p>
            )}

            {/* Tarix */}
            <Blok sarlavha="Tarix">
              <ol className="space-y-1.5">
                {b.tarix.map((t, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="font-medium text-gray-900 dark:text-gray-100">{holatNomi(t.holati, b.yetkazish)}</span>
                    <span className="text-xs text-gray-500">{formatSanaVaVaqt(t.sana)}{t.kim ? ` · ${t.kim}` : ''}</span>
                    {t.izoh && <span className="w-full text-xs text-gray-500">{t.izoh}</span>}
                  </li>
                ))}
              </ol>
            </Blok>

            {/* Dostavchik amallari — faqat o'ziga biriktirilgan buyurtmada */}
            {menikimi && b.dostavchik && ['TAYINLANGAN', 'YOLDA', 'YETIB_KELDI'].includes(b.dostavchik.holati) && (
              <div className="sticky bottom-0 -mx-5 -mb-5 px-5 py-4 bg-white/95 dark:bg-neutral-900/95 backdrop-blur border-t border-gray-100 dark:border-neutral-800 space-y-2">
                {b.lat != null && b.lng != null && (
                  <div className="flex gap-2">
                    <a href={googleYonalish(b.lat, b.lng)} target="_blank" rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-700 dark:text-gray-300">
                      <Navigation size={15} /> Google yo‘nalish
                    </a>
                    <a href={yandexNavigator(b.lat, b.lng)} target="_blank" rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-700 dark:text-gray-300">
                      <Navigation size={15} /> Yandex Navigator
                    </a>
                  </div>
                )}
                {b.dostavchik.holati === 'TAYINLANGAN' ? (
                  b.keyingiHolatlar?.includes('YOLDA') ? (
                    <button onClick={() => void ozgartir('YOLDA')} disabled={!!band}
                      className="w-full py-3.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-base font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                      {band === 'YOLDA' ? <Loader2 size={17} className="animate-spin" /> : <Truck size={18} />} Yo‘lga chiqdim
                    </button>
                  ) : (
                    <p className="text-sm text-center text-gray-500">Buyurtma yig‘ib bo‘lingach «Yo‘lga chiqdim» tugmasi chiqadi.</p>
                  )
                ) : (
                  <div className="flex gap-2">
                    {b.dostavchik.holati === 'YOLDA' && (
                      <button onClick={() => void yetibKeldim()} disabled={!!band}
                        className="flex-1 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                        <MapPinCheck size={17} /> Yetib keldim
                      </button>
                    )}
                    {b.keyingiHolatlar?.includes('BAJARILGAN') && (
                      <button onClick={() => void ozgartir('BAJARILGAN')} disabled={!!band}
                        className="flex-1 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                        {band === 'BAJARILGAN' ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />} Topshirdim
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Amallar */}
            {!menikimi && (oldinga.length > 0 || bekorMumkin) && (
              <div className="sticky bottom-0 -mx-5 -mb-5 px-5 py-4 bg-white/95 dark:bg-neutral-900/95 backdrop-blur border-t border-gray-100 dark:border-neutral-800 space-y-3">
                {bekorOchiq ? (
                  <div className="space-y-2">
                    <input
                      autoFocus value={sabab} onChange={e => setSabab(e.target.value)} maxLength={300}
                      placeholder="Bekor qilish sababi (mijozga ko‘rinadi)"
                      suppressHydrationWarning
                      className="w-full px-3 py-2.5 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => setBekorOchiq(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-medium">Qaytish</button>
                      <button onClick={() => void ozgartir('BEKOR')} disabled={!!band} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                        {band === 'BEKOR' && <Loader2 size={15} className="animate-spin" />} Bekor qilishni tasdiqlash
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col-reverse sm:flex-row gap-2">
                    {bekorMumkin && (
                      <button onClick={() => setBekorOchiq(true)} disabled={!!band} className="sm:w-auto px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 disabled:opacity-60">
                        Bekor qilish
                      </button>
                    )}
                    {oldinga.map(h => (
                      <button key={h} onClick={() => void ozgartir(h)} disabled={!!band} className="flex-1 px-4 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                        {band === h && <Loader2 size={15} className="animate-spin" />} {amalNomi(h, b.yetkazish)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Dostavchik ──────────────────────────────────────────────────────────────

interface DostavchikTanlov {
  id: string
  ism: string
  telefon: string | null
  transportTuri: TransportTuri | null
  transportNomi: string | null
  band: number
}

/** Buyurtmani kim olib boryapti; ruxsati borga — biriktirish, almashtirish, olib tashlash. */
function DostavchikBlok({ b, boshqara, onOzgardi }: {
  b: OnlaynBuyurtma
  boshqara: boolean
  onOzgardi: (d: OnlaynBuyurtma['dostavchik']) => void
}) {
  const [royxat, setRoyxat] = useState<DostavchikTanlov[] | null>(null)
  const [tanlash, setTanlash] = useState(false)
  const [saqlanmoqda, setSaqlanmoqda] = useState(false)
  const d = b.dostavchik
  const ozgartiraOladi = boshqara && FAOL_HOLATLAR.includes(b.holati)

  useEffect(() => {
    if (!tanlash || royxat) return
    fetch('/api/onlayn-buyurtmalar/dostavchiklar', { cache: 'no-store' })
      .then(async r => {
        const j = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(j.xato ?? 'Dostavchiklar yuklanmadi')
        setRoyxat(j)
      })
      .catch((e: Error) => { toast.error(e.message); setTanlash(false) })
  }, [tanlash, royxat])

  async function biriktir(id: string | null) {
    setSaqlanmoqda(true)
    try {
      const j = await fetch(`/api/onlayn-buyurtmalar/${encodeURIComponent(b.raqam)}/dostavchik`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dostavchikId: id }),
      })
      const x = await j.json().catch(() => ({}))
      if (!j.ok) { toast.error(x.xato ?? 'Saqlanmadi'); return }
      toast.success(id ? `${x.dostavchik?.ism ?? 'Dostavchik'} biriktirildi` : 'Dostavchik olib tashlandi')
      setTanlash(false)
      setRoyxat(null)
      onOzgardi(x.dostavchik ?? null)
    } catch {
      toast.error('Internet aloqasini tekshiring')
    } finally {
      setSaqlanmoqda(false)
    }
  }

  if (!d && !ozgartiraOladi) return null

  return (
    <Blok sarlavha="Dostavchik">
      {d ? (
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="flex items-center gap-2 flex-wrap font-medium text-gray-900 dark:text-gray-100">
              <Truck size={15} className="text-gray-400" /> {d.ism} <YetkazishBelgisi holat={d.holati} />
            </p>
            {d.telefon && (
              <a href={`tel:+998${d.telefon.replace(/\D/g, '').slice(-9)}`} className="mt-1 inline-flex items-center gap-1.5 font-mono text-sm text-primary font-semibold">
                <Phone size={13} />{telMatni(d.telefon)}
              </a>
            )}
            {(d.yolgaChiqdi || d.yetibKeldi) && (
              <p className="text-xs text-gray-500 mt-0.5">
                {d.yolgaChiqdi && <>Yo‘lga chiqdi {formatSanaVaVaqt(d.yolgaChiqdi)}</>}
                {d.yetibKeldi && <> · yetib keldi {formatSanaVaVaqt(d.yetibKeldi)}</>}
              </p>
            )}
          </div>
          {ozgartiraOladi && !tanlash && (
            <button onClick={() => setTanlash(true)} className="text-sm font-semibold text-primary hover:underline">Almashtirish</button>
          )}
        </div>
      ) : !tanlash && (
        <button onClick={() => setTanlash(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-gray-300 dark:border-neutral-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:border-primary hover:text-primary">
          <Truck size={16} /> Dostavchik biriktirish
        </button>
      )}

      {tanlash && (
        <div className="mt-2 space-y-1.5">
          {!royxat ? (
            <div className="flex justify-center py-3"><Loader2 size={18} className="animate-spin text-primary" /></div>
          ) : royxat.length === 0 ? (
            <p className="text-sm text-gray-500">Faol dostavchik yo‘q. «Namuna tovar» bo‘limida qo‘shing.</p>
          ) : (
            <ul className="max-h-60 overflow-y-auto divide-y divide-gray-100 dark:divide-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-800">
              {royxat.map(x => (
                <li key={x.id}>
                  <button onClick={() => void biriktir(x.id)} disabled={saqlanmoqda || x.id === d?.id}
                    className="w-full text-left flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-50">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{x.ism}{x.id === d?.id && ' (hozirgi)'}</span>
                      <span className="block text-xs text-gray-500 truncate">{x.transportNomi ?? transportNomi(x.transportTuri)}</span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${x.band ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'}`}>
                      {x.band ? `${x.band} ta band` : 'bo‘sh'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <button onClick={() => setTanlash(false)} disabled={saqlanmoqda} className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-medium">Qaytish</button>
            {d && (
              <button onClick={() => void biriktir(null)} disabled={saqlanmoqda}
                className="flex-1 py-2 rounded-xl border border-red-200 dark:border-red-900/50 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20">
                Olib tashlash
              </button>
            )}
          </div>
        </div>
      )}
    </Blok>
  )
}

function Blok({ sarlavha, children }: { sarlavha: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 p-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">{sarlavha}</p>
      {children}
    </div>
  )
}

// ─── Sayt sozlamalari ────────────────────────────────────────────────────────

function SozlamaModal({ onYopish }: { onYopish: () => void }) {
  useBodyScrollLock(true)
  const [q, setQ] = useState<{ telefon: string; manzil: string; ish_vaqti: string; qaytarish_shartlari: string } | null>(null)
  const [band, setBand] = useState(false)

  useEffect(() => {
    fetch('/api/onlayn-buyurtmalar/sozlama').then(r => r.json()).then(setQ).catch(() => toast.error('Sozlamalar yuklanmadi'))
  }, [])

  async function saqla() {
    if (!q) return
    setBand(true)
    try {
      const j = await fetch('/api/onlayn-buyurtmalar/sozlama', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(q) })
      const d = await j.json().catch(() => ({}))
      if (!j.ok) return toast.error(d.xato ?? 'Saqlanmadi')
      toast.success('Saqlandi — saytda 5 daqiqa ichida yangilanadi')
      onYopish()
    } finally {
      setBand(false)
    }
  }

  const inputCls = 'w-full px-3 py-2.5 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={e => { if (e.target === e.currentTarget) onYopish() }}>
      <div role="dialog" aria-modal="true" aria-label="Sayt sozlamalari" className="bg-white dark:bg-neutral-900 w-full max-w-md rounded-3xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Onlayn do‘kon aloqa ma‘lumotlari</h2>
          <button onClick={onYopish} aria-label="Yopish" className="p-2 -mr-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-neutral-800"><X size={20} /></button>
        </div>
        <p className="text-sm text-gray-500">Saytning pastki qismida va buyurtma sahifasida ko‘rinadi. Telefon va manzil chekda ham shu qiymatdan olinadi.</p>
        {!q ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" /></div>
        ) : (
          <>
            {([['telefon', 'Telefon', '+998 71 200 00 00'], ['manzil', 'Do‘kon manzili', 'Toshkent, Chilonzor 7-mavze, 12'], ['ish_vaqti', 'Ish vaqti', 'Har kuni 08:00–22:00']] as const).map(([k, nomi, ph]) => (
              <label key={k} className="block space-y-1.5">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{nomi}</span>
                <input value={q[k]} onChange={e => setQ({ ...q, [k]: e.target.value })} placeholder={ph} maxLength={200} className={inputCls} suppressHydrationWarning />
              </label>
            ))}
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Qaytarish shartlari</span>
              <textarea value={q.qaytarish_shartlari} onChange={e => setQ({ ...q, qaytarish_shartlari: e.target.value })} rows={4} maxLength={2000} className={inputCls} suppressHydrationWarning />
              <span className="block text-xs text-gray-500">Mahsulot sahifasida va «Qaytarish» sahifasida ko‘rinadi.</span>
            </label>
            <button onClick={() => void saqla()} disabled={band} className="w-full py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
              {band && <Loader2 size={16} className="animate-spin" />} Saqlash
            </button>
          </>
        )}
      </div>
    </div>
  )
}
