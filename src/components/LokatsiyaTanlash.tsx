'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import {
  MapPin, LocateFixed, Loader2, X, Crosshair, Check, Link2,
} from 'lucide-react'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import {
  koordinataMatni, koordinataTogrimi, matndanKoordinata, googleSputnik,
} from '@/lib/xarita-havola'

const Xarita = dynamic(() => import('@/components/Xarita'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-gray-100 dark:bg-neutral-800">
      <Loader2 size={22} className="animate-spin text-primary" />
    </div>
  ),
})

// Joylashuvni belgilash — UCH usul bilan.
//
// Mijoz formasida faqat "joriy GPS" bor edi va u shu holat uchun to'g'ri:
// kassir mijoz oldiga borib bosadi. Ammo TA'MINOTCHI uchun bu ishlamaydi —
// uning omborida turib ro'yxatga olmaysiz. Shuning uchun:
//   1. Joriy GPS        — o'sha joyda turgan bo'lsangiz
//   2. Xaritadan bosish — joyni ko'z bilan topib belgilash
//   3. Havola/koordinata — Google yoki Yandexdan ulashilgan joyni qo'yish
// Uchinchisi amalda eng ko'p ishlatiladi: ta'minotchi o'z joyini
// messenjerda havola qilib yuboradi.

interface Props {
  lat: number | null
  lng: number | null
  onChange: (lat: number | null, lng: number | null) => void
  /** Xaritada ko'rsatiladigan nom. */
  nomi?: string
  turi?: 'mijoz' | 'taminotchi' | 'xodim' | 'filial'
}

