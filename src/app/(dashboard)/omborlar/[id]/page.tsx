'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Warehouse, Plus, Loader2, X, Check, Trash2, Package, FolderTree,
  ChevronLeft, ArrowDownToLine, ArrowUpFromLine, AlertTriangle, Lock,
} from 'lucide-react'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { useConfirm } from '@/components/ConfirmProvider'
import { useRuxsat } from '@/hooks/useRuxsat'
import { harakatUchunKerak } from '@/lib/ruxsat-amallar'
import TovarTafsilot from '@/components/TovarTafsilot'
import SearchBar from '@/components/ui/search-bar'
import MoneyInput from '@/components/ui/money-input'
import Combobox from '@/components/ui/combobox'
import { formatSum } from '@/lib/utils'
import { QOLDA_TURLARI } from '@/lib/qolda-harakat'
import { harakatMalumoti, joyLabel } from '@/lib/harakat-turlari'

// OMBOR ICHI — shu bitta sahifadan ombor to'liq boshqariladi:
// kategoriya yaratish, mahsulot yaratish, kirim/chiqim va o'chirish.
// Maqsad: ish uchun boshqa bo'limlarga o'tib yurish shart bo'lmasin.

interface Kategoriya { id: string; nomi: string; tovarSoni: number }
interface Tovar {
  id: string; nomi: string; kategoriyaId: string
  kategoriya: { id: string; nomi: string }
  shtrixKod: string | null; birlik: string; valyuta: string
  kelishNarxi: number | null; sotishNarxi: number | null
  minimalQoldiq: number; qulflangan: boolean; rasmlar?: string[]
  omborQoldiq: number | null; dokonQoldiq: number | null
  qoldiq: number; kamQolgan: boolean
}
interface Malumot {
  ombor: { id: string; nomi: string; izoh: string | null; faol: boolean }
  kategoriyalar: Kategoriya[]
  tovarlar: Tovar[]
  boshqaraOladi: boolean
  tahrirlashMumkin: boolean
  ochirishMumkin: boolean
}
interface Taminotchi { id: string; nomi: string }

const inputCls =
  'w-full px-3 py-2.5 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500'

const BOSH_TOVAR = {
  nomi: '', kategoriyaId: '', shtrixKod: '', birlik: 'DONA', valyuta: 'UZS',
  kelishNarxi: '', sotishNarxi: '', minimalQoldiq: '5',
  boshlangichQoldiq: '', taminotchiId: '', keltirilganManzil: '',
}

