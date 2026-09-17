'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  UsersRound, Plus, Loader2, X, Search, Wallet, Gift, Check,
  Phone, Building, ShieldCheck, Banknote, Trash2, History, Package, ShoppingBag, LayoutDashboard,
} from 'lucide-react'
import { formatSum, formatPhone, formatSanaVaVaqt, uzSearch } from '@/lib/utils'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { useConfirm } from '@/components/ConfirmProvider'
import { XaritadaKorish } from '@/components/LokatsiyaModal'
import XodimMulkPanel from '@/components/xodim/XodimMulkPanel'
import XodimSotuvlarPanel from '@/components/xodim/XodimSotuvlarPanel'
import XodimUmumiyPanel, { type XodimTafsiloti } from '@/components/xodim/XodimUmumiyPanel'
import {
  TOLOV_TURLARI, TOLOV_MALUMOTI, tolovMalumoti, davrKaliti,
  type DavrYigindisi, type TolovTuri,
} from '@/lib/xodim-oylik'

interface Filial { id: string; nomi: string }

interface Xodim {
  id: string
  ism: string
  login: string
  rol: string
  faol: boolean
  telefon: string | null
  oylikMaosh: number | null
  filialId: string | null
  filial: Filial | null
  davrYigindisi: DavrYigindisi
  /** Oxirgi ma'lum joylashuv — kartadagi "Xaritada" tugmasi uchun. */
  lokatsiyaLat: number | null
  lokatsiyaLng: number | null
  lokatsiyaYangilangan: string | null
  /** Hozir qo'lidagi biriktirilgan mulk */
  mulk: { soni: number; qiymati: number }
  /** Tanlangan davrdagi sotuvlari — ko'rish ruxsati bo'lmasa `null` */
  davrSotuv: { soni: number; summa: number } | null
}

interface Tolov {
  id: string
  turi: string
  summa: number
  davr: string | null
  izoh: string | null
  sana: string
  yaratgan: { ism: string } | null
}

const ROLLAR = ['ADMIN', 'KASSIR', 'OMBORCHI', 'SOTUVCHI', 'DOSTAVCHIK'] as const
const ROL_RANG: Record<string, string> = {
  ADMIN: 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400',
  KASSIR: 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400',
  OMBORCHI: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400',
  SOTUVCHI: 'bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400',
  DOSTAVCHIK: 'bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400',
}

const inputCls =
  'w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500'

const boshForma = {
  ism: '', login: '', parol: '', rol: 'KASSIR', telefon: '', filialId: '', oylikMaosh: '',
}

/** Oxirgi 12 oyning "YYYY-MM" kalitlari. */
function oxirgiDavrlar(): string[] {
  const r: string[] = []
  const d = new Date()
  for (let i = 0; i < 12; i++) {
    r.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    d.setMonth(d.getMonth() - 1)
  }
  return r
}

