'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle, ArrowLeft, Check, ChevronDown, Copy, Eye, EyeOff, History, Info, Loader2, Lock,
  RotateCcw, Search, ShieldCheck, UserRound, X,
} from 'lucide-react'
import { useConfirm } from '@/components/ConfirmProvider'
import { navItems } from '@/components/layout/nav-items'
import { katalogBoyicha, ruxsatKatalogi, type RuxsatBolim } from '@/lib/ruxsat-katalogi'
import { formatSanaVaVaqt } from '@/lib/utils'

// Ruxsatlar — har bir xodim uchun qaysi bo'lim, qaysi amal va qaysi ma'lumot
// maydoni ochiq. O'zgarishlar avval qoralamada yig'iladi, "Saqlash" bosilganda
// bitta so'rov bilan yoziladi va jurnalga tushadi. Xodim sessiyasi 30 soniya
// ichida yangilanadi; pul va o'chirish kabi amallarda server darhol tekshiradi.

interface Xulosa { bolimlar: number; jamiBolim: number; amallar: number; jamiAmal: number; ozgartirilgan: number }
interface XodimQator {
  id: string; ism: string; login: string; rol: string; faol: boolean; telefon: string | null
  filialNomi: string | null; ulashilgan: boolean; tahrirlanadi: boolean; ozim: boolean; xulosa: Xulosa
}
interface KalitHolati { qiymat: boolean; standart: boolean; ozgartirilgan: boolean; samarali: boolean }
interface JurnalQator {
  id: string; foydalanuvchiId: string | null; foydalanuvchiIsm: string; ozgartiruvchiIsm: string
  kalit: string; eski: boolean; yangi: boolean; sabab: string; sana: string
}
interface Tafsilot {
  xodim: { id: string; ism: string; login: string; rol: string; faol: boolean; filialNomi: string | null; ulashilgan: boolean }
  holat: Record<string, KalitHolati>
  tahrirlanadi: boolean
  faqatMaydon: boolean
  sabab: string | null
  tovarBayroqlari: Record<string, boolean> | null
  jurnal: JurnalQator[]
}

