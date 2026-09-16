'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Warehouse, Plus, Loader2, X, Check, Trash2, Pencil, Package,
  FolderTree, AlertTriangle, ArrowRight, Boxes, ChevronRight,
} from 'lucide-react'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { useConfirm } from '@/components/ConfirmProvider'

// OMBORLAR — kategoriyalarning ustki guruhi.
//   Ombor (katta kategoriya) → Kategoriya (kichik) → Tovar
//
// Bu sahifada ombor yaratiladi va kategoriyalar omborlarga taqsimlanadi.
// Kirim/chiqim, prixod va tovar o'chirish "Ombor harakati" bo'limida
// bajariladi — har bir kartadagi havola o'sha bo'limni AYNAN shu ombor
// bilan filtrlangan holda ochadi (ikkinchi nusxa qilinmaydi).

interface Kategoriya {
  id: string
  nomi: string
  _count: { tovarlar: number }
}

interface Ombor {
  id: string
  nomi: string
  izoh: string | null
  tartib: number
  faol: boolean
  kategoriyalar: Kategoriya[]
  tovarSoni: number
}

interface Malumot {
  omborlar: Ombor[]
  omborsizKategoriyalar: Kategoriya[]
  boshqaraOladi: boolean
}

const inputCls =
  'w-full px-3 py-2.5 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500'

