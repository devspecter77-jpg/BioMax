'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle, ArrowLeft, ArrowRight, Check, ImagePlus, LayoutGrid, Loader2, Package, Percent, Plus,
  Search, Star, Tag, Trash2, X,
} from 'lucide-react'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { HAJM_BIRLIKLARI, HAJM_YORLIQ, MAX_TAVSIF, XUSUSIYAT_TAVSIYALARI, type HajmBirligi, type Xususiyat } from '@/lib/vitrina'
import { useRuxsat } from '@/hooks/useRuxsat'

// Onlayn vitrina — saytdagi mahsulot kartochkalari.
//
// Mahsulot ERP'da odatdagidek yaratiladi; bu yerda unga rasm, tavsif,
// xususiyatlar, hajm va aksiya qo'shiladi va saytga chiqariladi. Narx va
// qoldiq saytga o'zi o'tadi — ularni bu yerda qayta kiritish shart emas.

interface Qator {
  id: string
  nomi: string
  sarlavha: string | null
  birlik: string
  sotishNarxi: number
  valyuta: string
  kategoriya: string | null
  qulflangan: boolean
  saytda: boolean
  qoldiq: number
  rasmlarSoni: number
  yetishmaydi: string[]
  toliqlik: number
  aksiya: { holati: string; narx: number; oxiri: string | null } | null
  rasmVersiya: string
}

interface Kartochka {
  id: string
  nomi: string
  birlik: string
  sotishNarxi: number
  valyuta: string
  kategoriya: string | null
  qulflangan: boolean
  rasmlar: string[]
  saytda: boolean
  sarlavha: string
  brend: string
  tavsif: string
  xususiyatlar: Xususiyat[]
  hajm: number | null
  hajmBirligi: HajmBirligi | null
  aksiya: { narx: number; boshi: string | null; oxiri: string | null; eskiNarx: number | null; holati: string } | null
  admin: boolean
}

type Filtr = 'hammasi' | 'saytda' | 'saytda_emas' | 'tayyor_emas' | 'aksiya'

const YETISHMAYDI_YORLIQ: Record<string, string> = { rasm: 'Rasm', tavsif: 'Tavsif', xususiyatlar: 'Xususiyatlar', hajm: 'Hajm' }
const som = (n: number) => `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} so'm`
const inputCls = 'w-full px-3 py-2.5 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 transition'
const MAX_RASM = 10

