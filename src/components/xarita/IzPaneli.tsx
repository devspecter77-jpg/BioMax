'use client'

import { ChevronLeft, ChevronRight, ExternalLink, Loader2, MapPin, Route, X } from 'lucide-react'
import { ROL_NOMI } from '@/lib/rollar'
import { davomiylikMatni, soatMatni } from '@/lib/smena'
import { masofaMatni } from '@/lib/dostavchik'
import { googleXarita } from '@/lib/xarita-havola'
import { IZ_SAQLASH_KUN, kunSurish } from '@/lib/lokatsiya-izi'

/** `/api/xarita/iz` javobi. */
export interface IzJavob {
  xodim: { id: string; ism: string; rol: string }
  kun: string
  /** Izi bor kunlar (eng yangisi birinchi) */
  kunlar: string[]
  nuqtalarSoni: number
  bolaklar: [number, number][][]
  uzilishlar: [[number, number], [number, number]][]
  toxtashlar: { lat: number; lng: number; dan: number; gacha: number; uzilish: boolean }[]
  masofaM: number
  boshi: number | null
  oxiri: number | null
  oxirgiNuqta: { lat: number; lng: number; vaqt: number } | null
  hozir: number
}

/** Yurgan yo'l rangi — xaritadagi chiziq va to'xtash belgilari bilan bir xil. */
export const IZ_RANG = '#7c3aed'

const OYLAR = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr']

function kunNomi(kun: string, bugun: string): string {
  if (kun === bugun) return 'Bugun'
  if (kun === kunSurish(bugun, -1)) return 'Kecha'
  const [, oy, k] = kun.split('-').map(Number)
  return `${k}-${OYLAR[oy - 1] ?? ''}`
}

interface Props {
  ism: string
  rol: string
  kun: string
  bugun: string
  /** Shu xodim va kun uchun javob; hali kelmagan bo'lsa `null` */
  javob: IzJavob | null
  xato: string | null
  /** Har to'xtash uchun ma'lum joy: "Mijoz: Aziz" (yaqinida bo'lsa) */
  joylar: (string | null)[]
  /** Har to'xtash uchun ko'cha manzili; `undefined` — hali so'ralmoqda */
  manzillar: (string | null | undefined)[]
  tanlanganToxtash: number | null
  onKun: (kun: string) => void
  onToxtash: (i: number) => void
  onYopish: () => void
}

const tugmaCls = 'flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-gray-300 hover:border-primary/50 hover:text-primary disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:text-gray-600 transition'

