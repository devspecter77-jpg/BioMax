'use client'

import { useEffect, useState } from 'react'
import { formatSum, formatSana, uzSearch } from '@/lib/utils'
import { toast } from 'sonner'
import { Phone, Banknote, X, Clock, Plus, Trash2, PlusCircle, Pencil, Users, AlertTriangle, CheckCircle, TrendingDown, Download, Upload, Loader2 } from 'lucide-react'
import ViewToggle from '@/components/ViewToggle'
import MoneyInput from '@/components/ui/money-input'
import DateInput from '@/components/ui/date-input'
import SearchBar from '@/components/ui/search-bar'
import { useConfirm } from '@/components/ConfirmProvider'

interface NasiyaTolov {
  id: string
  summa: number
  tolovUsuli: string
  izoh: string | null
  sana: string
}

interface NasiyaQarz {
  id: string
  summa: number
  izoh: string | null
  sana: string
}

interface Nasiya {
  id: string
  mijoz: { ism: string; telefon: string | null; manzil?: string | null }
  sotuv: { chekRaqami: string; sana: string } | null
  jamiQarz: number; tolangan: number; qoldiq: number
  muddat: string | null; holati: string; sana: string
  tolovlar: NasiyaTolov[]
  qarzTarixi: NasiyaQarz[]
}

const inputCls = 'w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 transition'

function formatPhoneInput(raw: string): string {
  let v = raw.replace(/\D/g, '')
  if (v.startsWith('998')) v = v
  else if (v.startsWith('8') && v.length > 1) v = '998' + v.slice(1)
  else if (v.length > 0 && !v.startsWith('998')) v = '998' + v
  if (v.length > 12) v = v.slice(0, 12)
  let formatted = ''
  if (v.length > 0) formatted = '+' + v.slice(0, 3)
  if (v.length > 3) formatted += ' ' + v.slice(3, 5)
  if (v.length > 5) formatted += ' ' + v.slice(5, 8)
  if (v.length > 8) formatted += ' ' + v.slice(8, 10)
  if (v.length > 10) formatted += ' ' + v.slice(10, 12)
  return formatted
}

const holatiConfig = {
  OCHIQ: { cls: 'text-amber-600 bg-amber-50', label: 'Ochiq' },
  MUDDATI_OTGAN: { cls: 'text-red-600 bg-red-50', label: "Muddati o'tgan" },
  YOPILGAN: { cls: 'text-green-600 bg-green-50', label: 'Yopilgan' },
}

