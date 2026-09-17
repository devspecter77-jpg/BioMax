'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  AlertTriangle, Check, CheckCheck, Clock, ExternalLink, Loader2, MapPin, Navigation, Package, PackagePlus,
  Pencil, Phone, Route, Trash2, Undo2, User, X,
} from 'lucide-react'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { useConfirm } from '@/components/ConfirmProvider'
import { formatSanaVaVaqt } from '@/lib/utils'
import { vaqtMatni, yangilikAniqla } from '@/lib/lokatsiya-vaqt'
import { googleXarita, googleYonalish, yandexXarita } from '@/lib/xarita-havola'
import {
  YETKAZISH_NOMI, masofaMatni, miqdorMatni, transportNomi,
  type DostavchikTafsilot, type NamunaQator, type YetkazishHolati, type YetkazishQator,
} from '@/lib/dostavchik'
import type { XaritaNuqta } from '@/components/Xarita'
import DostavchikForma from './DostavchikForma'
import NamunaBerishForma from './NamunaBerishForma'

const Xarita = dynamic(() => import('@/components/Xarita'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-gray-100 dark:bg-neutral-800" />,
})

type Tab = 'holat' | 'namuna' | 'yetkazish'

const som = (n: number | null) => (n == null ? '—' : `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} so‘m`)
const telMatni = (t: string | null) => {
  const r = String(t ?? '').replace(/\D/g, '').slice(-9)
  return r.length === 9 ? `+998 ${r.slice(0, 2)} ${r.slice(2, 5)} ${r.slice(5, 7)} ${r.slice(7)}` : (t ?? '—')
}

export const YETKAZISH_RANGI: Record<YetkazishHolati, string> = {
  TAYINLANGAN: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  YOLDA: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400',
  YETIB_KELDI: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
  TOPSHIRILDI: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
  BEKOR: 'bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-gray-400',
}

