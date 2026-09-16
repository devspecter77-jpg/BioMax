'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ExternalLink, Globe, Loader2, Package, Receipt, RotateCcw, UserRound, Users, X } from 'lucide-react'
import { formatPhone, formatSana, formatSanaVaVaqt, formatSum } from '@/lib/utils'
import { tolovBadge, tolovQisqa } from '@/lib/tolov-usullari'
import { birlikQisqa } from '@/lib/kunlik-hisobot'

// Xodim sotuvlari — kimga nima sotgani. Uch ko'rinish: cheklar (bosilsa tarkibi),
// mijozlar bo'yicha va mahsulotlar bo'yicha. Kelish narxi va foyda chiqmaydi.

interface SotuvQatori {
  id: string
  chekRaqami: string
  sana: string
  tolovUsuli: string
  holati: 'YAKUNLANGAN' | 'BEKOR_QILINGAN'
  manba: string
  onlaynRaqam: string | null
  jamiSumma: number
  chegirma: number
  yakuniySumma: number
  ballIshlatilgan: number
  keshbekIshlatilgan: number
  mijoz: { id: string; ism: string; telefon: string | null } | null
  tarkiblar: { id: string; tovarId: string; nomi: string; birlik: string; miqdor: number; birlikNarxi: number; jami: number }[]
  qaytarilgan: number
}

interface Javob {
  davr: string
  xulosa: {
    sotuvSoni: number; jamiSumma: number; ortachaChek: number; chegirma: number
    mijozlarSoni: number; mahsulotlarSoni: number; qaytarishSoni: number; qaytarishSumma: number; bekorSoni: number
    tolovUsullari: { usul: string; soni: number; summa: number }[]
  }
  mijozlar: { mijozId: string; ism: string; telefon: string | null; sotuvSoni: number; jamiSumma: number; oxirgiSana: string | null }[]
  mahsulotlar: { tovarId: string; nomi: string; birlik: string; miqdor: number; jamiSumma: number; sotuvSoni: number }[]
  mijozFiltri: { id: string; ism: string } | null
  sotuvlar: SotuvQatori[]
  jami: number
  sahifa: number
  sahifaHajmi: number
}

type Korinish = 'cheklar' | 'mijozlar' | 'mahsulotlar'

const miqdorMatni = (n: number) => String(Math.round(n * 1000) / 1000)

function davrNomi(d: string): string {
  if (d === 'bugun') return 'Bugun'
  if (d === '7kun') return 'Oxirgi 7 kun'
  if (d === '30kun') return 'Oxirgi 30 kun'
  if (d === 'hammasi') return 'Butun davr'
  const [y, m] = d.split('-')
  const oylar = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr']
  return `${oylar[Number(m) - 1] ?? m} ${y}`
}

