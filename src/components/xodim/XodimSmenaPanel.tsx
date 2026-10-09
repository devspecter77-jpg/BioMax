'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle, CheckCircle2, ChevronDown, Cloud, Download, HardDrive, Loader2, Play, Square, Trash2, Volume2,
} from 'lucide-react'
import { useConfirm } from '@/components/ConfirmProvider'
import SmenaBelgisi from '@/components/smena/SmenaBelgisi'
import {
  SAQLASH_VARIANTLARI, YOZUV_HOLATI_MATNI, davomiylikMatni, hajmMatni, soatMatni, toshkentKuni,
} from '@/lib/smena'
import type { SmenaXulosasi, YozuvMalumoti } from '@/lib/smena-server'

// Xodimlar → kuryer oynasi → "Ish va ovozlar".
// Kunlar bo'yicha smenalar; har birida qancha yozilgani va uzilishlar,
// bo'laklarni ketma-ket tinglash va yuklab olish.

interface Javob {
  xodim: { id: string; ism: string; rol: string }
  smenalar: SmenaXulosasi[]
  kunlar: number
  saqlashKun: number
  omborTuri: 's3' | 'lokal' | null
  /** Ombor sozlanmagan bo'lsa — Vercel'da yetishmayotgan o'zgaruvchilar */
  omborYetishmaydi?: string[]
  adminmi: boolean
}

/** Shundan past o'rtacha balandlik — bo'lakda deyarli ovoz yo'q. */
const JIM_CHEGARA = 0.03

const OYLAR = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr']
const HAFTA = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba']

function kunNomi(kun: string): string {
  const bugun = toshkentKuni(Date.now())
  if (kun === bugun) return 'Bugun'
  if (kun === toshkentKuni(Date.now() - 86_400_000)) return 'Kecha'
  const d = new Date(`${kun}T12:00:00Z`)
  return `${d.getUTCDate()}-${OYLAR[d.getUTCMonth()]}, ${HAFTA[d.getUTCDay()]}`
}

const TUGATUVCHI: Record<string, string> = { xodim: 'o‘zi tugatdi', admin: 'administrator yopdi', avtomatik: 'avtomatik yopildi' }

function foizRangi(foiz: number): string {
  if (foiz >= 90) return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
  if (foiz >= 50) return 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400'
  return 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'
}