export default function LokatsiyaTanlash({
  lat, lng, onChange, nomi = 'Yangi joy', turi = 'taminotchi',
}: Props) {
  const [xaritaOchiq, setXaritaOchiq] = useState(false)
  const [gpsOlinmoqda, setGpsOlinmoqda] = useState(false)
  const [havola, setHavola] = useState('')
  const [havolaOchiq, setHavolaOchiq] = useState(false)
  // Oynada tanlangan, lekin hali tasdiqlanmagan nuqta
  const [vaqtinchalik, setVaqtinchalik] = useState<{ lat: number; lng: number } | null>(null)

  useBodyScrollLock(xaritaOchiq)

  const bor = koordinataTogrimi(lat, lng)

  /**
   * Oynani ochish. Boshlang'ich nuqta SHU YERDA o'rnatiladi, effektda emas:
   * effekt ichida sinxron `setState` chaqirish ortiqcha render zanjirini
   * keltirib chiqaradi va React buni taqiqlaydi. Ochilish — hodisa,
   * shuning uchun holat hodisa ishlovchisida tayyorlanadi.
   */
  function xaritaOch() {
    setVaqtinchalik(bor ? { lat: lat!, lng: lng! } : null)
    setXaritaOchiq(true)
  }

  function gpsOl() {
    if (!navigator.geolocation) {
      toast.error("Bu qurilma/brauzer GPS joylashuvni qo'llab-quvvatlamaydi")
      return
    }
    // Geolocation faqat xavfsiz kontekstda (https:// yoki localhost) ishlaydi.
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      toast.error('GPS faqat xavfsiz (https://) sahifada ishlaydi')
      return
    }
    setGpsOlinmoqda(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        onChange(pos.coords.latitude, pos.coords.longitude)
        toast.success('Joylashuv aniqlandi')
        setGpsOlinmoqda(false)
      },
      err => {
        const xabar = err.code === err.PERMISSION_DENIED
          ? 'Joylashuvga ruxsat berilmadi — brauzer sozlamalaridan ruxsat bering'
          : err.code === err.TIMEOUT
          ? "GPS signal topilmadi — ochiq joyda qayta urinib ko'ring"
          : "Joylashuvni aniqlab bo'lmadi"
        toast.error(xabar)
        setGpsOlinmoqda(false)
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    )
  }

  function havoladanOl() {
    const n = matndanKoordinata(havola)
    if (!n) {
      toast.error('Havoladan koordinata topilmadi — Google Xaritadan nusxa oling')
      return
    }
    onChange(n.lat, n.lng)
    setHavola('')
    setHavolaOchiq(false)
    toast.success('Joylashuv o‘rnatildi')
  }

  const tugmaCls =
    'flex items-center justify-center gap-1.5 px-3 py-2.5 border border-dashed border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400 rounded-xl hover:border-primary hover:text-primary transition disabled:opacity-60 text-sm'

  return (
    <div className="space-y-2">
      {bor ? (
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/40 rounded-xl">
          <a
            href={googleSputnik(lat!, lng!)}
            target="_blank" rel="noopener noreferrer"
            className="text-green-700 dark:text-green-500 text-sm font-medium flex items-center gap-1.5 hover:underline min-w-0"
          >
            <MapPin size={14} className="shrink-0" />
            <span className="truncate tabular-nums">{koordinataMatni(lat!, lng!)}</span>
          </a>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button" onClick={xaritaOch}
              title="Xaritadan o'zgartirish"
              className="p-1.5 text-gray-400 hover:text-primary rounded-lg transition"
            >
              <Crosshair size={14} />
            </button>
            <button
              type="button" onClick={() => onChange(null, null)}
              title="Joylashuvni olib tashlash"
              className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg transition"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={gpsOl} disabled={gpsOlinmoqda} className={tugmaCls}>
            {gpsOlinmoqda ? <Loader2 size={15} className="animate-spin" /> : <LocateFixed size={15} />}
            {gpsOlinmoqda ? 'Aniqlanmoqda...' : 'Joriy GPS'}
          </button>
          <button type="button" onClick={xaritaOch} className={tugmaCls}>
            <Crosshair size={15} /> Xaritadan
          </button>
        </div>
      )}

      {!havolaOchiq ? (
        <button
          type="button"
          onClick={() => setHavolaOchiq(true)}
          className="text-[11px] text-gray-500 dark:text-gray-400 hover:text-primary flex items-center gap-1.5 transition"
        >
          <Link2 size={12} /> Google/Yandex havolasidan qo&apos;yish
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <input
            suppressHydrationWarning
            value={havola}
            onChange={e => setHavola(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); havoladanOl() } }}
            autoFocus
            placeholder="Havola yoki 41.311081, 69.279737"
            aria-label="Xarita havolasi yoki koordinata"
            className="flex-1 min-w-0 px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <button
            type="button" onClick={havoladanOl}
            className="shrink-0 px-3 py-2 rounded-xl bg-primary text-white text-sm font-medium"
          >
            Qo&apos;yish
          </button>
          <button
            type="button" onClick={() => { setHavolaOchiq(false); setHavola('') }}
            aria-label="Bekor qilish"
            className="shrink-0 p-2 text-gray-400 hover:text-gray-600 rounded-lg"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Xaritadan tanlash oynasi */}
      {xaritaOchiq && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[70] p-0 sm:p-4"
          onClick={() => setXaritaOchiq(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-neutral-900 rounded-t-2xl sm:rounded-2xl shadow-xl dark:border dark:border-neutral-800 w-full max-w-2xl flex flex-col max-h-[92vh]"
          >
            <div className="p-4 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h3 className="text-gray-900 dark:text-gray-100 font-semibold">Xaritadan belgilash</h3>
                <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
                  Kerakli joyni bosing. Ko&apos;rinishni o&apos;ng yuqoridan almashtirasiz.
                </p>
              </div>
              <button
                type="button" onClick={() => setXaritaOchiq(false)}
                aria-label="Yopish"
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            <div className="h-[50vh] sm:h-96 shrink-0">
              <Xarita
                className="h-full w-full"
                nuqtalar={vaqtinchalik
                  ? [{ id: 'tanlangan', lat: vaqtinchalik.lat, lng: vaqtinchalik.lng, nomi, turi }]
                  : []}
                fokus={vaqtinchalik ? 'tanlangan' : null}
                onBosildi={(a, b) => setVaqtinchalik({ lat: a, lng: b })}
              />
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-neutral-800 flex items-center gap-3 shrink-0 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">
              <span className="text-sm text-gray-600 dark:text-gray-400 tabular-nums min-w-0 truncate flex-1">
                {vaqtinchalik
                  ? koordinataMatni(vaqtinchalik.lat, vaqtinchalik.lng)
                  : 'Joy tanlanmadi'}
              </span>
              <button
                type="button"
                disabled={!vaqtinchalik}
                onClick={() => {
                  if (!vaqtinchalik) return
                  onChange(vaqtinchalik.lat, vaqtinchalik.lng)
                  setXaritaOchiq(false)
                  toast.success('Joylashuv belgilandi')
                }}
                className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium disabled:opacity-50"
              >
                <Check size={15} /> Tasdiqlash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
