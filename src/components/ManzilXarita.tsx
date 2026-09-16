'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import {
  AlertTriangle, Check, Copy, Crosshair, ExternalLink, Loader2, MapPin, Navigation, Phone, Search, X,
} from 'lucide-react'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { formatPhone } from '@/lib/utils'
import {
  googleQidiruv, googleSputnik, googleXarita, googleYonalish, koordinataMatni, koordinataTogrimi,
  uzbekistondami, yandexNavigator, yandexNuqta, yandexQidiruv, yandexYonalish, yetkazishNuqtasi,
} from '@/lib/xarita-havola'

const Xarita = dynamic(() => import('@/components/Xarita'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-gray-100 dark:bg-neutral-800">
      <Loader2 size={22} className="animate-spin text-primary" />
    </div>
  ),
})

// Yetkazish manzili xaritada — onlayn mijoz manzillari va buyurtmalar uchun.
//
// Nuqta bor bo'lsa: ichki xaritada belgi, Google/Yandex'da aynan shu nuqta va
// yo'nalish. Nuqta yo'q bo'lsa (mijoz xaritada belgilamagan): manzil matni
// bo'yicha qidiruv va xodim telefonda aniqlab, havolani qo'yib yoki xaritaga
// bosib aniq nuqtani saqlaydi — kuryer aniq joyga boradi.

const TOSHKENT = { markaz: [41.3111, 69.2797] as [number, number], zoom: 11 }

export interface ManzilMalumoti {
  /** Oyna sarlavhasi: "Uy" yoki "MP-2026-00006 — yetkazish" */
  sarlavha: string
  /** Ko'rsatiladigan manzil matni */
  manzil: string
  /** Qidiruv uchun to'liq matn (shahar bilan) */
  qidiruvMatni: string
  moljal?: string | null
  lat: number | null
  lng: number | null
  /** Mijoz telefoni — nuqta yo'q bo'lsa aniqlashtirish uchun */
  telefon?: string | null
}

interface Props extends ManzilMalumoti {
  onYopish: () => void
  /** Berilsa — xodim aniq nuqtani saqlay oladi. `true` qaytsa saqlandi. */
  onNuqtaSaqla?: (lat: number, lng: number) => Promise<boolean>
}

