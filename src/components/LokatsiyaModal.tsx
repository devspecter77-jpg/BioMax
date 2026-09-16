'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import {
  X, Loader2, ExternalLink, Copy, Check, Navigation, MapPin,
} from 'lucide-react'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import type { XaritaNuqta } from '@/components/Xarita'
import {
  googleXarita, googleSputnik, googleYonalish, yandexXarita, yandexNuqta, yandexYonalish,
  koordinataMatni, koordinataTogrimi,
} from '@/lib/xarita-havola'
import { vaqtMatni as vaqtdanMatn, yangilikAniqla } from '@/lib/lokatsiya-vaqt'

const Xarita = dynamic(() => import('@/components/Xarita'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-gray-100 dark:bg-neutral-800">
      <Loader2 size={22} className="animate-spin text-primary" />
    </div>
  ),
})

// BITTA obyektning joylashuvini ko'rsatadigan oyna.
//
// Xodim, mijoz va ta'minotchi kartalaridagi "Xaritada" tugmasi shuni
// ochadi — joylashuvni ko'rish uchun Xarita bo'limiga o'tish shart emas.
//
// Ichki xarita (Esri) O'zbekistonda z17 dan yaqinlashtira olmaydi,
// shuning uchun "Google Xarita" tugmasi shu yerda — aniqroq tasvir
// kerak bo'lganda koordinata bo'yicha o'sha nuqta ochiladi.

interface Props {
  nomi: string
  tavsif?: string | null
  lat: number | null | undefined
  lng: number | null | undefined
  turi: XaritaNuqta['turi']
  /** Joylashuv qachon yangilangani — xodim uchun ma'noga ega. */
  vaqtMatni?: string | null
  /** Oxirgi yangilanish vaqti — berilsa belgi rangi (jonli/yaqin/eski) va matn shundan */
  yangilangan?: string | null
  onYopish: () => void
}