const ROL: Record<string, { nomi: string; rang: string }> = {
  ADMIN: { nomi: 'Administrator', rang: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400' },
  KASSIR: { nomi: 'Kassir', rang: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' },
  OMBORCHI: { nomi: 'Omborchi', rang: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400' },
  SOTUVCHI: { nomi: 'Sotuvchi', rang: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' },
  DOSTAVCHIK: { nomi: 'Dostavchik', rang: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400' },
}
const rolNomi = (r: string) => ROL[r]?.nomi ?? r

const ULASHISH: { kalit: string; label: string; izoh: string; xavfli?: boolean }[] = [
  { kalit: 'ulashish.tovarTahrirlash', label: 'Tovarni tahrirlash', izoh: 'Ega katalogidagi nom, narx va kategoriyani o‘zgartirish' },
  { kalit: 'ulashish.tovarOchirish', label: 'Tovarni o‘chirish', izoh: 'Ega katalogidan butunlay o‘chirish', xavfli: true },
]

const SABAB: Record<string, string> = { QOLDA: 'qo‘lda', NUSXA: 'nusxa', STANDART: 'standartga qaytarildi' }

function kalitNomi(k: string): string {
  const u = ULASHISH.find(x => x.kalit === k)
  if (u) return `Ulashilgan katalog › ${u.label}`
  const r = katalogBoyicha.get(k)
  if (!r) return k
  return r.ota ? `${katalogBoyicha.get(r.ota)?.label ?? r.ota} › ${r.label}` : r.label
}

// Menyudagi guruh va ikonka — Ruxsatlar ekrani menyu bilan bir xil tartibda o'qilsin
function navMalumoti(kalit: string) {
  const n = navItems.find(i => i.href === (kalit === 'bosh' ? '/' : `/${kalit}`))
  return { icon: n?.icon ?? ShieldCheck, guruh: n?.section ?? 'UMUMIY' }
}
const GURUH_NOMI: Record<string, string> = {
  UMUMIY: 'Umumiy', SAVDO: 'Savdo', OMBOR: 'Ombor', 'MIJOZ VA NASIYA': 'Mijoz va nasiya', "TA'MINOT": 'Ta’minot', TIZIM: 'Tizim',
}

const normal = (s: string) => s.toLowerCase().replace(/[‘’ʻʼ`']/g, "'")

function Almashtirgich({ yoniq, onChange, disabled, label }: { yoniq: boolean; onChange: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={yoniq} aria-label={label} disabled={disabled} onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900 disabled:cursor-not-allowed disabled:opacity-50 ${
        yoniq ? 'bg-primary' : 'bg-gray-300 dark:bg-neutral-700'
      }`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${yoniq ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
    </button>
  )
}

export default function RuxsatlarPage() {
  const confirm = useConfirm()
  const [xodimlar, setXodimlar] = useState<XodimQator[]>([])
  const [songgi, setSonggi] = useState<JurnalQator[]>([])
  const [royxatYuklanmoqda, setRoyxatYuklanmoqda] = useState(true)
  const [xodimQidiruv, setXodimQidiruv] = useState('')
  const [rolFiltr, setRolFiltr] = useState<string>('HAMMASI')

  const [tanlanganId, setTanlanganId] = useState<string | null>(null)
  const [tafsilot, setTafsilot] = useState<Tafsilot | null>(null)
  const [tafsilotYuklanmoqda, setTafsilotYuklanmoqda] = useState(false)
  const [qoralama, setQoralama] = useState<Record<string, boolean>>({})
  const [saqlanmoqda, setSaqlanmoqda] = useState(false)
  const [ochiqBolimlar, setOchiqBolimlar] = useState<Set<string>>(new Set())
  const [qidiruv, setQidiruv] = useState('')
  const [faqatOzgargan, setFaqatOzgargan] = useState(false)
  const [oyna, setOyna] = useState<'ruxsatlar' | 'tarix'>('ruxsatlar')
  const [nusxaOchiq, setNusxaOchiq] = useState(false)

  const ozgarishSoni = Object.keys(qoralama).length

  const royxatniYukla = useCallback(async (jim = false) => {
    if (!jim) setRoyxatYuklanmoqda(true)
    try {
      const r = await fetch('/api/ruxsatlar', { cache: 'no-store' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.xato || 'Xodimlar yuklanmadi'); return }
      setXodimlar(j.xodimlar ?? [])
      setSonggi(j.songgi ?? [])
    } catch {
      toast.error('Tarmoq xatosi')
    } finally {
      setRoyxatYuklanmoqda(false)
    }
  }, [])

  const tafsilotniYukla = useCallback(async (id: string) => {
    setTafsilotYuklanmoqda(true)
    try {
      const r = await fetch(`/api/ruxsatlar?foydalanuvchiId=${encodeURIComponent(id)}`, { cache: 'no-store' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.xato || 'Ruxsatlar yuklanmadi'); setTanlanganId(null); return }
      setTafsilot(j)
    } catch {
      toast.error('Tarmoq xatosi')
    } finally {
      setTafsilotYuklanmoqda(false)
    }
  }, [])

  useEffect(() => { void royxatniYukla() }, [royxatniYukla])

  // Saqlanmagan o'zgarish bilan sahifani yopib yubormaslik
  useEffect(() => {
    if (!ozgarishSoni) return
    const t = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', t)
    return () => window.removeEventListener('beforeunload', t)
  }, [ozgarishSoni])

  async function tashlabKetishMumkinmi() {
    if (!ozgarishSoni) return true
    return confirm({ title: 'Saqlanmagan o‘zgarishlar', message: `${ozgarishSoni} ta o‘zgarish saqlanmagan. Ular bekor qilinsinmi?`, confirmText: 'Bekor qilish', cancelText: 'Qolish', danger: true })
  }

  async function xodimTanla(id: string | null) {
    if (id === tanlanganId) return
    if (!(await tashlabKetishMumkinmi())) return
    setQoralama({})
    setQidiruv('')
    setFaqatOzgargan(false)
    setOyna('ruxsatlar')
    setTafsilot(null)
    setTanlanganId(id)
    if (id) {
      setOchiqBolimlar(new Set())
      void tafsilotniYukla(id)
    }
  }

  // ── Qiymatlar (qoralama ustiga) ──
  const holat = tafsilot?.holat
  const adminmi = tafsilot?.xodim.rol === 'ADMIN'
  const qiymat = useCallback((k: string): boolean => {
    if (k in qoralama) return qoralama[k]!
    if (k.startsWith('ulashish.')) return tafsilot?.tovarBayroqlari?.[k] ?? true
    return holat?.[k]?.qiymat ?? false
  }, [qoralama, holat, tafsilot?.tovarBayroqlari])

  const asl = useCallback((k: string): boolean => {
    if (k.startsWith('ulashish.')) return tafsilot?.tovarBayroqlari?.[k] ?? true
    return holat?.[k]?.qiymat ?? false
  }, [holat, tafsilot?.tovarBayroqlari])

  function almashtir(k: string, yangi?: boolean) {
    setQoralama(prev => {
      const v = yangi ?? !(k in prev ? prev[k] : asl(k))
      const keyingi = { ...prev }
      if (v === asl(k)) delete keyingi[k]
      else keyingi[k] = v
      return keyingi
    })
  }

  function bolimAmallariniOrnat(b: RuxsatBolim, v: boolean) {
    for (const c of b.children ?? []) if ((c.turi ?? 'amal') === 'amal') almashtir(c.kalit, v)
  }

  const standart = useCallback((k: string) => (k.startsWith('ulashish.') ? true : holat?.[k]?.standart ?? false), [holat])
  const tahrirlanadi = !!tafsilot?.tahrirlanadi && !saqlanmoqda

  async function saqla() {
    if (!tafsilot || !ozgarishSoni) return
    const xavflilar = Object.entries(qoralama).filter(([k, v]) => v && (katalogBoyicha.get(k)?.xavfli || ULASHISH.find(u => u.kalit === k)?.xavfli))
    if (xavflilar.length > 0) {
      const ok = await confirm({
        title: 'Xavfli amallar ochilmoqda',
        message: `${tafsilot.xodim.ism} uchun ochiladi: ${xavflilar.map(([k]) => kalitNomi(k)).join('; ')}. Davom etilsinmi?`,
        confirmText: 'Ha, saqlash',
      })
      if (!ok) return
    }
    await yubor({ amal: 'QOLDA', ozgarishlar: qoralama }, 'Ruxsatlar saqlandi')
  }

  async function yubor(tana: Record<string, unknown>, xabar: string) {
    if (!tafsilot) return
    setSaqlanmoqda(true)
    try {
      const r = await fetch('/api/ruxsatlar', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foydalanuvchiId: tafsilot.xodim.id, ...tana }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.xato || 'Saqlanmadi'); return }
      setQoralama({})
      toast.success(j.ozgardi ? `${xabar} · ${j.ozgardi} ta o‘zgarish. Xodimda 30 soniya ichida kuchga kiradi` : 'O‘zgarish yo‘q — ruxsatlar allaqachon shunday')
      void tafsilotniYukla(tafsilot.xodim.id)
      void royxatniYukla(true)
    } catch {
      toast.error('Tarmoq xatosi')
    } finally {
      setSaqlanmoqda(false)
    }
  }

  async function standartgaQaytar() {
    if (!tafsilot) return
    const ok = await confirm({
      title: 'Rol standartiga qaytarish',
      message: `${tafsilot.xodim.ism} ning barcha ruxsatlari «${rolNomi(tafsilot.xodim.rol)}» roli standartiga qaytariladi, yashirilgan maydonlar ochiladi.${ozgarishSoni ? ' Saqlanmagan o‘zgarishlar ham bekor bo‘ladi.' : ''}`,
      confirmText: 'Qaytarish', danger: true,
    })
    if (ok) await yubor({ amal: 'STANDART' }, 'Standartga qaytarildi')
  }

  async function nusxaOl(manba: XodimQator) {
    if (!tafsilot) return
    setNusxaOchiq(false)
    const ok = await confirm({
      title: 'Ruxsatlardan nusxa olish',
      message: `${manba.ism} (${rolNomi(manba.rol)}) ning bo‘lim, amal va maydon ruxsatlari ${tafsilot.xodim.ism} ga ko‘chiriladi.${ozgarishSoni ? ' Saqlanmagan o‘zgarishlar bekor bo‘ladi.' : ''}`,
      confirmText: 'Nusxa olish',
    })
    if (ok) await yubor({ amal: 'NUSXA', manbaId: manba.id }, `${manba.ism} dan nusxa olindi`)
  }

  // ── Filtrlar ──
  const korinadiganXodimlar = useMemo(() => {
    const q = normal(xodimQidiruv.trim())
    return xodimlar.filter(x =>
      (rolFiltr === 'HAMMASI' || x.rol === rolFiltr)
      && (!q || normal(`${x.ism} ${x.login} ${x.telefon ?? ''} ${x.filialNomi ?? ''}`).includes(q)),
    )
  }, [xodimlar, xodimQidiruv, rolFiltr])

  const rolSonlari = useMemo(() => {
    const s: Record<string, number> = {}
    for (const x of xodimlar) s[x.rol] = (s[x.rol] ?? 0) + 1
    return s
  }, [xodimlar])

  const ozgarganmi = useCallback((k: string) => qiymat(k) !== standart(k), [qiymat, standart])

  const guruhlar = useMemo(() => {
    const q = normal(qidiruv.trim())
    const mos = (r: RuxsatBolim) => !q || normal(`${r.label} ${r.izoh ?? ''}`).includes(q)
    const natija: { guruh: string; bolimlar: { b: RuxsatBolim; bolalar: RuxsatBolim[] }[] }[] = []
    for (const b of ruxsatKatalogi) {
      let bolalar = b.children ?? []
      if (adminmi) bolalar = bolalar.filter(c => c.turi === 'maydon')
      if (q && !mos(b)) bolalar = bolalar.filter(mos)
      if (faqatOzgargan) bolalar = bolalar.filter(c => ozgarganmi(c.kalit))
      const bolimKorinadi = (!q || mos(b) || bolalar.length > 0) && (!faqatOzgargan || bolalar.length > 0 || (!adminmi && !b.doimOchiq && ozgarganmi(b.kalit)))
      if (!bolimKorinadi || (adminmi && bolalar.length === 0)) continue
      const { guruh } = navMalumoti(b.kalit)
      let g = natija.find(x => x.guruh === guruh)
      if (!g) { g = { guruh, bolimlar: [] }; natija.push(g) }
      g.bolimlar.push({ b, bolalar })
    }
    return natija
  }, [qidiruv, faqatOzgargan, adminmi, ozgarganmi])

  // Qoralama bo'yicha jonli xulosa
  const jonliXulosa = useMemo(() => {
    let bolim = 0, jamiBolim = 0, amal = 0, jamiAmal = 0, farq = 0, yashirin = 0
    for (const b of ruxsatKatalogi) {
      const bOchiq = b.doimOchiq || adminmi || qiymat(b.kalit)
      if (!b.doimOchiq) { jamiBolim++; if (bOchiq) bolim++; if (!adminmi && ozgarganmi(b.kalit)) farq++ }
      for (const c of b.children ?? []) {
        if (c.turi === 'maydon') { if (!qiymat(c.kalit)) { yashirin++; farq++ } continue }
        jamiAmal++
        if (bOchiq && (adminmi || qiymat(c.kalit))) amal++
        if (!adminmi && ozgarganmi(c.kalit)) farq++
      }
    }
    return { bolim, jamiBolim, amal, jamiAmal, farq, yashirin }
  }, [qiymat, adminmi, ozgarganmi])

  const nusxaNomzodlari = xodimlar.filter(x => x.id !== tafsilot?.xodim.id && (adminmi ? true : x.rol !== 'ADMIN'))

  const qidiruvBor = qidiruv.trim().length > 0 || faqatOzgargan

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end gap-2 sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <ShieldCheck size={22} className="text-primary" /> Ruxsatlar
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5 max-w-2xl">
            Har bir xodim uchun: qaysi bo‘limlar menyuda ko‘rinadi, bo‘lim ichida qaysi amallarni bajara oladi va qaysi ma’lumotlarni ko‘radi.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)] items-start">
        {/* ── Xodimlar ro'yxati ── */}
        <aside className={`${tanlanganId ? 'hidden lg:block' : ''} bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden lg:sticky lg:top-0`}>
          <div className="p-3 border-b border-gray-100 dark:border-neutral-800 space-y-2.5">
            <label className="relative block">
              <span className="sr-only">Xodimni qidirish</span>
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden />
              <input
                id="xodim-qidiruv" value={xodimQidiruv} onChange={e => setXodimQidiruv(e.target.value)} placeholder="Ism, login yoki filial" suppressHydrationWarning
                className="w-full pl-9 pr-3 py-2.5 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </label>
            <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5">
              {['HAMMASI', 'KASSIR', 'OMBORCHI', 'SOTUVCHI', 'DOSTAVCHIK', 'ADMIN'].filter(r => r === 'HAMMASI' || rolSonlari[r]).map(r => (
                <button
                  key={r} type="button" onClick={() => setRolFiltr(r)}
                  className={`shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${rolFiltr === r ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-neutral-800 dark:text-gray-300 dark:hover:bg-neutral-700'}`}
                >
                  {r === 'HAMMASI' ? 'Hammasi' : rolNomi(r)}
                  <span className="ml-1 tabular-nums opacity-60">{r === 'HAMMASI' ? xodimlar.length : rolSonlari[r]}</span>
                </button>
              ))}
            </div>
          </div>

          {royxatYuklanmoqda ? (
            <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin text-primary" /></div>
          ) : korinadiganXodimlar.length === 0 ? (
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-12 px-4">
              {xodimlar.length === 0 ? 'Hali xodim yo‘q. Xodimlar bo‘limidan qo‘shing.' : 'Qidiruv bo‘yicha xodim topilmadi'}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-neutral-800 max-h-none lg:max-h-[calc(100vh-15rem)] overflow-y-auto">
              {korinadiganXodimlar.map(x => {
                const faol = x.id === tanlanganId
                return (
                  <li key={x.id}>
                    <button
                      type="button" onClick={() => void xodimTanla(x.id)} aria-current={faol ? 'true' : undefined}
                      className={`w-full text-left px-3.5 py-3 flex items-start gap-3 transition focus:outline-none focus-visible:bg-gray-50 dark:focus-visible:bg-neutral-800 ${faol ? 'bg-red-50/70 dark:bg-red-950/20' : 'hover:bg-gray-50 dark:hover:bg-neutral-800/60'} ${x.faol ? '' : 'opacity-60'}`}
                    >
                      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${faol ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-gray-300'}`} aria-hidden>
                        {x.ism.trim().charAt(0).toUpperCase() || <UserRound size={16} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-gray-900 dark:text-gray-100 truncate">{x.ism}</span>
                          {x.ozim && <span className="text-[11px] text-gray-500 dark:text-gray-400">(siz)</span>}
                          {!x.faol && <span className="text-[11px] font-medium text-red-600 dark:text-red-400">nofaol</span>}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5 flex-wrap text-xs text-gray-500 dark:text-gray-400">
                          <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${ROL[x.rol]?.rang ?? 'bg-gray-100 text-gray-600'}`}>{rolNomi(x.rol)}{x.ulashilgan ? ' · ulashilgan' : ''}</span>
                          {x.filialNomi && <span className="truncate">{x.filialNomi}</span>}
                        </span>
                        <span className="mt-1.5 block text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                          {x.rol === 'ADMIN'
                            ? 'Barcha bo‘limlar ochiq'
                            : `${x.xulosa.bolimlar}/${x.xulosa.jamiBolim} bo‘lim · ${x.xulosa.amallar}/${x.xulosa.jamiAmal} amal`}
                          {x.xulosa.ozgartirilgan > 0 && (
                            <span className="ml-1.5 inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />{x.xulosa.ozgartirilgan} ta sozlangan
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>

        {/* ── Tahrirlagich ── */}
        <section className={`${tanlanganId ? '' : 'hidden lg:block'} min-w-0`} aria-label="Xodim ruxsatlari">
          {!tanlanganId ? (
            <SonggiOzgarishlar songgi={songgi} yuklanmoqda={royxatYuklanmoqda} />
          ) : !tafsilot ? (
            <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl flex justify-center py-20">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-3">
              {/* Sarlavha */}
              <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <button type="button" onClick={() => void xodimTanla(null)} className="lg:hidden -ml-1 p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-neutral-800" aria-label="Xodimlar ro‘yxatiga qaytish">
                    <ArrowLeft size={18} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">{tafsilot.xodim.ism}</h2>
                      <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${ROL[tafsilot.xodim.rol]?.rang ?? ''}`}>{rolNomi(tafsilot.xodim.rol)}</span>
                      {!tafsilot.xodim.faol && <span className="rounded-md px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-gray-400">Nofaol — tizimga kira olmaydi</span>}
                      {tafsilotYuklanmoqda && <Loader2 size={14} className="animate-spin text-gray-400" />}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      Login: <span className="font-mono">{tafsilot.xodim.login}</span>
                      {tafsilot.xodim.filialNomi && <> · {tafsilot.xodim.filialNomi}</>}
                    </p>
                  </div>
                </div>

                {!adminmi && (
                  <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { nomi: 'Bo‘limlar', qiymat: `${jonliXulosa.bolim}/${jonliXulosa.jamiBolim}` },
                      { nomi: 'Amallar', qiymat: `${jonliXulosa.amal}/${jonliXulosa.jamiAmal}` },
                      { nomi: 'Yashirin maydon', qiymat: String(jonliXulosa.yashirin) },
                      { nomi: 'Standartdan farq', qiymat: String(jonliXulosa.farq), ogoh: jonliXulosa.farq > 0 },
                    ].map(k => (
                      <div key={k.nomi} className="rounded-xl bg-gray-50 dark:bg-neutral-800/60 px-3 py-2">
                        <dt className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{k.nomi}</dt>
                        <dd className={`text-base font-semibold tabular-nums ${k.ogoh ? 'text-amber-700 dark:text-amber-400' : 'text-gray-900 dark:text-gray-100'}`}>{k.qiymat}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                {tafsilot.sabab && (
                  <p className={`mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm ${tafsilot.tahrirlanadi ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/30 dark:text-blue-300' : 'bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-gray-300'}`}>
                    {tafsilot.tahrirlanadi ? <Info size={16} className="mt-0.5 shrink-0" aria-hidden /> : <Lock size={16} className="mt-0.5 shrink-0" aria-hidden />}
                    {tafsilot.sabab}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <div className="flex rounded-xl bg-gray-100 dark:bg-neutral-800 p-1" role="tablist" aria-label="Ko‘rinish">
                    {([['ruxsatlar', 'Ruxsatlar', ShieldCheck], ['tarix', 'O‘zgarishlar tarixi', History]] as const).map(([k, nomi, Icon]) => (
                      <button
                        key={k} type="button" role="tab" aria-selected={oyna === k} onClick={() => setOyna(k)}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${oyna === k ? 'bg-white text-gray-900 shadow-sm dark:bg-neutral-700 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'}`}
                      >
                        <Icon size={14} aria-hidden /> {nomi}
                        {k === 'tarix' && tafsilot.jurnal.length > 0 && <span className="tabular-nums text-xs opacity-60">{tafsilot.jurnal.length}</span>}
                      </button>
                    ))}
                  </div>
                  {tafsilot.tahrirlanadi && (
                    <div className="flex flex-wrap gap-2 sm:ml-auto">
                      <div className="relative">
                        <button
                          type="button" onClick={() => setNusxaOchiq(v => !v)} disabled={saqlanmoqda || nusxaNomzodlari.length === 0} aria-expanded={nusxaOchiq}
                          className="flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-neutral-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-50"
                        >
                          <Copy size={14} aria-hidden /> Nusxa olish
                        </button>
                        {nusxaOchiq && (
                          <div className="absolute right-0 sm:right-auto sm:left-0 z-20 mt-1 w-72 max-w-[calc(100vw-2.5rem)] rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg">
                            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-neutral-800">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Kimning ruxsatlari ko‘chirilsin?</span>
                              <button type="button" onClick={() => setNusxaOchiq(false)} className="p-1 text-gray-400 hover:text-gray-600" aria-label="Yopish"><X size={14} /></button>
                            </div>
                            <ul className="max-h-64 overflow-y-auto py-1">
                              {nusxaNomzodlari.map(m => (
                                <li key={m.id}>
                                  <button type="button" onClick={() => void nusxaOl(m)} className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-neutral-800 flex items-center justify-between gap-2">
                                    <span className="min-w-0">
                                      <span className="block truncate text-sm text-gray-900 dark:text-gray-100">{m.ism}</span>
                                      <span className="block text-xs text-gray-500 dark:text-gray-400">{rolNomi(m.rol)}{m.rol !== 'ADMIN' && ` · ${m.xulosa.bolimlar} bo‘lim`}</span>
                                    </span>
                                    {m.rol !== tafsilot.xodim.rol && <span className="shrink-0 text-[11px] text-amber-700 dark:text-amber-400">boshqa rol</span>}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      <button
                        type="button" onClick={() => void standartgaQaytar()} disabled={saqlanmoqda}
                        className="flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-neutral-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-50"
                      >
                        <RotateCcw size={14} aria-hidden /> Rol standarti
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {oyna === 'tarix' ? (
                <Jurnal qatorlar={tafsilot.jurnal} bittaXodim />
              ) : (
                <>
                  {/* Qidiruv */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <label className="relative flex-1">
                      <span className="sr-only">Ruxsatni qidirish</span>
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden />
                      <input
                        id="ruxsat-qidiruv" value={qidiruv} onChange={e => setQidiruv(e.target.value)} placeholder="Masalan: chegirma, o‘chirish, eksport" suppressHydrationWarning
                        className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </label>
                    <button
                      type="button" onClick={() => setFaqatOzgargan(v => !v)} aria-pressed={faqatOzgargan}
                      className={`shrink-0 rounded-xl px-3.5 py-2.5 text-sm font-medium transition border ${faqatOzgargan ? 'bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300' : 'bg-white border-gray-200 text-gray-700 dark:bg-neutral-900 dark:border-neutral-800 dark:text-gray-300'}`}
                    >
                      Faqat standartdan farqlilar
                    </button>
                  </div>

                  {guruhlar.length === 0 && (
                    <p className="rounded-2xl border border-dashed border-gray-300 dark:border-neutral-700 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                      {faqatOzgargan ? 'Barcha ruxsatlar rol standartida' : 'Hech narsa topilmadi'}
                    </p>
                  )}

                  {guruhlar.map(g => (
                    <div key={g.guruh} className="space-y-2">
                      <h3 className="px-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{GURUH_NOMI[g.guruh] ?? g.guruh}</h3>
                      {g.bolimlar.map(({ b, bolalar }) => {
                        const { icon: Icon } = navMalumoti(b.kalit)
                        const bOchiq = !!b.doimOchiq || adminmi || qiymat(b.kalit)
                        const amallar = (b.children ?? []).filter(c => (c.turi ?? 'amal') === 'amal')
                        const ochiqAmal = amallar.filter(c => qiymat(c.kalit)).length
                        const kengaygan = qidiruvBor || ochiqBolimlar.has(b.kalit)
                        const bolimFarq = !adminmi && !b.doimOchiq && ozgarganmi(b.kalit)
                        const ichidaFarq = (b.children ?? []).some(c => (adminmi ? c.turi === 'maydon' : true) && ozgarganmi(c.kalit))
                        const qoralamada = [b.kalit, ...(b.children ?? []).map(c => c.kalit)].some(k => k in qoralama)
                        return (
                          <div key={b.kalit} className={`bg-white dark:bg-neutral-900 border rounded-2xl overflow-hidden ${qoralamada ? 'border-amber-300 dark:border-amber-800' : 'border-gray-200 dark:border-neutral-800'}`}>
                            <div className="flex items-center gap-3 px-3.5 py-3">
                              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${bOchiq ? 'bg-red-50 text-primary dark:bg-red-950/30' : 'bg-gray-100 text-gray-400 dark:bg-neutral-800'}`} aria-hidden>
                                <Icon size={18} />
                              </span>
                              <button
                                type="button"
                                onClick={() => setOchiqBolimlar(s => { const n = new Set(s); if (n.has(b.kalit)) n.delete(b.kalit); else n.add(b.kalit); return n })}
                                aria-expanded={kengaygan} disabled={bolalar.length === 0 || qidiruvBor}
                                className="min-w-0 flex-1 text-left disabled:cursor-default"
                              >
                                <span className="flex items-center gap-2 flex-wrap">
                                  <span className={`font-medium ${bOchiq ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>{b.label}</span>
                                  {(bolimFarq || ichidaFarq) && <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-400">sozlangan</span>}
                                </span>
                                <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                  {b.doimOchiq ? b.izoh : adminmi ? 'Administratorga doim ochiq'
                                    : !bOchiq ? 'Menyuda ko‘rinmaydi'
                                    : amallar.length ? `${ochiqAmal} / ${amallar.length} amal ruxsat etilgan` : 'Menyuda ko‘rinadi'}
                                </span>
                              </button>
                              {bolalar.length > 0 && !qidiruvBor && (
                                <span className="shrink-0 text-gray-400" aria-hidden>
                                  <ChevronDown size={18} className={`transition-transform ${kengaygan ? 'rotate-180' : ''}`} />
                                </span>
                              )}
                              {!b.doimOchiq && !adminmi && (
                                <Almashtirgich yoniq={qiymat(b.kalit)} onChange={() => almashtir(b.kalit)} disabled={!tahrirlanadi} label={`${b.label} bo‘limi`} />
                              )}
                            </div>

                            {kengaygan && bolalar.length > 0 && (
                              <div className="border-t border-gray-100 dark:border-neutral-800 bg-gray-50/60 dark:bg-neutral-950/30">
                                {!bOchiq && (
                                  <p className="flex items-center gap-2 px-4 pt-3 text-xs text-gray-500 dark:text-gray-400">
                                    <Lock size={12} aria-hidden /> Bo‘lim yopiq — quyidagilar u ochilgandagina ishlaydi
                                  </p>
                                )}
                                {tahrirlanadi && !adminmi && amallar.length > 1 && (
                                  <div className="flex gap-3 px-4 pt-2.5 text-xs">
                                    <button type="button" onClick={() => bolimAmallariniOrnat(b, true)} className="font-medium text-primary hover:underline">Barcha amallarni ochish</button>
                                    <button type="button" onClick={() => bolimAmallariniOrnat(b, false)} className="font-medium text-gray-600 dark:text-gray-400 hover:underline">Hammasini yopish</button>
                                  </div>
                                )}
                                <ul className="divide-y divide-gray-100 dark:divide-neutral-800">
                                  {bolalar.map(c => {
                                    const maydonmi = c.turi === 'maydon'
                                    const v = qiymat(c.kalit)
                                    const farq = ozgarganmi(c.kalit)
                                    const ishlaydi = bOchiq && v
                                    return (
                                      <li key={c.kalit} className={`flex items-start gap-3 px-4 py-3 ${c.kalit in qoralama ? 'bg-amber-50/60 dark:bg-amber-950/10' : ''}`}>
                                        <span className="mt-0.5 shrink-0 text-gray-400" aria-hidden>
                                          {maydonmi ? (v ? <Eye size={16} /> : <EyeOff size={16} />) : c.xavfli ? <AlertTriangle size={16} className="text-amber-500" /> : <Check size={16} className={ishlaydi ? 'text-emerald-500' : ''} />}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                          <p className={`text-sm ${ishlaydi || (maydonmi && v) ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>
                                            {c.label}
                                            {maydonmi && <span className="ml-1.5 rounded bg-gray-200/70 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-600 dark:bg-neutral-800 dark:text-gray-400">maydon</span>}
                                            {c.xavfli && <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:bg-amber-950/50 dark:text-amber-400">xavfli</span>}
                                          </p>
                                          {c.izoh && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{c.izoh}</p>}
                                          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                                            <span>Standart: {standart(c.kalit) ? 'ochiq' : 'yopiq'}</span>
                                            {farq && tahrirlanadi && (
                                              <button type="button" onClick={() => almashtir(c.kalit, standart(c.kalit))} className="inline-flex items-center gap-1 font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200">
                                                <RotateCcw size={11} aria-hidden /> <span>standartga</span>
                                              </button>
                                            )}
                                          </p>
                                        </div>
                                        <Almashtirgich yoniq={v} onChange={() => almashtir(c.kalit)} disabled={!tahrirlanadi} label={`${b.label}: ${c.label}`} />
                                      </li>
                                    )
                                  })}
                                </ul>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))}

                  {/* Ulashilgan administrator — Ega katalogidagi huquqlar */}
                  {tafsilot.tovarBayroqlari && !qidiruvBor && (
                    <div className="space-y-2">
                      <h3 className="px-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Ulashilgan katalog</h3>
                      <ul className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl divide-y divide-gray-100 dark:divide-neutral-800">
                        {ULASHISH.map(u => (
                          <li key={u.kalit} className={`flex items-start gap-3 px-4 py-3 ${u.kalit in qoralama ? 'bg-amber-50/60 dark:bg-amber-950/10' : ''}`}>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-gray-900 dark:text-gray-100">
                                {u.label}
                                {u.xavfli && <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:bg-amber-950/50 dark:text-amber-400">xavfli</span>}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{u.izoh}</p>
                            </div>
                            <Almashtirgich yoniq={qiymat(u.kalit)} onChange={() => almashtir(u.kalit)} disabled={!tahrirlanadi} label={u.label} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Saqlash paneli */}
                  {ozgarishSoni > 0 && (
                    <div className="sticky bottom-20 lg:bottom-0 z-10 pt-2">
                      <div className="flex items-center gap-3 rounded-2xl border border-gray-200 dark:border-neutral-700 bg-white/95 dark:bg-neutral-900/95 backdrop-blur px-4 py-3 shadow-lg">
                        <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-amber-100 px-2 text-sm font-semibold tabular-nums text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">{ozgarishSoni}</span>
                        <p className="min-w-0 flex-1 text-sm text-gray-700 dark:text-gray-300">
                          <span className="font-medium">Saqlanmagan o‘zgarish</span>
                          <span className="hidden sm:inline text-gray-500 dark:text-gray-400"> · xodimda 30 soniya ichida kuchga kiradi</span>
                        </p>
                        <button type="button" onClick={() => setQoralama({})} disabled={saqlanmoqda} className="rounded-xl px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-neutral-800 disabled:opacity-50">
                          Bekor
                        </button>
                        <button type="button" onClick={() => void saqla()} disabled={saqlanmoqda} className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60">
                          {saqlanmoqda ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Saqlash
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function Jurnal({ qatorlar, bittaXodim }: { qatorlar: JurnalQator[]; bittaXodim?: boolean }) {
  if (qatorlar.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-gray-300 dark:border-neutral-700 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
        Hali o‘zgarish qilinmagan — barcha ruxsatlar rol standartida yoki bu bo‘lim ishga tushishidan oldin sozlangan.
      </p>
    )
  }
  return (
    <ul className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl divide-y divide-gray-100 dark:divide-neutral-800">
      {qatorlar.map(j => (
        <li key={j.id} className="flex items-start gap-3 px-4 py-3">
          <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${j.yangi ? 'bg-emerald-500' : 'bg-gray-400'}`} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-gray-900 dark:text-gray-100">
              {!bittaXodim && <span className="font-medium">{j.foydalanuvchiIsm}: </span>}
              {kalitNomi(j.kalit)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              <span className={j.eski ? 'text-emerald-700 dark:text-emerald-400' : ''}>{j.eski ? 'ochiq' : 'yopiq'}</span>
              {' → '}
              <span className={`font-medium ${j.yangi ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'}`}>{j.yangi ? 'ochiq' : 'yopiq'}</span>
              {' · '}{j.ozgartiruvchiIsm}{j.sabab !== 'QOLDA' && ` · ${SABAB[j.sabab] ?? j.sabab}`}
            </p>
          </div>
          <time className="shrink-0 text-xs text-gray-400 tabular-nums" dateTime={j.sana}>{formatSanaVaVaqt(j.sana)}</time>
        </li>
      ))}
    </ul>
  )
}

function SonggiOzgarishlar({ songgi, yuklanmoqda }: { songgi: JurnalQator[]; yuklanmoqda: boolean }) {
  return (
    <div className="space-y-3">
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">Xodimni tanlang</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-xl">
          Chapdagi ro‘yxatdan xodimni tanlab, uning ruxsatlarini sozlang. Ruxsatlar uch darajada boshqariladi:
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-3 text-sm">
          <li className="rounded-xl bg-gray-50 dark:bg-neutral-800/60 p-3">
            <p className="font-medium text-gray-900 dark:text-gray-100">Bo‘lim</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Menyuda ko‘rinadimi. Yopilsa sahifa ham, uning ma’lumotlari ham yopiladi.</p>
          </li>
          <li className="rounded-xl bg-gray-50 dark:bg-neutral-800/60 p-3">
            <p className="font-medium text-gray-900 dark:text-gray-100">Amal</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Bo‘lim ichida nima qila oladi: qo‘shish, o‘chirish, chegirma, eksport.</p>
          </li>
          <li className="rounded-xl bg-gray-50 dark:bg-neutral-800/60 p-3">
            <p className="font-medium text-gray-900 dark:text-gray-100">Maydon</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Qaysi ma’lumotni ko‘radi — masalan kelish narxi.</p>
          </li>
        </ul>
      </div>
      <h3 className="px-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">So‘nggi o‘zgarishlar</h3>
      {yuklanmoqda ? <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-primary" /></div> : <Jurnal qatorlar={songgi} />}
    </div>
  )
}
