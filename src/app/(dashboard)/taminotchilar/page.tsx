'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Truck, Plus, Loader2, X, Save, Pencil, Trash2, Phone, MapPin, User, Package, ShoppingBag,
} from 'lucide-react'
import { formatSum, formatPhone, uzSearch } from '@/lib/utils'
import PhoneInput from '@/components/ui/phone-input'
import SearchBar from '@/components/ui/search-bar'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { useConfirm } from '@/components/ConfirmProvider'
import TaminotchiTafsilot from '@/components/TaminotchiTafsilot'

interface Taminotchi {
  id: string
  nomi: string
  kontaktShaxs: string | null
  telefon: string | null
  manzil: string | null
  izoh: string | null
  jamiQarz: number
  _count: { xaridlar: number; tovarlar: number }
}

const bosh = { nomi: '', kontaktShaxs: '', telefon: '', manzil: '', izoh: '' }
const inputCls = 'w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 transition text-sm'

export default function TaminotchilarPage() {
  const confirm = useConfirm()
  const [royxat, setRoyxat] = useState<Taminotchi[]>([])
  const [yuklanmoqda, setYuklanmoqda] = useState(true)
  const [qidiruv, setQidiruv] = useState('')
  const [modal, setModal] = useState(false)
  const [tahrirlash, setTahrirlash] = useState<Taminotchi | null>(null)
  const [form, setForm] = useState(bosh)
  const [saqlanmoqda, setSaqlanmoqda] = useState(false)
  const [ochirilmoqda, setOchirilmoqda] = useState<string | null>(null)
  const [tafsilotId, setTafsilotId] = useState<string | null>(null)

  useBodyScrollLock(modal)

  const yukla = useCallback(async () => {
    setYuklanmoqda(true)
    try {
      const d = await fetch('/api/taminotchilar').then(r => r.json())
      setRoyxat(Array.isArray(d) ? d : [])
    } catch {
      toast.error("Ma'lumot yuklanmadi")
    } finally {
      setYuklanmoqda(false)
    }
  }, [])

  useEffect(() => { void yukla() }, [yukla])

  const korinadigan = useMemo(() => {
    if (!qidiruv.trim()) return royxat
    return royxat.filter(t =>
      uzSearch(t.nomi, qidiruv)
      || uzSearch(t.kontaktShaxs || '', qidiruv)
      || (t.telefon || '').includes(qidiruv)
      || uzSearch(t.manzil || '', qidiruv),
    )
  }, [royxat, qidiruv])

  const jamiQarz = royxat.reduce((s, t) => s + Number(t.jamiQarz || 0), 0)

  function modalOchish(t?: Taminotchi) {
    if (t) {
      setTahrirlash(t)
      setForm({
        nomi: t.nomi,
        kontaktShaxs: t.kontaktShaxs || '',
        telefon: (t.telefon || '').replace(/\D/g, '').replace(/^998/, ''),
        manzil: t.manzil || '',
        izoh: t.izoh || '',
      })
    } else {
      setTahrirlash(null)
      setForm(bosh)
    }
    setModal(true)
  }

  async function saqla(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nomi.trim()) { toast.error('Nomini kiriting'); return }
    setSaqlanmoqda(true)
    try {
      const res = await fetch(
        tahrirlash ? `/api/taminotchilar/${tahrirlash.id}` : '/api/taminotchilar',
        {
          method: tahrirlash ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        },
      )
      const d = await res.json()
      if (!res.ok) { toast.error(d.xato || 'Saqlanmadi'); return }
      toast.success(tahrirlash ? "Ta'minotchi yangilandi" : "Ta'minotchi qo'shildi")
      setModal(false)
      setTahrirlash(null)
      setForm(bosh)
      await yukla()
    } finally {
      setSaqlanmoqda(false)
    }
  }

  async function ochir(t: Taminotchi) {
    const rozi = await confirm({
      title: "Ta'minotchini o'chirish",
      message: `"${t.nomi}" o'chirilsinmi? Bog'langan mahsulotlarda ta'minotchi bo'sh qoladi, xaridlar tarixi saqlanadi.`,
      danger: true,
    })
    if (!rozi) return

    setOchirilmoqda(t.id)
    try {
      const res = await fetch(`/api/taminotchilar/${t.id}`, { method: 'DELETE' })
      const d = await res.json()
      if (!res.ok) { toast.error(d.xato || "O'chirilmadi"); return }
      toast.success("Ta'minotchi o'chirildi")
      await yukla()
    } finally {
      setOchirilmoqda(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Truck size={22} className="text-primary" />
            Ta&apos;minotchilar
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
            Do&apos;konga tovar yetkazib beruvchilar
          </p>
        </div>
        <button
          onClick={() => modalOchish()}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-medium transition text-sm"
        >
          <Plus size={16} /> Ta&apos;minotchi qo&apos;shish
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4">
          <p className="text-gray-500 dark:text-gray-400 text-xs font-mono uppercase tracking-wide">Ta&apos;minotchilar</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1 font-mono tabular-nums">
            {royxat.length}
          </p>
        </div>
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4">
          <p className="text-gray-500 dark:text-gray-400 text-xs font-mono uppercase tracking-wide">Jami qarzimiz</p>
          <p className={`text-2xl font-bold mt-1 font-mono tabular-nums ${jamiQarz > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {jamiQarz > 0 ? formatSum(jamiQarz) : "Yo'q"}
          </p>
        </div>
      </div>

      <SearchBar value={qidiruv} onChange={setQidiruv} placeholder="Nomi, telefon yoki manzil..." />

      {yuklanmoqda ? (
        <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin text-primary" /></div>
      ) : korinadigan.length === 0 ? (
        <div className="text-center py-14">
          <Truck size={38} className="mx-auto text-gray-300 dark:text-neutral-700" />
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-3">
            {qidiruv ? 'Hech narsa topilmadi' : "Hali ta'minotchi qo'shilmagan"}
            <span className="block mt-3">
              {qidiruv ? (
                <button
                  onClick={() => setQidiruv('')}
                  className="px-4 py-2 rounded-xl border border-gray-300 dark:border-neutral-700 text-sm text-gray-600 dark:text-gray-400 hover:border-primary/50 hover:text-primary transition"
                >
                  Qidiruvni tozalash
                </button>
              ) : (
                <button
                  onClick={() => modalOchish()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90 transition"
                >
                  <Plus size={15} /> Birinchi ta&apos;minotchini qo&apos;shish
                </button>
              )}
            </span>
          </p>
          {!qidiruv && (
            <button
              onClick={() => modalOchish()}
              className="mt-4 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-medium transition"
            >
              Birinchisini qo&apos;shish
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {korinadigan.map(t => (
            <div
              key={t.id}
              className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 flex flex-col gap-3 hover:border-primary/30 dark:hover:border-primary/40 hover:shadow-lg transition-all"
            >
              {/* Kartaning ma'lumot qismi bosilsa tafsilot ochiladi.
                  Telefon havolasi va pastdagi tugmalar bundan tashqarida. */}
              <div
                onClick={() => setTafsilotId(t.id)}
                title="Batafsil va so'rov yuborish"
                className="flex flex-col gap-3 cursor-pointer"
              >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-gray-900 dark:text-gray-100 font-semibold truncate">{t.nomi}</p>
                  {t.kontaktShaxs && (
                    <p className="text-gray-500 dark:text-gray-400 text-xs flex items-center gap-1 mt-0.5 truncate">
                      <User size={11} className="shrink-0" />{t.kontaktShaxs}
                    </p>
                  )}
                </div>
                <div className="w-10 h-10 bg-primary-light dark:bg-primary/10 rounded-xl flex items-center justify-center text-primary font-bold shrink-0">
                  {t.nomi[0]?.toUpperCase()}
                </div>
              </div>

              <div className="space-y-1">
                {t.telefon && (
                  <a
                    href={`tel:${t.telefon.replace(/\s/g, '')}`}
                    onClick={e => e.stopPropagation()}
                    className="text-blue-500 hover:text-blue-600 text-sm flex items-center gap-1.5"
                  >
                    <Phone size={12} className="shrink-0" />{formatPhone(t.telefon)}
                  </a>
                )}
                {t.manzil && (
                  <p className="text-gray-500 dark:text-gray-400 text-xs flex items-center gap-1.5">
                    <MapPin size={12} className="shrink-0" />
                    <span className="truncate">{t.manzil}</span>
                  </p>
                )}
                {t.izoh && (
                  <p className="text-gray-500 dark:text-gray-400 text-xs italic truncate">{t.izoh}</p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100 dark:border-neutral-800 text-center">
                <div>
                  <p className="text-gray-500 dark:text-gray-400 text-[11px] flex items-center justify-center gap-1">
                    <Package size={10} />Tovar
                  </p>
                  <p className="text-gray-900 dark:text-gray-100 font-semibold text-sm">{t._count.tovarlar}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400 text-[11px] flex items-center justify-center gap-1">
                    <ShoppingBag size={10} />Xarid
                  </p>
                  <p className="text-gray-900 dark:text-gray-100 font-semibold text-sm">{t._count.xaridlar}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400 text-[11px]">Qarz</p>
                  <p className={`font-semibold text-sm ${Number(t.jamiQarz) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {Number(t.jamiQarz) > 0 ? formatSum(t.jamiQarz) : '—'}
                  </p>
                </div>
              </div>
              </div>

              <div className="grid grid-cols-2 gap-2 -mx-4 -mb-4 pt-2 border-t border-gray-100 dark:border-neutral-800">
                <button
                  onClick={() => modalOchish(t)}
                  className="flex items-center justify-center gap-1.5 py-2.5 text-primary hover:bg-primary-light dark:hover:bg-primary/10 transition text-sm border-r border-gray-100 dark:border-neutral-800 rounded-bl-2xl"
                >
                  <Pencil size={14} /> Tahrirlash
                </button>
                <button
                  onClick={() => ochir(t)}
                  disabled={ochirilmoqda === t.id}
                  className="flex items-center justify-center gap-1.5 py-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition text-sm disabled:opacity-50 rounded-br-2xl"
                >
                  {ochirilmoqda === t.id
                    ? <Loader2 size={14} className="animate-spin" />
                    : <Trash2 size={14} />}
                  O&apos;chirish
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4 pb-24 sm:pb-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl dark:border dark:border-neutral-800 w-full max-w-sm max-h-[85dvh] overflow-y-auto">
            <div className="p-5 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between sticky top-0 bg-white dark:bg-neutral-900">
              <h3 className="text-gray-900 dark:text-gray-100 font-semibold">
                {tahrirlash ? "Ta'minotchini tahrirlash" : "Yangi ta'minotchi"}
              </h3>
              <button
                onClick={() => { setModal(false); setTahrirlash(null) }}
                className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={saqla} className="p-5 space-y-4">
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">
                  Nomi <span className="text-red-500">*</span>
                </label>
                <input
                  type="text" required autoFocus
                  value={form.nomi}
                  onChange={e => setForm(f => ({ ...f, nomi: e.target.value }))}
                  placeholder="masalan: Ariel Distribution"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">
                  Kontakt shaxs <span className="text-gray-400 font-normal">(ixtiyoriy)</span>
                </label>
                <input
                  type="text"
                  value={form.kontaktShaxs}
                  onChange={e => setForm(f => ({ ...f, kontaktShaxs: e.target.value }))}
                  placeholder="masalan: Aziz aka"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Telefon</label>
                <PhoneInput
                  value={form.telefon}
                  onChange={v => setForm(f => ({ ...f, telefon: v }))}
                  placeholder="+998 (__) ___-__-__"
                />
              </div>

              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Manzil</label>
                <input
                  type="text"
                  value={form.manzil}
                  onChange={e => setForm(f => ({ ...f, manzil: e.target.value }))}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Izoh</label>
                <input
                  type="text"
                  value={form.izoh}
                  onChange={e => setForm(f => ({ ...f, izoh: e.target.value }))}
                  placeholder="masalan: haftada bir keladi"
                  className={inputCls}
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setModal(false); setTahrirlash(null) }}
                  className="flex-1 py-2.5 border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition font-medium"
                >
                  Bekor
                </button>
                <button
                  type="submit"
                  disabled={saqlanmoqda}
                  className="flex-1 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-60 text-white rounded-xl font-medium transition flex items-center justify-center gap-2"
                >
                  {saqlanmoqda ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {tafsilotId && (
        <TaminotchiTafsilot
          key={tafsilotId}
          taminotchiId={tafsilotId}
          onYopish={() => { setTafsilotId(null); void yukla() }}
          onTahrir={() => {
            const tam = royxat.find(x => x.id === tafsilotId)
            setTafsilotId(null)
            if (tam) modalOchish(tam)
          }}
        />
      )}
    </div>
  )
}