export default function LokatsiyaModal({
  nomi, tavsif, lat, lng, turi, vaqtMatni, yangilangan, onYopish,
}: Props) {
  const [nusxalandi, setNusxalandi] = useState(false)
  useBodyScrollLock(true)

  const bor = koordinataTogrimi(lat, lng)
  const a = Number(lat)
  const b = Number(lng)

  async function nusxala() {
    const matn = koordinataMatni(a, b)
    try {
      await navigator.clipboard.writeText(matn)
      setNusxalandi(true)
      toast.success('Koordinata nusxalandi')
      setTimeout(() => setNusxalandi(false), 2000)
    } catch {
      // HTTPS bo'lmasa yoki ruxsat berilmasa clipboard ishlamaydi —
      // foydalanuvchi qiymatni qo'lda ko'chira olishi uchun ko'rsatamiz.
      toast.error(`Nusxalab bo'lmadi. Koordinata: ${matn}`)
    }
  }

  const havolaCls =
    'flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-300 dark:border-neutral-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-primary/50 hover:text-primary transition'

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[60] p-0 sm:p-4"
      onClick={onYopish}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-neutral-900 rounded-t-2xl sm:rounded-2xl shadow-xl dark:border dark:border-neutral-800 w-full max-w-2xl flex flex-col max-h-[92vh]"
      >
        <div className="p-4 border-b border-gray-200 dark:border-neutral-800 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h3 className="text-gray-900 dark:text-gray-100 font-semibold flex items-center gap-2">
              <MapPin size={16} className="text-primary shrink-0" />
              <span className="truncate">{nomi}</span>
            </h3>
            {tavsif && (
              <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5 truncate">{tavsif}</p>
            )}
          </div>
          <button
            onClick={onYopish}
            aria-label="Yopish"
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {!bor ? (
          <div className="py-14 px-6 text-center">
            <MapPin size={30} className="text-gray-300 dark:text-neutral-700 mx-auto" />
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 font-medium">
              Joylashuv belgilanmagan
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Tahrirlash oynasida xaritadan joyini belgilang
            </p>
          </div>
        ) : (
          <>
            {/* O'lcham TASHQI o'ramga beriladi — ichki idish `h-full` bilan to'ldiradi */}
            <div className="h-[45vh] sm:h-80 shrink-0">
              <Xarita
                className="h-full w-full"
                nuqtalar={[{
                  id: 'yagona', lat: a, lng: b, nomi, tavsif, turi,
                  vaqtMatni: vaqtMatni ?? (yangilangan !== undefined ? vaqtdanMatn(yangilangan) : null),
                  yangilik: yangilangan !== undefined ? yangilikAniqla(yangilangan) : 'jonli',
                }]}
                fokus="yagona"
              />
            </div>

            <div className="p-4 space-y-3 overflow-y-auto">
              <div className="flex items-center justify-between gap-3 bg-gray-50 dark:bg-neutral-800/60 rounded-xl px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">Koordinata</p>
                  <p className="text-sm text-gray-900 dark:text-gray-100 font-medium tabular-nums truncate">
                    {koordinataMatni(a, b)}
                  </p>
                </div>
                <button
                  onClick={() => void nusxala()}
                  title="Nusxalash"
                  className="shrink-0 p-2 text-gray-400 hover:text-primary hover:bg-primary-light dark:hover:bg-primary/10 rounded-lg transition"
                >
                  {nusxalandi ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <a href={googleSputnik(a, b)} target="_blank" rel="noopener noreferrer" className={havolaCls}>
                  <ExternalLink size={14} /> Google sputnik
                </a>
                <a href={googleXarita(a, b)} target="_blank" rel="noopener noreferrer" className={havolaCls}>
                  <ExternalLink size={14} /> Google Xarita
                </a>
                <a href={yandexNuqta(a, b)} target="_blank" rel="noopener noreferrer" className={havolaCls}>
                  <ExternalLink size={14} /> Yandex Xarita
                </a>
                <a href={yandexXarita(a, b)} target="_blank" rel="noopener noreferrer" className={havolaCls}>
                  <ExternalLink size={14} /> Yandex sputnik
                </a>
                <a href={googleYonalish(a, b)} target="_blank" rel="noopener noreferrer" className={havolaCls}>
                  <Navigation size={14} /> Google yo&apos;nalish
                </a>
                <a href={yandexYonalish(a, b)} target="_blank" rel="noopener noreferrer" className={havolaCls}>
                  <Navigation size={14} /> Yandex yo&apos;nalish
                </a>
              </div>

              <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                Ichki sputnik tasviri O&apos;zbekistonda cheklangan masshtabgacha aniq.
                Binoni yaqindan ko&apos;rish uchun <span className="font-medium">Google sputnik</span> ni oching —
                u aynan shu koordinatani topadi.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * "Xaritada" tugmasi — o'zi oynani ham boshqaradi.
 *
 * Xodim, mijoz va ta'minotchi kartalarida bir xil ishlatiladi, shuning
 * uchun holat har sahifada qayta yozilmasin deb shu yerda turadi.
 * Koordinata yo'q bo'lsa tugma umuman chiqmaydi — bosib bo'lmaydigan
 * tugma foydalanuvchini chalg'itadi.
 */
export function XaritadaKorish({
  nomi, tavsif, lat, lng, turi, vaqtMatni, className, matnBilan = false,
}: Omit<Props, 'onYopish'> & { className?: string; matnBilan?: boolean }) {
  const [ochiq, setOchiq] = useState(false)
  if (!koordinataTogrimi(lat, lng)) return null

  return (
    <>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setOchiq(true) }}
        title={`${nomi} — xaritada ko'rish`}
        aria-label={`${nomi} — xaritada ko'rish`}
        className={className ?? (matnBilan
          ? 'flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-primary transition'
          : 'p-2 text-gray-400 hover:text-primary hover:bg-primary-light dark:hover:bg-primary/10 rounded-lg transition')}
      >
        <MapPin size={matnBilan ? 12 : 15} className="shrink-0" />
        {matnBilan && <span>Xaritada</span>}
      </button>
      {ochiq && (
        <LokatsiyaModal
          nomi={nomi} tavsif={tavsif} lat={lat} lng={lng}
          turi={turi} vaqtMatni={vaqtMatni}
          onYopish={() => setOchiq(false)}
        />
      )}
    </>
  )
}
