'use client'

import { useEffect, useState } from 'react'
import { ChevronRight, ExternalLink, Loader2, MapPin, Navigation, Package, ShoppingBag, Wallet } from 'lucide-react'
import LokatsiyaModal from '@/components/LokatsiyaModal'
import { TURI_BELGISI } from '@/components/xodim/XodimMulkPanel'
import { formatSanaVaVaqt, formatSum } from '@/lib/utils'
import { googleXarita, koordinataTogrimi, yandexNuqta, yandexYonalish } from '@/lib/xarita-havola'
import { vaqtMatni, yangilikAniqla, type Yangilik } from '@/lib/lokatsiya-vaqt'
import { MULK_TURI_MALUMOTI, type MulkTuri } from '@/lib/xodim-mulk'

// Xodim oynasining birinchi varag'i — bir qarashda: hozir qayerda, bugun va
// umuman qancha sotgan, qo'lida nima bor, oyligi qancha qoldi.

export interface XodimTafsiloti {
  xodim: {
    lokatsiyaLat: number | null
    lokatsiyaLng: number | null
    lokatsiyaYangilangan: string | null
  }
  sotuvXulosa: {
    davr: string
    bugun: { soni: number; summa: number; oxirgi: string | null }
    davrda: { soni: number; summa: number; oxirgi: string | null }
    jami: { soni: number; summa: number; oxirgi: string | null }
  } | null
  qolidagiMulk: { id: string; turi: MulkTuri; nomi: string; raqami: string | null; qiymati: number | null; berilganSana: string }[]
}

type Varaq = 'oylik' | 'mulk' | 'sotuvlar'

