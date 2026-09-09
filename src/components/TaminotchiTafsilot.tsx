'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  X, Truck, Loader2, Phone, MapPin, User, Package, ShoppingBag, Send,
  Plus, Trash2, Search, AlertTriangle, History, RotateCcw, Check, Building,
} from 'lucide-react'
import { formatSum, formatPhone, formatSana, formatSanaVaVaqt, uzSearch } from '@/lib/utils'
import { birlikQisqa } from '@/lib/kunlik-hisobot'
import { sorovMatni, type SorovQatori } from '@/lib/taminotchi-sorov'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'

// Ta'minotchi kartasi: aloqa ma'lumoti, mahsulot so'rovi tuzish va uni
// Telegram orqali yuborish, hamda yuborilgan so'rovlar tarixi.

interface TovarQator {
  id: string
  nomi: string
  birlik: string
  shtrixKod: string | null
  minimalQoldiq: number
  qoldiq: number
  kamQolgan: boolean
  taklif: number
}

interface SorovTarkib { id: string; nomi: string; miqdor: number; birlik: string; izoh: string | null }

interface Sorov {
  id: string
  sana: string
  status: string
  xato: string | null
  matn: string
  qoshimchaIzoh: string | null
  yuborilganSana: string | null
  xodim: string | null
  tarkiblar: SorovTarkib[]
}

interface Malumot {
  taminotchi: {
    id: string; nomi: string; kontaktShaxs: string | null; telefon: string | null
    manzil: string | null; izoh: string | null
    filial: { id: string; nomi: string } | null
    yaratilgan: string; xaridSoni: number; tovarSoni: number; jamiQarz: number
  }
  xabarKonteksti: { dokonNomi: string; aloqaTelefoni: string | null }
  tovarlar: TovarQator[]
  xaridlar: { id: string; sana: string; jamiSumma: string; qoldiqQarz: string; izoh: string | null }[]
  sorovlar: Sorov[]
}

/** Qo'lda yozilgan qator — katalogda yo'q narsa uchun. */
interface QolQator { kalit: string; nomi: string; miqdor: string; birlik: string }

const BIRLIKLAR = ['DONA', 'KG', 'LITR', 'METR', 'PACHKA', 'QUTI']

const STATUS_MATNI: Record<string, string> = {
  sent: 'Yuborildi', failed: 'Yuborilmadi', pending: 'Kutilmoqda',
}
const STATUS_RANG: Record<string, string> = {
  sent: 'bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400',
  failed: 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400',
  pending: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400',
}

const inputCls =
  'w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500'