export default function NasiyalarPage() {
  const confirm = useConfirm()
  const [nasiyalar, setNasiyalar] = useState<Nasiya[]>([])
  const [barchasi, setBarchasi] = useState<Nasiya[]>([])
  const [yuklanmoqda, setYuklanmoqda] = useState(true)
  const [filter, setFilter] = useState('OCHIQ')
  const [qidiruv, setQidiruv] = useState('')
  const [tolovModal, setTolovModal] = useState<Nasiya | null>(null)
  const [tolovForm, setTolovForm] = useState({ summa: '', tolovUsuli: 'NAQD', izoh: '' })
  const [view, setView] = useState<'table' | 'card'>('table')
  const [qoshishModal, setQoshishModal] = useState(false)
  const [qoshishForm, setQoshishForm] = useState({ ism: '', manzil: '', telefon: '', qarz: '', muddat: '', sana: new Date().toISOString().slice(0, 10) })
  const [qoshishYuklash, setQoshishYuklash] = useState(false)
  const [qarzQoshishModal, setQarzQoshishModal] = useState<Nasiya | null>(null)
  const [qarzQoshishForm, setQarzQoshishForm] = useState({ summa: '', muddat: '' })
  const [qarzQoshishYuklash, setQarzQoshishYuklash] = useState(false)
  const [tahrirlashModal, setTahrirlashModal] = useState<Nasiya | null>(null)
  const [tahrirlashForm, setTahrirlashForm] = useState({ ism: '', manzil: '', telefon: '', qarz: '', muddat: '', sana: '' })
  const [tahrirlashYuklash, setTahrirlashYuklash] = useState(false)
  const [importYuklanmoqda, setImportYuklanmoqda] = useState(false)

  async function excelTanlash(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImportYuklanmoqda(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch('/api/nasiyalar/import', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Import tugadi: ${data.qoshildi} ta qo'shildi`)
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

  async function yuklash() {
    setYuklanmoqda(true)
    const [filtered, all] = await Promise.all([
      fetch(`/api/nasiyalar${filter ? `?holati=${filter}` : ''}`).then(r => r.json()),
      fetch('/api/nasiyalar').then(r => r.json()),
    ])
    setNasiyalar(filtered || [])
    setBarchasi(all || [])
    setYuklanmoqda(false)
  }

  useEffect(() => {
    // Restore saved view preference from localStorage
    const saved = localStorage.getItem('nasiyalar-view')
    if (saved === 'table' || saved === 'card') setView(saved)
  }, [])

  useEffect(() => { yuklash() }, [filter])

  // Stats hisoblash
  const yopilganlar = barchasi.filter(n => n.holati === 'YOPILGAN')
  const stats = {
    jamiQarz: barchasi.reduce((s, n) => s + Number(n.jamiQarz), 0),
    jamiTolangan: barchasi.reduce((s, n) => s + Number(n.tolangan), 0),
    jamiQoldiq: barchasi.reduce((s, n) => s + Number(n.qoldiq), 0),
    ochiq: barchasi.filter(n => n.holati === 'OCHIQ').length,
    muddatiOtgan: barchasi.filter(n => n.holati === 'MUDDATI_OTGAN').length,
    yopilgan: yopilganlar.length,
    yopilganTolangan: yopilganlar.reduce((s, n) => s + Math.min(Number(n.tolangan), Number(n.jamiQarz)), 0),
    mijozlarSoni: new Set(barchasi.map(n => n.mijoz.ism)).size,
  }

  function changeView(v: 'table' | 'card') {
    setView(v)
    localStorage.setItem('nasiyalar-view', v)
  }

  /** Open payment modal for a nasiya record */
  function openTolovModal(n: Nasiya) {
    if (n.holati === 'YOPILGAN') return
    setTolovModal(n)
    setTolovForm({ summa: '', tolovUsuli: 'NAQD', izoh: '' })
  }

  async function tolovQilish(e: React.FormEvent) {
    e.preventDefault()
    if (!tolovModal) return
    const res = await fetch(`/api/nasiyalar/${tolovModal.id}/tolov`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tolovForm)
    })
    if (res.ok) {
      toast.success("To'lov qabul qilindi!")
      setTolovModal(null)
      setTolovForm({ summa: '', tolovUsuli: 'NAQD', izoh: '' })
      yuklash()
    } else toast.error('Xatolik yuz berdi')
  }

  async function nasiyaQoshish(e: React.FormEvent) {
    e.preventDefault()
    setQoshishYuklash(true)
    try {
      const res = await fetch('/api/nasiyalar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(qoshishForm),
      })
      if (res.ok) {
        toast.success('Nasiya muvaffaqiyatli qo\'shildi!')
        setQoshishModal(false)
        setQoshishForm({ ism: '', manzil: '', telefon: '', qarz: '', muddat: '', sana: new Date().toISOString().slice(0, 10) })
        yuklash()
      } else {
        const data = await res.json()
        toast.error(data.xato || 'Xatolik yuz berdi')
      }
    } catch {
      toast.error('Xatolik yuz berdi')
    }
    setQoshishYuklash(false)
  }

  async function qarzQoshish(e: React.FormEvent) {
    e.preventDefault()
    if (!qarzQoshishModal) return
    setQarzQoshishYuklash(true)
    try {
      const res = await fetch(`/api/nasiyalar/${qarzQoshishModal.id}/qarz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summa: qarzQoshishForm.summa, muddat: qarzQoshishForm.muddat || null }),
      })
      if (res.ok) {
        toast.success('Qarz qo\'shildi!')
        setQarzQoshishModal(null)
        setQarzQoshishForm({ summa: '', muddat: '' })
        yuklash()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.xato || 'Xatolik yuz berdi')
      }
    } catch {
      toast.error('Xatolik yuz berdi')
    }
    setQarzQoshishYuklash(false)
  }

  function openTahrirlash(n: Nasiya) {
    setTahrirlashModal(n)
    setTahrirlashForm({
      ism: n.mijoz.ism,
      manzil: n.mijoz.manzil || '',
      telefon: n.mijoz.telefon || '',
      qarz: String(n.jamiQarz),
      muddat: n.muddat ? n.muddat.slice(0, 10) : '',
      sana: n.sana ? n.sana.slice(0, 10) : '',
    })
  }

  async function tahrirlash(e: React.FormEvent) {
    e.preventDefault()
    if (!tahrirlashModal) return
    setTahrirlashYuklash(true)
    try {
      const res = await fetch(`/api/nasiyalar/${tahrirlashModal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tahrirlashForm),
      })
      if (res.ok) {
        toast.success('Ma\'lumotlar yangilandi!')
        setTahrirlashModal(null)
        yuklash()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.xato || 'Xatolik yuz berdi')
      }
    } catch {
      toast.error('Xatolik yuz berdi')
    }
    setTahrirlashYuklash(false)
  }

  async function nasiyaOchirish(id: string, ism: string) {
    if (!(await confirm(`"${ism}" nasiyasini o'chirishni tasdiqlaysizmi?`))) return
    const res = await fetch(`/api/nasiyalar/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Nasiya o\'chirildi')
      yuklash()
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.xato || 'Xatolik yuz berdi')
    }
  }

  // Qidiruv — barcha statuslarda qidirish, keyin filtrga qarab ko'rsatish
  const filteredNasiyalar = (() => {
    let list = nasiyalar
    if (qidiruv) {
      // Barcha nasiyalar ichidan qidirish
      const topilganlar = barchasi.filter(n =>
        uzSearch(n.mijoz.ism, qidiruv) ||
        (n.sotuv?.chekRaqami || '').toLowerCase().includes(qidiruv.toLowerCase()) ||
        uzSearch(n.mijoz.manzil || '', qidiruv) ||
        (n.mijoz.telefon || '').includes(qidiruv)
      )
      // Agar filtr tanlangan bo'lsa — shu filtr ichida qidiradi, aks holda hammasi
      list = filter ? topilganlar.filter(n => n.holati === filter) : topilganlar
    }
    return list
  })()

  return (
    <div className="space-y-4">
      {/* Stats Cards = Filter */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button onClick={() => setFilter('')}
          className={`text-left rounded-2xl p-3 sm:p-5 transition-shadow border-2 ${filter === '' ? 'border-red-500 shadow-md' : 'border-gray-200 dark:border-neutral-800 hover:shadow-md'} bg-white dark:bg-neutral-900`}>
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-gray-500 dark:text-gray-500 text-xs sm:text-sm">Qolgan qarz</p>
              <p className="text-base sm:text-2xl font-bold mt-1 text-gray-900 dark:text-gray-100">{formatSum(stats.jamiQoldiq)}</p>
              <p className="text-gray-400 dark:text-gray-600 text-[10px] sm:text-xs mt-0.5 sm:mt-1">{stats.mijozlarSoni} ta mijoz</p>
            </div>
            <div className="w-8 h-8 sm:w-11 sm:h-11 bg-red-500 rounded-xl flex items-center justify-center shrink-0 ml-2 sm:ml-3">
              <Banknote size={16} className="text-white sm:w-5 sm:h-5" />
            </div>
          </div>
        </button>
        <button onClick={() => setFilter('OCHIQ')}
          className={`text-left rounded-2xl p-3 sm:p-5 transition-shadow border-2 ${filter === 'OCHIQ' ? 'border-amber-500 shadow-md' : 'border-gray-200 dark:border-neutral-800 hover:shadow-md'} bg-white dark:bg-neutral-900`}>
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-gray-500 dark:text-gray-500 text-xs sm:text-sm">Ochiq</p>
              <p className="text-base sm:text-2xl font-bold mt-1 text-amber-600">{stats.ochiq} ta</p>
              <p className="text-gray-400 dark:text-gray-600 text-[10px] sm:text-xs mt-0.5 sm:mt-1">Qarz: {formatSum(stats.jamiQoldiq)}</p>
            </div>
            <div className="w-8 h-8 sm:w-11 sm:h-11 bg-amber-500 rounded-xl flex items-center justify-center shrink-0 ml-2 sm:ml-3">
              <Clock size={16} className="text-white sm:w-5 sm:h-5" />
            </div>
          </div>
        </button>
        <button onClick={() => setFilter('MUDDATI_OTGAN')}
          className={`text-left rounded-2xl p-3 sm:p-5 transition-shadow border-2 ${filter === 'MUDDATI_OTGAN' ? 'border-red-500 shadow-md' : 'border-gray-200 dark:border-neutral-800 hover:shadow-md'} bg-white dark:bg-neutral-900`}>
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-gray-500 dark:text-gray-500 text-xs sm:text-sm">Muddati o&apos;tgan</p>
              <p className="text-base sm:text-2xl font-bold mt-1 text-red-600">{stats.muddatiOtgan} ta</p>
              <p className="text-gray-400 dark:text-gray-600 text-[10px] sm:text-xs mt-0.5 sm:mt-1">Diqqat talab etadi</p>
            </div>
            <div className="w-8 h-8 sm:w-11 sm:h-11 bg-red-600 rounded-xl flex items-center justify-center shrink-0 ml-2 sm:ml-3">
              <AlertTriangle size={16} className="text-white sm:w-5 sm:h-5" />
            </div>
          </div>
        </button>
        <button onClick={() => setFilter('YOPILGAN')}
          className={`text-left rounded-2xl p-3 sm:p-5 transition-shadow border-2 ${filter === 'YOPILGAN' ? 'border-green-500 shadow-md' : 'border-gray-200 dark:border-neutral-800 hover:shadow-md'} bg-white dark:bg-neutral-900`}>
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-gray-500 dark:text-gray-500 text-xs sm:text-sm">Yopilgan</p>
              <p className="text-base sm:text-2xl font-bold mt-1 text-green-600">{stats.yopilgan} ta</p>
              <p className="text-gray-400 dark:text-gray-600 text-[10px] sm:text-xs mt-0.5 sm:mt-1">To&apos;langan: {formatSum(stats.yopilganTolangan)}</p>
            </div>
            <div className="w-8 h-8 sm:w-11 sm:h-11 bg-green-500 rounded-xl flex items-center justify-center shrink-0 ml-2 sm:ml-3">
              <CheckCircle size={16} className="text-white sm:w-5 sm:h-5" />
            </div>
          </div>
        </button>
      </div>

      <SearchBar
        value={qidiruv}
        onChange={setQidiruv}
        placeholder="Mijoz ismi yoki chek raqami bo'yicha qidirish..."
        debounceMs={0}
      />

      {/* ViewToggle + Qo'shish */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1" />
        <div className="hidden sm:block">
          <ViewToggle view={view} onChange={changeView} />
        </div>
        <a
          href="/api/nasiyalar/export"
          title="Excel export"
          className="flex items-center gap-1.5 p-2.5 sm:px-4 sm:py-2 rounded-xl text-sm font-medium transition border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800"
        >
          <Download size={16} />
          <span className="hidden sm:inline">Excel export</span>
        </a>
        <label title="Excel import" className={`flex items-center gap-1.5 p-2.5 sm:px-4 sm:py-2 rounded-xl text-sm font-medium transition cursor-pointer border ${importYuklanmoqda ? 'opacity-60 cursor-not-allowed border-gray-300 dark:border-neutral-700 text-gray-400' : 'border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800'}`}>
          {importYuklanmoqda ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          <span className="hidden sm:inline">{importYuklanmoqda ? 'Yuklanmoqda...' : 'Excel import'}</span>
          <input type="file" accept=".xlsx,.xls" className="hidden" disabled={importYuklanmoqda} onChange={excelTanlash} />
        </label>
        <button
          onClick={() => setQoshishModal(true)}
          className="flex items-center gap-1.5 p-2.5 sm:px-4 sm:py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-medium transition">
          <Plus size={16} />
          <span className="hidden sm:inline">Nasiya qo&apos;shish</span>
        </button>
      </div>

      {/* TABLE VIEW — faqat desktopda */}
      {view === 'table' && (
        <div className="hidden sm:block bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <thead>
                <tr className="bg-gray-50 dark:bg-neutral-800 border-b border-gray-200 dark:border-neutral-800">
                  <th className="text-left text-gray-500 dark:text-gray-500 text-xs font-medium px-4 py-3">Mijoz</th>
                  <th style={{ width: '110px' }} className="text-center text-gray-500 dark:text-gray-500 text-xs font-medium px-4 py-3 whitespace-nowrap">Holati</th>
                  <th style={{ width: '130px' }} className="text-right text-gray-500 dark:text-gray-500 text-xs font-medium px-4 py-3 hidden lg:table-cell whitespace-nowrap">Jami qarz</th>
                  <th style={{ width: '130px' }} className="text-right text-gray-500 dark:text-gray-500 text-xs font-medium px-4 py-3 hidden lg:table-cell whitespace-nowrap">To&apos;langan</th>
                  <th style={{ width: '130px' }} className="text-right text-gray-500 dark:text-gray-500 text-xs font-medium px-4 py-3 whitespace-nowrap">Qoldiq</th>
                  <th style={{ width: '110px' }} className="text-right text-gray-500 dark:text-gray-500 text-xs font-medium px-4 py-3 hidden md:table-cell whitespace-nowrap">Berilgan</th>
                  <th style={{ width: '110px' }} className="text-right text-gray-500 dark:text-gray-500 text-xs font-medium px-4 py-3 hidden md:table-cell whitespace-nowrap">Qaytarish</th>
                  <th style={{ width: '120px' }} className="text-center text-gray-500 dark:text-gray-500 text-xs font-medium px-4 py-3 whitespace-nowrap">Amal</th>
                </tr>
              </thead>
              <tbody>
                {yuklanmoqda ? (
                  <tr><td colSpan={8} className="text-center text-gray-400 dark:text-gray-600 py-12">Yuklanmoqda...</td></tr>
                ) : nasiyalar.length === 0 ? (
                  <tr><td colSpan={8} className="text-center text-gray-400 dark:text-gray-600 py-12">Nasiyalar topilmadi</td></tr>
                ) : filteredNasiyalar.map((n, idx) => {
                  const hCfg = holatiConfig[n.holati as keyof typeof holatiConfig]
                  return (
                    <tr
                      key={n.id}
                      onClick={() => openTolovModal(n)}
                      className={`border-b border-gray-100 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-800 transition ${idx % 2 === 1 ? 'bg-gray-50/40 dark:bg-neutral-800/40' : ''} ${n.holati !== 'YOPILGAN' ? 'cursor-pointer' : ''}`}
                    >
                      {/* Mijoz + Telefon — qolgan joyni o'zlashtiradi */}
                      <td className="px-4 py-3">
                        <div className="min-w-0">
                          <div className="text-gray-900 dark:text-gray-100 font-medium text-sm truncate">{n.mijoz.ism}</div>
                          {n.mijoz.telefon && (
                            <a href={`tel:${n.mijoz.telefon.replace(/\s/g, '')}`} onClick={e => e.stopPropagation()} className="text-blue-500 hover:text-blue-600 text-xs inline-flex items-center gap-1 mt-0.5 truncate"><Phone size={10} />{n.mijoz.telefon}</a>
                          )}
                          {n.mijoz.manzil && (
                            <div className="text-gray-400 dark:text-gray-500 text-xs mt-0.5 truncate">{n.mijoz.manzil}</div>
                          )}
                        </div>
                      </td>
                      {/* Holati */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className={`text-xs px-2 py-0.5 rounded-lg font-medium ${hCfg?.cls || ''}`}>
                          {hCfg?.label || n.holati}
                        </span>
                      </td>
                      {/* Jami qarz */}
                      <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-500 text-sm hidden lg:table-cell whitespace-nowrap">{formatSum(n.jamiQarz)}</td>
                      {/* To'langan */}
                      <td className="px-4 py-3 text-right text-green-600 text-sm hidden lg:table-cell whitespace-nowrap">{formatSum(n.tolangan)}</td>
                      {/* Qoldiq */}
                      <td className="px-4 py-3 text-right text-red-600 font-semibold text-sm whitespace-nowrap">{formatSum(n.qoldiq)}</td>
                      {/* Berilgan sana */}
                      <td className="px-4 py-3 text-right text-gray-400 dark:text-gray-600 text-sm hidden md:table-cell whitespace-nowrap">
                        {formatSana(n.sana)}
                      </td>
                      {/* Qaytarish sanasi */}
                      <td className="px-4 py-3 text-right text-gray-400 dark:text-gray-600 text-sm hidden md:table-cell whitespace-nowrap">
                        {n.muddat ? formatSana(n.muddat) : <span className="text-gray-300 dark:text-gray-700">—</span>}
                      </td>
                      {/* Amal: To'lov + O'chirish buttons */}
                      <td className="px-4 py-3 text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          {n.holati !== 'YOPILGAN' && (
                            <button
                              onClick={() => openTolovModal(n)}
                              className="inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 bg-green-50 hover:bg-green-100 dark:bg-green-950/30 dark:hover:bg-green-950/50 text-green-700 dark:text-green-400 rounded-lg text-xs font-medium transition"
                              title="To'lov">
                              <Banknote size={12} />
                              <span className="hidden lg:inline">To&apos;lov</span>
                            </button>
                          )}
                          <button
                            onClick={() => { setQarzQoshishModal(n); setQarzQoshishForm({ summa: '', muddat: n.muddat ? n.muddat.slice(0, 10) : '' }) }}
                            className="inline-flex items-center p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition"
                            title="Qarz qo'shish">
                            <PlusCircle size={14} />
                          </button>
                          <button
                            onClick={() => openTahrirlash(n)}
                            className="inline-flex items-center p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition"
                            title="Tahrirlash">
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => nasiyaOchirish(n.id, n.mijoz.ism)}
                            className="inline-flex items-center p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition"
                            title="O'chirish">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CARD VIEW — mobilda har doim ko'rinadi, desktopda faqat view==='card' bo'lsa */}
      <div className={`space-y-3 ${view === 'card' ? '' : 'sm:hidden'}`}>
          {yuklanmoqda ? (
            <p className="text-gray-400 dark:text-gray-600 text-center py-12">Yuklanmoqda...</p>
          ) : nasiyalar.length === 0 ? (
            <p className="text-gray-400 dark:text-gray-600 text-center py-12">Nasiyalar topilmadi</p>
          ) : filteredNasiyalar.map(n => {
            const hCfg = holatiConfig[n.holati as keyof typeof holatiConfig]
            return (
              <div
                key={n.id}
                onClick={() => openTolovModal(n)}
                className={`bg-white dark:bg-neutral-900 border rounded-2xl p-4 transition ${n.holati === 'MUDDATI_OTGAN' ? 'border-red-200 dark:border-red-900' : 'border-gray-200 dark:border-neutral-800'} ${n.holati !== 'YOPILGAN' ? 'cursor-pointer hover:shadow-md' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-gray-900 dark:text-gray-100 font-semibold">{n.mijoz.ism}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-lg font-medium ${hCfg?.cls || ''}`}>
                        {hCfg?.label || n.holati}
                      </span>
                    </div>
                    {n.mijoz.telefon && (
                      <a href={`tel:${n.mijoz.telefon.replace(/\s/g, '')}`} onClick={e => e.stopPropagation()} className="text-blue-500 hover:text-blue-600 text-sm mt-0.5 flex items-center gap-1">
                        <Phone size={12} /> {n.mijoz.telefon}
                      </a>
                    )}
                    {n.mijoz.manzil && (
                      <p className="text-gray-400 dark:text-gray-500 text-xs mt-0.5">{n.mijoz.manzil}</p>
                    )}
                    <p className="text-gray-400 dark:text-gray-600 text-xs mt-1">
                      {formatSana(n.sana)}
                      {n.muddat && ` • Muddat: ${formatSana(n.muddat)}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-red-600 font-bold text-lg">{formatSum(n.qoldiq)}</p>
                    <p className="text-gray-400 dark:text-gray-600 text-xs">Jami: {formatSum(n.jamiQarz)}</p>
                    <p className="text-green-600 text-xs">To&apos;langan: {formatSum(n.tolangan)}</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3 bg-gray-100 dark:bg-neutral-800 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (Number(n.tolangan) / Number(n.jamiQarz)) * 100)}%` }}
                  />
                </div>

                {/* Action buttons */}
                <div className="mt-3 flex gap-2" onClick={e => e.stopPropagation()}>
                  {n.holati !== 'YOPILGAN' && (
                    <button
                      onClick={() => openTolovModal(n)}
                      className="flex-1 py-2 bg-green-50 hover:bg-green-100 dark:bg-green-950/30 dark:hover:bg-green-950/50 text-green-700 dark:text-green-400 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2">
                      <Banknote size={15} />
                      To&apos;lov
                    </button>
                  )}
                  <button
                    onClick={() => { setQarzQoshishModal(n); setQarzQoshishForm({ summa: '', muddat: n.muddat ? n.muddat.slice(0, 10) : '' }) }}
                    className="px-3 py-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 border border-blue-200 dark:border-blue-900/30 rounded-xl transition"
                    title="Qarz qo'shish">
                    <PlusCircle size={15} />
                  </button>
                  <button
                    onClick={() => openTahrirlash(n)}
                    className="px-3 py-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl transition"
                    title="Tahrirlash">
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => nasiyaOchirish(n.id, n.mijoz.ism)}
                    className="px-3 py-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 border border-red-200 dark:border-red-900/30 rounded-xl transition">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            )
          })}
      </div>

      {/* Tahrirlash modal */}
      {tahrirlashModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4 pb-24 sm:pb-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl dark:shadow-none dark:border dark:border-neutral-800 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-gray-900 dark:text-gray-100 font-semibold">Nasiyani tahrirlash</h3>
              <button
                onClick={() => setTahrirlashModal(null)}
                className="p-1.5 text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={tahrirlash} className="p-5 space-y-4">
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Ism *</label>
                <input
                  value={tahrirlashForm.ism}
                  onChange={e => setTahrirlashForm(f => ({ ...f, ism: e.target.value }))}
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Manzil</label>
                <input
                  value={tahrirlashForm.manzil}
                  onChange={e => setTahrirlashForm(f => ({ ...f, manzil: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Telefon raqam</label>
                <input
                  value={tahrirlashForm.telefon}
                  onChange={e => setTahrirlashForm(f => ({ ...f, telefon: formatPhoneInput(e.target.value) }))}
                  className={inputCls}
                  placeholder="+998 90 123 45 67"
                  type="tel"
                />
              </div>
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Qarz summasi *</label>
                <MoneyInput
                  value={tahrirlashForm.qarz}
                  onChange={v => setTahrirlashForm(f => ({ ...f, qarz: v }))}
                  required
                  min={1}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Berilgan sana</label>
                <DateInput
                  value={tahrirlashForm.sana}
                  onChange={v => setTahrirlashForm(f => ({ ...f, sana: v }))}
                />
              </div>
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Qaytarish sanasi</label>
                <DateInput
                  value={tahrirlashForm.muddat}
                  onChange={v => setTahrirlashForm(f => ({ ...f, muddat: v }))}
                />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setTahrirlashModal(null)}
                  className="flex-1 py-2.5 border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition font-medium">
                  Bekor
                </button>
                <button type="submit" disabled={tahrirlashYuklash}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-medium transition disabled:opacity-50">
                  {tahrirlashYuklash ? 'Saqlanmoqda...' : 'Saqlash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Qarz qo'shish modal */}
      {qarzQoshishModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4 pb-24 sm:pb-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl dark:shadow-none dark:border dark:border-neutral-800 w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-200 dark:border-neutral-800 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-gray-900 dark:text-gray-100 font-semibold">Qarz qo&apos;shish</h3>
                <p className="text-gray-500 dark:text-gray-500 text-sm">{qarzQoshishModal.mijoz.ism}</p>
                <p className="text-xs text-gray-400 mt-1">Hozirgi qarz: <span className="text-red-600 font-medium">{formatSum(qarzQoshishModal.qoldiq)}</span></p>
              </div>
              <button
                onClick={() => setQarzQoshishModal(null)}
                className="p-1.5 text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition shrink-0">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={qarzQoshish} className="p-5 space-y-4">
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Qo&apos;shiladigan summa *</label>
                <MoneyInput
                  value={qarzQoshishForm.summa}
                  onChange={v => setQarzQoshishForm(f => ({ ...f, summa: v }))}
                  required
                  min={1}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Yangi muddat (qaytarish sanasi)</label>
                <DateInput
                  value={qarzQoshishForm.muddat}
                  onChange={v => setQarzQoshishForm(f => ({ ...f, muddat: v }))}
                />
                <p className="text-xs text-gray-400 mt-1">Bo&apos;sh qoldirilsa, eski muddat saqlanadi.</p>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setQarzQoshishModal(null)}
                  className="flex-1 py-2.5 border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition font-medium">
                  Bekor
                </button>
                <button type="submit" disabled={qarzQoshishYuklash}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition disabled:opacity-50">
                  {qarzQoshishYuklash ? 'Saqlanmoqda...' : 'Qo\'shish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Nasiya qo'shish modal */}
      {qoshishModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4 pb-24 sm:pb-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl dark:shadow-none dark:border dark:border-neutral-800 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-gray-900 dark:text-gray-100 font-semibold">Nasiya qo&apos;shish</h3>
              <button
                onClick={() => setQoshishModal(false)}
                className="p-1.5 text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={nasiyaQoshish} className="p-5 space-y-4">
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Ism *</label>
                <input
                  value={qoshishForm.ism}
                  onChange={e => setQoshishForm(f => ({ ...f, ism: e.target.value }))}
                  className={inputCls}
                  placeholder="Mijoz ismi"
                  required
                />
              </div>
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Manzil *</label>
                <input
                  value={qoshishForm.manzil}
                  onChange={e => setQoshishForm(f => ({ ...f, manzil: e.target.value }))}
                  className={inputCls}
                  placeholder="Manzil"
                  required
                />
              </div>
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Qarz summasi *</label>
                <MoneyInput
                  value={qoshishForm.qarz}
                  onChange={v => setQoshishForm(f => ({ ...f, qarz: v }))}
                  required
                  min={1}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Berilgan sana *</label>
                <DateInput
                  value={qoshishForm.sana}
                  onChange={v => setQoshishForm(f => ({ ...f, sana: v }))}
                  required
                />
              </div>
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Qaytarish sanasi</label>
                <DateInput
                  value={qoshishForm.muddat}
                  onChange={v => setQoshishForm(f => ({ ...f, muddat: v }))}
                />
              </div>
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Telefon raqam</label>
                <input
                  value={qoshishForm.telefon}
                  onChange={e => setQoshishForm(f => ({ ...f, telefon: formatPhoneInput(e.target.value) }))}
                  className={inputCls}
                  placeholder="+998 90 123 45 67"
                  type="tel"
                />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setQoshishModal(false)}
                  className="flex-1 py-2.5 border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition font-medium">
                  Bekor
                </button>
                <button type="submit" disabled={qoshishYuklash}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-medium transition disabled:opacity-50">
                  {qoshishYuklash ? 'Saqlanmoqda...' : 'Saqlash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* To'lov modal */}
      {tolovModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4 pb-24 sm:pb-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl dark:shadow-none dark:border dark:border-neutral-800 w-full max-w-md max-h-[90vh] overflow-y-auto">
            {/* Modal header with progress info */}
            <div className="p-5 border-b border-gray-200 dark:border-neutral-800 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-gray-900 dark:text-gray-100 font-semibold">To&apos;lov qabul qilish</h3>
                <p className="text-gray-500 dark:text-gray-500 text-sm">{tolovModal.mijoz.ism}</p>
                <div className="flex gap-3 mt-1 text-xs flex-wrap">
                  <span className="text-gray-400">Jami: {formatSum(tolovModal.jamiQarz)}</span>
                  <span className="text-green-600">To&apos;langan: {formatSum(tolovModal.tolangan)}</span>
                  <span className="text-red-600 font-semibold">Qoldiq: {formatSum(tolovModal.qoldiq)}</span>
                </div>
                {/* Progress bar in modal header */}
                <div className="mt-2 h-1.5 bg-gray-100 dark:bg-neutral-800 rounded-full">
                  <div
                    className="h-1.5 bg-green-500 rounded-full"
                    style={{ width: `${Math.min(100, (Number(tolovModal.tolangan) / Number(tolovModal.jamiQarz)) * 100)}%` }}
                  />
                </div>
              </div>
              <button
                onClick={() => setTolovModal(null)}
                className="p-1.5 text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition shrink-0">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={tolovQilish} className="p-5 space-y-4">
              {/* To'lov summasi with "To'liq to'lash" shortcut */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-gray-700 dark:text-gray-300 text-sm font-medium">To&apos;lov summasi *</label>
                  <button
                    type="button"
                    onClick={() => setTolovForm(f => ({ ...f, summa: String(tolovModal?.qoldiq ?? '') }))}
                    className="text-xs text-green-600 hover:text-green-500 font-medium">
                    To&apos;liq to&apos;lash ({formatSum(tolovModal?.qoldiq ?? 0)})
                  </button>
                </div>
                <MoneyInput
                  value={tolovForm.summa}
                  onChange={v => setTolovForm(f => ({ ...f, summa: v }))}
                  required
                  min={1}
                  max={tolovModal ? Number(tolovModal.qoldiq) : undefined}
                  placeholder="0"
                />
              </div>

              {/* To'lov usuli — toggle buttons instead of select */}
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-2 block font-medium">To&apos;lov usuli</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'NAQD', label: 'Naqd pul' },
                    { value: 'KARTA', label: 'Bank kartasi' },
                  ].map(u => (
                    <button
                      key={u.value}
                      type="button"
                      onClick={() => setTolovForm(f => ({ ...f, tolovUsuli: u.value }))}
                      className={`py-2 rounded-xl text-sm font-medium border transition ${tolovForm.tolovUsuli === u.value ? 'bg-green-600 border-green-600 text-white' : 'bg-white dark:bg-neutral-900 border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400'}`}>
                      {u.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Izoh */}
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Izoh</label>
                <input
                  value={tolovForm.izoh}
                  onChange={e => setTolovForm(f => ({ ...f, izoh: e.target.value }))}
                  className={inputCls}
                />
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setTolovModal(null)}
                  className="flex-1 py-2.5 border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition font-medium">Bekor</button>
                <button type="submit" className="flex-1 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl font-medium transition">
                  To&apos;lovni tasdiqlash
                </button>
              </div>
            </form>

            {/* Qarz tarixi — qarz qo'shilgan sanalar */}
            {tolovModal.qarzTarixi && tolovModal.qarzTarixi.length > 0 && (
              <div className="px-5 pb-3">
                <div className="border-t border-gray-200 dark:border-neutral-800 pt-4">
                  <h4 className="text-gray-700 dark:text-gray-300 text-sm font-semibold mb-3 flex items-center gap-2">
                    <PlusCircle size={14} className="text-red-500" />
                    Qarz tarixi ({tolovModal.qarzTarixi.length} ta)
                  </h4>
                  <div className="space-y-2 max-h-36 overflow-y-auto">
                    {tolovModal.qarzTarixi.map(q => (
                      <div key={q.id} className="flex items-center justify-between gap-2 py-2 border-b border-gray-100 dark:border-neutral-800 last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-900 dark:text-gray-100 text-sm font-medium">{formatSum(q.summa)}</p>
                          <p className="text-gray-400 dark:text-gray-600 text-xs">
                            {formatSana(q.sana)}
                            {q.izoh && ` • ${q.izoh}`}
                          </p>
                        </div>
                        <span className="text-red-600 text-xs font-medium shrink-0 bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded-lg">
                          +{formatSum(q.summa)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* To'lovlar tarixi */}
            {tolovModal.tolovlar.length > 0 && (
              <div className="px-5 pb-5">
                <div className="border-t border-gray-200 dark:border-neutral-800 pt-4">
                  <h4 className="text-gray-700 dark:text-gray-300 text-sm font-semibold mb-3 flex items-center gap-2">
                    <Clock size={14} />
                    To&apos;lovlar tarixi ({tolovModal.tolovlar.length} ta)
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {tolovModal.tolovlar.map(t => (
                      <div key={t.id} className="flex items-center justify-between gap-2 py-2 border-b border-gray-100 dark:border-neutral-800 last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-900 dark:text-gray-100 text-sm font-medium">{formatSum(t.summa)}</p>
                          <p className="text-gray-400 dark:text-gray-600 text-xs">
                            {formatSana(t.sana)} • {t.tolovUsuli === 'NAQD' ? 'Naqd' : 'Karta'}
                            {t.izoh && ` • ${t.izoh}`}
                          </p>
                        </div>
                        <span className="text-green-600 text-xs font-medium shrink-0 bg-green-50 dark:bg-green-950/30 px-2 py-0.5 rounded-lg">
                          +{formatSum(t.summa)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
