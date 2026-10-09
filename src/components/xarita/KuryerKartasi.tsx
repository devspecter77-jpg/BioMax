'use client'

import Link from 'next/link'
import { AlertTriangle, ExternalLink, MapPin, Navigation, Phone, Truck, X } from 'lucide-react'
import { formatPhone, formatSum } from '@/lib/utils'
import { YETKAZISH_NOMI, masofaMatni, transportNomi, type KuryerYetkazish } from '@/lib/dostavchik'
import { YETKAZISH_XARITA_RANGI, vaqtYorligi } from '@/lib/yonalish'
import { googleYonalish } from '@/lib/xarita-havola'
import { vaqtMatni, yangilikAniqla } from '@/lib/lokatsiya-vaqt'
import { soatMatni } from '@/lib/smena'

/** Joriy buyurtmagacha qolgan yo'l. */
export interface YolHolati {
  masofaM: number | null
  /** Taxminiy qolgan vaqt (s) — faqat ko'chalar bo'ylab marshrut bo'lsa */
  vaqtS: number | null
  /** true — ko'chalar bo'ylab, false — to'g'ri chiziqda (marshrut olinmadi) */
  yolBoylab: boolean
}

interface Props {
  kuryer: KuryerYetkazish
  yol: YolHolati | null
  /** Server vaqti (ms) — "necha daqiqa oldin" hisobi uchun */
  hozir: number
  onYopish: () => void
}

const tugmaCls = 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2.5 min-h-9 text-xs font-medium text-gray-700 dark:text-gray-300 hover:border-primary/50 hover:text-primary transition'