export default function XodimSotuvlarPanel({ xodimId, xodimIsmi, davrlar, boshlangichDavr }: {
  xodimId: string
  xodimIsmi: string
  /** Oylik davrlar ro'yxati ("2026-09"...) */
  davrlar: string[]
  boshlangichDavr: string
}) {
  const [davr, setDavr] = useState(boshlangichDavr)
  const [korinish, setKorinish] = useState<Korinish>('cheklar')
  const [mijozId, setMijozId] = useState<string | null>(null)
  const [sahifa, setSahifa] = useState(1)
  const [data, setData] = useState<Javob | null>(null)
  const [yuklanmoqda, setYuklanmoqda] = useState(true)
  const [xato, setXato] = useState<string | null>(null)
  const [ochiq, setOchiq] = useState<string | null>(null)

  const yukla = useCallback(async () => {
    setYuklanmoqda(true)
    try {
      const p = new URLSearchParams({ davr })
      if (mijozId) p.set('mijozId', mijozId)
      if (sahifa > 1) p.set('sahifa', String(sahifa))
      const r = await fetch(`/api/xodimlar/${xodimId}/sotuvlar?${p}`, { cache: 'no-store' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setXato(j.xato ?? 'Sotuvlar yuklanmadi'); return }
      setXato(null)
      setData(j)
    } catch {
      setXato('Tarmoq xatosi')
    } finally {
      setYuklanmoqda(false)
    }
  }, [xodimId, davr, mijozId, sahifa])

  useEffect(() => { void yukla() }, [yukla])

  function mijozniTanla(id: string | null) {
    setMijozId(id)
    setSahifa(1)
    setOchiq(null)
    setKorinish('cheklar')
  }

  if (xato) return <p className="py-10 text-center text-sm text-red-600">{xato}</p>
  if (!data) return <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin text-primary" /></div>

  const x = data.xulosa
  const sahifalar = Math.max(1, Math.ceil(data.jami / data.sahifaHajmi))
  const engKattaMijoz = Math.max(1, ...data.mijozlar.map(m => m.jamiSumma))
  const engKattaMahsulot = Math.max(1, ...data.mahsulotlar.map(m => m.jamiSumma))

  return (
    <div className={`space-y-4 transition-opacity ${yuklanmoqda ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-500 dark:text-gray-400">{xodimIsmi} — <b className="font-medium text-gray-900 dark:text-gray-100">{davrNomi(data.davr)}</b></p>
        <select
          id="xodim-sotuv-davr" value={davr} onChange={e => { setDavr(e.target.value); setSahifa(1); setOchiq(null) }}
          className="px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <option value="bugun">Bugun</option>
          <option value="7kun">Oxirgi 7 kun</option>
          <option value="30kun">Oxirgi 30 kun</option>
          {davrlar.map(d => <option key={d} value={d}>{davrNomi(d)}</option>)}
          <option value="hammasi">Butun davr</option>
        </select>
      </div>

      {/* Ko'rsatkichlar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { nomi: 'Sotuvlar', qiymat: `${x.sotuvSoni} ta`, izoh: x.bekorSoni ? `${x.bekorSoni} tasi bekor qilingan` : '' },
          { nomi: 'Jami summa', qiymat: formatSum(x.jamiSumma), izoh: x.chegirma > 0 ? `chegirma ${formatSum(x.chegirma)}` : '' },
          { nomi: 'O‘rtacha chek', qiymat: x.ortachaChek ? formatSum(x.ortachaChek) : '—', izoh: '' },
          { nomi: 'Mijozlar', qiymat: `${x.mijozlarSoni} ta`, izoh: `${x.mahsulotlarSoni} xil mahsulot` },
        ].map(k => (
          <div key={k.nomi} className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-2.5 min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{k.nomi}</p>
            <p className="font-bold tabular-nums text-gray-900 dark:text-gray-100 truncate">{k.qiymat}</p>
            {k.izoh && <p className="text-[11px] text-gray-400 truncate">{k.izoh}</p>}
          </div>
        ))}
      </div>

      {(x.tolovUsullari.length > 0 || x.qaytarishSoni > 0) && (
        <div className="flex flex-wrap gap-1.5 text-xs">
          {x.tolovUsullari.map(t => (
            <span key={t.usul} className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 font-medium ${tolovBadge(t.usul)}`}>
              {tolovQisqa(t.usul)} <span className="tabular-nums opacity-80">{t.soni} · {formatSum(t.summa)}</span>
            </span>
          ))}
          {x.qaytarishSoni > 0 && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 dark:bg-amber-950/30 px-2 py-1 font-medium text-amber-700 dark:text-amber-400">
              <RotateCcw size={11} aria-hidden /> Qaytarilgan <span className="tabular-nums">{x.qaytarishSoni} · {formatSum(x.qaytarishSumma)}</span>
            </span>
          )}
        </div>
      )}

      {/* Ko'rinish tanlash */}
      <div className="flex rounded-xl bg-gray-100 dark:bg-neutral-800 p-1 gap-1" role="tablist" aria-label="Sotuvlar ko‘rinishi">
        {([['cheklar', 'Cheklar', 'Cheklar', Receipt], ['mijozlar', 'Mijozlar bo‘yicha', 'Mijozlar', Users], ['mahsulotlar', 'Mahsulotlar bo‘yicha', 'Mahsulotlar', Package]] as const).map(([k, nomi, qisqa, Belgi]) => (
          <button
            key={k} type="button" role="tab" aria-selected={korinish === k} onClick={() => setKorinish(k)}
            className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs sm:text-sm font-medium transition ${korinish === k ? 'bg-white dark:bg-neutral-700 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}
          >
            <Belgi size={14} className="shrink-0" aria-hidden />
            <span className="truncate sm:hidden">{qisqa}</span>
            <span className="truncate hidden sm:inline">{nomi}</span>
          </button>
        ))}
      </div>

      {korinish === 'cheklar' && (
        <div className="space-y-2">
          {data.mijozFiltri && (
            <div className="flex items-center gap-2 rounded-xl bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-sm text-blue-800 dark:text-blue-300">
              <UserRound size={14} aria-hidden />
              <span className="flex-1 min-w-0 truncate">Faqat: <b>{data.mijozFiltri.ism}</b> — {data.jami} ta chek</span>
              <button type="button" onClick={() => mijozniTanla(null)} aria-label="Mijoz filtrini olib tashlash" className="p-1 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40"><X size={14} /></button>
            </div>
          )}
          {data.sotuvlar.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-gray-300 dark:border-neutral-700 py-10 text-center text-sm text-gray-500 dark:text-gray-400">Bu davrda sotuv yo‘q</p>
          ) : (
            <ul className="space-y-1.5">
              {data.sotuvlar.map(s => {
                const kengaygan = ochiq === s.id
                const bekor = s.holati === 'BEKOR_QILINGAN'
                return (
                  <li key={s.id} className={`rounded-2xl border bg-white dark:bg-neutral-900 overflow-hidden ${kengaygan ? 'border-gray-300 dark:border-neutral-700' : 'border-gray-200 dark:border-neutral-800'} ${bekor ? 'opacity-70' : ''}`}>
                    <button type="button" onClick={() => setOchiq(kengaygan ? null : s.id)} aria-expanded={kengaygan} className="w-full text-left px-3.5 py-2.5 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-neutral-800/50">
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{s.mijoz?.ism ?? 'Mijozsiz'}</span>
                          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${tolovBadge(s.tolovUsuli)}`}>{tolovQisqa(s.tolovUsuli)}</span>
                          {s.manba === 'ONLAYN' && <span className="inline-flex items-center gap-0.5 rounded-md bg-violet-50 dark:bg-violet-950/40 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:text-violet-400"><Globe size={9} aria-hidden />onlayn</span>}
                          {bekor && <span className="rounded-md bg-gray-200 dark:bg-neutral-700 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700 dark:text-gray-300">bekor qilingan</span>}
                          {s.qaytarilgan > 0 && <span className="rounded-md bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">qaytarish</span>}
                        </span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400 tabular-nums mt-0.5">
                          <span className="font-mono">{s.chekRaqami}</span> · {formatSanaVaVaqt(s.sana)} · {s.tarkiblar.length} xil
                        </span>
                      </span>
                      <span className={`shrink-0 font-semibold tabular-nums ${bekor ? 'line-through text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>{formatSum(s.yakuniySumma)}</span>
                      <ChevronDown size={16} className={`shrink-0 text-gray-400 transition-transform ${kengaygan ? 'rotate-180' : ''}`} aria-hidden />
                    </button>
                    {kengaygan && (
                      <div className="border-t border-dashed border-gray-300 dark:border-neutral-700 px-3.5 py-3 text-sm">
                        {s.mijoz?.telefon && <p className="mb-2 text-xs text-gray-500">Mijoz telefoni: <span className="font-mono">{formatPhone(s.mijoz.telefon)}</span></p>}
                        <ul className="divide-y divide-gray-100 dark:divide-neutral-800">
                          {s.tarkiblar.map(t => (
                            <li key={t.id} className="flex items-baseline justify-between gap-3 py-1.5">
                              <span className="min-w-0">
                                <span className="block text-gray-900 dark:text-gray-100">{t.nomi}</span>
                                <span className="block text-xs text-gray-500 tabular-nums">
                                  {t.birlikNarxi === 0 ? `${miqdorMatni(t.miqdor)} ${birlikQisqa(t.birlik)} · bonus` : `${miqdorMatni(t.miqdor)} ${birlikQisqa(t.birlik)} × ${formatSum(t.birlikNarxi)}`}
                                </span>
                              </span>
                              <span className="shrink-0 font-medium tabular-nums text-gray-900 dark:text-gray-100">{formatSum(t.jami)}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-2 border-t border-dashed border-gray-300 dark:border-neutral-700 pt-2 space-y-0.5 text-xs text-gray-600 dark:text-gray-400">
                          {s.chegirma > 0 && <div className="flex justify-between"><span>Chegirma</span><span className="tabular-nums">−{formatSum(s.chegirma)}</span></div>}
                          {s.ballIshlatilgan + s.keshbekIshlatilgan > 0 && <div className="flex justify-between"><span>Ball / keshbek</span><span className="tabular-nums">−{formatSum(s.ballIshlatilgan + s.keshbekIshlatilgan)}</span></div>}
                          {s.qaytarilgan > 0 && <div className="flex justify-between text-amber-700 dark:text-amber-400"><span>Qaytarilgan</span><span className="tabular-nums">−{formatSum(s.qaytarilgan)}</span></div>}
                          <div className="flex justify-between text-sm font-bold text-gray-900 dark:text-gray-100 pt-0.5"><span>Jami</span><span className="tabular-nums">{formatSum(s.yakuniySumma)}</span></div>
                        </div>
                        <div className="mt-2.5 flex flex-wrap gap-2">
                          <a href={`/chek/${encodeURIComponent(s.chekRaqami)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-gray-100 dark:bg-neutral-800 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-neutral-700">
                            <Receipt size={13} aria-hidden /> Chekni ochish <ExternalLink size={11} aria-hidden />
                          </a>
                          {s.mijoz && !data.mijozFiltri && (
                            <button type="button" onClick={() => mijozniTanla(s.mijoz!.id)} className="inline-flex items-center gap-1.5 rounded-xl bg-gray-100 dark:bg-neutral-800 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-neutral-700">
                              <UserRound size={13} aria-hidden /> Shu mijozga barcha sotuvlari
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          {sahifalar > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 pt-1">
              <span className="tabular-nums">{data.jami} ta chek</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setSahifa(p => Math.max(1, p - 1))} disabled={sahifa <= 1 || yuklanmoqda} aria-label="Oldingi sahifa" className="rounded-xl border border-gray-200 dark:border-neutral-800 p-2 disabled:opacity-40"><ChevronLeft size={16} /></button>
                <span className="px-2 tabular-nums">{sahifa} / {sahifalar}</span>
                <button type="button" onClick={() => setSahifa(p => Math.min(sahifalar, p + 1))} disabled={sahifa >= sahifalar || yuklanmoqda} aria-label="Keyingi sahifa" className="rounded-xl border border-gray-200 dark:border-neutral-800 p-2 disabled:opacity-40"><ChevronRight size={16} /></button>
              </div>
            </div>
          )}
        </div>
      )}

      {korinish === 'mijozlar' && (
        data.mijozlar.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-300 dark:border-neutral-700 py-10 text-center text-sm text-gray-500 dark:text-gray-400">Bu davrda sotuv yo‘q</p>
        ) : (
          <ul className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 divide-y divide-gray-100 dark:divide-neutral-800 overflow-hidden">
            {data.mijozlar.map(m => (
              <li key={m.mijozId}>
                <button type="button" onClick={() => mijozniTanla(m.mijozId)} className="w-full text-left px-3.5 py-2.5 hover:bg-gray-50 dark:hover:bg-neutral-800/50">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0">
                      <span className={`block text-sm font-medium truncate ${m.mijozId === 'mijozsiz' ? 'text-gray-500 italic' : 'text-gray-900 dark:text-gray-100'}`}>{m.ism}</span>
                      <span className="block text-xs text-gray-500 tabular-nums">
                        {m.telefon ? <span className="font-mono">{formatPhone(m.telefon)} · </span> : null}
                        {m.sotuvSoni} ta chek{m.oxirgiSana ? ` · oxirgisi ${formatSana(m.oxirgiSana)}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatSum(m.jamiSumma)}</span>
                  </span>
                  <span className="mt-1.5 block h-1 rounded-full bg-gray-100 dark:bg-neutral-800 overflow-hidden" aria-hidden>
                    <span className="block h-full rounded-full bg-primary/70" style={{ width: `${Math.max(2, (m.jamiSumma / engKattaMijoz) * 100)}%` }} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )
      )}

      {korinish === 'mahsulotlar' && (
        data.mahsulotlar.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-300 dark:border-neutral-700 py-10 text-center text-sm text-gray-500 dark:text-gray-400">Bu davrda sotuv yo‘q</p>
        ) : (
          <ul className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 divide-y divide-gray-100 dark:divide-neutral-800 overflow-hidden">
            {data.mahsulotlar.map(m => (
              <li key={m.tovarId} className="px-3.5 py-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-sm text-gray-900 dark:text-gray-100 truncate">{m.nomi}</span>
                    <span className="block text-xs text-gray-500 tabular-nums">{miqdorMatni(m.miqdor)} {birlikQisqa(m.birlik)} · {m.sotuvSoni} ta chekda</span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatSum(m.jamiSumma)}</span>
                </div>
                <span className="mt-1.5 block h-1 rounded-full bg-gray-100 dark:bg-neutral-800 overflow-hidden" aria-hidden>
                  <span className="block h-full rounded-full bg-emerald-500/70" style={{ width: `${Math.max(2, (m.jamiSumma / engKattaMahsulot) * 100)}%` }} />
                </span>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  )
}