export default function ManzilXarita({ sarlavha, manzil, qidiruvMatni, moljal, lat, lng, telefon, onYopish, onNuqtaSaqla }: Props) {
  useBodyScrollLock(true)
  const [nuqta, setNuqta] = useState<{ lat: number; lng: number } | null>(
    koordinataTogrimi(lat, lng) ? { lat: Number(lat), lng: Number(lng) } : null,
  )
  const [belgilash, setBelgilash] = useState(false)
  const [kiritma, setKiritma] = useState('')
  const [tanlangan, setTanlangan] = useState<{ lat: number; lng: number } | null>(null)
  const [band, setBand] = useState(false)

  const tahlil = useMemo(() => (kiritma.trim() ? yetkazishNuqtasi(kiritma) : null), [kiritma])
  const yangiNuqta = tanlangan ?? (tahlil && !('xato' in tahlil) ? tahlil : null)
  const korsatiladigan = belgilash ? yangiNuqta : nuqta

  async function nusxala(matn: string, xabar: string) {
    try {
      await navigator.clipboard.writeText(matn)
      toast.success(xabar)
    } catch {
      toast.error(`Nusxalab bo‘lmadi: ${matn}`)
    }
  }

  async function saqla() {
    if (!yangiNuqta || !onNuqtaSaqla) return
    setBand(true)
    try {
      if (await onNuqtaSaqla(yangiNuqta.lat, yangiNuqta.lng)) {
        setNuqta(yangiNuqta)
        setBelgilash(false)
        setKiritma('')
        setTanlangan(null)
      }
    } finally {
      setBand(false)
    }
  }

  const tugmaCls = 'flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-300 dark:border-neutral-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-primary/50 hover:text-primary transition'
  const asosiyTugmaCls = 'flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 transition'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[60] p-0 sm:p-4" onClick={onYopish}>
      <div
        role="dialog" aria-modal="true" aria-label={`${sarlavha} — xaritada`}
        onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-neutral-900 rounded-t-2xl sm:rounded-2xl shadow-xl dark:border dark:border-neutral-800 w-full max-w-2xl flex flex-col max-h-[94dvh]"
      >
        <div className="p-4 border-b border-gray-200 dark:border-neutral-800 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{sarlavha}</p>
            <h3 className="mt-0.5 text-gray-900 dark:text-gray-100 font-semibold flex items-start gap-1.5">
              <MapPin size={16} className="text-primary shrink-0 mt-0.5" aria-hidden />
              <span>{manzil || 'Manzil yozilmagan'}</span>
            </h3>
            {moljal && <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 ml-5">Mo‘ljal: {moljal}</p>}
          </div>
          <button type="button" onClick={onYopish} aria-label="Yopish" className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto">
          {/* Xarita: nuqta bor bo'lsa belgi bilan; belgilash rejimida bosib tanlanadi */}
          {(korsatiladigan || belgilash) && (
            <div className="relative h-[42vh] sm:h-80">
              <Xarita
                key={belgilash ? 'belgilash' : 'korish'}
                className="h-full w-full"
                nuqtalar={korsatiladigan ? [{ id: 'manzil', lat: korsatiladigan.lat, lng: korsatiladigan.lng, nomi: sarlavha, tavsif: manzil, turi: 'mijoz' }] : []}
                fokus={korsatiladigan ? 'manzil' : null}
                boshlangich={TOSHKENT}
                onBosildi={belgilash ? (a, b) => {
                  if (!uzbekistondami(a, b)) { toast.error('Nuqta O‘zbekiston hududida emas'); return }
                  setTanlangan({ lat: a, lng: b })
                  setKiritma('')
                } : undefined}
              />
              {belgilash && (
                <p className="pointer-events-none absolute left-1/2 top-3 z-[500] -translate-x-1/2 rounded-full bg-gray-900/85 px-3 py-1.5 text-xs font-medium text-white shadow">
                  {yangiNuqta ? 'Nuqta tanlandi — kerak bo‘lsa boshqa joyga bosing' : 'Xaritada uy joylashgan joyga bosing'}
                </p>
              )}
            </div>
          )}

          <div className="p-4 space-y-3">
            {nuqta && !belgilash ? (
              <>
                <div className="flex items-center justify-between gap-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">Aniq nuqta belgilangan</p>
                    <p className="text-sm font-medium tabular-nums text-gray-900 dark:text-gray-100 truncate">{koordinataMatni(nuqta.lat, nuqta.lng)}</p>
                  </div>
                  <button
                    type="button" onClick={() => void nusxala(`${manzil}\n${googleXarita(nuqta.lat, nuqta.lng)}`, 'Manzil va xarita havolasi nusxalandi — kuryerga yuboring')}
                    title="Kuryerga yuborish uchun nusxalash" aria-label="Manzil va havolani nusxalash"
                    className="shrink-0 p-2 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg transition"
                  >
                    <Copy size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <a href={googleXarita(nuqta.lat, nuqta.lng)} target="_blank" rel="noopener noreferrer" className={tugmaCls}>
                    <ExternalLink size={14} aria-hidden /> Google Xarita
                  </a>
                  <a href={yandexNuqta(nuqta.lat, nuqta.lng)} target="_blank" rel="noopener noreferrer" className={tugmaCls}>
                    <ExternalLink size={14} aria-hidden /> Yandex Xarita
                  </a>
                  <a href={googleYonalish(nuqta.lat, nuqta.lng)} target="_blank" rel="noopener noreferrer" className={asosiyTugmaCls}>
                    <Navigation size={14} aria-hidden /> Google yo‘nalish
                  </a>
                  <a href={yandexYonalish(nuqta.lat, nuqta.lng)} target="_blank" rel="noopener noreferrer" className={asosiyTugmaCls}>
                    <Navigation size={14} aria-hidden /> Yandex yo‘nalish
                  </a>
                  <a href={googleSputnik(nuqta.lat, nuqta.lng)} target="_blank" rel="noopener noreferrer" className={tugmaCls}>
                    <ExternalLink size={14} aria-hidden /> Google sputnik
                  </a>
                  <a href={yandexNavigator(nuqta.lat, nuqta.lng)} className={tugmaCls} title="Telefonda Yandex Navigator ilovasi o‘rnatilgan bo‘lsa ochiladi">
                    <Navigation size={14} aria-hidden /> Yandex Navigator
                  </a>
                </div>
              </>
            ) : !belgilash && (
              <>
                <div className="flex gap-2.5 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-950/15 px-3 py-2.5 text-sm text-amber-900 dark:text-amber-300">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
                  <p>
                    Mijoz xaritada aniq nuqta belgilamagan. Quyidagi tugmalar <b>manzil matni bo‘yicha</b> qidiradi —
                    natija taxminiy. Yetkazishdan oldin mijoz bilan aniqlashtiring va nuqtani saqlang.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <a href={googleQidiruv(qidiruvMatni)} target="_blank" rel="noopener noreferrer" className={tugmaCls}>
                    <Search size={14} aria-hidden /> Google’da qidirish
                  </a>
                  <a href={yandexQidiruv(qidiruvMatni)} target="_blank" rel="noopener noreferrer" className={tugmaCls}>
                    <Search size={14} aria-hidden /> Yandex’da qidirish
                  </a>
                  {telefon && (
                    <a href={`tel:${telefon.replace(/\s/g, '')}`} className={tugmaCls}>
                      <Phone size={14} aria-hidden /> {formatPhone(telefon)}
                    </a>
                  )}
                  <button type="button" onClick={() => void nusxala(qidiruvMatni, 'Manzil nusxalandi')} className={tugmaCls}>
                    <Copy size={14} aria-hidden /> Manzilni nusxalash
                  </button>
                </div>
              </>
            )}

            {/* Aniq nuqtani kiritish / o'zgartirish */}
            {onNuqtaSaqla && !belgilash && (
              <button type="button" onClick={() => { setBelgilash(true); setTanlangan(null); setKiritma('') }} className={`w-full ${nuqta ? tugmaCls : asosiyTugmaCls}`}>
                <Crosshair size={15} aria-hidden /> {nuqta ? 'Nuqtani o‘zgartirish' : 'Aniq nuqtani belgilash'}
              </button>
            )}

            {belgilash && (
              <div className="space-y-2.5">
                <label className="block">
                  <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mijoz yuborgan havola yoki koordinata</span>
                  <input
                    id="manzil-nuqta-kiritma"
                    value={kiritma}
                    onChange={e => { setKiritma(e.target.value); setTanlangan(null) }}
                    placeholder="Google/Yandex havolasi yoki 41.311081, 69.279737"
                    className="w-full px-3 py-2.5 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                    Mijoz Telegramda «Joylashuv» yuborsa — uni Google Xaritada ochib havolasini shu yerga qo‘ying. Yoki xaritaning o‘zida bosing.
                  </span>
                </label>
                {tahlil && 'xato' in tahlil && <p className="text-sm text-red-600">{tahlil.xato}</p>}
                {kiritma.trim() && !tahlil && <p className="text-sm text-red-600">Havoladan koordinata topilmadi — to‘liq havolani yoki «41.31, 69.27» ko‘rinishini qo‘ying</p>}
                {yangiNuqta && <p className="text-sm text-emerald-700 dark:text-emerald-400 tabular-nums">Tanlangan nuqta: {koordinataMatni(yangiNuqta.lat, yangiNuqta.lng)}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setBelgilash(false); setKiritma(''); setTanlangan(null) }} className={`flex-1 ${tugmaCls}`}>Bekor</button>
                  <button type="button" onClick={() => void saqla()} disabled={!yangiNuqta || band} className={`flex-1 ${asosiyTugmaCls} disabled:opacity-50`}>
                    {band ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Nuqtani saqlash
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Bosiladigan manzil — matn va "xaritada" belgisi. Bosilganda `ManzilXarita` ochiladi.
 */
export function ManzilTugma({ className, children, onNuqtaSaqla, ...m }: ManzilMalumoti & {
  className?: string
  children?: React.ReactNode
  onNuqtaSaqla?: (lat: number, lng: number) => Promise<boolean>
}) {
  const [ochiq, setOchiq] = useState(false)
  const bor = koordinataTogrimi(m.lat, m.lng)
  return (
    <>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setOchiq(true) }}
        title={bor ? 'Xaritada aniq joyini ko‘rish' : 'Xaritada qidirish va aniq nuqtani belgilash'}
        className={className ?? 'group inline-flex items-start gap-1.5 text-left text-gray-800 dark:text-gray-200 hover:text-primary transition'}
      >
        <MapPin size={14} className={`mt-0.5 shrink-0 ${bor ? 'text-emerald-600' : 'text-gray-400 group-hover:text-primary'}`} aria-hidden />
        <span className="min-w-0">
          {children ?? m.manzil}
          <span className={`ml-1.5 inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold align-middle ${bor ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-gray-400'}`}>
            {bor ? 'xaritada' : 'nuqta yo‘q'}
          </span>
        </span>
      </button>
      {ochiq && <ManzilXarita {...m} onNuqtaSaqla={onNuqtaSaqla} onYopish={() => setOchiq(false)} />}
    </>
  )
}
