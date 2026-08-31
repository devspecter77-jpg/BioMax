'use client'

import { useEffect, useState } from 'react'
import { formatSum, formatPhone, formatSanaVaVaqt } from '@/lib/utils'
import { toast } from 'sonner'
import { UserPlus, Phone, MapPin, X, Hash, Trash2, Loader2, ShoppingBag, Calendar, Trophy, Users, Download, Upload } from 'lucide-react'
import ViewToggle from '@/components/ViewToggle'
import PhoneInput from '@/components/ui/phone-input'
import SearchBar from '@/components/ui/search-bar'
import { useConfirm } from '@/components/ConfirmProvider'

interface Mijoz {
  id: string; ism: string; telefon: string | null; manzil: string | null
  maxsus_kod: string | null
  _count: { sotuvlar: number; nasiyalar: number }; jami_qarz: number
}

interface SotuvTarkibiItem { id: string; miqdor: number; birlikNarxi: number; jami: number; tovar: { nomi: string } }
interface MijozSotuv {
  id: string; chekRaqami: string; sana: string; yakuniySumma: number; tolovUsuli: string
  tarkiblar: SotuvTarkibiItem[]; kassir: { ism: string }
}
interface MijozDetail extends Mijoz { sotuvlar: MijozSotuv[] }

const inputCls = 'w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 transition'