// Xaritada tanlangan kuryer: qaysi buyurtmani olib ketyapti, qayerga, qancha
// qoldi. Ma'lumot har bir necha soniyada yangilanadi (sahifa uzatadi).
export default function KuryerKartasi({ kuryer: k, yol, hozir, onYopish }: Props) {
  const j = k.joriy
  const rang = YETKAZISH_XARITA_RANGI[j?.holati ?? 'TAYINLANGAN']
  const yangilik = yangilikAniqla(k.lokatsiya?.yangilangan, hozir)
  const boshqalar = k.yetkazishlar.filter(y => y.raqam !== j?.raqam)
  const transport = [k.transportTuri ? transportNomi(k.transportTuri) : null, k.transportNomi, k.davlatRaqami]
    .filter(Boolean).join(' · ')

  return (
    <section
      aria-label={`${k.ism} — yetkazish`}
      className="max-h-[min(70dvh,560px)] overflow-y-auto rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white/97 dark:bg-neutral-900/97 shadow-xl backdrop-blur"
    >
      <div className="flex items-start gap-3 p-3.5 pb-2.5">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white" style={{ background: rang }}>
          <Truck size={17} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-semibold text-gray-900 dark:text-gray-100">{k.ism}</h2>
          <p className="truncate text-xs text-gray-500 dark:text-gray-400">{transport || 'Transport ko‘rsatilmagan'}</p>
        </div>
        <button
          type="button"
          onClick={onYopish}
          aria-label="Kartani yopish"
          className="-mr-1 -mt-1 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-neutral-800 dark:hover:text-gray-200"
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      {/* Joylashuv qanchalik yangi */}
      <div className="px-3.5">
        {!k.lokatsiya ? (
          <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 px-2.5 py-2 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden />
            Joylashuv hali kelmagan — kuryer ERP’ni telefonida ochib, joylashuvga ruxsat berishi kerak.
          </p>
        ) : yangilik === 'jonli' ? (
          <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Jonli · joylashuv {vaqtMatni(k.lokatsiya.yangilangan, hozir).toLowerCase()}
          </p>
        ) : (
          <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 px-2.5 py-2 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden />
            Joylashuv {vaqtMatni(k.lokatsiya.yangilangan, hozir).toLowerCase()} yangilangan — kuryer ilovasi yopiq yoki fonda.
            Chiziq oxirgi ma’lum joydan.
          </p>
        )}
      </div>

      {j && (
        <div className="m-3.5 mt-3 rounded-xl border border-gray-200 dark:border-neutral-800">
          <div className="flex items-center justify-between gap-2 border-b border-gray-100 dark:border-neutral-800 px-3 py-2">
            <span className="font-mono text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{j.raqam}</span>
            <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color: rang, background: `${rang}1a` }}>
              {YETKAZISH_NOMI[j.holati]}
            </span>
          </div>

          {/* Qolgan yo'l */}
          <div className="px-3 pt-2.5">
            {j.holati === 'YOLDA' && yol?.masofaM != null ? (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">{masofaMatni(yol.masofaM)}</span>
                {yol.vaqtS != null && <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{vaqtYorligi(yol.vaqtS)}</span>}
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  {yol.yolBoylab ? 'qoldi, ko‘chalar bo‘ylab' : 'to‘g‘ri chiziqda'}
                </span>
              </div>
            ) : j.holati === 'YETIB_KELDI' ? (
              <p className="text-sm font-medium" style={{ color: rang }}>
                Mijoz oldida{j.yetibKeldi ? ` · ${soatMatni(j.yetibKeldi)} dan` : ''}
              </p>
            ) : j.holati === 'TAYINLANGAN' ? (
              <p className="text-sm text-gray-600 dark:text-gray-400">Hali yo‘lga chiqmagan — «Yo‘lga chiqdim»ni kutyapti</p>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">Manzil xaritada belgilanmagan</p>
            )}
            {j.yolgaChiqdi && j.holati === 'YOLDA' && (
              <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">Yo‘lga chiqdi: {soatMatni(j.yolgaChiqdi)}</p>
            )}
          </div>

          <dl className="space-y-1.5 px-3 py-2.5 text-sm">
            <div className="flex items-center justify-between gap-2">
              <dt className="sr-only">Mijoz</dt>
              <dd className="min-w-0 truncate font-medium text-gray-900 dark:text-gray-100">{j.aloqaIsm ?? 'Mijoz'}</dd>
              {j.jamiSumma != null && (
                <dd className="shrink-0 tabular-nums text-gray-700 dark:text-gray-300">{formatSum(j.jamiSumma)}</dd>
              )}
            </div>
            {j.manzilMatni && (
              <div className="flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                <dt className="sr-only">Manzil</dt>
                <MapPin size={13} className="mt-px shrink-0" aria-hidden />
                <dd className="min-w-0">{j.manzilMatni}</dd>
              </div>
            )}
          </dl>

          <div className="flex flex-wrap gap-1.5 px-3 pb-3">
            {k.telefon && (
              <a href={`tel:${k.telefon}`} className={tugmaCls} title={formatPhone(k.telefon)}>
                <Phone size={13} aria-hidden /> Kuryer
              </a>
            )}
            {j.aloqaTel && (
              <a href={`tel:${j.aloqaTel}`} className={tugmaCls} title={formatPhone(j.aloqaTel)}>
                <Phone size={13} aria-hidden /> Mijoz
              </a>
            )}
            {j.lat != null && j.lng != null && (
              <a href={googleYonalish(j.lat, j.lng)} target="_blank" rel="noopener noreferrer" className={tugmaCls}>
                <Navigation size={13} aria-hidden /> Google
              </a>
            )}
            <Link href={`/onlayn-buyurtmalar?raqam=${encodeURIComponent(j.raqam)}`} className={tugmaCls}>
              <ExternalLink size={13} aria-hidden /> Buyurtma
            </Link>
          </div>
        </div>
      )}

      {boshqalar.length > 0 && (
        <div className="px-3.5 pb-3.5">
          <p className="mb-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">Yana {boshqalar.length} ta buyurtma</p>
          <ul className="divide-y divide-gray-100 dark:divide-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-800">
            {boshqalar.map(y => (
              <li key={y.raqam} className="flex items-center gap-2 px-3 py-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: YETKAZISH_XARITA_RANGI[y.holati] }} aria-hidden />
                <span className="font-mono text-xs tabular-nums text-gray-900 dark:text-gray-100">{y.raqam}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-gray-500 dark:text-gray-400">
                  {YETKAZISH_NOMI[y.holati]}{y.manzilMatni ? ` · ${y.manzilMatni}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