export default function TaminotchiTafsilot({
  taminotchiId, onYopish, onTahrir,
}: {
  taminotchiId: string
  onYopish: () => void
  onTahrir?: () => void
}) {
  const [data, setData] = useState<Malumot | null>(null)
  const [yuklanmoqda, setYuklanmoqda] = useState(true)
  const [xato, setXato] = useState<string | null>(null)
  const [varaq, setVaraq] = useState<'sorov' | 'tarix'>('sorov')

  // Tanlangan mahsulotlar: tovarId -> miqdor (matn, chunki input bo'sh bo'lishi mumkin)
  const [tanlangan, setTanlangan] = useState<Record<string, string>>({})
  const [qidiruv, setQidiruv] = useState('')
  const [qolQatorlar, setQolQatorlar] = useState<QolQator[]>([])
  const [izoh, setIzoh] = useState('')
  const [yuborilmoqda, setYuborilmoqda] = useState(false)
  const [qaytaYuborilmoqda, setQaytaYuborilmoqda] = useState<string | null>(null)
  const [ochiqSorov, setOchiqSorov] = useState<string | null>(null)

  useBodyScrollLock(true)

  const yukla = useCallback(async () => {
    try {
      const r = await fetch(`/api/taminotchilar/${taminotchiId}`)
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setXato(j.xato || "Ma'lumot yuklanmadi"); return }
      setData(j)
    } catch {
      setXato('Tarmoq xatosi')
    } finally {
      setYuklanmoqda(false)
    }
  }, [taminotchiId])

  useEffect(() => { void yukla() }, [yukla])

  useEffect(() => {
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') onYopish() }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [onYopish])

  const filtrlangan = useMemo(() => {
    if (!data) return []
    if (!qidiruv.trim()) return data.tovarlar
    return data.tovarlar.filter(t =>
      uzSearch(t.nomi, qidiruv) || (t.shtrixKod ?? '').includes(qidiruv.trim()))
  }, [data, qidiruv])

  // Yuboriladigan qatorlar — ko'rinish ham, so'rov ham shundan quriladi
  const qatorlar: SorovQatori[] = useMemo(() => {
    if (!data) return []
    const katalog = data.tovarlar
      .filter(t => tanlangan[t.id] !== undefined)
      .map(t => ({
        tovarId: t.id,
        nomi: t.nomi,
        miqdor: Number(tanlangan[t.id]) || 0,
        birlik: t.birlik,
      }))
      .filter(q => q.miqdor > 0)
    const qol = qolQatorlar
      .filter(q => q.nomi.trim() && Number(q.miqdor) > 0)
      .map(q => ({ tovarId: null, nomi: q.nomi.trim(), miqdor: Number(q.miqdor), birlik: q.birlik }))
    return [...katalog, ...qol]
  }, [data, tanlangan, qolQatorlar])

  // Server bilan AYNAN bir xil funksiya — ko'rinish yuboriladigan matnga teng
  const korinish = useMemo(() => {
    if (!data) return ''
    return sorovMatni({
      dokonNomi: data.xabarKonteksti.dokonNomi,
      taminotchiNomi: data.taminotchi.nomi,
      kontaktShaxs: data.taminotchi.kontaktShaxs,
      qatorlar,
      qoshimchaIzoh: izoh.trim() || null,
      aloqaTelefoni: data.xabarKonteksti.aloqaTelefoni,
    })
  }, [data, qatorlar, izoh])

  const bosh = qatorlar.length === 0 && !izoh.trim()
  const telefonYoq = !!data && !data.taminotchi.telefon

  function tanlaTogla(t: TovarQator) {
    setTanlangan(p => {
      const n = { ...p }
      if (n[t.id] !== undefined) delete n[t.id]
      else n[t.id] = String(t.taklif)
      return n
    })
  }

  function kamQolganlarniBelgila() {
    if (!data) return
    const kam = data.tovarlar.filter(t => t.kamQolgan)
    if (kam.length === 0) { toast.info('Kam qolgan mahsulot yo‘q'); return }
    setTanlangan(p => {
      const n = { ...p }
      for (const t of kam) if (n[t.id] === undefined) n[t.id] = String(t.taklif)
      return n
    })
    toast.success(`${kam.length} ta kam qolgan mahsulot belgilandi`)
  }

  async function yubor() {
    setYuborilmoqda(true)
    try {
      const r = await fetch(`/api/taminotchilar/${taminotchiId}/sorov`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qatorlar, qoshimchaIzoh: izoh.trim() || null }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        toast.error(j.xato || 'Yuborilmadi')
        // Saqlangan bo'lsa tarix yangilanadi — qayta yuborish mumkin
        if (j.saqlandi) { setVaraq('tarix'); void yukla() }
        return
      }
      toast.success('So‘rov Telegramga yuborildi')
      setTanlangan({})
      setQolQatorlar([])
      setIzoh('')
      setVaraq('tarix')
      void yukla()
    } catch {
      toast.error('Tarmoq xatosi')
    } finally {
      setYuborilmoqda(false)
    }
  }

  async function qaytaYubor(sorovId: string) {
    setQaytaYuborilmoqda(sorovId)
    try {
      const r = await fetch(`/api/taminotchi-sorov/${sorovId}/yuborish`, { method: 'POST' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.xato || 'Yuborilmadi'); void yukla(); return }
      toast.success('Qayta yuborildi')
      void yukla()
    } catch {
      toast.error('Tarmoq xatosi')
    } finally {
      setQaytaYuborilmoqda(null)
    }
  }

  const t = data?.taminotchi

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={onYopish}
    >
      <div
        className="bg-white dark:bg-neutral-900 rounded-t-2xl sm:rounded-2xl shadow-xl dark:border dark:border-neutral-800 w-full max-w-3xl max-h-[92dvh] sm:max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Sarlavha */}
        <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-neutral-800 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h3 className="text-gray-900 dark:text-gray-100 font-semibold flex items-center gap-2">
              <Truck size={18} className="text-primary shrink-0" />
              <span className="truncate">{t?.nomi ?? "Ta'minotchi"}</span>
            </h3>
            {t && (
              <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-gray-500 dark:text-gray-400">
                {t.kontaktShaxs && <span className="flex items-center gap-1"><User size={11} />{t.kontaktShaxs}</span>}
                {t.telefon && (
                  <a href={`tel:${t.telefon.replace(/\s/g, '')}`} className="flex items-center gap-1 text-blue-500 hover:text-blue-600">
                    <Phone size={11} />{formatPhone(t.telefon)}
                  </a>
                )}
                {t.manzil && <span className="flex items-center gap-1"><MapPin size={11} />{t.manzil}</span>}
                {t.filial && <span className="flex items-center gap-1"><Building size={11} />{t.filial.nomi}</span>}
              </div>
            )}
          </div>
          <button
            onClick={onYopish}
            className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {yuklanmoqda ? (
          <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-primary" /></div>
        ) : xato || !data || !t ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-20 text-sm">{xato ?? 'Topilmadi'}</p>
        ) : (
          <>
            {/* Yakuniy raqamlar + varaqlar */}
            <div className="px-4 sm:px-5 pt-3 shrink-0">
              <div className="grid grid-cols-3 gap-2">
                <MiniKarta belgi={<Package size={11} />} label="Tovar" qiymat={String(t.tovarSoni)} />
                <MiniKarta belgi={<ShoppingBag size={11} />} label="Xarid" qiymat={String(t.xaridSoni)} />
                <MiniKarta
                  label="Qarzimiz"
                  qiymat={t.jamiQarz > 0 ? formatSum(t.jamiQarz) : '—'}
                  rang={t.jamiQarz > 0 ? 'text-red-600' : 'text-green-600'}
                />
              </div>
              {t.izoh && (
                <p className="text-gray-500 dark:text-gray-400 text-xs italic mt-2">{t.izoh}</p>
              )}

              <div className="flex bg-gray-100 dark:bg-neutral-800 rounded-xl p-1 gap-1 mt-3">
                {([['sorov', "So'rov yuborish"], ['tarix', `Tarix (${data.sorovlar.length})`]] as const).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setVaraq(k)}
                    className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                      varaq === k
                        ? 'bg-white dark:bg-neutral-700 shadow-sm text-gray-900 dark:text-gray-100'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-4 sm:p-5 space-y-4">
              {varaq === 'sorov' ? (
                <>
                  {telefonYoq && (
                    <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20">
                      <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-amber-800 dark:text-amber-300 text-xs">
                        Bu ta&apos;minotchida telefon raqam yo&apos;q — Telegram orqali yuborib bo&apos;lmaydi.
                        Tahrirlab raqam kiriting.
                      </p>
                    </div>
                  )}

                  {/* ── Katalogdan tanlash ── */}
                  <section>
                    <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Mahsulot tanlash
                      </p>
                      {data.tovarlar.some(x => x.kamQolgan) && (
                        <button
                          onClick={kamQolganlarniBelgila}
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <Check size={12} /> Kam qolganlarni belgilash
                        </button>
                      )}
                    </div>

                    {data.tovarlar.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6 bg-gray-50 dark:bg-neutral-800/60 rounded-xl">
                        Bu ta&apos;minotchiga bog&apos;langan mahsulot yo&apos;q — pastdan qo&apos;lda yozing
                      </p>
                    ) : (
                      <>
                        <div className="relative mb-2">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            value={qidiruv}
                            onChange={e => setQidiruv(e.target.value)}
                            placeholder="Mahsulot qidirish..."
                            className={`${inputCls} pl-9`}
                          />
                        </div>
                        <div className="border border-gray-200 dark:border-neutral-800 rounded-xl divide-y divide-gray-100 dark:divide-neutral-800 max-h-72 overflow-y-auto">
                          {filtrlangan.length === 0 ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">Topilmadi</p>
                          ) : filtrlangan.map(tv => {
                            const belgilangan = tanlangan[tv.id] !== undefined
                            return (
                              <div
                                key={tv.id}
                                className={`px-3 py-2.5 flex items-center gap-3 ${belgilangan ? 'bg-primary/5' : ''}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={belgilangan}
                                  onChange={() => tanlaTogla(tv)}
                                  className="w-4 h-4 accent-red-600 shrink-0"
                                />
                                <button
                                  onClick={() => tanlaTogla(tv)}
                                  className="min-w-0 flex-1 text-left"
                                >
                                  <p className="text-gray-900 dark:text-gray-100 text-sm font-medium truncate">{tv.nomi}</p>
                                  <p className={`text-[11px] ${tv.kamQolgan ? 'text-red-600' : 'text-gray-500 dark:text-gray-400'}`}>
                                    {tv.kamQolgan && '⚠ '}
                                    Qoldiq: {tv.qoldiq} {birlikQisqa(tv.birlik)} · min {tv.minimalQoldiq}
                                  </p>
                                </button>
                                {belgilangan && (
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <input
                                      type="number"
                                      min={0}
                                      step="any"
                                      value={tanlangan[tv.id]}
                                      onChange={e => setTanlangan(p => ({ ...p, [tv.id]: e.target.value }))}
                                      className="w-20 px-2 py-1.5 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-lg text-sm text-right text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                                    />
                                    <span className="text-gray-500 dark:text-gray-400 text-xs w-10">{birlikQisqa(tv.birlik)}</span>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </section>

                  {/* ── Qo'lda yozish ── */}
                  <section>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Qo&apos;lda qo&apos;shish
                      </p>
                      <button
                        onClick={() => setQolQatorlar(p => [
                          ...p, { kalit: `q${Date.now()}${p.length}`, nomi: '', miqdor: '1', birlik: 'DONA' },
                        ])}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        <Plus size={12} /> Qator qo&apos;shish
                      </button>
                    </div>
                    {qolQatorlar.length === 0 ? (
                      <p className="text-gray-500 dark:text-gray-400 text-xs">
                        Katalogda yo&apos;q narsani shu yerdan yozib qo&apos;shasiz
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {qolQatorlar.map((q, i) => (
                          <div key={q.kalit} className="flex items-center gap-2">
                            <input
                              value={q.nomi}
                              onChange={e => setQolQatorlar(p => p.map((x, j) => j === i ? { ...x, nomi: e.target.value } : x))}
                              placeholder="Mahsulot nomi"
                              maxLength={200}
                              className={`${inputCls} flex-1`}
                            />
                            <input
                              type="number" min={0} step="any"
                              value={q.miqdor}
                              onChange={e => setQolQatorlar(p => p.map((x, j) => j === i ? { ...x, miqdor: e.target.value } : x))}
                              className={`${inputCls} w-20 text-right`}
                            />
                            <select
                              value={q.birlik}
                              onChange={e => setQolQatorlar(p => p.map((x, j) => j === i ? { ...x, birlik: e.target.value } : x))}
                              className={`${inputCls} w-24`}
                            >
                              {BIRLIKLAR.map(b => <option key={b} value={b}>{birlikQisqa(b)}</option>)}
                            </select>
                            <button
                              onClick={() => setQolQatorlar(p => p.filter((_, j) => j !== i))}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition shrink-0"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* ── Izoh ── */}
                  <section>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                      Qo&apos;shimcha izoh
                    </p>
                    <textarea
                      value={izoh}
                      onChange={e => setIzoh(e.target.value)}
                      rows={2}
                      maxLength={1000}
                      placeholder="Masalan: ertaga ertalab yetkazib bering"
                      className={`${inputCls} resize-none`}
                    />
                  </section>

                  {/* ── Xabar ko'rinishi ── */}
                  {!bosh && (
                    <section>
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                        Yuboriladigan xabar
                      </p>
                      <pre className="bg-gray-50 dark:bg-neutral-800/60 rounded-xl p-3 text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words font-sans">
                        {korinish}
                      </pre>
                    </section>
                  )}
                </>
              ) : (
                /* ── Tarix ── */
                data.sorovlar.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-12">
                    Hali so&apos;rov yuborilmagan
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.sorovlar.map(s => (
                      <div key={s.id} className="border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
                        <div className="px-3 py-2.5 flex items-start justify-between gap-3">
                          <button onClick={() => setOchiqSorov(o => o === s.id ? null : s.id)} className="min-w-0 flex-1 text-left">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[11px] px-2 py-0.5 rounded-md ${STATUS_RANG[s.status] ?? STATUS_RANG.pending}`}>
                                {STATUS_MATNI[s.status] ?? s.status}
                              </span>
                              <span className="text-gray-900 dark:text-gray-100 text-sm font-medium">
                                {s.tarkiblar.length} ta mahsulot
                              </span>
                            </div>
                            <p className="text-gray-500 dark:text-gray-400 text-[11px] mt-0.5 truncate">
                              {formatSanaVaVaqt(s.sana)}{s.xodim && ` · ${s.xodim}`}
                            </p>
                            {s.xato && <p className="text-red-500 text-[11px] mt-0.5 truncate">{s.xato}</p>}
                          </button>
                          <button
                            onClick={() => void qaytaYubor(s.id)}
                            disabled={qaytaYuborilmoqda === s.id || telefonYoq}
                            title="Qayta yuborish"
                            className="p-2 text-gray-400 hover:text-primary hover:bg-primary-light dark:hover:bg-primary/10 rounded-lg transition shrink-0 disabled:opacity-40"
                          >
                            {qaytaYuborilmoqda === s.id
                              ? <Loader2 size={15} className="animate-spin" />
                              : <RotateCcw size={15} />}
                          </button>
                        </div>
                        {ochiqSorov === s.id && (
                          <pre className="px-3 py-2.5 border-t border-gray-100 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-800/60 text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words font-sans">
                            {s.matn}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* So'nggi xaridlar — kontekst uchun */}
              {varaq === 'tarix' && data.xaridlar.length > 0 && (
                <section>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <History size={12} /> So&apos;nggi xaridlar
                  </p>
                  <div className="border border-gray-200 dark:border-neutral-800 rounded-xl divide-y divide-gray-100 dark:divide-neutral-800">
                    {data.xaridlar.map(x => (
                      <div key={x.id} className="px-3 py-2 flex items-center justify-between gap-3">
                        <span className="text-gray-500 dark:text-gray-400 text-xs">{formatSana(x.sana)}</span>
                        <div className="text-right">
                          <p className="text-gray-900 dark:text-gray-100 text-sm font-mono tabular-nums">{formatSum(Number(x.jamiSumma))}</p>
                          {Number(x.qoldiqQarz) > 0 && (
                            <p className="text-red-500 text-[11px]">qarz {formatSum(Number(x.qoldiqQarz))}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* Tugmalar */}
            <div className="p-4 sm:p-5 border-t border-gray-200 dark:border-neutral-800 flex gap-3 shrink-0 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-5">
              {varaq === 'sorov' ? (
                <button
                  onClick={() => void yubor()}
                  disabled={bosh || yuborilmoqda || telefonYoq}
                  className="flex-1 py-2.5 bg-primary text-white rounded-xl font-medium transition hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {yuborilmoqda ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  Telegramga yuborish
                  {qatorlar.length > 0 && ` (${qatorlar.length})`}
                </button>
              ) : onTahrir ? (
                <button
                  onClick={onTahrir}
                  className="flex-1 py-2.5 border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition font-medium"
                >
                  Tahrirlash
                </button>
              ) : null}
              <button
                onClick={onYopish}
                className="px-5 py-2.5 border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition font-medium"
              >
                Yopish
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function MiniKarta({ belgi, label, qiymat, rang }: {
  belgi?: React.ReactNode; label: string; qiymat: string; rang?: string
}) {
  return (
    <div className="bg-gray-50 dark:bg-neutral-800/60 rounded-xl p-2.5 text-center">
      <p className="text-gray-500 dark:text-gray-400 text-[11px] flex items-center justify-center gap-1">{belgi}{label}</p>
      <p className={`font-semibold text-sm mt-0.5 truncate ${rang ?? 'text-gray-900 dark:text-gray-100'}`}>{qiymat}</p>
    </div>
  )
}