export default function OnlaynVitrinaPage() {
  const yozaOladi = useRuxsat().bor('onlayn-vitrina.tahrirlash')
  const [filtr, setFiltr] = useState<Filtr>('hammasi')
  const [qidiruv, setQidiruv] = useState('')
  const [tovarlar, setTovarlar] = useState<Qator[]>([])
  const [sonlar, setSonlar] = useState({ hammasi: 0, saytda: 0, saytdaEmas: 0, aksiyada: 0 })
  const [yuklanmoqda, setYuklanmoqda] = useState(true)
  const [xato, setXato] = useState<string | null>(null)
  const [tanlangan, setTanlangan] = useState<string | null>(null)
  const [almashmoqda, setAlmashmoqda] = useState<string | null>(null)

  const yukla = useCallback(async (jim = false) => {
    if (!jim) setYuklanmoqda(true)
    try {
      const p = new URLSearchParams({ filtr })
      if (qidiruv.trim()) p.set('q', qidiruv.trim())
      const j = await fetch(`/api/onlayn-vitrina?${p}`, { cache: 'no-store' })
      const d = await j.json().catch(() => ({}))
      if (!j.ok) { setXato(d.xato ?? 'Ro‘yxat yuklanmadi'); return }
      setXato(null)
      setTovarlar(d.tovarlar)
      setSonlar(d.sonlar)
    } catch {
      setXato('Internet aloqasini tekshiring')
    } finally {
      setYuklanmoqda(false)
    }
  }, [filtr, qidiruv])

  useEffect(() => {
    const t = setTimeout(() => { void yukla() }, qidiruv ? 300 : 0)
    return () => clearTimeout(t)
  }, [yukla, qidiruv])

  async function saytdaAlmashtir(q: Qator) {
    if (!q.saytda && q.rasmlarSoni === 0 && !window.confirm(`«${q.nomi}» da rasm yo‘q. Rasmsiz mahsulot saytda kam sotiladi. Baribir chiqarilsinmi?`)) return
    setAlmashmoqda(q.id)
    try {
      const j = await fetch(`/api/onlayn-vitrina/${q.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ saytda: !q.saytda }) })
      const d = await j.json().catch(() => ({}))
      if (!j.ok) { toast.error(d.xato ?? 'O‘zgarmadi'); return }
      toast.success(d.saytda ? `«${q.nomi}» saytga chiqarildi — 1–2 daqiqada ko‘rinadi` : `«${q.nomi}» saytdan olindi`)
      void yukla(true)
    } finally {
      setAlmashmoqda(null)
    }
  }

  const FILTRLAR: { kalit: Filtr; nomi: string; soni?: number }[] = [
    { kalit: 'hammasi', nomi: 'Hammasi', soni: sonlar.hammasi },
    { kalit: 'saytda', nomi: 'Saytda', soni: sonlar.saytda },
    { kalit: 'saytda_emas', nomi: 'Saytda emas', soni: sonlar.saytdaEmas },
    { kalit: 'tayyor_emas', nomi: 'To‘ldirilmagan' },
    { kalit: 'aksiya', nomi: 'Aksiyada', soni: sonlar.aksiyada },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <LayoutGrid size={22} className="text-primary" /> Onlayn vitrina
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
          Saytdagi mahsulot kartochkalari: rasm, tavsif, xususiyatlar va aksiyalar. Narx va qoldiq saytga o‘zi o‘tadi.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {FILTRLAR.map(f => (
            <button
              key={f.kalit}
              onClick={() => setFiltr(f.kalit)}
              className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition ${
                filtr === f.kalit ? 'bg-primary text-white' : 'bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800'
              }`}
            >
              {f.nomi}
              {f.soni !== undefined && <span className={`min-w-5 px-1.5 rounded-full text-xs tabular-nums ${filtr === f.kalit ? 'bg-white/25' : 'bg-gray-100 dark:bg-neutral-800'}`}>{f.soni}</span>}
            </button>
          ))}
        </div>
        <label className="relative lg:ml-auto lg:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={qidiruv} onChange={e => setQidiruv(e.target.value)} placeholder="Nomi yoki shtrix-kod" suppressHydrationWarning
            className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </label>
      </div>

      {xato ? (
        <div className="rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50/60 dark:bg-red-950/10 p-6 text-center">
          <AlertTriangle size={26} className="mx-auto text-red-500" />
          <p className="mt-2 font-medium text-red-700 dark:text-red-400">{xato}</p>
        </div>
      ) : yuklanmoqda && tovarlar.length === 0 ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-primary" /></div>
      ) : tovarlar.length === 0 ? (
        <p className="text-center py-16 text-sm text-gray-500">Mahsulot topilmadi</p>
      ) : (
        <div className="grid gap-2">
          {tovarlar.map(q => (
            <div key={q.id} className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-3 sm:p-3.5 flex items-center gap-3">
              <button onClick={() => setTanlangan(q.id)} className="shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-gray-100 dark:bg-neutral-800 flex items-center justify-center" aria-label={`${q.nomi} — tahrirlash`}>
                {q.rasmlarSoni > 0
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={`/api/onlayn-vitrina/${q.id}/rasm/0?v=${q.rasmVersiya}`} alt="" className="w-full h-full object-cover" loading="lazy" />
                  : <Package size={22} className="text-gray-300 dark:text-neutral-600" />}
              </button>

              <button onClick={() => setTanlangan(q.id)} className="min-w-0 flex-1 text-left">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900 dark:text-gray-100 truncate">{q.sarlavha || q.nomi}</span>
                  {q.aksiya && (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${q.aksiya.holati === 'FAOL' ? 'bg-red-600 text-white' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400'}`}>
                      <Percent size={11} /> {q.aksiya.holati === 'FAOL' ? 'Aksiya' : 'Aksiya kutilmoqda'}
                    </span>
                  )}
                  {q.qulflangan && <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-gray-400">Qulflangan</span>}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                  {[q.kategoriya, `${som(q.sotishNarxi)}${q.valyuta === 'USD' ? ' (USD)' : ''}`, `qoldiq ${q.qoldiq} ${q.birlik.toLowerCase()}`].filter(Boolean).join(' · ')}
                </p>
                <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                  <span className="w-20 h-1.5 rounded-full bg-gray-100 dark:bg-neutral-800 overflow-hidden" aria-label={`To‘liqlik ${q.toliqlik}%`}>
                    <span className={`block h-full rounded-full ${q.toliqlik === 100 ? 'bg-emerald-500' : q.toliqlik >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${q.toliqlik}%` }} />
                  </span>
                  {q.yetishmaydi.length === 0
                    ? <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5"><Check size={12} /> To‘liq</span>
                    : q.yetishmaydi.map(y => <span key={y} className="text-[11px] text-gray-500 dark:text-gray-400">{YETISHMAYDI_YORLIQ[y]} yo‘q</span>)}
                </div>
              </button>

              <div className="shrink-0 flex flex-col items-center gap-1 select-none">
                <span className="text-[11px] text-gray-500">{q.saytda ? 'Saytda' : 'Yashirin'}</span>
                <button
                  role="switch" aria-checked={q.saytda} aria-label={`${q.nomi} — saytda ko‘rsatish`}
                  disabled={almashmoqda === q.id || q.qulflangan || !yozaOladi}
                  onClick={() => void saytdaAlmashtir(q)}
                  className={`relative w-11 h-6 rounded-full transition disabled:opacity-50 ${q.saytda ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-neutral-700'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition ${q.saytda ? 'translate-x-5' : ''}`} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tanlangan && (
        <KartochkaTahrir
          id={tanlangan}
          onYopish={() => setTanlangan(null)}
          onSaqlandi={() => void yukla(true)}
        />
      )}
    </div>
  )
}

// ─── Kartochka tahrirlagichi ─────────────────────────────────────────────────

function KartochkaTahrir({ id, onYopish, onSaqlandi }: { id: string; onYopish: () => void; onSaqlandi: () => void }) {
  const yozaOladi = useRuxsat().bor('onlayn-vitrina.tahrirlash')
  useBodyScrollLock(true)
  const [asl, setAsl] = useState<Kartochka | null>(null)
  const [k, setK] = useState<Kartochka | null>(null)
  const [xato, setXato] = useState<string | null>(null)
  const [band, setBand] = useState(false)
  const fayl = useRef<HTMLInputElement>(null)

  const yukla = useCallback(async () => {
    const j = await fetch(`/api/onlayn-vitrina/${id}`, { cache: 'no-store' })
    const d = await j.json().catch(() => ({}))
    if (!j.ok) { setXato(d.xato ?? 'Kartochka ochilmadi'); return }
    setAsl(d); setK(d)
  }, [id])

  useEffect(() => { void yukla() }, [yukla])

  const ozgargan = useMemo(() => !!asl && !!k && JSON.stringify(ozgaruvchi(asl)) !== JSON.stringify(ozgaruvchi(k)), [asl, k])

  const yop = useCallback(() => {
    if (ozgargan && !window.confirm('Saqlanmagan o‘zgarishlar bor. Chiqib ketilsinmi?')) return
    onYopish()
  }, [ozgargan, onYopish])

  useEffect(() => {
    const t = (e: KeyboardEvent) => { if (e.key === 'Escape' && !band) yop() }
    window.addEventListener('keydown', t)
    return () => window.removeEventListener('keydown', t)
  }, [yop, band])

  function rasmQosh(fayllar: FileList | null) {
    if (!fayllar || !k) return
    const joy = MAX_RASM - k.rasmlar.length
    const tanlov = [...fayllar].slice(0, joy)
    if (fayllar.length > joy) toast.warning(`Eng ko‘pi bilan ${MAX_RASM} ta rasm — ${fayllar.length - joy} tasi qo‘shilmadi`)
    for (const f of tanlov) {
      if (!f.type.startsWith('image/')) { toast.error(`${f.name}: rasm emas`); continue }
      if (f.size > 12 * 1024 * 1024) { toast.error(`${f.name}: 12 MB dan katta`); continue }
      const o = new FileReader()
      o.onload = () => setK(x => x && x.rasmlar.length < MAX_RASM ? { ...x, rasmlar: [...x.rasmlar, o.result as string] } : x)
      o.readAsDataURL(f)
    }
  }

  function rasmSur(i: number, yon: -1 | 1) {
    setK(x => {
      if (!x) return x
      const r = [...x.rasmlar]
      const j = i + yon
      if (j < 0 || j >= r.length) return x
      ;[r[i], r[j]] = [r[j]!, r[i]!]
      return { ...x, rasmlar: r }
    })
  }

  async function saqla() {
    if (!k) return
    setBand(true)
    try {
      const j = await fetch(`/api/onlayn-vitrina/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ozgaruvchi(k)),
      })
      const d = await j.json().catch(() => ({}))
      if (!j.ok) { toast.error(d.xato ?? 'Saqlanmadi'); return }
      setAsl(d); setK(d)
      toast.success(d.saytda ? 'Saqlandi — saytda 1–2 daqiqada yangilanadi' : 'Saqlandi')
      onSaqlandi()
    } catch {
      toast.error('Internet aloqasini tekshiring')
    } finally {
      setBand(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={e => { if (e.target === e.currentTarget && !band) yop() }}>
      <div role="dialog" aria-modal="true" aria-label="Mahsulot kartochkasi" className="bg-gray-50 dark:bg-neutral-950 w-full sm:max-w-2xl h-full flex flex-col shadow-2xl">
        <div className="flex items-center justify-between gap-3 px-5 py-4 bg-white dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800">
          <div className="min-w-0">
            <p className="text-xs text-gray-500">Onlayn kartochka</p>
            <h2 className="font-bold text-gray-900 dark:text-gray-100 truncate">{k?.nomi ?? '…'}</h2>
          </div>
          <button onClick={yop} aria-label="Yopish" className="p-2 -mr-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-neutral-800"><X size={20} /></button>
        </div>

        {xato ? <p className="p-8 text-center text-red-600">{xato}</p> : !k ? (
          <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* Saytda */}
              <Bolim>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">Saytda ko‘rsatish</p>
                    <p className="text-sm text-gray-500">{k.qulflangan ? 'Mahsulot qulflangan — saytda ham ko‘rinmaydi.' : k.saytda ? 'Xaridorlar ko‘radi va buyurtma qila oladi.' : 'Hozir saytda yashirin.'}</p>
                  </div>
                  <button
                    role="switch" aria-checked={k.saytda} onClick={() => setK({ ...k, saytda: !k.saytda })}
                    className={`relative shrink-0 w-12 h-7 rounded-full transition ${k.saytda ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-neutral-700'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition ${k.saytda ? 'translate-x-5' : ''}`} />
                  </button>
                </div>
                {k.saytda && k.rasmlar.length === 0 && (
                  <p className="mt-3 flex gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-sm text-amber-800 dark:text-amber-400">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" /> Rasmsiz mahsulot saytda bo‘sh qutida ko‘rinadi — kamida bitta rasm qo‘shing.
                  </p>
                )}
              </Bolim>

              {/* Rasmlar */}
              <Bolim sarlavha={`Rasmlar · ${k.rasmlar.length}/${MAX_RASM}`} izoh="Birinchi rasm — asosiy. Oq yoki toza fonda, mahsulot to‘liq ko‘rinsin.">
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {k.rasmlar.map((r, i) => (
                    <div key={i} className="group relative aspect-square rounded-xl overflow-hidden border border-gray-200 dark:border-neutral-800 bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={r} alt={`Rasm ${i + 1}`} className="w-full h-full object-cover" />
                      {i === 0 && <span className="absolute top-1 left-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white flex items-center gap-0.5"><Star size={10} /> Asosiy</span>}
                      <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/55 p-1 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition">
                        <button onClick={() => rasmSur(i, -1)} disabled={i === 0} aria-label="Chapga" className="p-1 rounded text-white disabled:opacity-30"><ArrowLeft size={14} /></button>
                        <button onClick={() => setK({ ...k, rasmlar: k.rasmlar.filter((_, j) => j !== i) })} aria-label="O‘chirish" className="p-1 rounded text-white"><Trash2 size={14} /></button>
                        <button onClick={() => rasmSur(i, 1)} disabled={i === k.rasmlar.length - 1} aria-label="O‘ngga" className="p-1 rounded text-white disabled:opacity-30"><ArrowRight size={14} /></button>
                      </div>
                    </div>
                  ))}
                  {k.rasmlar.length < MAX_RASM && (
                    <button onClick={() => fayl.current?.click()} className="aspect-square rounded-xl border-2 border-dashed border-gray-300 dark:border-neutral-700 flex flex-col items-center justify-center gap-1 text-gray-500 hover:border-primary hover:text-primary transition">
                      <ImagePlus size={22} /><span className="text-[11px] font-medium">Qo‘shish</span>
                    </button>
                  )}
                </div>
                <input ref={fayl} type="file" accept="image/*" multiple hidden onChange={e => { rasmQosh(e.target.files); e.target.value = '' }} />
              </Bolim>

              {/* Asosiy */}
              <Bolim sarlavha="Nomi va brend">
                <div className="grid sm:grid-cols-[1fr_180px] gap-3">
                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Saytdagi nomi</span>
                    <input value={k.sarlavha} onChange={e => setK({ ...k, sarlavha: e.target.value })} maxLength={160} placeholder={k.nomi} className={inputCls} suppressHydrationWarning />
                    <span className="block text-xs text-gray-500">Bo‘sh qolsa ERP’dagi nom ishlatiladi. Qisqartmalarni oching: «1 k × 16 b» → «16 varaqli, 1 karobkada 60 ta».</span>
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Brend</span>
                    <input value={k.brend} onChange={e => setK({ ...k, brend: e.target.value })} maxLength={60} placeholder="Masalan, Ariel" className={inputCls} suppressHydrationWarning />
                  </label>
                </div>
              </Bolim>

              {/* Hajm */}
              <Bolim sarlavha="Hajm yoki og‘irlik" izoh="Saytda «1 kg / 1 l uchun» narx hisoblanadi — xaridor turli qadoqlarni solishtiradi.">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number" inputMode="decimal" min={0} step="any" value={k.hajm ?? ''} placeholder="400"
                    onChange={e => setK({ ...k, hajm: e.target.value === '' ? null : Number(e.target.value), hajmBirligi: k.hajmBirligi ?? 'ML' })}
                    className={`${inputCls.replace('w-full ', '')} w-28`} suppressHydrationWarning
                  />
                  <div className="flex gap-1">
                    {HAJM_BIRLIKLARI.map(b => (
                      <button key={b} onClick={() => setK({ ...k, hajmBirligi: b })} className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${k.hajmBirligi === b ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900' : 'border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-gray-300'}`}>
                        {HAJM_YORLIQ[b]}
                      </button>
                    ))}
                  </div>
                  {k.hajm && k.hajmBirligi && (
                    <span className="text-sm text-gray-500">≈ {birlikNarxiMatni(k.sotishNarxi, k.hajm, k.hajmBirligi)}</span>
                  )}
                  {k.hajm !== null && <button onClick={() => setK({ ...k, hajm: null, hajmBirligi: null })} className="text-sm text-gray-500 hover:text-red-600">Tozalash</button>}
                </div>
              </Bolim>

              {/* Tavsif */}
              <Bolim sarlavha="Tavsif" izoh="Nima uchun kerak, qanday ishlatiladi, nimasi bilan yaxshi. Qisqa xatboshilar bilan.">
                <textarea value={k.tavsif} onChange={e => setK({ ...k, tavsif: e.target.value })} rows={6} maxLength={MAX_TAVSIF} className={`${inputCls} resize-y leading-relaxed`} suppressHydrationWarning />
                <p className="mt-1 text-right text-xs text-gray-400 tabular-nums">{k.tavsif.length} / {MAX_TAVSIF}</p>
              </Bolim>

              {/* Xususiyatlar */}
              <Bolim sarlavha="Xususiyatlar" izoh="Saytda jadval bo‘lib chiqadi. Nomlarni bir xil yozing — tavsiyalardan tanlang.">
                <datalist id="xususiyat-tavsiyalari">{XUSUSIYAT_TAVSIYALARI.map(x => <option key={x} value={x} />)}</datalist>
                <div className="space-y-2">
                  {k.xususiyatlar.map((x, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1.4fr_auto] gap-2">
                      <input list="xususiyat-tavsiyalari" value={x.nomi} placeholder="Nomi" maxLength={60} className={inputCls} suppressHydrationWarning
                        onChange={e => setK({ ...k, xususiyatlar: k.xususiyatlar.map((y, j) => j === i ? { ...y, nomi: e.target.value } : y) })} />
                      <input value={x.qiymat} placeholder="Qiymati" maxLength={200} className={inputCls} suppressHydrationWarning
                        onChange={e => setK({ ...k, xususiyatlar: k.xususiyatlar.map((y, j) => j === i ? { ...y, qiymat: e.target.value } : y) })} />
                      <button onClick={() => setK({ ...k, xususiyatlar: k.xususiyatlar.filter((_, j) => j !== i) })} aria-label="O‘chirish" className="p-2.5 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"><Trash2 size={16} /></button>
                    </div>
                  ))}
                  {k.xususiyatlar.length < 20 && (
                    <button onClick={() => setK({ ...k, xususiyatlar: [...k.xususiyatlar, { nomi: '', qiymat: '' }] })} className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                      <Plus size={16} /> Xususiyat qo‘shish
                    </button>
                  )}
                </div>
              </Bolim>

              {/* Aksiya */}
              <AksiyaBolimi k={k} onOzgardi={async () => { await yukla(); onSaqlandi() }} />
            </div>

            <div className="px-4 sm:px-5 py-3 bg-white dark:bg-neutral-900 border-t border-gray-200 dark:border-neutral-800 flex items-center gap-3">
              <span className="text-sm text-gray-500 flex-1">{ozgargan ? 'Saqlanmagan o‘zgarishlar bor' : 'Hammasi saqlangan'}</span>
              <button onClick={yop} className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-medium">Yopish</button>
              <button onClick={() => void saqla()} disabled={band || !ozgargan || !yozaOladi} title={yozaOladi ? undefined : 'Kartochkani tahrirlashga ruxsatingiz yo‘q'} className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-2">
                {band && <Loader2 size={15} className="animate-spin" />} Saqlash
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ozgaruvchi(k: Kartochka) {
  return {
    saytda: k.saytda, sarlavha: k.sarlavha, brend: k.brend, tavsif: k.tavsif,
    xususiyatlar: k.xususiyatlar, hajm: k.hajm, hajmBirligi: k.hajmBirligi, rasmlar: k.rasmlar,
  }
}

function birlikNarxiMatni(narx: number, hajm: number, b: HajmBirligi): string {
  // Kichik birlikda katta qadoq uchun 1 kg / 1 l ga, kichik qadoq uchun 100 g / 100 ml ga
  if (b === 'G' || b === 'ML') {
    const katta = b === 'G' ? 'kg' : 'l'
    return hajm >= 500 ? `${som((narx / hajm) * 1000)} / 1 ${katta}` : `${som((narx / hajm) * 100)} / 100 ${HAJM_YORLIQ[b]}`
  }
  return `${som(narx / hajm)} / 1 ${HAJM_YORLIQ[b]}`
}

function Bolim({ sarlavha, izoh, children }: { sarlavha?: string; izoh?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4">
      {sarlavha && <h3 className="font-semibold text-gray-900 dark:text-gray-100">{sarlavha}</h3>}
      {izoh && <p className="text-sm text-gray-500 mt-0.5">{izoh}</p>}
      <div className={sarlavha ? 'mt-3' : ''}>{children}</div>
    </section>
  )
}

// ─── Aksiya ──────────────────────────────────────────────────────────────────

function mahalliyVaqt(d: Date): string {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return z.toISOString().slice(0, 16)
}

function AksiyaBolimi({ k, onOzgardi }: { k: Kartochka; onOzgardi: () => Promise<void> }) {
  const [narx, setNarx] = useState('')
  const [boshi, setBoshi] = useState(() => mahalliyVaqt(new Date()))
  const [oxiri, setOxiri] = useState(() => mahalliyVaqt(new Date(Date.now() + 7 * 86_400_000)))
  const [band, setBand] = useState(false)
  const a = k.aksiya
  const asosiy = a?.eskiNarx ?? k.sotishNarxi
  const foiz = narx && Number(narx) > 0 && Number(narx) < k.sotishNarxi ? Math.round((1 - Number(narx) / k.sotishNarxi) * 100) : null

  async function belgila() {
    setBand(true)
    try {
      const j = await fetch(`/api/onlayn-vitrina/${k.id}/aksiya`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ narx: Number(narx), boshi: new Date(boshi).toISOString(), oxiri: new Date(oxiri).toISOString() }),
      })
      const d = await j.json().catch(() => ({}))
      if (!j.ok) { toast.error(d.xato ?? 'Aksiya belgilanmadi'); return }
      toast.success(d.darholQollandi ? `Aksiya boshlandi (−${d.foiz}%) — kassada ham yangi narx` : `Aksiya belgilandi (−${d.foiz}%), vaqti kelganda boshlanadi`)
      setNarx('')
      await onOzgardi()
    } finally {
      setBand(false)
    }
  }

  async function bekor() {
    if (!window.confirm('Aksiya bekor qilinsinmi? Qo‘llangan bo‘lsa, asl narx kassada ham qaytadi.')) return
    setBand(true)
    try {
      const j = await fetch(`/api/onlayn-vitrina/${k.id}/aksiya`, { method: 'DELETE' })
      const d = await j.json().catch(() => ({}))
      if (!j.ok) { toast.error(d.xato ?? 'Bekor qilinmadi'); return }
      toast.success(d.narxQaytdi ? 'Aksiya bekor qilindi — asl narx qaytdi' : 'Aksiya bekor qilindi')
      await onOzgardi()
    } finally {
      setBand(false)
    }
  }

  return (
    <Bolim sarlavha="Aksiya" izoh="Aksiya narxi saytda ham, KASSADA ham amal qiladi. Tugaganda asl narx o‘zi qaytadi.">
      {a ? (
        <div className="space-y-3">
          <div className={`rounded-xl p-3 ${a.holati === 'FAOL' ? 'bg-red-50 dark:bg-red-950/20' : 'bg-amber-50 dark:bg-amber-950/20'}`}>
            <div className="flex items-center gap-2 flex-wrap">
              <Tag size={16} className={a.holati === 'FAOL' ? 'text-red-600' : 'text-amber-600'} />
              <span className="font-semibold text-gray-900 dark:text-gray-100">{som(a.narx)}</span>
              <span className="text-sm text-gray-500 line-through">{som(asosiy)}</span>
              <span className="rounded-full bg-red-600 text-white px-2 py-0.5 text-xs font-bold">−{Math.round((1 - a.narx / asosiy) * 100)}%</span>
              <span className="text-sm text-gray-600 dark:text-gray-400">{a.holati === 'FAOL' ? 'amalda' : 'boshlanishini kutmoqda'}</span>
            </div>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {a.boshi && new Date(a.boshi).toLocaleString('uz-UZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} — {a.oxiri && new Date(a.oxiri).toLocaleString('uz-UZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          {k.admin && (
            <button onClick={() => void bekor()} disabled={band} className="text-sm font-semibold text-red-600 disabled:opacity-50">Aksiyani bekor qilish</button>
          )}
        </div>
      ) : !k.admin ? (
        <p className="text-sm text-gray-500">Aksiyani faqat administrator belgilaydi.</p>
      ) : k.valyuta !== 'UZS' ? (
        <p className="text-sm text-gray-500">Dollarda narxlangan mahsulotga aksiya hozircha belgilanmaydi.</p>
      ) : (
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Aksiya narxi</span>
            <input type="number" inputMode="numeric" min={1} value={narx} onChange={e => setNarx(e.target.value)} placeholder={String(Math.round(k.sotishNarxi * 0.9))} className={inputCls} suppressHydrationWarning />
            <span className="block text-xs text-gray-500">Hozir: {som(k.sotishNarxi)}{foiz !== null && <b className="text-red-600"> · −{foiz}%</b>}</span>
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Boshlanishi</span>
            <input type="datetime-local" value={boshi} onChange={e => setBoshi(e.target.value)} className={inputCls} suppressHydrationWarning />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Tugashi</span>
            <input type="datetime-local" value={oxiri} onChange={e => setOxiri(e.target.value)} className={inputCls} suppressHydrationWarning />
          </label>
          <button onClick={() => void belgila()} disabled={band || !narx} className="sm:col-span-3 justify-self-start px-4 py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-semibold disabled:opacity-40 flex items-center gap-2">
            {band && <Loader2 size={15} className="animate-spin" />} <Percent size={15} /> Aksiyani belgilash
          </button>
        </div>
      )}
    </Bolim>
  )
}