const YANGILIK: Record<Yangilik, { nomi: string; nuqta: string; badge: string }> = {
  jonli: { nomi: 'Hozir onlayn', nuqta: 'bg-green-500', badge: 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400' },
  yaqin: { nomi: 'Yaqinda ko‘ringan', nuqta: 'bg-lime-500', badge: 'bg-lime-50 text-lime-700 dark:bg-lime-950/40 dark:text-lime-400' },
  eski: { nomi: 'Eskirgan', nuqta: 'bg-gray-400', badge: 'bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-gray-400' },
}

function oyNomi(d: string): string {
  const [y, m] = d.split('-')
  const oylar = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr']
  return `${oylar[Number(m) - 1] ?? m} ${y}`
}

function Sarlavha({ belgi: Belgi, matn, onBatafsil, batafsilMatn }: { belgi: typeof MapPin; matn: string; onBatafsil?: () => void; batafsilMatn?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2.5">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        <Belgi size={13} aria-hidden /> {matn}
      </p>
      {onBatafsil && (
        <button type="button" onClick={onBatafsil} className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline">
          {batafsilMatn} <ChevronRight size={13} aria-hidden />
        </button>
      )}
    </div>
  )
}

export default function XodimUmumiyPanel({ ism, rol, tafsilot, yuklanmoqda, oylik, onVaraq }: {
  ism: string
  rol: string
  tafsilot: XodimTafsiloti | null
  yuklanmoqda: boolean
  /** Ro'yxatdagi shu davr oylik ma'lumoti */
  oylik: { davr: string; maosh: number | null; tolangan: number }
  onVaraq: (v: Varaq) => void
}) {
  const [xaritaOchiq, setXaritaOchiq] = useState(false)
  // "5 daqiqa oldin" oyna ochiq turganda ham to'g'ri qolsin
  const [hozir, setHozir] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setHozir(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  if (yuklanmoqda && !tafsilot) {
    return <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin text-primary" /></div>
  }

  const l = tafsilot?.xodim
  const joyBor = !!l && koordinataTogrimi(l.lokatsiyaLat, l.lokatsiyaLng)
  const lat = Number(l?.lokatsiyaLat), lng = Number(l?.lokatsiyaLng)
  const yangilik = yangilikAniqla(l?.lokatsiyaYangilangan ?? null, hozir)
  const sx = tafsilot?.sotuvXulosa
  const qoldi = oylik.maosh ? oylik.maosh - oylik.tolangan : null
  const tugmaCls = 'inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-300 dark:border-neutral-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-primary/50 hover:text-primary transition'

  return (
    <div className="space-y-3">
      {/* ── Joylashuv ── */}
      <section className="rounded-2xl border border-gray-200 dark:border-neutral-800 p-3.5">
        <Sarlavha belgi={MapPin} matn="Joylashuv" />
        {joyBor ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${YANGILIK[yangilik].badge}`}>
                <span className={`h-2 w-2 rounded-full ${YANGILIK[yangilik].nuqta} ${yangilik === 'jonli' ? 'animate-pulse' : ''}`} aria-hidden />
                {YANGILIK[yangilik].nomi}
              </span>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Oxirgi marta: <b className="font-medium">{vaqtMatni(l!.lokatsiyaYangilangan, hozir)}</b>
                {l!.lokatsiyaYangilangan && <span className="text-gray-500"> · {formatSanaVaVaqt(l!.lokatsiyaYangilangan)}</span>}
              </span>
            </div>
            {yangilik === 'eski' && (
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                Xodim ilovani yopgan — bu oxirgi marta ochgan paytidagi joy. Yangi joylashuv u ERP’ni qayta ochganda keladi.
              </p>
            )}
            <div className="mt-3 grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
              <button type="button" onClick={() => setXaritaOchiq(true)} className="col-span-2 whitespace-nowrap inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
                <MapPin size={15} aria-hidden /> Xaritada ko‘rish
              </button>
              <a href={googleXarita(lat, lng)} target="_blank" rel="noopener noreferrer" className={tugmaCls}>
                <ExternalLink size={14} aria-hidden /> Google
              </a>
              <a href={yandexNuqta(lat, lng)} target="_blank" rel="noopener noreferrer" className={tugmaCls}>
                <ExternalLink size={14} aria-hidden /> Yandex
              </a>
              <a href={yandexYonalish(lat, lng)} target="_blank" rel="noopener noreferrer" className={`${tugmaCls} col-span-2`} title="Yandex’da yo‘nalish — Google yo‘nalishi «Xaritada ko‘rish» oynasida">
                <Navigation size={14} aria-hidden /> Yo‘nalish
              </a>
            </div>
          </>
        ) : (
          <div className="rounded-xl bg-gray-50 dark:bg-neutral-800/50 px-3 py-2.5 text-sm text-gray-600 dark:text-gray-400">
            <p className="font-medium text-gray-800 dark:text-gray-200">Joylashuv hali kelmagan</p>
            <p className="mt-0.5 text-xs">
              {ism} ERP’ni telefonida ochib, brauzer so‘raganda joylashuvga <b>ruxsat</b> bersa — shu yerda va Xarita bo‘limida ko‘rinadi.
              Ilova ochiq turganda har 15 soniyada yangilanadi.
            </p>
          </div>
        )}
      </section>

      {/* ── Sotuvlar ── */}
      {sx && (
        <section className="rounded-2xl border border-gray-200 dark:border-neutral-800 p-3.5">
          <Sarlavha belgi={ShoppingBag} matn="Sotuvlar" onBatafsil={() => onVaraq('sotuvlar')} batafsilMatn="Kimga nima sotgani" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { nomi: 'Bugun', q: sx.bugun },
              { nomi: oyNomi(sx.davr), q: sx.davrda },
              { nomi: 'Butun davr', q: sx.jami },
            ].map(k => (
              <button
                key={k.nomi} type="button" onClick={() => onVaraq('sotuvlar')}
                className="min-w-0 rounded-xl bg-gray-50 dark:bg-neutral-800/50 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-neutral-800 flex items-baseline justify-between gap-3 sm:block"
              >
                <span className="min-w-0">
                  <span className="block text-xs sm:text-[11px] text-gray-600 sm:text-gray-500 dark:text-gray-400 truncate">{k.nomi}</span>
                  <span className="block text-[11px] text-gray-500 tabular-nums sm:hidden">{k.q.soni} ta chek</span>
                </span>
                <span className="block font-bold tabular-nums text-gray-900 dark:text-gray-100 whitespace-nowrap sm:truncate">{formatSum(k.q.summa)}</span>
                <span className="hidden sm:block text-[11px] text-gray-500 tabular-nums">{k.q.soni} ta chek</span>
              </button>
            ))}
          </div>
          {sx.jami.oxirgi && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Oxirgi sotuvi: {formatSanaVaVaqt(sx.jami.oxirgi)}</p>
          )}
          {sx.jami.soni === 0 && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Bu xodim hali sotuv qilmagan.</p>
          )}
        </section>
      )}

      {/* ── Biriktirilgan mulk ── */}
      <section className="rounded-2xl border border-gray-200 dark:border-neutral-800 p-3.5">
        <Sarlavha belgi={Package} matn={`Qo‘lidagi mulk${tafsilot ? ` — ${tafsilot.qolidagiMulk.length} ta` : ''}`} onBatafsil={() => onVaraq('mulk')} batafsilMatn="Boshqarish" />
        {!tafsilot || tafsilot.qolidagiMulk.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Hozir hech narsa biriktirilmagan</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {tafsilot.qolidagiMulk.map(m => {
              const Belgi = TURI_BELGISI[m.turi]
              return (
                <li key={m.id} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1.5 text-sm text-emerald-900 dark:text-emerald-300" title={`${MULK_TURI_MALUMOTI[m.turi].label}${m.qiymati ? ` · ${formatSum(m.qiymati)}` : ''}`}>
                  <Belgi size={14} aria-hidden />
                  <span className="font-medium">{m.nomi}</span>
                  {m.raqami && <span className="font-mono text-xs opacity-80">{m.raqami}</span>}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* ── Oylik ── */}
      <section className="rounded-2xl border border-gray-200 dark:border-neutral-800 p-3.5">
        <Sarlavha belgi={Wallet} matn={`Oylik — ${oyNomi(oylik.davr)}`} onBatafsil={() => onVaraq('oylik')} batafsilMatn="To‘lovlar" />
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="min-w-0"><span className="block text-[11px] text-gray-500">Belgilangan</span><span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100 truncate block">{oylik.maosh ? formatSum(oylik.maosh) : '—'}</span></div>
          <div className="min-w-0"><span className="block text-[11px] text-gray-500">To‘langan</span><span className="font-semibold tabular-nums text-green-600 truncate block">{oylik.tolangan > 0 ? formatSum(oylik.tolangan) : '—'}</span></div>
          <div className="min-w-0"><span className="block text-[11px] text-gray-500">Qoldi</span><span className={`font-semibold tabular-nums truncate block ${qoldi === null ? 'text-gray-400' : qoldi > 0 ? 'text-amber-600' : 'text-green-600'}`}>{qoldi === null ? '—' : qoldi > 0 ? formatSum(qoldi) : 'To‘liq'}</span></div>
        </div>
      </section>

      {xaritaOchiq && joyBor && (
        <LokatsiyaModal
          nomi={ism}
          tavsif={`${rol} · ${vaqtMatni(l!.lokatsiyaYangilangan, hozir)}`}
          lat={lat} lng={lng}
          turi="xodim"
          yangilangan={l!.lokatsiyaYangilangan}
          onYopish={() => setXaritaOchiq(false)}
        />
      )}
    </div>
  )
}