export default function OmborlarPage() {
  const confirm = useConfirm()
  const [data, setData] = useState<Malumot | null>(null)
  const [yuklanmoqda, setYuklanmoqda] = useState(true)

  const [modal, setModal] = useState(false)
  const [tahrir, setTahrir] = useState<Ombor | null>(null)
  const [nomi, setNomi] = useState('')
  const [izoh, setIzoh] = useState('')
  // Nofaol ombor tanlagichlarda (POS, tovar formasi, ombor qoldig'i)
  // ko'rinmaydi, lekin ichidagi kategoriya va tovarlar o'z joyida
  // qoladi — ya'ni bu o'chirish emas, ro'yxatni tozalash.
  const [faol, setFaol] = useState(true)
  const [amalda, setAmalda] = useState(false)

  // Kategoriyani boshqa omborga ko'chirish
  const [kochirilmoqda, setKochirilmoqda] = useState<string | null>(null)

  useBodyScrollLock(modal)

  const yukla = useCallback(async () => {
    setYuklanmoqda(true)
    try {
      const r = await fetch('/api/omborlar')
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.xato || "Ma'lumot yuklanmadi"); return }
      setData(j)
    } catch {
      toast.error('Tarmoq xatosi')
    } finally {
      setYuklanmoqda(false)
    }
  }, [])

  useEffect(() => { void yukla() }, [yukla])

  function modalOch(o?: Ombor) {
    setTahrir(o ?? null)
    setNomi(o?.nomi ?? '')
    setIzoh(o?.izoh ?? '')
    setFaol(o?.faol ?? true)
    setModal(true)
  }

  async function saqla(e: React.FormEvent) {
    e.preventDefault()
    if (!nomi.trim()) { toast.error('Ombor nomini kiriting'); return }
    setAmalda(true)
    try {
      const r = await fetch(tahrir ? `/api/omborlar/${tahrir.id}` : '/api/omborlar', {
        method: tahrir ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomi: nomi.trim(), izoh: izoh.trim() || null, faol }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.xato || 'Saqlanmadi'); return }
      toast.success(tahrir ? 'Ombor yangilandi' : 'Ombor yaratildi')
      setModal(false)
      void yukla()
    } catch {
      toast.error('Tarmoq xatosi')
    } finally {
      setAmalda(false)
    }
  }

  async function ochir(o: Ombor) {
    const ok = await confirm({
      title: `"${o.nomi}" o'chirilsinmi?`,
      message: o.kategoriyalar.length > 0
        ? `${o.kategoriyalar.length} ta kategoriya ombordan ajratiladi, lekin O'CHMAYDI — ular "Ombor belgilanmagan" ro'yxatiga tushadi. Tovarlar ham joyida qoladi.`
        : 'Bu omborda kategoriya yo‘q.',
      confirmText: "O'chirish",
      danger: true,
    })
    if (!ok) return
    try {
      const r = await fetch(`/api/omborlar/${o.id}`, { method: 'DELETE' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.xato || 'O‘chirilmadi'); return }
      toast.success('Ombor o‘chirildi')
      void yukla()
    } catch {
      toast.error('Tarmoq xatosi')
    }
  }

  /** Kategoriyani boshqa omborga (yoki omborsizga) ko'chirish. */
  async function kategoriyaniKochir(kategoriyaId: string, omborId: string | null) {
    setKochirilmoqda(kategoriyaId)
    try {
      const r = await fetch(`/api/kategoriyalar/${kategoriyaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ omborId }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.xato || 'Ko‘chirilmadi'); return }
      toast.success(omborId ? 'Omborga biriktirildi' : 'Ombordan ajratildi')
      void yukla()
    } catch {
      toast.error('Tarmoq xatosi')
    } finally {
      setKochirilmoqda(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Warehouse size={22} className="text-primary" />
            Omborlar
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
            Ombor — katta guruh, kategoriya — uning ichidagi kichik guruh
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/ombor"
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-neutral-700 text-sm text-gray-600 dark:text-gray-400 hover:border-primary/50 hover:text-primary transition"
          >
            <Boxes size={15} /> Kirim / chiqim
          </Link>
          {data?.boshqaraOladi && (
            <button
              onClick={() => modalOch()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90 transition"
            >
              <Plus size={16} /> Yangi ombor
            </button>
          )}
        </div>
      </div>

      {yuklanmoqda || !data ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-primary" /></div>
      ) : (
        <>
          {data.omborlar.length === 0 && data.omborsizKategoriyalar.length === 0 ? (
            <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl py-14 text-center">
              <Warehouse size={30} className="text-gray-300 dark:text-neutral-700 mx-auto" />
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Hali ombor yaratilmagan</p>
              {data.boshqaraOladi && (
                <button
                  onClick={() => modalOch()}
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium"
                >
                  <Plus size={15} /> Birinchi omborni yaratish
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {data.omborlar.map(o => (
                <div
                  key={o.id}
                  className={`bg-white dark:bg-neutral-900 border rounded-2xl overflow-hidden ${
                    o.faol ? 'border-gray-200 dark:border-neutral-800' : 'border-gray-200 dark:border-neutral-800 opacity-60'
                  }`}
                >
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between gap-3">
                    {/* Ombor nomi — "ichiga kirish" havolasi. U yerda
                        kategoriya/mahsulot yaratish va kirim-chiqim bor. */}
                    <Link href={`/omborlar/${o.id}`} className="min-w-0 group">
                      <p className="text-gray-900 dark:text-gray-100 font-semibold flex items-center gap-2 group-hover:text-primary transition">
                        <Warehouse size={15} className="text-primary shrink-0" />
                        <span className="truncate">{o.nomi}</span>
                        <ChevronRight size={15} className="text-gray-400 shrink-0 group-hover:text-primary transition" />
                        {!o.faol && (
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-neutral-800 text-gray-500">
                            nofaol
                          </span>
                        )}
                      </p>
                      <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
                        {o.kategoriyalar.length} ta kategoriya · {o.tovarSoni} ta tovar
                        {o.izoh && ` · ${o.izoh}`}
                      </p>
                    </Link>
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Shu omborning kirim/chiqim, prixod va o'chirish
                          amallari — ro'yxat shu ombor bilan cheklangan holda
                          ochiladi. */}
                      <Link
                        href={`/ombor?ombor=${o.id}`}
                        title="Kirim / chiqim"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-neutral-700 hover:border-primary/50 hover:text-primary transition"
                      >
                        <Boxes size={13} /> Kirim / chiqim
                      </Link>
                    </div>
                    {data.boshqaraOladi && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => modalOch(o)}
                          title="Tahrirlash"
                          className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary-light dark:hover:bg-primary/10 rounded-lg transition"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => void ochir(o)}
                          title="O'chirish"
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </div>

                  {o.kategoriyalar.length === 0 ? (
                    <div className="px-4 py-5 text-center">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Bu omborda kategoriya yo&apos;q
                      </p>
                      <Link href={`/omborlar/${o.id}`}
                        className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                        <Plus size={14} /> Ombor ichida yaratish
                      </Link>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                      {o.kategoriyalar.map(k => (
                        <div key={k.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                          <span className="text-gray-700 dark:text-gray-300 text-sm flex items-center gap-2 min-w-0">
                            <FolderTree size={13} className="text-gray-400 shrink-0" />
                            <span className="truncate">{k.nomi}</span>
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-gray-500 dark:text-gray-400 text-xs flex items-center gap-1">
                              <Package size={11} /> {k._count.tovarlar}
                            </span>
                            {data.boshqaraOladi && (
                              <button
                                onClick={() => void kategoriyaniKochir(k.id, null)}
                                disabled={kochirilmoqda === k.id}
                                title="Ombordan ajratish"
                                className="p-1 text-gray-400 hover:text-red-600 rounded transition disabled:opacity-50"
                              >
                                {kochirilmoqda === k.id
                                  ? <Loader2 size={13} className="animate-spin" />
                                  : <X size={13} />}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Omborsiz kategoriyalar */}
              {data.omborsizKategoriyalar.length > 0 && (
                <div className="bg-white dark:bg-neutral-900 border border-amber-200 dark:border-amber-900/50 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-neutral-800">
                    <p className="text-amber-700 dark:text-amber-500 font-medium text-sm flex items-center gap-2">
                      <AlertTriangle size={15} />
                      Ombor belgilanmagan ({data.omborsizKategoriyalar.length})
                    </p>
                    <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
                      Bu kategoriyalar hech qaysi omborga tegishli emas
                    </p>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                    {data.omborsizKategoriyalar.map(k => (
                      <div key={k.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                        <span className="text-gray-700 dark:text-gray-300 text-sm flex items-center gap-2 min-w-0">
                          <FolderTree size={13} className="text-gray-400 shrink-0" />
                          <span className="truncate">{k.nomi}</span>
                          <span className="text-gray-500 dark:text-gray-400 text-xs flex items-center gap-1 shrink-0">
                            <Package size={11} /> {k._count.tovarlar}
                          </span>
                        </span>
                        {data.boshqaraOladi && data.omborlar.length > 0 && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <ArrowRight size={13} className="text-gray-400" />
                            <select
                              value=""
                              onChange={e => { if (e.target.value) void kategoriyaniKochir(k.id, e.target.value) }}
                              disabled={kochirilmoqda === k.id}
                              aria-label={`${k.nomi} uchun ombor tanlash`}
                              className="px-2.5 py-1.5 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-lg text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                            >
                              <option value="">Omborga biriktirish…</option>
                              {data.omborlar.map(o => (
                                <option key={o.id} value={o.id}>{o.nomi}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Ombor yaratish / tahrirlash */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={() => setModal(false)}>
          <form
            onSubmit={saqla}
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-neutral-900 rounded-t-2xl sm:rounded-2xl shadow-xl dark:border dark:border-neutral-800 w-full max-w-md"
          >
            <div className="p-4 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-gray-900 dark:text-gray-100 font-semibold">
                {tahrir ? 'Omborni tahrirlash' : 'Yangi ombor'}
              </h3>
              <button type="button" onClick={() => setModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nomi *</label>
                <input
                  value={nomi}
                  onChange={e => setNomi(e.target.value)}
                  required
                  maxLength={100}
                  placeholder="Masalan: Oziq-ovqat ombori"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Izoh <span className="text-gray-400 font-normal text-xs">(ixtiyoriy)</span>
                </label>
                <input
                  value={izoh}
                  onChange={e => setIzoh(e.target.value)}
                  maxLength={500}
                  placeholder="Qayerda joylashgan yoki nima saqlanadi"
                  className={inputCls}
                />
              </div>
              <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 dark:border-neutral-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={faol}
                  onChange={e => setFaol(e.target.checked)}
                  className="mt-0.5 accent-red-600"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">Faol</span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Belgi olinsa ombor kassa va tovar formasidagi tanlagichlarda
                    ko&apos;rinmaydi. Kategoriyalari va tovarlari o&apos;chmaydi.
                  </span>
                </span>
              </label>
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-neutral-800 flex gap-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">
              <button type="submit" disabled={amalda}
                className="flex-1 py-2.5 bg-primary text-white rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                {amalda ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                Saqlash
              </button>
              <button type="button" onClick={() => setModal(false)}
                className="px-5 py-2.5 border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400 rounded-xl font-medium">
                Bekor
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