export default function XodimSmenaPanel({ xodimId }: { xodimId: string }) {
  const confirm = useConfirm()
  const [d, setD] = useState<Javob | null>(null)
  const [xato, setXato] = useState<string | null>(null)
  const [ochiq, setOchiq] = useState<string | null>(null)
  const [amalda, setAmalda] = useState(false)

  const yukla = useCallback(async () => {
    const r = await fetch(`/api/xodimlar/${xodimId}/smenalar?kunlar=14`, { cache: 'no-store' }).catch(() => null)
    if (!r) { setXato('Internet yo‘q'); return }
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { setXato(j.xato || 'Yuklanmadi'); return }
    setXato(null)
    setD(j)
  }, [xodimId])

  useEffect(() => {
    void yukla()
    // Ochiq smena jonli: holat va yangi bo'laklar har daqiqada
    const i = setInterval(() => { if (document.visibilityState === 'visible') void yukla() }, 60_000)
    return () => clearInterval(i)
  }, [yukla])

  async function smenaniYop(s: SmenaXulosasi) {
    const ok = await confirm({
      title: 'Smenani yakunlash',
      message: `${soatMatni(s.boshlandi)} da boshlangan smena hozir yopiladi va kuryer ilovasida ovoz yozish to‘xtaydi (bir daqiqa ichida).`,
      confirmText: 'Yakunlash',
      danger: false,
    })
    if (!ok) return
    setAmalda(true)
    try {
      const r = await fetch(`/api/xodimlar/${xodimId}/smenalar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amal: 'tugatish', smenaId: s.id }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.xato || 'Yakunlanmadi'); return }
      toast.success('Smena yakunlandi')
      await yukla()
    } finally {
      setAmalda(false)
    }
  }

  async function yozuvlarniOchir(s: SmenaXulosasi) {
    const ok = await confirm({
      title: 'Ovoz yozuvlarini o‘chirish',
      message: `${kunNomi(toshkentKuni(s.boshlandi))}, ${soatMatni(s.boshlandi)}–${s.tugadi ? soatMatni(s.tugadi) : ''} smenasining ${s.yozuvSoni} ta yozuvi butunlay o‘chiriladi. Buni qaytarib bo‘lmaydi.`,
      confirmText: 'O‘chirish',
      danger: true,
    })
    if (!ok) return
    setAmalda(true)
    try {
      const r = await fetch(`/api/xodimlar/${xodimId}/smenalar?smenaId=${encodeURIComponent(s.id)}`, { method: 'DELETE' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.xato || 'O‘chmadi'); return }
      toast.success(`${j.ochirildi} ta yozuv o‘chirildi`)
      setOchiq(null)
      await yukla()
    } finally {
      setAmalda(false)
    }
  }

  if (xato && !d) {
    return <p className="py-10 text-center text-sm text-red-600 dark:text-red-400">{xato}</p>
  }
  if (!d) {
    return <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin text-primary" /></div>
  }

  const kunlar = new Map<string, SmenaXulosasi[]>()
  for (const s of d.smenalar) {
    const k = toshkentKuni(s.boshlandi)
    kunlar.set(k, [...(kunlar.get(k) ?? []), s])
  }

  return (
    <div className="space-y-4">
      <OmborSozlamasi javob={d} onOzgardi={yukla} />

      {d.smenalar.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-neutral-700 px-4 py-10 text-center">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Oxirgi {d.kunlar} kunda smena yo‘q</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Kuryer o‘z panelida «Ishni boshlash»ni bosganda shu yerda paydo bo‘ladi.
          </p>
        </div>
      ) : (
        [...kunlar.entries()].map(([kun, smenalar]) => (
          <div key={kun} className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{kunNomi(kun)}</h4>
            {smenalar.map(s => (
              <SmenaKartasi
                key={s.id}
                xodimId={xodimId}
                smena={s}
                ochiq={ochiq === s.id}
                onBos={() => setOchiq(o => (o === s.id ? null : s.id))}
                adminmi={d.adminmi}
                amalda={amalda}
                onYop={() => void smenaniYop(s)}
                onOchir={() => void yozuvlarniOchir(s)}
              />
            ))}
          </div>
        ))
      )}
    </div>
  )
}

function OmborSozlamasi({ javob, onOzgardi }: { javob: Javob; onOzgardi: () => Promise<void> }) {
  const [tekshirilmoqda, setTekshirilmoqda] = useState(false)
  const [kun, setKun] = useState(javob.saqlashKun)
  useEffect(() => { setKun(javob.saqlashKun) }, [javob.saqlashKun])

  async function tekshir() {
    setTekshirilmoqda(true)
    try {
      const r = await fetch('/api/ovoz-sozlama', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amal: 'tekshir' }),
      })
      const j = await r.json().catch(() => ({}))
      if (j.ok) toast.success('Ombor ishlayapti: yozish, o‘qish va o‘chirish muvaffaqiyatli')
      else toast.error(j.xato || 'Ombor ishlamayapti', { duration: 10_000 })
    } finally {
      setTekshirilmoqda(false)
    }
  }

  async function kunniSaqla(yangi: number) {
    const eski = kun
    setKun(yangi)
    const r = await fetch('/api/ovoz-sozlama', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ saqlashKun: yangi }),
    }).catch(() => null)
    const j = r ? await r.json().catch(() => ({})) : {}
    if (!r?.ok) { setKun(eski); toast.error(j.xato || 'Saqlanmadi'); return }
    toast.success(yangi < eski
      ? `Saqlash muddati ${yangi} kun — eski yozuvlar o‘chiriladi`
      : `Saqlash muddati ${yangi} kun`)
    await onOzgardi()
  }

  const t = javob.omborTuri
  return (
    <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-gray-50/60 dark:bg-neutral-800/30 px-3.5 py-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${
          t === 's3' ? 'text-emerald-700 dark:text-emerald-400' : t === 'lokal' ? 'text-gray-600 dark:text-gray-400' : 'text-amber-700 dark:text-amber-400'
        }`}>
          {t === 's3' ? <Cloud size={14} aria-hidden /> : t === 'lokal' ? <HardDrive size={14} aria-hidden /> : <AlertTriangle size={14} aria-hidden />}
          {t === 's3' ? 'Bulut ombori ulangan' : t === 'lokal' ? 'Sinov rejimi: kompyuterdagi papka' : 'Ovoz ombori sozlanmagan'}
        </span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
            Saqlash:
            {javob.adminmi ? (
              <select
                value={kun}
                onChange={e => void kunniSaqla(Number(e.target.value))}
                className="rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-xs text-gray-900 dark:text-gray-100"
              >
                {SAQLASH_VARIANTLARI.map(v => <option key={v} value={v}>{v} kun</option>)}
              </select>
            ) : <b className="text-gray-800 dark:text-gray-200">{kun} kun</b>}
          </label>
          {javob.adminmi && (
            <button
              type="button"
              onClick={() => void tekshir()}
              disabled={tekshirilmoqda}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 disabled:opacity-60"
            >
              {tekshirilmoqda ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <CheckCircle2 size={12} aria-hidden />}
              Tekshirish
            </button>
          )}
        </div>
      </div>
      {!t && (
        <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
          Kuryer ilovasi yozuvlarni telefonda saqlab turibdi. Ular serverga tushishi uchun Vercel’da
          S3 ombori (tavsiya: Cloudflare R2) o‘zgaruvchilarini kiriting:{' '}
          {(javob.omborYetishmaydi?.length
            ? javob.omborYetishmaydi
            : ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']
          ).map((n, i) => (
            <span key={n}>{i > 0 && ', '}<code className="font-mono">{n}</code></span>
          ))}
          {' '}— Redeploy, so‘ng «Tekshirish».
        </p>
      )}
    </div>
  )
}

function SmenaKartasi({ xodimId, smena: s, ochiq, onBos, adminmi, amalda, onYop, onOchir }: {
  xodimId: string
  smena: SmenaXulosasi
  ochiq: boolean
  onBos: () => void
  adminmi: boolean
  amalda: boolean
  onYop: () => void
  onOchir: () => void
}) {
  const faol = !s.tugadi
  return (
    <div className={`rounded-xl border bg-white dark:bg-neutral-900 overflow-hidden ${faol ? 'border-emerald-300 dark:border-emerald-800' : 'border-gray-200 dark:border-neutral-800'}`}>
      <button
        type="button"
        onClick={onBos}
        aria-expanded={ochiq}
        className="w-full px-3.5 py-3 flex items-start justify-between gap-3 text-left hover:bg-gray-50 dark:hover:bg-neutral-800/40 transition"
      >
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono tabular-nums text-sm font-semibold text-gray-900 dark:text-gray-100">
              {soatMatni(s.boshlandi)} – {s.tugadi ? soatMatni(s.tugadi) : 'hozir'}
            </span>
            {faol && (
              <SmenaBelgisi smena={{ faol: true, boshlandi: s.boshlandi, tugadi: null, aloqa: s.aloqa, yozuvHolati: s.yozuvHolati }} />
            )}
          </span>
          <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
            {davomiylikMatni(s.smenaMs)} · {s.yozuvSoni} ta bo‘lak · {hajmMatni(s.hajm)}
            {s.tugatuvchi && ` · ${TUGATUVCHI[s.tugatuvchi] ?? s.tugatuvchi}`}
          </span>
        </span>
        <span className="flex items-center gap-2 shrink-0">
          <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${foizRangi(s.foiz)}`}
            title={`Smenaning ${s.foiz}% qismi yozilgan (${davomiylikMatni(s.yozilganMs)})`}>
            {s.foiz}% yozilgan
          </span>
          <ChevronDown size={16} className={`text-gray-400 transition-transform ${ochiq ? 'rotate-180' : ''}`} aria-hidden />
        </span>
      </button>

      {ochiq && (
        <div className="border-t border-gray-100 dark:border-neutral-800 px-3.5 py-3 space-y-3">
          <VaqtChizigi smena={s} />
          {faol && s.yozuvHolati && s.yozuvHolati !== 'yozilmoqda' && (
            <p className="text-xs text-amber-800 dark:text-amber-400">Kuryer ilovasi: {YOZUV_HOLATI_MATNI[s.yozuvHolati]}</p>
          )}
          {(s.yozuvlar?.length ?? 0) > 0
            ? <Pleer xodimId={xodimId} yozuvlar={s.yozuvlar!} />
            : <p className="text-xs text-gray-500 dark:text-gray-400">Bu smenada hali yozuv yo‘q{faol ? ' — birinchi bo‘lak 3 daqiqada keladi' : ''}.</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            {faol && (
              <button type="button" onClick={onYop} disabled={amalda}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-neutral-700 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-60">
                <Square size={13} aria-hidden /> Smenani yakunlash
              </button>
            )}
            {!faol && adminmi && s.yozuvSoni > 0 && (
              <button type="button" onClick={onOchir} disabled={amalda}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-900/60 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-60">
                <Trash2 size={13} aria-hidden /> Yozuvlarni o‘chirish
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** Smena chizig'i: yashil — yozilgan, qizil — yozuv uzilgan oraliq. */
function VaqtChizigi({ smena: s }: { smena: SmenaXulosasi }) {
  const bosh = new Date(s.boshlandi).getTime()
  const oxir = s.tugadi ? new Date(s.tugadi).getTime() : bosh + s.smenaMs
  const uzunlik = Math.max(1, oxir - bosh)
  const joy = (dan: string, gacha: string) => {
    const a = Math.max(0, (new Date(dan).getTime() - bosh) / uzunlik)
    const b = Math.min(1, (new Date(gacha).getTime() - bosh) / uzunlik)
    return { left: `${a * 100}%`, width: `${Math.max(0.4, (b - a) * 100)}%` }
  }
  return (
    <div>
      <div className="relative h-3 rounded-full bg-gray-100 dark:bg-neutral-800 overflow-hidden" role="img"
        aria-label={`Smenaning ${s.foiz}% qismi yozilgan, ${s.boshliqlar.length} ta uzilish`}>
        {(s.yozuvlar ?? []).map(y => (
          <span key={y.id} className={`absolute inset-y-0 ${(y.daraja ?? 1) < JIM_CHEGARA ? 'bg-emerald-300/70 dark:bg-emerald-800' : 'bg-emerald-500'}`} style={joy(y.boshlandi, y.tugadi)} />
        ))}
        {s.boshliqlar.map(b => (
          <span key={b.dan} className="absolute inset-y-0 bg-red-400/80" style={joy(b.dan, b.gacha)} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">
        <span>{soatMatni(bosh)}</span>
        <span>{s.tugadi ? soatMatni(oxir) : 'hozir'}</span>
      </div>
      {s.boshliqlar.length > 0 && (
        <p className="mt-1.5 text-xs text-red-700 dark:text-red-400">
          Yozilmagan: {s.boshliqlar.slice(0, 4).map(b => `${soatMatni(b.dan)}–${soatMatni(b.gacha)}`).join(', ')}
          {s.boshliqlar.length > 4 && ` va yana ${s.boshliqlar.length - 4} ta`}
        </p>
      )}
    </div>
  )
}

/** Bo'laklarni ketma-ket tinglash: biri tugasa keyingisi o'zi boshlanadi. */
function Pleer({ xodimId, yozuvlar }: { xodimId: string; yozuvlar: YozuvMalumoti[] }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [joriy, setJoriy] = useState<number | null>(null)
  const [ketma, setKetma] = useState(true)
  const [jimniOtkaz, setJimniOtkaz] = useState(true)
  const manzil = (y: YozuvMalumoti) => `/api/xodimlar/${xodimId}/ovozlar/${y.id}`
  const jimmi = (y: YozuvMalumoti) => y.daraja !== null && y.daraja < JIM_CHEGARA

  useEffect(() => {
    const a = audioRef.current
    if (joriy === null || !a) return
    a.src = manzil(yozuvlar[joriy])
    void a.play().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joriy])

  function keyingisi() {
    if (!ketma || joriy === null) return
    let i = joriy + 1
    while (i < yozuvlar.length && jimniOtkaz && jimmi(yozuvlar[i])) i++
    if (i < yozuvlar.length) setJoriy(i)
  }

  const y = joriy !== null ? yozuvlar[joriy] : null
  return (
    <div className="space-y-2">
      <div className="rounded-xl bg-gray-50 dark:bg-neutral-800/50 p-2.5 space-y-2">
        <audio ref={audioRef} controls preload="none" className="w-full h-10" onEnded={keyingisi} />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600 dark:text-gray-400">
          <span className="inline-flex items-center gap-1.5">
            <Volume2 size={13} aria-hidden />
            {y ? `${soatMatni(y.boshlandi)}–${soatMatni(y.tugadi)} tinglanmoqda` : 'Tinglash uchun bo‘lakni tanlang'}
          </span>
          <span className="flex items-center gap-3">
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={ketma} onChange={e => setKetma(e.target.checked)} className="accent-red-600" />
              Ketma-ket
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={jimniOtkaz} onChange={e => setJimniOtkaz(e.target.checked)} className="accent-red-600" />
              Jimini o‘tkazish
            </label>
          </span>
        </div>
      </div>
      <ul className="max-h-72 overflow-y-auto rounded-xl border border-gray-200 dark:border-neutral-800 divide-y divide-gray-100 dark:divide-neutral-800">
        {yozuvlar.map((b, i) => {
          const jim = jimmi(b)
          const tanlangan = i === joriy
          return (
            <li key={b.id} className={`flex items-center gap-2 px-2.5 py-1.5 ${tanlangan ? 'bg-red-50 dark:bg-red-950/30' : ''}`}>
              <button type="button" onClick={() => setJoriy(i)}
                aria-label={`${soatMatni(b.boshlandi)} dagi bo‘lakni tinglash`}
                className={`p-1.5 rounded-lg ${tanlangan ? 'text-primary' : 'text-gray-500 dark:text-gray-400 hover:text-primary'}`}>
                <Play size={14} aria-hidden />
              </button>
              <span className={`flex-1 min-w-0 text-xs tabular-nums ${jim ? 'text-gray-400 dark:text-gray-600' : 'text-gray-800 dark:text-gray-200'}`}>
                {soatMatni(b.boshlandi)}–{soatMatni(b.tugadi)}
                <span className="text-gray-400"> · {davomiylikMatni(b.davomiylikMs, true)}</span>
                {jim && <span className="ml-1.5 rounded bg-gray-100 dark:bg-neutral-800 px-1 text-[10px]">jim</span>}
              </span>
              <span className="hidden sm:block w-16 h-1.5 rounded-full bg-gray-100 dark:bg-neutral-800 overflow-hidden" aria-hidden>
                <span className="block h-full bg-emerald-500" style={{ width: `${Math.min(100, Math.round((b.daraja ?? 0) * 250))}%` }} />
              </span>
              <a href={`${manzil(b)}?yuklab=1`} aria-label={`${soatMatni(b.boshlandi)} dagi bo‘lakni yuklab olish`}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                <Download size={14} aria-hidden />
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