export default function MijozlarPage() {
  const confirm = useConfirm()
  const [mijozlar, setMijozlar] = useState<Mijoz[]>([])
  const [yuklanmoqda, setYuklanmoqda] = useState(true)
  const [qidiruv, setQidiruv] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ ism: '', telefon: '', manzil: '', izoh: '' })
  const [view, setView] = useState<'table' | 'card'>('table')
  const [saqlanmoqda, setSaqlanmoqda] = useState(false)
  const [ochirilayotganId, setOchirilayotganId] = useState<string | null>(null)
  const [kategoriya, setKategoriya] = useState<'barchasi' | 'top'>('barchasi')
  const [importYuklanmoqda, setImportYuklanmoqda] = useState(false)

  // Mijoz tafsilotlari (xaridlar tarixi)
  const [detailModal, setDetailModal] = useState(false)
  const [detailYuklanmoqda, setDetailYuklanmoqda] = useState(false)
  const [tanlanganMijoz, setTanlanganMijoz] = useState<MijozDetail | null>(null)

  async function mijozOch(id: string) {
    setDetailModal(true)
    setDetailYuklanmoqda(true)
    setTanlanganMijoz(null)
    const data = await fetch(`/api/mijozlar/${id}`).then(r => r.json()).catch(() => null)
    setTanlanganMijoz(data)
    setDetailYuklanmoqda(false)
  }

  async function yuklash() {
    setYuklanmoqda(true)
    const data = await fetch(`/api/mijozlar?q=${qidiruv}`).then(r => r.json())
    setMijozlar(data || [])
    setYuklanmoqda(false)
  }

  useEffect(() => {
    // Restore saved view preference from localStorage
    const saved = localStorage.getItem('mijozlar-view')
    if (saved === 'table' || saved === 'card') setView(saved)
  }, [])

  useEffect(() => { yuklash() }, [qidiruv])

  function changeView(v: 'table' | 'card') {
    setView(v)
    localStorage.setItem('mijozlar-view', v)
  }

  async function excelTanlash(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImportYuklanmoqda(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch('/api/mijozlar/import', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Import tugadi: ${data.qoshildi} ta qo'shildi, ${data.yangilandi} ta yangilandi`)
        yuklash()
      } else {
        toast.error(data.xato || 'Import xatoligi')
      }
    } catch {
      toast.error('Import amalga oshmadi')
    } finally {
      setImportYuklanmoqda(false)
    }
  }

  async function ochirish(m: Mijoz) {
    if (!(await confirm(`"${m.ism}" mijozni o'chirasizmi?`))) return
    setOchirilayotganId(m.id)
    try {
      const res = await fetch(`/api/mijozlar/${m.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.ok) { toast.success("Mijoz o'chirildi"); yuklash() }
      else toast.error(data.xato || "O'chirishda xatolik")
    } finally {
      setOchirilayotganId(null)
    }
  }

  async function saqlash(e: React.FormEvent) {
    e.preventDefault()
    setSaqlanmoqda(true)
    try {
      const res = await fetch('/api/mijozlar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      if (res.ok) {
        toast.success("Mijoz qo'shildi")
        setModal(false)
        setForm({ ism: '', telefon: '', manzil: '', izoh: '' })
        yuklash()
      } else toast.error('Xatolik yuz berdi')
    } finally {
      setSaqlanmoqda(false)
    }
  }

  const korsatiladiganMijozlar = kategoriya === 'top'
    ? [...mijozlar].sort((a, b) => b._count.sotuvlar - a._count.sotuvlar)
    : mijozlar

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchBar
          value={qidiruv}
          onChange={setQidiruv}
          placeholder="Ism yoki telefon raqam bo'yicha qidirish..."
          className="flex-1"
        />
        {/* View toggle placed between search and add button */}
        <ViewToggle view={view} onChange={changeView} />
        <a
          href="/api/mijozlar/export"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition whitespace-nowrap border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800"
        >
          <Download size={16} />
          Excel export
        </a>
        <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition whitespace-nowrap cursor-pointer border ${importYuklanmoqda ? 'opacity-60 cursor-not-allowed border-gray-300 dark:border-neutral-700 text-gray-400' : 'border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800'}`}>
          {importYuklanmoqda ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {importYuklanmoqda ? 'Yuklanmoqda...' : 'Excel import'}
          <input type="file" accept=".xlsx,.xls" className="hidden" disabled={importYuklanmoqda} onChange={excelTanlash} />
        </label>
        <button onClick={() => setModal(true)} className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-medium transition whitespace-nowrap">
          <UserPlus size={16} />
          Mijoz qo&apos;shish
        </button>
      </div>

      {/* Kategoriya tablari */}
      <div className="flex gap-2">
        <button
          onClick={() => setKategoriya('barchasi')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-medium transition ${
            kategoriya === 'barchasi'
              ? 'bg-red-600 text-white'
              : 'bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-800'
          }`}
        >
          <Users size={14} /> Barchasi
        </button>
        <button
          onClick={() => setKategoriya('top')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-medium transition ${
            kategoriya === 'top'
              ? 'bg-red-600 text-white'
              : 'bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-800'
          }`}
        >
          <Trophy size={14} /> Top mijozlar
        </button>
      </div>

      {/* TABLE VIEW */}
      {view === 'table' && (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <thead>
                <tr className="bg-gray-50 dark:bg-neutral-800 border-b border-gray-200 dark:border-neutral-800">
                  {kategoriya === 'top' && (
                    <th style={{ width: '44px' }} className="text-center text-gray-500 dark:text-gray-500 text-xs font-medium px-2 py-3 whitespace-nowrap">#</th>
                  )}
                  <th className="text-left text-gray-500 dark:text-gray-500 text-xs font-medium px-4 py-3">Ism</th>
                  <th style={{ width: '120px' }} className="text-left text-gray-500 dark:text-gray-500 text-xs font-medium px-4 py-3 hidden lg:table-cell whitespace-nowrap">Kod</th>
                  <th style={{ width: '180px' }} className="text-left text-gray-500 dark:text-gray-500 text-xs font-medium px-4 py-3 hidden sm:table-cell whitespace-nowrap">Telefon</th>
                  <th style={{ width: '160px' }} className="text-left text-gray-500 dark:text-gray-500 text-xs font-medium px-4 py-3 hidden md:table-cell whitespace-nowrap">Manzil</th>
                  <th style={{ width: '100px' }} className="text-center text-gray-500 dark:text-gray-500 text-xs font-medium px-4 py-3 whitespace-nowrap">Jami sotuv</th>
                  <th style={{ width: '140px' }} className="text-right text-gray-500 dark:text-gray-500 text-xs font-medium px-4 py-3 whitespace-nowrap">Qarz</th>
                  <th style={{ width: '60px' }} className="text-right text-gray-500 dark:text-gray-500 text-xs font-medium px-4 py-3 whitespace-nowrap">Amal</th>
                </tr>
              </thead>
              <tbody>
                {yuklanmoqda ? (
                  <tr><td colSpan={kategoriya === 'top' ? 8 : 7} className="text-center text-gray-400 dark:text-gray-600 py-12">Yuklanmoqda...</td></tr>
                ) : korsatiladiganMijozlar.length === 0 ? (
                  <tr><td colSpan={kategoriya === 'top' ? 8 : 7} className="text-center text-gray-400 dark:text-gray-600 py-12">Mijozlar topilmadi</td></tr>
                ) : korsatiladiganMijozlar.map((m, idx) => (
                  <tr key={m.id} onClick={() => mijozOch(m.id)} className={`border-b border-gray-100 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-800 transition cursor-pointer ${idx % 2 === 1 ? 'bg-gray-50/40 dark:bg-neutral-800/40' : ''}`}>
                    {kategoriya === 'top' && (
                      <td className="px-2 py-3 text-center">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-xs font-bold ${
                          idx === 0 ? 'bg-amber-100 text-amber-600' : idx === 1 ? 'bg-gray-200 text-gray-600' : idx === 2 ? 'bg-orange-100 text-orange-600' : 'text-gray-400 dark:text-gray-600'
                        }`}>{idx + 1}</span>
                      </td>
                    )}
                    {/* Ism with avatar — qolgan joyni o'zlashtiradi */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 bg-red-100 rounded-lg flex items-center justify-center text-red-600 font-bold text-sm shrink-0">
                          {m.ism[0]?.toUpperCase()}
                        </div>
                        <span className="text-gray-900 dark:text-gray-100 font-medium text-sm truncate">{m.ism}</span>
                      </div>
                    </td>
                    {/* Maxsus kod */}
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-500 text-sm hidden lg:table-cell whitespace-nowrap">
                      {m.maxsus_kod ? (
                        <span className="flex items-center gap-1 font-mono text-xs bg-gray-100 dark:bg-neutral-800 px-2 py-0.5 rounded-lg">
                          <Hash size={10} />{m.maxsus_kod}
                        </span>
                      ) : <span className="text-gray-300 dark:text-gray-700">—</span>}
                    </td>
                    {/* Telefon */}
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-500 text-sm hidden sm:table-cell whitespace-nowrap">
                      {m.telefon ? (
                        <a href={`tel:${m.telefon.replace(/\s/g, '')}`} onClick={e => e.stopPropagation()} className="flex items-center gap-1 text-blue-500 hover:text-blue-600"><Phone size={12} />{formatPhone(m.telefon)}</a>
                      ) : <span className="text-gray-300 dark:text-gray-700">—</span>}
                    </td>
                    {/* Manzil */}
                    <td className="px-4 py-3 text-gray-400 dark:text-gray-600 text-sm hidden md:table-cell whitespace-nowrap">
                      {m.manzil ? (
                        <span className="flex items-center gap-1 truncate"><MapPin size={12} />{m.manzil}</span>
                      ) : <span className="text-gray-300 dark:text-gray-700">—</span>}
                    </td>
                    {/* Jami sotuv */}
                    <td className="px-4 py-3 text-center text-gray-900 dark:text-gray-100 font-medium text-sm whitespace-nowrap">
                      {m._count.sotuvlar} ta
                    </td>
                    {/* Qarz */}
                    <td className="px-4 py-3 text-right font-semibold text-sm whitespace-nowrap">
                      <span className={m.jami_qarz > 0 ? 'text-red-600' : 'text-green-600'}>
                        {m.jami_qarz > 0 ? formatSum(m.jami_qarz) : "Yo'q"}
                      </span>
                    </td>
                    {/* Amal */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={e => { e.stopPropagation(); ochirish(m) }}
                        disabled={ochirilayotganId === m.id}
                        className="p-1.5 text-gray-400 dark:text-gray-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition disabled:opacity-50"
                        title="O'chirish"
                      >
                        {ochirilayotganId === m.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CARD VIEW */}
      {view === 'card' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {yuklanmoqda ? (
            <p className="text-gray-400 dark:text-gray-600 col-span-3 text-center py-12">Yuklanmoqda...</p>
          ) : korsatiladiganMijozlar.length === 0 ? (
            <p className="text-gray-400 dark:text-gray-600 col-span-3 text-center py-12">Mijozlar topilmadi</p>
          ) : korsatiladiganMijozlar.map((m, idx) => (
            <div key={m.id} onClick={() => mijozOch(m.id)} className="relative bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 hover:shadow-md transition-shadow cursor-pointer">
              {kategoriya === 'top' && (
                <span className={`absolute -top-2 -left-2 inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shadow ${
                  idx === 0 ? 'bg-amber-400 text-white' : idx === 1 ? 'bg-gray-300 text-gray-700' : idx === 2 ? 'bg-orange-400 text-white' : 'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-gray-400'
                }`}>{idx + 1}</span>
              )}
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-gray-900 dark:text-gray-100 font-semibold">{m.ism}</p>
                    <button
                      onClick={e => { e.stopPropagation(); ochirish(m) }}
                      disabled={ochirilayotganId === m.id}
                      className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition shrink-0 disabled:opacity-50"
                      title="O'chirish"
                    >
                      {ochirilayotganId === m.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                  {/* Clickable phone link */}
                  {m.telefon && (
                    <a href={`tel:${m.telefon.replace(/\s/g, '')}`} onClick={e => e.stopPropagation()} className="text-blue-500 hover:text-blue-600 text-sm flex items-center gap-1">
                      <Phone size={12} /> {formatPhone(m.telefon)}
                    </a>
                  )}
                  {m.manzil && (
                    <p className="text-gray-400 dark:text-gray-600 text-sm flex items-center gap-1">
                      <MapPin size={12} /> {m.manzil}
                    </p>
                  )}
                </div>
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-600 font-bold text-lg shrink-0 ml-2">
                  {m.ism[0]?.toUpperCase()}
                </div>
              </div>
              {m.maxsus_kod && (
                <p className="mt-1.5 text-xs font-mono text-gray-400 dark:text-gray-600 flex items-center gap-1">
                  <Hash size={10} />{m.maxsus_kod}
                </p>
              )}
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-neutral-800 grid grid-cols-2 gap-2">
                <div className="text-center">
                  <p className="text-gray-400 dark:text-gray-600 text-xs">Jami sotuv</p>
                  <p className="text-gray-900 dark:text-gray-100 font-semibold">{m._count.sotuvlar} ta</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-400 dark:text-gray-600 text-xs">Qarz</p>
                  <p className={`font-semibold ${m.jami_qarz > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {m.jami_qarz > 0 ? formatSum(m.jami_qarz) : "Yo'q"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4 pb-24 sm:pb-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl dark:shadow-none dark:border dark:border-neutral-800 w-full max-w-md">
            <div className="p-5 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-gray-900 dark:text-gray-100 font-semibold">Yangi mijoz</h3>
              <button onClick={() => setModal(false)} className="p-1.5 text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={saqlash} className="p-5 space-y-4">
              {/* Ism field */}
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Ism *</label>
                <input type="text" required
                  value={form.ism}
                  onChange={e => setForm(prev => ({ ...prev, ism: e.target.value }))}
                  className={inputCls} />
              </div>
              {/* Telefon — PhoneInput component */}
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Telefon</label>
                <PhoneInput
                  value={form.telefon}
                  onChange={v => setForm(f => ({ ...f, telefon: v }))}
                  placeholder="+998 (__) ___-__-__"
                />
              </div>
              {/* Manzil field */}
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Manzil</label>
                <input type="text"
                  value={form.manzil}
                  onChange={e => setForm(prev => ({ ...prev, manzil: e.target.value }))}
                  className={inputCls} />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setModal(false)}
                  className="flex-1 py-2.5 border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition font-medium">Bekor</button>
                <button type="submit" disabled={saqlanmoqda} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white rounded-xl font-medium transition flex items-center justify-center gap-2">
                  {saqlanmoqda ? <Loader2 size={16} className="animate-spin" /> : null}
                  {saqlanmoqda ? "Qo'shilmoqda..." : "Qo'shish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mijoz tafsilotlari — xaridlar tarixi */}
      {detailModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4 pb-24 sm:pb-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl dark:border dark:border-neutral-800 w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between sticky top-0 bg-white dark:bg-neutral-900 z-10">
              <h3 className="text-gray-900 dark:text-gray-100 font-semibold">
                {detailYuklanmoqda ? 'Yuklanmoqda...' : tanlanganMijoz?.ism || 'Mijoz'}
              </h3>
              <button onClick={() => setDetailModal(false)} className="p-1.5 text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition">
                <X size={18} />
              </button>
            </div>

            {detailYuklanmoqda ? (
              <div className="p-10 flex items-center justify-center">
                <Loader2 size={24} className="animate-spin text-red-500" />
              </div>
            ) : !tanlanganMijoz ? (
              <p className="p-8 text-center text-gray-400 dark:text-gray-600">Ma&apos;lumot topilmadi</p>
            ) : (
              <div className="p-5 space-y-4">
                <div className="flex flex-wrap gap-2 text-sm">
                  {tanlanganMijoz.telefon && (
                    <a href={`tel:${tanlanganMijoz.telefon.replace(/\s/g, '')}`} className="flex items-center gap-1 text-blue-500 hover:text-blue-600 bg-blue-50 dark:bg-blue-950/30 px-2.5 py-1 rounded-lg">
                      <Phone size={12} />{formatPhone(tanlanganMijoz.telefon)}
                    </a>
                  )}
                  {tanlanganMijoz.manzil && (
                    <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-neutral-800 px-2.5 py-1 rounded-lg">
                      <MapPin size={12} />{tanlanganMijoz.manzil}
                    </span>
                  )}
                  {tanlanganMijoz.jami_qarz > 0 && (
                    <span className="flex items-center gap-1 text-red-600 bg-red-50 dark:bg-red-950/30 px-2.5 py-1 rounded-lg font-medium">
                      Qarz: {formatSum(tanlanganMijoz.jami_qarz)}
                    </span>
                  )}
                </div>

                <div>
                  <p className="text-gray-700 dark:text-gray-300 text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <ShoppingBag size={14} />
                    Xaridlar tarixi ({tanlanganMijoz.sotuvlar.length} ta)
                  </p>
                  {tanlanganMijoz.sotuvlar.length === 0 ? (
                    <p className="text-gray-400 dark:text-gray-600 text-sm text-center py-6">Hali xarid qilmagan</p>
                  ) : (
                    <div className="space-y-2">
                      {tanlanganMijoz.sotuvlar.map(s => (
                        <div key={s.id} className="border border-gray-200 dark:border-neutral-700 rounded-xl p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{s.chekRaqami}</span>
                            <span className="text-green-600 font-semibold text-sm">{formatSum(s.yakuniySumma)}</span>
                          </div>
                          <p className="text-gray-400 dark:text-gray-600 text-xs mt-0.5 flex items-center gap-1">
                            <Calendar size={11} />{formatSanaVaVaqt(s.sana)}
                          </p>
                          <div className="mt-2 pt-2 border-t border-gray-100 dark:border-neutral-800 space-y-1">
                            {s.tarkiblar.map(t => (
                              <div key={t.id} className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                                <span className="truncate">{t.tovar.nomi} × {t.miqdor}</span>
                                <span className="shrink-0 ml-2">{formatSum(t.jami)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