export function YetkazishBelgisi({ holat }: { holat: YetkazishHolati }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${YETKAZISH_RANGI[holat]}`}>
      {YETKAZISH_NOMI[holat]}
    </span>
  )
}

export default function DostavchikOynasi({ id, yangilanish, ruxsat, onYopish, onOzgardi }: {
  id: string
  /** Jonli belgi o'zgarganda ota komponent oshiradi — oyna ham qayta yuklanadi */
  yangilanish: number
  ruxsat: { berish: boolean; dostavchik: boolean }
  onYopish: () => void
  onOzgardi: () => void
}) {
  useBodyScrollLock(true)
  const confirm = useConfirm()
  const [t, setT] = useState<DostavchikTafsilot | null>(null)
  const [xato, setXato] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('holat')
  const [berishOchiq, setBerishOchiq] = useState(false)
  const [tahrirOchiq, setTahrirOchiq] = useState(false)
  const [faqatQolida, setFaqatQolida] = useState(true)
  const [tanlangan, setTanlangan] = useState<Set<string>>(new Set())
  const [band, setBand] = useState(false)
  const [, setSoat] = useState(0)

  const yukla = useCallback(async () => {
    try {
      const j = await fetch(`/api/namuna-tovar/dostavchiklar/${id}`, { cache: 'no-store' })
      const d = await j.json().catch(() => ({}))
      if (!j.ok) { setXato(d.xato ?? 'Ma’lumot yuklanmadi'); return }
      setXato(null)
      setT(d)
    } catch {
      setXato('Internet aloqasini tekshiring')
    }
  }, [id])

  useEffect(() => { void yukla() }, [yukla, yangilanish])

  // "3 daqiqa oldin" kabi matnlar o'zi yangilanib tursin
  useEffect(() => {
    const s = setInterval(() => setSoat(x => x + 1), 30_000)
    return () => clearInterval(s)
  }, [])

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !tahrirOchiq && !band) onYopish() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onYopish, tahrirOchiq, band])

  const nuqtalar = useMemo<XaritaNuqta[]>(() => {
    if (!t) return []
    const n: XaritaNuqta[] = []
    if (t.lokatsiya) {
      n.push({
        id: t.id, lat: t.lokatsiya.lat, lng: t.lokatsiya.lng, turi: 'xodim', nomi: t.ism,
        tavsif: t.joriy ? `${YETKAZISH_NOMI[t.joriy.holati]}: ${t.joriy.raqam}` : 'Bo‘sh',
        yangilik: yangilikAniqla(t.lokatsiya.yangilangan), vaqtMatni: vaqtMatni(t.lokatsiya.yangilangan),
      })
    }
    if (t.manzilLat != null && t.manzilLng != null) {
      n.push({
        id: `manzil-${t.id}`, lat: t.manzilLat, lng: t.manzilLng, turi: 'filial',
        nomi: `${t.ism} — manzili`, yorliq: 'Manzil', tavsif: t.manzil,
      })
    }
    if (t.joriy?.lat != null && t.joriy.lng != null) {
      n.push({
        id: `manzil-${t.joriy.raqam}`, lat: t.joriy.lat, lng: t.joriy.lng, turi: 'mijoz',
        nomi: `${t.joriy.raqam} · ${t.joriy.aloqaIsm ?? 'Mijoz'}`, yorliq: t.joriy.raqam, tavsif: t.joriy.manzilMatni,
      })
    }
    return n
  }, [t])

  async function namunaAmal(yol: 'topshirish' | 'ochirish', idlar: string[]) {
    if (idlar.length === 0) return
    if (yol === 'ochirish') {
      const ok = await confirm({
        title: 'Namunani o‘chirish',
        message: `${idlar.length} ta yozuv butunlay o‘chiriladi. Faqat xato yozilgan bo‘lsa o‘chiring — dostavchik qaytargan bo‘lsa «Topshirdi»ni bosing, shunda tarix saqlanadi.`,
        confirmText: 'O‘chirish',
        danger: true,
      })
      if (!ok) return
    }
    setBand(true)
    try {
      const j = await fetch(`/api/namuna-tovar/namunalar/${yol}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idlar }),
      })
      const d = await j.json().catch(() => ({}))
      if (!j.ok) { toast.error(d.xato ?? 'Bajarilmadi'); return }
      toast.success(yol === 'topshirish' ? `${d.soni} ta namuna qaytarib olindi` : `${d.soni} ta yozuv o‘chirildi`)
      setTanlangan(new Set())
      await yukla()
      onOzgardi()
    } catch {
      toast.error('Internet aloqasini tekshiring')
    } finally {
      setBand(false)
    }
  }

  const qolida = t?.namunalar.flatMap(b => b.tarkiblar.filter(x => x.holati === 'BERILGAN')) ?? []
  const faollar = t?.yetkazishlar.filter(y => ['TAYINLANGAN', 'YOLDA', 'YETIB_KELDI'].includes(y.holati)) ?? []
  const yakunlanganlar = t?.yetkazishlar.filter(y => !['TAYINLANGAN', 'YOLDA', 'YETIB_KELDI'].includes(y.holati)) ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget && !band) onYopish() }}>
      <div role="dialog" aria-modal="true" aria-label={t ? `Dostavchik ${t.ism}` : 'Dostavchik'}
        className="bg-white dark:bg-neutral-900 w-full sm:max-w-3xl h-[94dvh] sm:h-auto sm:max-h-[92dvh] flex flex-col rounded-t-3xl sm:rounded-3xl shadow-2xl">

        {/* Sarlavha */}
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-gray-100 dark:border-neutral-800">
          {t ? (
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t.ism}</h2>
                {!t.faol && <span className="rounded-full bg-gray-100 dark:bg-neutral-800 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:text-gray-400">Faol emas</span>}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {transportNomi(t.transportTuri)}
                {t.transportNomi && ` · ${t.transportNomi}`}
                {t.davlatRaqami && <> · <span className="font-mono">{t.davlatRaqami}</span></>}
                <span className="text-gray-400"> · login: {t.login}</span>
              </p>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                {[t.telefon, ...t.qoshimchaTelefonlar].filter(Boolean).map(tel => (
                  <a key={tel} href={`tel:+998${String(tel).replace(/\D/g, '').slice(-9)}`}
                    className="inline-flex items-center gap-1 text-sm font-mono font-semibold text-primary hover:underline">
                    <Phone size={13} />{telMatni(tel)}
                  </a>
                ))}
              </div>
            </div>
          ) : <div className="h-14" />}
          <div className="flex items-center gap-1 shrink-0">
            {t && ruxsat.dostavchik && (
              <button onClick={() => setTahrirOchiq(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800">
                <Pencil size={14} /> <span className="hidden sm:inline">Tahrirlash</span>
              </button>
            )}
            <button onClick={onYopish} aria-label="Yopish" className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-neutral-800"><X size={20} /></button>
          </div>
        </div>

        {/* Tablar */}
        {t && (
          <div className="flex gap-1 px-5 pt-3 overflow-x-auto" role="tablist">
            {([
              ['holat', 'Joylashuv va holat', null],
              ['namuna', 'Namunalar', qolida.length],
              ['yetkazish', 'Yetkazishlar', faollar.length],
            ] as [Tab, string, number | null][]).map(([k, nomi, soni]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition ${
                  tab === k ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800'
                }`}>
                {nomi}
                {!!soni && <span className={`min-w-5 px-1.5 rounded-full text-xs tabular-nums ${tab === k ? 'bg-white/20 dark:bg-black/10' : 'bg-gray-100 dark:bg-neutral-800'}`}>{soni}</span>}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5">
          {xato ? (
            <p className="py-10 text-center text-red-600">{xato}</p>
          ) : !t ? (
            <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-primary" /></div>
          ) : tab === 'holat' ? (
            <div className="space-y-4">
              {/* Xarita */}
              <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-neutral-800">
                {nuqtalar.length > 0 ? (
                  <div className="h-64 sm:h-72">
                    <Xarita nuqtalar={nuqtalar} fokus={t.lokatsiya ? t.id : null} className="h-full w-full" />
                  </div>
                ) : (
                  <div className="h-40 flex flex-col items-center justify-center gap-2 px-6 text-center bg-gray-50 dark:bg-neutral-800/30">
                    <MapPin size={24} className="text-gray-300 dark:text-neutral-600" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Joylashuv hali kelmagan. Dostavchik ERP’ni telefonida ochib, joylashuvga ruxsat berishi kerak.
                    </p>
                  </div>
                )}
                {t.lokatsiya && <JoylashuvQatori lok={t.lokatsiya} />}
              </div>

              {(t.manzil || t.manzilLat != null) && (
                <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 p-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Manzili</p>
                  <p className="flex items-start gap-2 text-sm text-gray-900 dark:text-gray-100">
                    <MapPin size={15} className="mt-0.5 shrink-0 text-gray-400" />
                    <span>{t.manzil ?? 'Matn yozilmagan — faqat xaritadagi nuqta'}</span>
                  </p>
                  {t.manzilLat != null && t.manzilLng != null && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <XaritaHavola href={googleXarita(t.manzilLat, t.manzilLng)}>Google</XaritaHavola>
                      <XaritaHavola href={yandexXarita(t.manzilLat, t.manzilLng)}>Yandex</XaritaHavola>
                      <XaritaHavola href={googleYonalish(t.manzilLat, t.manzilLng)}><Navigation size={13} /> Yo‘nalish</XaritaHavola>
                    </div>
                  )}
                </div>
              )}

              {/* Joriy yetkazish */}
              {t.joriy ? <JoriyKarta y={t.joriy} /> : (
                <div className="rounded-2xl border border-dashed border-gray-300 dark:border-neutral-700 p-4 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <Route size={16} className="shrink-0" /> Hozir biriktirilgan buyurtma yo‘q — bo‘sh.
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <Korsatkich nomi="Bugun topshirdi" qiymat={t.bugunTopshirgan} />
                <Korsatkich nomi="Jami topshirgan" qiymat={t.jamiTopshirgan} />
                <Korsatkich nomi="Qo‘lida namuna" qiymat={t.qolganNamuna} />
              </div>

              {faollar.length > 1 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Navbatdagi buyurtmalar</p>
                  <YetkazishRoyxati qatorlar={faollar.filter(y => y.raqam !== t.joriy?.raqam)} />
                </div>
              )}
            </div>
          ) : tab === 'namuna' ? (
            <div className="space-y-4">
              {ruxsat.berish && (berishOchiq ? (
                <NamunaBerishForma
                  dostavchikId={t.id}
                  dostavchikIsmi={t.ism}
                  onBekor={() => setBerishOchiq(false)}
                  onBerildi={() => { setBerishOchiq(false); setFaqatQolida(true); void yukla(); onOzgardi() }}
                />
              ) : (
                <button onClick={() => setBerishOchiq(true)} disabled={!t.faol}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-gray-300 dark:border-neutral-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:border-primary hover:text-primary transition disabled:opacity-50">
                  <PackagePlus size={17} /> {t.faol ? 'Namuna berish' : 'Faol emas — namuna berib bo‘lmaydi'}
                </button>
              ))}

              <div className="flex items-center gap-1.5">
                {[true, false].map(q => (
                  <button key={String(q)} onClick={() => setFaqatQolida(q)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium ${faqatQolida === q ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300'}`}>
                    {q ? `Qo‘lida (${qolida.length})` : 'Hammasi'}
                  </button>
                ))}
              </div>

              <NamunaRoyxati
                t={t}
                faqatQolida={faqatQolida}
                boshqarish={ruxsat.berish}
                tanlangan={tanlangan}
                setTanlangan={setTanlangan}
                band={band}
                onAmal={namunaAmal}
              />
            </div>
          ) : (
            <div className="space-y-4">
              {faollar.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Hozirgi</p>
                  <YetkazishRoyxati qatorlar={faollar} />
                </div>
              )}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Yakunlangan (oxirgi 100 ta)</p>
                {yakunlanganlar.length ? <YetkazishRoyxati qatorlar={yakunlanganlar} /> : (
                  <p className="text-sm text-gray-500">Hali yetkazilgan buyurtma yo‘q.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {tahrirOchiq && t && (
        <DostavchikForma
          tahrir={t}
          onYopish={() => setTahrirOchiq(false)}
          onSaqlandi={() => { setTahrirOchiq(false); void yukla(); onOzgardi() }}
        />
      )}
    </div>
  )
}

// ─── Qismlar ─────────────────────────────────────────────────────────────────

function JoylashuvQatori({ lok }: { lok: { lat: number; lng: number; yangilangan: string } }) {
  const yangilik = yangilikAniqla(lok.yangilangan)
  const rang = yangilik === 'jonli' ? 'bg-emerald-500' : yangilik === 'yaqin' ? 'bg-lime-500' : 'bg-gray-400'
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-white dark:bg-neutral-900 border-t border-gray-100 dark:border-neutral-800">
      <span className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <span className="relative flex h-2.5 w-2.5">
          {yangilik === 'jonli' && <span className={`absolute inline-flex h-full w-full rounded-full ${rang} opacity-60 animate-ping motion-reduce:animate-none`} />}
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${rang}`} />
        </span>
        {yangilik === 'jonli' ? 'Jonli' : yangilik === 'yaqin' ? 'Yaqinda ko‘ringan' : 'Eskirgan'} · {vaqtMatni(lok.yangilangan)}
      </span>
      <span className="flex flex-wrap gap-1.5">
        <XaritaHavola href={googleXarita(lok.lat, lok.lng)}>Google</XaritaHavola>
        <XaritaHavola href={yandexXarita(lok.lat, lok.lng)}>Yandex</XaritaHavola>
        <XaritaHavola href={googleYonalish(lok.lat, lok.lng)}><Navigation size={13} /> Yo‘nalish</XaritaHavola>
      </span>
    </div>
  )
}

function XaritaHavola({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800">
      {children} <ExternalLink size={11} className="text-gray-400" />
    </a>
  )
}

function JoriyKarta({ y }: { y: YetkazishQator }) {
  const sarlavha = y.holati === 'YETIB_KELDI' ? 'Hozir mijoz manzilida' : y.holati === 'YOLDA' ? 'Hozir shu buyurtmaga ketyapti' : 'Navbatdagi buyurtma'
  const masofa = masofaMatni(y.masofaM)
  return (
    <div className={`rounded-2xl border p-4 ${y.holati === 'YETIB_KELDI' ? 'border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/10' : y.holati === 'YOLDA' ? 'border-violet-200 dark:border-violet-900/50 bg-violet-50/50 dark:bg-violet-950/10' : 'border-gray-200 dark:border-neutral-800'}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{sarlavha}</p>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-gray-900 dark:text-gray-100">{y.raqam}</span>
            <YetkazishBelgisi holat={y.holati} />
          </div>
        </div>
        <Link href={`/onlayn-buyurtmalar?raqam=${encodeURIComponent(y.raqam)}`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
          Buyurtmani ochish <ExternalLink size={13} />
        </Link>
      </div>
      <div className="mt-3 grid sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm text-gray-700 dark:text-gray-300">
        <span className="flex items-center gap-1.5 min-w-0"><User size={14} className="text-gray-400 shrink-0" /><span className="truncate">{y.aloqaIsm ?? '—'}</span></span>
        {y.aloqaTel && (
          <a href={`tel:+998${y.aloqaTel.replace(/\D/g, '').slice(-9)}`} className="flex items-center gap-1.5 font-mono text-primary"><Phone size={14} className="shrink-0" />{telMatni(y.aloqaTel)}</a>
        )}
        <span className="flex items-start gap-1.5 min-w-0 sm:col-span-2"><MapPin size={14} className="text-gray-400 shrink-0 mt-0.5" /><span>{y.manzilMatni ?? '—'}{masofa && <b className="ml-1.5 text-gray-900 dark:text-gray-100">· {masofa} qoldi</b>}</span></span>
        <span className="flex items-center gap-1.5 text-gray-500 sm:col-span-2 flex-wrap">
          <Clock size={14} className="shrink-0" />
          Biriktirildi {formatSanaVaVaqt(y.tayinlangan)}
          {y.yolgaChiqdi && <> · yo‘lga chiqdi {formatSanaVaVaqt(y.yolgaChiqdi)}</>}
          {y.yetibKeldi && <> · yetib keldi {formatSanaVaVaqt(y.yetibKeldi)}</>}
        </span>
      </div>
      {y.lat != null && y.lng != null && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <XaritaHavola href={googleYonalish(y.lat, y.lng)}><Navigation size={13} /> Manzilga yo‘nalish</XaritaHavola>
          <XaritaHavola href={yandexXarita(y.lat, y.lng)}>Yandex xarita</XaritaHavola>
        </div>
      )}
      {y.jamiSumma != null && <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Mijozdan olinadi: <b className="text-gray-900 dark:text-gray-100 tabular-nums">{som(y.jamiSumma)}</b></p>}
    </div>
  )
}

function Korsatkich({ nomi, qiymat }: { nomi: string; qiymat: number }) {
  return (
    <div className="rounded-2xl bg-gray-50 dark:bg-neutral-800/40 px-3 py-2.5">
      <p className="text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{qiymat}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">{nomi}</p>
    </div>
  )
}

function YetkazishRoyxati({ qatorlar }: { qatorlar: YetkazishQator[] }) {
  return (
    <ul className="divide-y divide-gray-100 dark:divide-neutral-800 rounded-2xl border border-gray-200 dark:border-neutral-800">
      {qatorlar.map(y => (
        <li key={y.raqam}>
          <Link href={`/onlayn-buyurtmalar?raqam=${encodeURIComponent(y.raqam)}`}
            className="flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-gray-50 dark:hover:bg-neutral-800/40">
            <span className="min-w-0">
              <span className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">{y.raqam}</span>
                <YetkazishBelgisi holat={y.holati} />
              </span>
              <span className="block text-xs text-gray-500 truncate mt-0.5">{y.aloqaIsm ?? '—'} · {y.manzilMatni ?? 'manzil yo‘q'}</span>
            </span>
            <span className="shrink-0 text-right text-xs text-gray-500 tabular-nums">
              {y.topshirildi ? formatSanaVaVaqt(y.topshirildi) : formatSanaVaVaqt(y.tayinlangan)}
              {masofaMatni(y.masofaM) && <span className="block font-semibold text-gray-700 dark:text-gray-300">{masofaMatni(y.masofaM)}</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function NamunaRoyxati({ t, faqatQolida, boshqarish, tanlangan, setTanlangan, band, onAmal }: {
  t: DostavchikTafsilot
  faqatQolida: boolean
  boshqarish: boolean
  tanlangan: Set<string>
  setTanlangan: (s: Set<string>) => void
  band: boolean
  onAmal: (yol: 'topshirish' | 'ochirish', idlar: string[]) => void
}) {
  const guruhlar = t.namunalar
    .map(b => ({ ...b, tarkiblar: faqatQolida ? b.tarkiblar.filter(x => x.holati === 'BERILGAN') : b.tarkiblar }))
    .filter(b => b.tarkiblar.length > 0)

  if (guruhlar.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500 dark:text-gray-400">
        <Package size={30} className="mx-auto text-gray-300 dark:text-neutral-700" />
        <p className="mt-2 text-sm">{faqatQolida ? 'Dostavchikning qo‘lida namuna yo‘q' : 'Hali namuna berilmagan'}</p>
      </div>
    )
  }

  const almashtir = (id: string) => {
    const s = new Set(tanlangan)
    if (s.has(id)) s.delete(id)
    else s.add(id)
    setTanlangan(s)
  }

  return (
    <div className="space-y-3">
      {guruhlar.map(g => {
        const qolidagi = g.tarkiblar.filter(x => x.holati === 'BERILGAN')
        return (
          <div key={g.id} className="rounded-2xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-3.5 py-2 bg-gray-50 dark:bg-neutral-800/40">
              <p className="text-xs text-gray-600 dark:text-gray-400 min-w-0">
                <b className="text-gray-800 dark:text-gray-200">{formatSanaVaVaqt(g.yaratilgan)}</b> · berdi: {g.bergan}
                {g.izoh && <span className="block truncate">{g.izoh}</span>}
              </p>
              {boshqarish && qolidagi.length > 1 && (
                <button onClick={() => onAmal('topshirish', qolidagi.map(x => x.id))} disabled={band}
                  className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60">
                  <CheckCheck size={13} /> Hammasini qaytardi
                </button>
              )}
            </div>
            <ul className="divide-y divide-gray-100 dark:divide-neutral-800">
              {g.tarkiblar.map(x => (
                <NamunaQatori key={x.id} x={x} boshqarish={boshqarish} tanlanganmi={tanlangan.has(x.id)} band={band}
                  onTanla={() => almashtir(x.id)} onTopshir={() => onAmal('topshirish', [x.id])} />
              ))}
            </ul>
          </div>
        )
      })}

      {boshqarish && tanlangan.size > 0 && (
        <div className="sticky bottom-0 flex flex-wrap items-center gap-2 rounded-2xl bg-gray-900 dark:bg-neutral-800 text-white px-4 py-3 shadow-lg">
          <span className="text-sm font-medium mr-auto">{tanlangan.size} ta tanlandi</span>
          <button onClick={() => onAmal('ochirish', [...tanlangan])} disabled={band}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-red-300 hover:bg-white/10 disabled:opacity-60">
            <Trash2 size={14} /> Xato yozilgan — o‘chirish
          </button>
          <button onClick={() => onAmal('topshirish', [...tanlangan])} disabled={band}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60">
            {band ? <Loader2 size={14} className="animate-spin" /> : <Undo2 size={14} />} Topshirdi
          </button>
        </div>
      )}

      {!boshqarish && (
        <p className="flex items-center gap-1.5 text-xs text-gray-500"><AlertTriangle size={13} /> Namunani qaytarib olish uchun «Namuna berish» ruxsati kerak.</p>
      )}
    </div>
  )
}

function NamunaQatori({ x, boshqarish, tanlanganmi, band, onTanla, onTopshir }: {
  x: NamunaQator
  boshqarish: boolean
  tanlanganmi: boolean
  band: boolean
  onTanla: () => void
  onTopshir: () => void
}) {
  const qolida = x.holati === 'BERILGAN'
  return (
    <li className={`flex items-center gap-3 px-3.5 py-2.5 ${tanlanganmi ? 'bg-emerald-50/60 dark:bg-emerald-950/10' : ''}`}>
      {boshqarish && qolida ? (
        <input type="checkbox" checked={tanlanganmi} onChange={onTanla} aria-label={`${x.nomi} — tanlash`}
          className="h-4 w-4 shrink-0 accent-emerald-600" />
      ) : (
        <span className={`h-4 w-4 shrink-0 rounded-full flex items-center justify-center ${qolida ? 'bg-amber-100 dark:bg-amber-950/40' : 'bg-emerald-100 dark:bg-emerald-950/40'}`}>
          {!qolida && <Check size={11} className="text-emerald-600" />}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className={`text-sm truncate ${qolida ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 line-through decoration-gray-300'}`}>{x.nomi}</p>
        <p className="text-xs text-gray-500">
          {miqdorMatni(x.miqdor, x.birlik)}
          {!x.tovarId && ' · qo‘lda yozilgan'}
          {x.topshirilganVaqt && <> · qaytardi {formatSanaVaVaqt(x.topshirilganVaqt)}{x.qabulQilgan && `, qabul qildi: ${x.qabulQilgan}`}</>}
        </p>
      </div>
      {qolida ? (
        boshqarish ? (
          <button onClick={onTopshir} disabled={band}
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 disabled:opacity-60">
            <Undo2 size={12} /> Topshirdi
          </button>
        ) : <span className="shrink-0 rounded-full bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">Qo‘lida</span>
      ) : <span className="shrink-0 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">Qaytarildi</span>}
    </li>
  )
}