// Xaritada tanlangan xodimning bir kunlik yurgan yo'li: qancha yurdi, qayerlarda
// to'xtadi (vaqti, davomiyligi, joyi). To'xtash bosilsa xarita o'sha joyga boradi.
export default function IzPaneli({
  ism, rol, kun, bugun, javob, xato, joylar, manzillar, tanlanganToxtash, onKun, onToxtash, onYopish,
}: Props) {
  const engEski = kunSurish(bugun, -(IZ_SAQLASH_KUN - 1))
  const toxtashlar = javob?.toxtashlar ?? []
  const bor = !!javob && javob.nuqtalarSoni > 0
  const harakatda = !!javob?.oxirgiNuqta && kun === bugun && javob.hozir - javob.oxirgiNuqta.vaqt < 3 * 60_000
  const boshqaKunlar = (javob?.kunlar ?? []).filter(k => k !== kun).slice(0, 4)

  return (
    <section
      aria-label={`${ism} — yurgan yo‘li`}
      className="max-h-[min(70dvh,560px)] overflow-y-auto rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white/97 dark:bg-neutral-900/97 shadow-xl backdrop-blur"
    >
      <div className="flex items-start gap-3 p-3.5 pb-2.5">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white" style={{ background: IZ_RANG }}>
          <Route size={17} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-semibold text-gray-900 dark:text-gray-100">{ism}</h2>
          <p className="truncate text-xs text-gray-500 dark:text-gray-400">
            {ROL_NOMI[rol] ?? rol} · yurgan yo‘li
            {harakatda && <span className="ml-1.5 font-medium text-emerald-600 dark:text-emerald-400">· hozir harakatda</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={onYopish}
          aria-label="Yurgan yo‘lini yopish"
          className="-mr-1 -mt-1 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-neutral-800 dark:hover:text-gray-200"
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      {/* Kun tanlash */}
      <div className="flex items-center gap-2 px-3.5">
        <button type="button" className={tugmaCls} onClick={() => onKun(kunSurish(kun, -1))} disabled={kun <= engEski} aria-label="Oldingi kun">
          <ChevronLeft size={16} aria-hidden />
        </button>
        <label className="relative flex-1 min-w-0">
          <span className="sr-only">Sanani tanlash</span>
          <input
            type="date"
            id="iz-sana"
            value={kun}
            min={engEski}
            max={bugun}
            onChange={e => { if (e.target.value) onKun(e.target.value) }}
            className="w-full h-9 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <span className="pointer-events-none absolute right-9 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-500 dark:text-gray-400">
            {kunNomi(kun, bugun)}
          </span>
        </label>
        <button type="button" className={tugmaCls} onClick={() => onKun(kunSurish(kun, 1))} disabled={kun >= bugun} aria-label="Keyingi kun">
          <ChevronRight size={16} aria-hidden />
        </button>
      </div>

      <div className="p-3.5 pt-3">
        {xato ? (
          <p className="rounded-lg bg-red-50 dark:bg-red-950/30 px-3 py-2.5 text-sm text-red-700 dark:text-red-400">{xato}</p>
        ) : !javob ? (
          <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-primary" aria-label="Yuklanmoqda" /></div>
        ) : !bor ? (
          <div className="rounded-xl border border-dashed border-gray-300 dark:border-neutral-700 px-3.5 py-4 text-center">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{kunNomi(kun, bugun)} yurgan yo‘li yozilmagan</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Iz xodim ERP’ni telefonida ochiq tutganda va joylashuvga ruxsat berganda yoziladi.
            </p>
            {boshqaKunlar.length > 0 && (
              <div className="mt-2.5 flex flex-wrap justify-center gap-1.5">
                {boshqaKunlar.map(k => (
                  <button key={k} type="button" onClick={() => onKun(k)}
                    className="rounded-full bg-gray-100 dark:bg-neutral-800 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-primary/10 hover:text-primary">
                    {kunNomi(k, bugun)}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Vaqt oralig'i (11 belgi) sig'sin — uchinchi ustun kengroq */}
            <dl className="grid grid-cols-[1fr_1fr_1.45fr] gap-2">
              <Korsatkich nomi="Yurdi" qiymat={masofaMatni(javob.masofaM) ?? '0 m'} />
              <Korsatkich nomi="To‘xtadi" qiymat={`${toxtashlar.length} joyda`} />
              <Korsatkich nomi="Vaqt" qiymat={javob.boshi && javob.oxiri ? `${soatMatni(javob.boshi)}–${soatMatni(javob.oxiri)}` : '—'} />
            </dl>

            {toxtashlar.length === 0 ? (
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                Bir joyda 5 daqiqadan ortiq turgan joyi yo‘q — faqat yo‘l chizig‘i ko‘rsatilgan.
              </p>
            ) : (
              <ol className="mt-3 space-y-1.5" aria-label="To‘xtagan joylari">
                {toxtashlar.map((t, i) => {
                  const joy = joylar[i]
                  const manzil = manzillar[i]
                  const tanlangan = tanlanganToxtash === i
                  return (
                    <li key={`${t.dan}-${i}`} className="flex items-stretch gap-1">
                      <button
                        type="button"
                        onClick={() => onToxtash(i)}
                        aria-pressed={tanlangan}
                        className={`flex min-w-0 flex-1 items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition ${
                          tanlangan ? 'bg-violet-50 dark:bg-violet-950/30' : 'hover:bg-gray-50 dark:hover:bg-neutral-800/50'
                        }`}
                      >
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: IZ_RANG }}>
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium tabular-nums text-gray-900 dark:text-gray-100">
                            {soatMatni(t.dan)}–{soatMatni(t.gacha)}
                            <span className="font-normal text-gray-500 dark:text-gray-400"> · {davomiylikMatni(t.gacha - t.dan, true)}</span>
                          </span>
                          <span className="block text-xs text-gray-600 dark:text-gray-400 break-words">
                            {joy ?? (manzil === undefined ? 'Manzil aniqlanmoqda…' : manzil ?? `${t.lat.toFixed(5)}, ${t.lng.toFixed(5)}`)}
                          </span>
                          {joy && manzil && <span className="block text-[11px] text-gray-400 break-words">{manzil}</span>}
                          {t.uzilish && <span className="block text-[11px] text-amber-700 dark:text-amber-400">Shu orada ilova yopiq bo‘lgan — vaqt taxminiy</span>}
                        </span>
                      </button>
                      <a
                        href={googleXarita(t.lat, t.lng)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${i + 1}-joyni Google xaritada ochish`}
                        title="Google xaritada ochish"
                        className="flex w-9 shrink-0 items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 hover:text-primary dark:hover:bg-neutral-800"
                      >
                        <ExternalLink size={14} aria-hidden />
                      </a>
                    </li>
                  )
                })}
              </ol>
            )}

            <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
              <MapPin size={12} className="mt-0.5 shrink-0" aria-hidden />
              Uzuq chiziq — ilova yopiq bo‘lgan oraliq, aniq yo‘l noma’lum. Iz {IZ_SAQLASH_KUN} kun saqlanadi.
            </p>
          </>
        )}
      </div>
    </section>
  )
}

function Korsatkich({ nomi, qiymat }: { nomi: string; qiymat: string }) {
  return (
    <div className="rounded-xl bg-gray-50 dark:bg-neutral-800/60 px-2.5 py-2">
      <dt className="text-[11px] text-gray-500 dark:text-gray-400">{nomi}</dt>
      <dd className="mt-0.5 truncate text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{qiymat}</dd>
    </div>
  )
}