export default function OmborIchiPage() {
  const { id } = useParams<{ id: string }>()
  const confirm = useConfirm()
  const ruxsat = useRuxsat()

  const [data, setData] = useState<Malumot | null>(null)
  const [taminotchilar, setTaminotchilar] = useState<Taminotchi[]>([])
  const [yuklanmoqda, setYuklanmoqda] = useState(true)
  const [topilmadi, setTopilmadi] = useState(false)

  const [qidiruv, setQidiruv] = useState('')
  const [aktifKategoriya, setAktifKategoriya] = useState<string | null>(null)
  const [tafsilotId, setTafsilotId] = useState<string | null>(null)

  // Kategoriya yaratish
  const [katModal, setKatModal] = useState(false)
  const [katNomi, setKatNomi] = useState('')

  // Mahsulot yaratish
  const [tovarModal, setTovarModal] = useState(false)
  const [forma, setForma] = useState({ ...BOSH_TOVAR })

  // Kirim / chiqim
  const [harakatTovar, setHarakatTovar] = useState<Tovar | null>(null)
  const [harakat, setHarakat] = useState({
    turi: 'KIRIM', joy: 'DOKON', miqdor: '', narx: '', taminotchiId: '', izoh: '',
  })

  const [amalda, setAmalda] = useState(false)
  useBodyScrollLock(katModal || tovarModal || !!harakatTovar)

  const yukla = useCallback(async () => {
    try {
      const [r, tm] = await Promise.all([
        fetch(`/api/omborlar/${id}/tafsilot`),
        fetch('/api/taminotchilar').then(x => x.json()).catch(() => []),
      ])
      const j = await r.json().catch(() => ({}))
      if (r.status === 404) { setTopilmadi(true); return }
      if (!r.ok) { toast.error(j.xato || "Ma'lumot yuklanmadi"); return }
      setData(j)
      setTaminotchilar(Array.isArray(tm) ? tm : [])
    } catch {
      toast.error('Tarmoq xatosi')
    } finally {
      setYuklanmoqda(false)
    }
  }, [id])

  useEffect(() => { void yukla() }, [yukla])

  const korinadigan = useMemo(() => {
    const q = qidiruv.trim().toLowerCase()
    return (data?.tovarlar ?? []).filter(t =>
      (!aktifKategoriya || t.kategoriyaId === aktifKategoriya) &&
      (!q || t.nomi.toLowerCase().includes(q) || (t.shtrixKod ?? '').includes(q)))
  }, [data, aktifKategoriya, qidiruv])

  const jamiQoldiq = useMemo(
    () => (data?.tovarlar ?? []).reduce((s, t) => s + t.qoldiq, 0), [data])

  // ─── Kategoriya ───────────────────────────────────────────────────────────
  async function kategoriyaYarat(e: React.FormEvent) {
    e.preventDefault()
    if (!katNomi.trim()) { toast.error('Kategoriya nomini kiriting'); return }
    setAmalda(true)
    try {
      const r = await fetch('/api/kategoriyalar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // `omborId` — shu ombor: kategoriya darhol shu ombor ichida tug'iladi,
        // keyin alohida biriktirish kerak emas.
        body: JSON.stringify({ nomi: katNomi.trim(), omborId: id }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.xato || 'Yaratilmadi'); return }
      toast.success(`"${j.nomi}" kategoriyasi qo'shildi`)
      setKatNomi(''); setKatModal(false)
      await yukla()
    } catch { toast.error('Tarmoq xatosi') } finally { setAmalda(false) }
  }

  // ─── Mahsulot ─────────────────────────────────────────────────────────────
  function tovarModalOch() {
    const kategoriyalar = data?.kategoriyalar ?? []
    if (kategoriyalar.length === 0) {
      toast.error('Avval shu omborda kategoriya yarating')
      setKatModal(true)
      return
    }
    setForma({
      ...BOSH_TOVAR,
      // Kategoriya tanlangan bo'lsa o'sha, aks holda birinchisi — foydalanuvchi
      // ko'p hollarda aynan shuni xohlaydi.
      kategoriyaId: aktifKategoriya ?? kategoriyalar[0].id,
    })
    setTovarModal(true)
  }

  async function tovarYarat(e: React.FormEvent) {
    e.preventDefault()
    if (!forma.nomi.trim()) { toast.error('Mahsulot nomini kiriting'); return }
    if (!forma.kategoriyaId) { toast.error('Kategoriyani tanlang'); return }
    if (!forma.kelishNarxi || !forma.sotishNarxi) {
      toast.error('Kelish va sotish narxini kiriting'); return
    }
    setAmalda(true)
    try {
      const r = await fetch('/api/tovarlar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...forma,
          nomi: forma.nomi.trim(),
          taminotchiId: forma.taminotchiId || null,
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.xato || 'Yaratilmadi'); return }
      toast.success(`"${j.nomi}" qo'shildi`)
      setTovarModal(false)
      await yukla()
    } catch { toast.error('Tarmoq xatosi') } finally { setAmalda(false) }
  }

  async function tovarOchir(t: Tovar) {
    const ok = await confirm({
      title: `"${t.nomi}" o'chirilsinmi?`,
      message: t.qoldiq > 0
        ? `Qoldiq ${t.qoldiq} ${t.birlik.toLowerCase()}. Mahsulot arxivga o'tadi — `
          + 'sotuvda va bu omborda ko\'rinmaydi, lekin eski sotuv va hisobotlar saqlanib qoladi.'
        : "Mahsulot arxivga o'tadi. Eski sotuv va hisobotlar saqlanib qoladi.",
      confirmText: "O'chirish",
      danger: true,
    })
    if (!ok) return
    try {
      const r = await fetch(`/api/tovarlar/${t.id}`, { method: 'DELETE' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.xato || "O'chirilmadi"); return }
      toast.success(`"${t.nomi}" o'chirildi`)
      await yukla()
    } catch { toast.error('Tarmoq xatosi') }
  }

  // ─── Kirim / chiqim ───────────────────────────────────────────────────────
  function harakatOch(t: Tovar, turi: string) {
    setHarakat({
      turi,
      // Kirim odatda omborga tushadi, chiqim esa do'kondan bo'ladi —
      // eng ko'p uchraydigan holat oldindan tanlangan bo'lsin.
      joy: turi === 'KIRIM' ? 'OMBOR' : 'DOKON',
      miqdor: '',
      narx: turi === 'KIRIM' && t.kelishNarxi != null ? String(t.kelishNarxi) : '',
      taminotchiId: '', izoh: '',
    })
    setHarakatTovar(t)
  }

  async function harakatYoz(e: React.FormEvent) {
    e.preventDefault()
    if (!harakatTovar) return
    if (!harakat.miqdor || Number(harakat.miqdor) <= 0) {
      toast.error("Miqdor 0 dan katta bo'lishi kerak"); return
    }
    setAmalda(true)
    try {
      const r = await fetch('/api/ombor/harakat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tovarId: harakatTovar.id, ...harakat }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.xato || 'Saqlanmadi'); return }
      toast.success(
        `${harakatTovar.nomi}: ${harakatMalumoti(harakat.turi).label.toLowerCase()} `
        + `${harakat.miqdor} ${harakatTovar.birlik.toLowerCase()} · yangi qoldiq ${j.qoldiq}`)
      setHarakatTovar(null)
      await yukla()
    } catch { toast.error('Tarmoq xatosi') } finally { setAmalda(false) }
  }

  // ─── Ko'rinish ────────────────────────────────────────────────────────────
  if (topilmadi) {
    return (
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl py-16 text-center">
        <Warehouse size={30} className="text-gray-300 dark:text-neutral-700 mx-auto" />
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Bunday ombor topilmadi</p>
        <Link href="/omborlar" className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary">
          <ChevronLeft size={15} /> Omborlar ro&apos;yxati
        </Link>
      </div>
    )
  }
  if (yuklanmoqda || !data) {
    return <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-primary" /></div>
  }

  const yozaOladi = data.tahrirlashMumkin
  // Xodim ruxsatlari: kirim va chiqim alohida, mahsulot/kategoriya — Tovarlar ruxsatlari
  const kirimMumkin = yozaOladi && ruxsat.bor('ombor.kirim')
  const chiqimMumkin = yozaOladi && ruxsat.bor('ombor.chiqim')
  const mahsulotQoshaOladi = yozaOladi && ruxsat.bor('tovarlar.qoshish')
  const kategoriyaQoshaOladi = ruxsat.bor('tovarlar.qoshish') || ruxsat.bor('tovarlar.tahrirlash') || ruxsat.bor('omborlar.boshqarish')
  const ruxsatliTurlar = QOLDA_TURLARI.filter(tur => ruxsat.bor(harakatUchunKerak(tur)))

  return (
    <div className="space-y-4">
      {/* Sarlavha */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <Link href="/omborlar"
            className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-primary transition mb-1">
            <ChevronLeft size={15} /> Omborlar
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Warehouse size={22} className="text-primary shrink-0" />
            <span className="truncate">{data.ombor.nomi}</span>
            {!data.ombor.faol && (
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-neutral-800 text-gray-500 shrink-0">
                nofaol
              </span>
            )}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
            {data.kategoriyalar.length} kategoriya · {data.tovarlar.length} mahsulot · jami {jamiQoldiq} dona
            {data.ombor.izoh && ` · ${data.ombor.izoh}`}
          </p>
        </div>
        {(mahsulotQoshaOladi || kategoriyaQoshaOladi) && (
          <div className="flex items-center gap-2">
            {kategoriyaQoshaOladi && <button
              onClick={() => setKatModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-neutral-700 text-sm text-gray-600 dark:text-gray-400 hover:border-primary/50 hover:text-primary transition"
            >
              <FolderTree size={15} /> Kategoriya
            </button>}
            {mahsulotQoshaOladi && <button
              onClick={tovarModalOch}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90 transition"
            >
              <Plus size={16} /> Mahsulot
            </button>}
          </div>
        )}
      </div>

      {/* Kategoriyalar */}
      {data.kategoriyalar.length === 0 ? (
        <div className="bg-white dark:bg-neutral-900 border border-amber-200 dark:border-amber-900/50 rounded-2xl py-10 text-center">
          <FolderTree size={28} className="text-amber-500 mx-auto" />
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 font-medium">
            Bu omborda hali kategoriya yo&apos;q
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 px-6">
            Mahsulot kategoriyasiz bo&apos;lmaydi — avval kategoriya yarating
          </p>
          {kategoriyaQoshaOladi && (
            <button onClick={() => setKatModal(true)}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium">
              <Plus size={15} /> Birinchi kategoriya
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setAktifKategoriya(null)}
            className={`shrink-0 px-3.5 py-2 rounded-full text-sm font-medium transition whitespace-nowrap ${
              aktifKategoriya === null
                ? 'bg-gray-800 dark:bg-neutral-200 text-white dark:text-neutral-900'
                : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700'
            }`}
          >
            Hammasi ({data.tovarlar.length})
          </button>
          {data.kategoriyalar.map(k => (
            <button
              key={k.id}
              onClick={() => setAktifKategoriya(k.id)}
              className={`shrink-0 px-3.5 py-2 rounded-full text-sm font-medium transition whitespace-nowrap ${
                aktifKategoriya === k.id
                  ? 'bg-gray-800 dark:bg-neutral-200 text-white dark:text-neutral-900'
                  : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700'
              }`}
            >
              {k.nomi} ({k.tovarSoni})
            </button>
          ))}
        </div>
      )}

      {/* Mahsulotlar */}
      {data.kategoriyalar.length > 0 && (
        <>
          {data.tovarlar.length > 0 && (
            <SearchBar value={qidiruv} onChange={setQidiruv}
              placeholder="Mahsulot nomi yoki shtrix-kod..." />
          )}

          {korinadigan.length === 0 ? (
            <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl py-14 text-center">
              <Package size={30} className="text-gray-300 dark:text-neutral-700 mx-auto" />
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                {data.tovarlar.length === 0
                  ? "Bu omborda hali mahsulot yo'q"
                  : 'Qidiruvga mos mahsulot topilmadi'}
              </p>
              {data.tovarlar.length === 0 && yozaOladi && (
                <button onClick={tovarModalOch}
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium">
                  <Plus size={15} /> Birinchi mahsulot
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl divide-y divide-gray-100 dark:divide-neutral-800 overflow-hidden">
              {korinadigan.map(t => (
                <div key={t.id} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <button
                    onClick={() => setTafsilotId(t.id)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <p className="text-gray-900 dark:text-gray-100 text-sm font-medium flex items-center gap-1.5">
                      <span className="truncate">{t.nomi}</span>
                      {t.qulflangan && <Lock size={12} className="text-amber-500 shrink-0" />}
                      {t.kamQolgan && <AlertTriangle size={12} className="text-red-500 shrink-0" />}
                    </p>
                    <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
                      {t.kategoriya.nomi}
                      {t.omborQoldiq !== null && t.dokonQoldiq !== null
                        ? ` · ${joyLabel('OMBOR')} ${t.omborQoldiq} · ${joyLabel('DOKON')} ${t.dokonQoldiq}`
                        : ''}
                      {t.sotishNarxi != null && ` · ${formatSum(Number(t.sotishNarxi))}`}
                    </p>
                  </button>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-sm font-semibold tabular-nums px-2 ${
                      t.kamQolgan ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {t.qoldiq} <span className="text-xs font-normal text-gray-400">{t.birlik.toLowerCase()}</span>
                    </span>
                    {(kirimMumkin || chiqimMumkin) && (
                      <>
                        {kirimMumkin && <button
                          onClick={() => harakatOch(t, 'KIRIM')}
                          title="Kirim"
                          className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30 rounded-lg transition"
                        >
                          <ArrowDownToLine size={15} />
                        </button>}
                        {chiqimMumkin && <button
                          onClick={() => harakatOch(t, 'CHIQIM')}
                          title="Chiqim"
                          className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30 rounded-lg transition"
                        >
                          <ArrowUpFromLine size={15} />
                        </button>}
                      </>
                    )}
                    {data.ochirishMumkin && ruxsat.bor('tovarlar.ochirish') && (
                      <button
                        onClick={() => void tovarOchir(t)}
                        title="O'chirish"
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Kategoriya yaratish ── */}
      {katModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={() => setKatModal(false)}>
          <form onSubmit={kategoriyaYarat} onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-neutral-900 rounded-t-2xl sm:rounded-2xl shadow-xl dark:border dark:border-neutral-800 w-full max-w-md">
            <div className="p-4 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-gray-900 dark:text-gray-100 font-semibold">Yangi kategoriya</h3>
              <button type="button" onClick={() => setKatModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition">
                <X size={18} />
              </button>
            </div>
            <div className="p-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nomi *</label>
              <input value={katNomi} onChange={e => setKatNomi(e.target.value)} required autoFocus
                maxLength={100} placeholder="Masalan: Ichimliklar" className={inputCls} />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                <span className="font-medium">{data.ombor.nomi}</span> ombori ichida yaratiladi
              </p>
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-neutral-800 flex gap-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">
              <button type="submit" disabled={amalda}
                className="flex-1 py-2.5 bg-primary text-white rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                {amalda ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Saqlash
              </button>
              <button type="button" onClick={() => setKatModal(false)}
                className="px-5 py-2.5 border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400 rounded-xl font-medium">
                Bekor
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Mahsulot yaratish ── */}
      {tovarModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={() => setTovarModal(false)}>
          <form onSubmit={tovarYarat} onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-neutral-900 rounded-t-2xl sm:rounded-2xl shadow-xl dark:border dark:border-neutral-800 w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between shrink-0">
              <div className="min-w-0">
                <h3 className="text-gray-900 dark:text-gray-100 font-semibold">Yangi mahsulot</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{data.ombor.nomi} ombori</p>
              </div>
              <button type="button" onClick={() => setTovarModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nomi *</label>
                <input value={forma.nomi} onChange={e => setForma(f => ({ ...f, nomi: e.target.value }))}
                  required autoFocus placeholder="Mahsulot nomi" className={inputCls} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kategoriya *</label>
                <Combobox
                  options={data.kategoriyalar.map(k => ({ value: k.id, label: k.nomi }))}
                  value={forma.kategoriyaId}
                  onChange={v => setForma(f => ({ ...f, kategoriyaId: v }))}
                  placeholder="Kategoriyani tanlang"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Faqat shu ombordagi kategoriyalar
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kelish narxi *</label>
                  <MoneyInput value={forma.kelishNarxi}
                    onChange={v => setForma(f => ({ ...f, kelishNarxi: v }))} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sotish narxi *</label>
                  <MoneyInput value={forma.sotishNarxi}
                    onChange={v => setForma(f => ({ ...f, sotishNarxi: v }))} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valyuta</label>
                  <select value={forma.valyuta} onChange={e => setForma(f => ({ ...f, valyuta: e.target.value }))}
                    className={inputCls}>
                    <option value="UZS">so&apos;m (UZS)</option>
                    <option value="USD">dollar (USD)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Birlik</label>
                  <select value={forma.birlik} onChange={e => setForma(f => ({ ...f, birlik: e.target.value }))}
                    className={inputCls}>
                    {['DONA', 'KG', 'LITR', 'METR', 'PACHKA', 'QUTI'].map(b => (
                      <option key={b} value={b}>{b.toLowerCase()}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Boshlang&apos;ich qoldiq
                  </label>
                  <input type="number" min="0" step="0.001" inputMode="decimal"
                    value={forma.boshlangichQoldiq}
                    onChange={e => setForma(f => ({ ...f, boshlangichQoldiq: e.target.value }))}
                    placeholder="0" className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Minimal qoldiq</label>
                  <input type="number" min="0" inputMode="numeric" value={forma.minimalQoldiq}
                    onChange={e => setForma(f => ({ ...f, minimalQoldiq: e.target.value }))}
                    className={inputCls} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Shtrix-kod <span className="text-gray-400 font-normal text-xs">(bo&apos;sh qolsa avtomatik)</span>
                </label>
                <input value={forma.shtrixKod} onChange={e => setForma(f => ({ ...f, shtrixKod: e.target.value }))}
                  placeholder="Avtomatik" className={inputCls} />
              </div>

              {taminotchilar.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Ta&apos;minotchi <span className="text-gray-400 font-normal text-xs">(ixtiyoriy)</span>
                  </label>
                  <Combobox
                    options={taminotchilar.map(t => ({ value: t.id, label: t.nomi }))}
                    value={forma.taminotchiId}
                    onChange={v => setForma(f => ({ ...f, taminotchiId: v }))}
                    placeholder="Tanlanmagan"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Keltirilgan manzil <span className="text-gray-400 font-normal text-xs">(ixtiyoriy)</span>
                </label>
                <input value={forma.keltirilganManzil}
                  onChange={e => setForma(f => ({ ...f, keltirilganManzil: e.target.value }))}
                  placeholder="Qayerdan olib kelindi" className={inputCls} />
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400">
                Rasm va yaroqlilik muddati kabi qo&apos;shimcha maydonlar{' '}
                <Link href="/tovarlar" className="text-primary underline">Mahsulotlar</Link> bo&apos;limida.
              </p>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-neutral-800 flex gap-3 shrink-0 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">
              <button type="submit" disabled={amalda}
                className="flex-1 py-2.5 bg-primary text-white rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                {amalda ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Saqlash
              </button>
              <button type="button" onClick={() => setTovarModal(false)}
                className="px-5 py-2.5 border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400 rounded-xl font-medium">
                Bekor
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Kirim / chiqim ── */}
      {harakatTovar && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={() => setHarakatTovar(null)}>
          <form onSubmit={harakatYoz} onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-neutral-900 rounded-t-2xl sm:rounded-2xl shadow-xl dark:border dark:border-neutral-800 w-full max-w-md">
            <div className="p-4 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
              <div className="min-w-0">
                <h3 className="text-gray-900 dark:text-gray-100 font-semibold truncate">{harakatTovar.nomi}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {joyLabel('OMBOR')} {harakatTovar.omborQoldiq ?? '—'} ·{' '}
                  {joyLabel('DOKON')} {harakatTovar.dokonQoldiq ?? '—'}
                </p>
              </div>
              <button type="button" onClick={() => setHarakatTovar(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Harakat turi</label>
                <div className="grid grid-cols-2 gap-2">
                  {ruxsatliTurlar.map(tur => {
                    const m = harakatMalumoti(tur)
                    return (
                      <button key={tur} type="button"
                        onClick={() => setHarakat(h => ({ ...h, turi: tur }))}
                        className={`px-3 py-2.5 rounded-xl text-sm font-medium transition border ${
                          harakat.turi === tur
                            ? 'border-primary bg-primary-light dark:bg-primary/10 text-primary'
                            : 'border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400'
                        }`}>
                        {m.label}
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                  {harakatMalumoti(harakat.turi).izoh}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Qayerda</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['OMBOR', 'DOKON'] as const).map(j => (
                    <button key={j} type="button"
                      onClick={() => setHarakat(h => ({ ...h, joy: j }))}
                      className={`px-3 py-2.5 rounded-xl text-sm font-medium transition border ${
                        harakat.joy === j
                          ? 'border-primary bg-primary-light dark:bg-primary/10 text-primary'
                          : 'border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400'
                      }`}>
                      {joyLabel(j)}{' '}
                      <span className="text-xs font-normal opacity-70">
                        ({(j === 'OMBOR' ? harakatTovar.omborQoldiq : harakatTovar.dokonQoldiq) ?? '—'})
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Miqdor * <span className="text-gray-400 font-normal text-xs">({harakatTovar.birlik.toLowerCase()})</span>
                </label>
                <input type="number" min="0" step="0.001" inputMode="decimal" required autoFocus
                  value={harakat.miqdor}
                  onChange={e => setHarakat(h => ({ ...h, miqdor: e.target.value }))}
                  placeholder="0" className={inputCls} />
              </div>

              {harakat.turi === 'KIRIM' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Kelish narxi <span className="text-gray-400 font-normal text-xs">(birlik uchun)</span>
                    </label>
                    <MoneyInput value={harakat.narx}
                      onChange={v => setHarakat(h => ({ ...h, narx: v }))} />
                  </div>
                  {taminotchilar.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Ta&apos;minotchi <span className="text-gray-400 font-normal text-xs">(ixtiyoriy)</span>
                      </label>
                      <Combobox
                        options={taminotchilar.map(t => ({ value: t.id, label: t.nomi }))}
                        value={harakat.taminotchiId}
                        onChange={v => setHarakat(h => ({ ...h, taminotchiId: v }))}
                        placeholder="Tanlanmagan"
                      />
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Izoh <span className="text-gray-400 font-normal text-xs">(ixtiyoriy)</span>
                </label>
                <input value={harakat.izoh} onChange={e => setHarakat(h => ({ ...h, izoh: e.target.value }))}
                  maxLength={500} placeholder="Nima uchun" className={inputCls} />
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-neutral-800 flex gap-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">
              <button type="submit" disabled={amalda}
                className="flex-1 py-2.5 bg-primary text-white rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                {amalda ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Saqlash
              </button>
              <button type="button" onClick={() => setHarakatTovar(null)}
                className="px-5 py-2.5 border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400 rounded-xl font-medium">
                Bekor
              </button>
            </div>
          </form>
        </div>
      )}

      {tafsilotId && (
        <TovarTafsilot key={tafsilotId} tovarId={tafsilotId} onYopish={() => setTafsilotId(null)} />
      )}
    </div>
  )
}