export default function XodimlarPage() {
  const confirm = useConfirm()
  const [xodimlar, setXodimlar] = useState<Xodim[]>([])
  const [filiallar, setFiliallar] = useState<Filial[]>([])
  const [boshqaraOladi, setBoshqaraOladi] = useState(false)
  const [oylikBeraOladi, setOylikBeraOladi] = useState(false)
  const [meId, setMeId] = useState<string | null>(null)
  const [adminmi, setAdminmi] = useState(false)
  const [yuklanmoqda, setYuklanmoqda] = useState(true)
  const [davr, setDavr] = useState(davrKaliti())
  const [qidiruv, setQidiruv] = useState('')

  const [yangiModal, setYangiModal] = useState(false)
  const [forma, setForma] = useState(boshForma)
  const [saqlanmoqda, setSaqlanmoqda] = useState(false)

  // Tanlangan xodim — oylik belgilash va to'lov qo'shish oynasi
  const [tanlangan, setTanlangan] = useState<Xodim | null>(null)
  const [tolovlar, setTolovlar] = useState<Tolov[]>([])
  const [tarixYuklanmoqda, setTarixYuklanmoqda] = useState(false)
  const [maoshMatn, setMaoshMatn] = useState('')
  const [tolovTuri, setTolovTuri] = useState<TolovTuri>('OYLIK')
  const [tolovSumma, setTolovSumma] = useState('')
  const [tolovIzoh, setTolovIzoh] = useState('')
  const [amalda, setAmalda] = useState(false)
  // Xodim oynasidagi varaq
  const [varaq, setVaraq] = useState<'umumiy' | 'oylik' | 'mulk' | 'sotuvlar'>('umumiy')
  // Oynadagi "Umumiy" varaq ma'lumoti: joylashuv, sotuvlar xulosasi, qo'lidagi mulk
  const [tafsilot, setTafsilot] = useState<XodimTafsiloti | null>(null)
  const [sotuvlarKoraOladi, setSotuvlarKoraOladi] = useState(false)

  useBodyScrollLock(yangiModal || !!tanlangan)

  const yukla = useCallback(async () => {
    setYuklanmoqda(true)
    try {
      const r = await fetch(`/api/xodimlar?davr=${davr}`)
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.xato || "Ma'lumot yuklanmadi"); return }
      setXodimlar(j.xodimlar ?? [])
      setFiliallar(j.filiallar ?? [])
      setBoshqaraOladi(!!j.boshqaraOladi)
      setOylikBeraOladi(!!j.oylikBeraOladi)
      setSotuvlarKoraOladi(!!j.sotuvlarKoraOladi)
      setMeId(j.meId ?? null)
      setAdminmi(!!j.adminmi)
    } catch {
      toast.error('Tarmoq xatosi')
    } finally {
      setYuklanmoqda(false)
    }
  }, [davr])

  useEffect(() => { void yukla() }, [yukla])

  const korinadigan = useMemo(() => {
    if (!qidiruv.trim()) return xodimlar
    return xodimlar.filter(x =>
      uzSearch(x.ism, qidiruv) || x.login.includes(qidiruv.trim()) ||
      (x.telefon ?? '').includes(qidiruv.trim()))
  }, [xodimlar, qidiruv])

  const jami = useMemo(() => {
    const y = { maosh: 0, tolangan: 0, bonus: 0, jarima: 0, mulk: 0, sotuv: 0 }
    for (const x of xodimlar) {
      if (x.faol) y.maosh += x.oylikMaosh ?? 0
      y.tolangan += x.davrYigindisi.sof
      y.bonus += x.davrYigindisi.BONUS
      y.jarima += x.davrYigindisi.JARIMA
      y.mulk += x.mulk?.soni ?? 0
      y.sotuv += x.davrSotuv?.summa ?? 0
    }
    return y
  }, [xodimlar])

  async function xodimOch(x: Xodim, boshVaraq: 'umumiy' | 'oylik' | 'mulk' | 'sotuvlar' = 'umumiy') {
    setTanlangan(x)
    setVaraq(boshVaraq)
    setTafsilot(null)
    setMaoshMatn(x.oylikMaosh ? String(x.oylikMaosh) : '')
    setTolovTuri('OYLIK')
    setTolovSumma(x.oylikMaosh ? String(x.oylikMaosh) : '')
    setTolovIzoh('')
    setTolovlar([])
    setTarixYuklanmoqda(true)
    try {
      const r = await fetch(`/api/xodimlar/${x.id}?davr=${encodeURIComponent(davr)}`, { cache: 'no-store' })
      const j = await r.json().catch(() => ({}))
      if (r.ok) {
        setTolovlar(j.tolovlar ?? [])
        setTafsilot({ xodim: j.xodim, sotuvXulosa: j.sotuvXulosa ?? null, qolidagiMulk: j.qolidagiMulk ?? [] })
      }
    } finally {
      setTarixYuklanmoqda(false)
    }
  }

  async function yangiXodim(e: React.FormEvent) {
    e.preventDefault()
    setSaqlanmoqda(true)
    try {
      const r = await fetch('/api/xodimlar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(forma),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.xato || 'Xatolik'); return }
      toast.success(`"${j.ism}" qo‘shildi`)
      setYangiModal(false)
      setForma(boshForma)
      void yukla()
    } catch {
      toast.error('Tarmoq xatosi')
    } finally {
      setSaqlanmoqda(false)
    }
  }

  async function maoshSaqla() {
    if (!tanlangan) return
    setAmalda(true)
    try {
      const r = await fetch(`/api/xodimlar/${tanlangan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oylikMaosh: maoshMatn === '' ? null : Number(maoshMatn) }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.xato || 'Saqlanmadi'); return }
      toast.success('Oylik belgilandi')
      setTanlangan(t => t ? { ...t, oylikMaosh: j.oylikMaosh } : t)
      void yukla()
    } catch {
      toast.error('Tarmoq xatosi')
    } finally {
      setAmalda(false)
    }
  }

  async function tolovQosh() {
    if (!tanlangan) return
    const summa = Number(tolovSumma)
    if (!Number.isFinite(summa) || summa <= 0) { toast.error('Summani kiriting'); return }
    setAmalda(true)
    try {
      const r = await fetch(`/api/xodimlar/${tanlangan.id}/tolov`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turi: tolovTuri, summa, davr, izoh: tolovIzoh.trim() || null }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.xato || 'Qo‘shilmadi'); return }
      toast.success(`${tolovMalumoti(tolovTuri).label} qo‘shildi`)
      setTolovlar(p => [j, ...p])
      setTolovSumma('')
      setTolovIzoh('')
      void yukla()
    } catch {
      toast.error('Tarmoq xatosi')
    } finally {
      setAmalda(false)
    }
  }

  async function tolovOchir(t: Tolov) {
    if (!tanlangan) return
    const ok = await confirm({
      title: 'To‘lovni bekor qilish',
      message: `${tolovMalumoti(t.turi).label} — ${formatSum(t.summa)}. Bog‘langan xarajat yozuvi ham o‘chiriladi.`,
      confirmText: 'Bekor qilish',
      danger: true,
    })
    if (!ok) return
    setAmalda(true)
    try {
      const r = await fetch(`/api/xodimlar/${tanlangan.id}/tolov?tolovId=${t.id}`, { method: 'DELETE' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.xato || 'O‘chirilmadi'); return }
      toast.success('Bekor qilindi')
      setTolovlar(p => p.filter(x => x.id !== t.id))
      void yukla()
    } finally {
      setAmalda(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Sarlavha */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <UsersRound size={22} className="text-primary" />
            Xodimlar
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
            Oylik, biriktirilgan mulk va kimga nima sotgani
          </p>
        </div>
        {boshqaraOladi && (
          <button
            onClick={() => { setForma(boshForma); setYangiModal(true) }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90 transition"
          >
            <Plus size={16} /> Yangi xodim
          </button>
        )}
      </div>

      {/* Filtrlar */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={davr}
          onChange={e => setDavr(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          {oxirgiDavrlar().map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={qidiruv}
            onChange={e => setQidiruv(e.target.value)}
            placeholder="Ism, login yoki telefon..."
            className={`${inputCls} pl-9`}
          />
        </div>
      </div>

      {yuklanmoqda ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-primary" /></div>
      ) : (
        <>
          {/* Yakuniy raqamlar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Karta belgi={<UsersRound size={13} className="text-primary" />} sarlavha="Xodimlar"
              qiymat={String(xodimlar.filter(x => x.faol).length)}
              izoh={`${xodimlar.length} ta jami${jami.mulk ? ` · ${jami.mulk} ta mulk qo‘lida` : ''}`} />
            <Karta belgi={<Banknote size={13} className="text-gray-500" />} sarlavha="Belgilangan oylik"
              qiymat={formatSum(jami.maosh)} izoh="faol xodimlar bo'yicha" />
            <Karta belgi={<Wallet size={13} className="text-green-600" />} sarlavha={`To'langan (${davr})`}
              qiymat={formatSum(jami.tolangan)} rang="text-green-600" izoh="jarima ayrilgan" />
            <Karta belgi={<Gift size={13} className="text-blue-600" />} sarlavha="Bonus"
              qiymat={formatSum(jami.bonus)} rang="text-blue-600"
              izoh={jami.jarima > 0 ? `jarima ${formatSum(jami.jarima)}` : 'shu davrda'} />
          </div>

          {/* Ro'yxat */}
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
            {korinadigan.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {qidiruv ? 'Shu nom bo\'yicha xodim topilmadi' : 'Hali xodim qo\'shilmagan'}
                </p>
                {qidiruv ? (
                  <button
                    onClick={() => setQidiruv('')}
                    className="mt-3 px-4 py-2 rounded-xl border border-gray-300 dark:border-neutral-700 text-sm text-gray-600 dark:text-gray-400 hover:border-primary/50 hover:text-primary transition"
                  >
                    Qidiruvni tozalash
                  </button>
                ) : boshqaraOladi ? (
                  <button
                    onClick={() => { setForma(boshForma); setYangiModal(true) }}
                    className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90 transition"
                  >
                    <Plus size={15} /> Birinchi xodimni qo&apos;shish
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-neutral-800/60">
                    <tr>
                      <th className="text-left text-gray-500 dark:text-gray-400 text-xs font-medium px-4 py-2.5">Xodim</th>
                      <th className="text-left text-gray-500 dark:text-gray-400 text-xs font-medium px-4 py-2.5 hidden sm:table-cell">Rol</th>
                      <th className="text-right text-gray-500 dark:text-gray-400 text-xs font-medium px-4 py-2.5 whitespace-nowrap">Oylik</th>
                      <th className="text-right text-gray-500 dark:text-gray-400 text-xs font-medium px-4 py-2.5 whitespace-nowrap">To&apos;langan</th>
                      <th className="text-right text-gray-500 dark:text-gray-400 text-xs font-medium px-4 py-2.5 whitespace-nowrap">Qoldi</th>
                      {sotuvlarKoraOladi && (
                        <th className="text-right text-gray-500 dark:text-gray-400 text-xs font-medium px-4 py-2.5 whitespace-nowrap hidden md:table-cell">Sotuv ({davr})</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                    {korinadigan.map(x => {
                      const qoldi = (x.oylikMaosh ?? 0) - x.davrYigindisi.sof
                      return (
                        <tr
                          key={x.id}
                          onClick={() => void xodimOch(x)}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void xodimOch(x) } }}
                          tabIndex={0}
                          role="button"
                          title="Batafsil: oylik, biriktirilgan mulk, sotuvlar"
                          className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800/40 transition ${x.faol ? '' : 'opacity-50'}`}
                        >
                          <td className="px-4 py-2.5">
                            <p className="text-gray-900 dark:text-gray-100 font-medium truncate">{x.ism}</p>
                            <p className="text-gray-500 dark:text-gray-400 text-[11px] flex items-center gap-2 flex-wrap">
                              <span>@{x.login}</span>
                              {x.telefon && <span className="flex items-center gap-1"><Phone size={9} />{formatPhone(x.telefon)}</span>}
                              {x.filial && <span className="flex items-center gap-1"><Building size={9} />{x.filial.nomi}</span>}
                              {!x.faol && <span className="text-red-500">nofaol</span>}
                              {x.mulk?.soni > 0 && (
                                <button type="button" onClick={e => { e.stopPropagation(); void xodimOch(x, 'mulk') }}
                                  className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-400 hover:underline"
                                  title="Biriktirilgan mulk">
                                  <Package size={10} aria-hidden />{x.mulk.soni} ta mulk
                                </button>
                              )}
                              {/* Qator bosilsa oylik oynasi ochiladi — shuning
                                  uchun tugma bosilishini to'xtatadi (komponent ichida). */}
                              <XaritadaKorish
                                nomi={x.ism}
                                tavsif={[x.rol, x.filial?.nomi ?? 'Markaziy'].join(' · ')}
                                lat={x.lokatsiyaLat} lng={x.lokatsiyaLng}
                                turi="xodim" matnBilan
                              />
                            </p>
                          </td>
                          <td className="px-4 py-2.5 hidden sm:table-cell">
                            <span className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${ROL_RANG[x.rol] ?? ''}`}>
                              {x.rol}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono tabular-nums text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            {x.oylikMaosh ? formatSum(x.oylikMaosh) : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-green-600 whitespace-nowrap">
                            {x.davrYigindisi.sof > 0 ? formatSum(x.davrYigindisi.sof) : '—'}
                          </td>
                          <td className={`px-4 py-2.5 text-right font-mono tabular-nums whitespace-nowrap ${
                            !x.oylikMaosh ? 'text-gray-500 dark:text-gray-400'
                              : qoldi > 0 ? 'text-amber-600' : 'text-green-600'
                          }`}>
                            {!x.oylikMaosh ? '—' : qoldi > 0 ? formatSum(qoldi) : 'To‘liq'}
                          </td>
                          {sotuvlarKoraOladi && (
                            <td className="px-4 py-2.5 text-right whitespace-nowrap hidden md:table-cell">
                              {x.davrSotuv && x.davrSotuv.soni > 0 ? (
                                <button type="button" onClick={e => { e.stopPropagation(); void xodimOch(x, 'sotuvlar') }} className="text-right hover:underline" title="Kimga nima sotganini ko‘rish">
                                  <span className="block font-mono tabular-nums font-semibold text-gray-900 dark:text-gray-100">{formatSum(x.davrSotuv.summa)}</span>
                                  <span className="block text-[11px] text-gray-500">{x.davrSotuv.soni} ta chek</span>
                                </button>
                              ) : <span className="text-gray-400">—</span>}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Yangi xodim ── */}
      {yangiModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={() => setYangiModal(false)}>
          <form
            onSubmit={yangiXodim}
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-neutral-900 rounded-t-2xl sm:rounded-2xl shadow-xl dark:border dark:border-neutral-800 w-full max-w-md max-h-[92dvh] flex flex-col"
          >
            <div className="p-4 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-gray-900 dark:text-gray-100 font-semibold">Yangi xodim</h3>
              <button type="button" onClick={() => setYangiModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              <Maydon label="Ism *">
                <input value={forma.ism} onChange={e => setForma(f => ({ ...f, ism: e.target.value }))}
                  required placeholder="Aziz Karimov" className={inputCls} />
              </Maydon>
              <div className="grid grid-cols-2 gap-3">
                <Maydon label="Login *">
                  <input value={forma.login} onChange={e => setForma(f => ({ ...f, login: e.target.value }))}
                    required minLength={3} placeholder="aziz" className={inputCls} />
                </Maydon>
                <Maydon label="Parol *" izoh="kamida 6 belgi">
                  <input type="text" value={forma.parol} onChange={e => setForma(f => ({ ...f, parol: e.target.value }))}
                    required minLength={6} placeholder="••••••" className={inputCls} />
                </Maydon>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Maydon label="Rol">
                  <select value={forma.rol} onChange={e => setForma(f => ({ ...f, rol: e.target.value }))} className={inputCls}>
                    {/* Administrator hisobini faqat administrator yaratadi (server ham tekshiradi) */}
                    {ROLLAR.filter(r => adminmi || r !== 'ADMIN').map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </Maydon>
                <Maydon label="Telefon">
                  <input value={forma.telefon} onChange={e => setForma(f => ({ ...f, telefon: e.target.value }))}
                    inputMode="numeric" placeholder="901234567" className={inputCls} />
                </Maydon>
              </div>
              {filiallar.length > 0 && (
                <Maydon label="Filial" izoh={forma.rol === 'ADMIN' ? 'ADMIN uchun ixtiyoriy' : 'majburiy'}>
                  <select value={forma.filialId} onChange={e => setForma(f => ({ ...f, filialId: e.target.value }))} className={inputCls}>
                    <option value="">Tanlanmagan</option>
                    {filiallar.map(f => <option key={f.id} value={f.id}>{f.nomi}</option>)}
                  </select>
                </Maydon>
              )}
              {oylikBeraOladi && (
                <Maydon label="Oylik maosh" izoh="keyin ham belgilash mumkin">
                  <input value={forma.oylikMaosh} onChange={e => setForma(f => ({ ...f, oylikMaosh: e.target.value }))}
                    inputMode="numeric" placeholder="3000000" className={inputCls} />
                </Maydon>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-neutral-800 flex gap-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">
              <button type="submit" disabled={saqlanmoqda}
                className="flex-1 py-2.5 bg-primary text-white rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                {saqlanmoqda ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                Qo&apos;shish
              </button>
              <button type="button" onClick={() => setYangiModal(false)}
                className="px-5 py-2.5 border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400 rounded-xl font-medium">
                Bekor
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Xodim: oylik va to'lovlar ── */}
      {tanlangan && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={() => setTanlangan(null)}>
          <div onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-neutral-900 rounded-t-2xl sm:rounded-2xl shadow-xl dark:border dark:border-neutral-800 w-full sm:max-w-2xl max-h-[92dvh] flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-neutral-800 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-gray-900 dark:text-gray-100 font-semibold truncate">{tanlangan.ism}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-xs flex items-center gap-2 flex-wrap mt-0.5">
                  <span className={`text-[11px] px-2 py-0.5 rounded-md ${ROL_RANG[tanlangan.rol] ?? ''}`}>{tanlangan.rol}</span>
                  <span className="flex items-center gap-1"><ShieldCheck size={10} />@{tanlangan.login}</span>
                  {tanlangan.filial && <span className="flex items-center gap-1"><Building size={10} />{tanlangan.filial.nomi}</span>}
                </p>
              </div>
              <button onClick={() => setTanlangan(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition shrink-0">
                <X size={18} />
              </button>
            </div>

            <div className="px-4 pt-3 shrink-0">
              <div className="flex rounded-xl bg-gray-100 dark:bg-neutral-800 p-1 gap-1" role="tablist" aria-label="Xodim ma’lumotlari">
                {([
                  ['umumiy', 'Umumiy', 'Umumiy', LayoutDashboard, null],
                  ['oylik', 'Oylik', 'Oylik', Wallet, null],
                  ['mulk', 'Biriktirilgan mulk', 'Mulk', Package, tanlangan.mulk?.soni || null],
                  ...(sotuvlarKoraOladi ? [['sotuvlar', 'Sotuvlar', 'Sotuvlar', ShoppingBag, null] as const] : []),
                ] as const).map(([k, nomi, qisqa, Belgi, son]) => (
                  <button
                    key={k} type="button" role="tab" aria-selected={varaq === k} onClick={() => setVaraq(k)}
                    className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs sm:text-sm font-medium transition ${
                      varaq === k ? 'bg-white dark:bg-neutral-700 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    <Belgi size={14} className="shrink-0" aria-hidden />
                    <span className="truncate sm:hidden">{qisqa}</span>
                    <span className="truncate hidden sm:inline">{nomi}</span>
                    {son ? <span className="rounded-full bg-emerald-600 text-white text-[10px] px-1.5 tabular-nums">{son}</span> : null}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-4">
              {varaq === 'umumiy' && (
                <XodimUmumiyPanel
                  ism={tanlangan.ism}
                  rol={tanlangan.rol}
                  tafsilot={tafsilot}
                  yuklanmoqda={tarixYuklanmoqda}
                  oylik={{ davr, maosh: tanlangan.oylikMaosh, tolangan: tanlangan.davrYigindisi.sof }}
                  onVaraq={setVaraq}
                />
              )}
              {varaq === 'mulk' && (
                <XodimMulkPanel
                  xodimId={tanlangan.id}
                  xodimIsmi={tanlangan.ism}
                  xodimlar={xodimlar.map(x => ({ id: x.id, ism: x.ism, faol: x.faol }))}
                  onOzgardi={() => { void yukla(); void xodimOch(tanlangan, 'mulk') }}
                />
              )}
              {varaq === 'sotuvlar' && sotuvlarKoraOladi && (
                <XodimSotuvlarPanel xodimId={tanlangan.id} xodimIsmi={tanlangan.ism} davrlar={oxirgiDavrlar()} boshlangichDavr={davr} />
              )}
              {varaq === 'oylik' && (<>
              {oylikBeraOladi && tanlangan.id !== meId && (
                <>
                  {/* Oylik belgilash */}
                  <section>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                      Oylik maosh
                    </p>
                    <div className="flex items-center gap-2">
                      <input value={maoshMatn} onChange={e => setMaoshMatn(e.target.value)}
                        inputMode="numeric" placeholder="3000000" className={inputCls} />
                      <button onClick={() => void maoshSaqla()} disabled={amalda}
                        className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-50 shrink-0">
                        Saqlash
                      </button>
                    </div>
                  </section>

                  {/* To'lov qo'shish */}
                  <section>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                      To&apos;lov qo&apos;shish ({davr})
                    </p>
                    <div className="flex bg-gray-100 dark:bg-neutral-800 rounded-xl p-1 gap-1 mb-2">
                      {TOLOV_TURLARI.map(t => (
                        <button key={t} onClick={() => setTolovTuri(t)}
                          className={`flex-1 px-2 py-2.5 rounded-lg text-xs font-medium transition ${
                            tolovTuri === t
                              ? 'bg-white dark:bg-neutral-700 shadow-sm text-gray-900 dark:text-gray-100'
                              : 'text-gray-500 dark:text-gray-400'
                          }`}>
                          {TOLOV_MALUMOTI[t].label}
                        </button>
                      ))}
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 text-[11px] mb-2">{TOLOV_MALUMOTI[tolovTuri].izoh}</p>
                    <div className="space-y-2">
                      <input value={tolovSumma} onChange={e => setTolovSumma(e.target.value)}
                        inputMode="numeric" placeholder="Summa" className={inputCls} />
                      <input value={tolovIzoh} onChange={e => setTolovIzoh(e.target.value)}
                        placeholder="Izoh (ixtiyoriy)" maxLength={500} className={inputCls} />
                      <button onClick={() => void tolovQosh()} disabled={amalda || !tolovSumma}
                        className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2">
                        {amalda ? <Loader2 size={15} className="animate-spin" /> : <Wallet size={15} />}
                        {TOLOV_MALUMOTI[tolovTuri].label} qo&apos;shish
                      </button>
                    </div>
                  </section>
                </>
              )}

              {/* Tarix */}
              <section>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <History size={12} /> To&apos;lovlar tarixi
                </p>
                {tarixYuklanmoqda ? (
                  <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-primary" /></div>
                ) : tolovlar.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8 bg-gray-50 dark:bg-neutral-800/60 rounded-xl">
                    Hali to&apos;lov yo&apos;q
                  </p>
                ) : (
                  <div className="border border-gray-200 dark:border-neutral-800 rounded-xl divide-y divide-gray-100 dark:divide-neutral-800">
                    {tolovlar.map(t => {
                      const m = tolovMalumoti(t.turi)
                      return (
                        <div key={t.id} className="px-3 py-2.5 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${m.badge}`}>{m.label}</span>
                              {t.davr && <span className="text-gray-500 dark:text-gray-400 text-[11px]">{t.davr}</span>}
                            </div>
                            <p className="text-gray-500 dark:text-gray-400 text-[11px] mt-0.5 truncate">
                              {formatSanaVaVaqt(t.sana)}
                              {t.yaratgan && ` · ${t.yaratgan.ism}`}
                              {t.izoh && ` · ${t.izoh}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className={`font-mono tabular-nums text-sm font-semibold ${m.ishora > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {m.ishora > 0 ? '+' : '−'}{formatSum(t.summa)}
                            </span>
                            {oylikBeraOladi && tanlangan.id !== meId && (
                              <button onClick={() => void tolovOchir(t)} disabled={amalda}
                                title="Bekor qilish"
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition disabled:opacity-50">
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
              </>)}
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-neutral-800 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">
              <button onClick={() => setTanlangan(null)}
                className="w-full py-2.5 border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400 rounded-xl font-medium">
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Maydon({ label, izoh, children }: { label: string; izoh?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label} {izoh && <span className="text-gray-400 font-normal text-xs">({izoh})</span>}
      </label>
      {children}
    </div>
  )
}

function Karta({ belgi, sarlavha, qiymat, rang, izoh }: {
  belgi: React.ReactNode; sarlavha: string; qiymat: string; rang?: string; izoh: string
}) {
  return (
    <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4">
      <p className="text-gray-500 dark:text-gray-400 text-xs font-mono uppercase tracking-wide flex items-center gap-1.5">
        {belgi} {sarlavha}
      </p>
      <p className={`text-lg sm:text-xl font-bold mt-1 font-mono tabular-nums truncate ${rang ?? 'text-gray-900 dark:text-gray-100'}`}>
        {qiymat}
      </p>
      <p className="text-gray-500 dark:text-gray-400 text-xs mt-1 truncate">{izoh}</p>
    </div>
  )
}
