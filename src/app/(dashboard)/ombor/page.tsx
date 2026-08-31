'use client'

import { useEffect, useState } from 'react'
import { formatSum, formatSana } from '@/lib/utils'
import { toast } from 'sonner'
import { AlertTriangle, X, History, ArrowRightLeft, Pencil, Trash2, Plus, Package, Loader2 } from 'lucide-react'
import ViewToggle from '@/components/ViewToggle'
import Combobox from '@/components/ui/combobox'
import MoneyInput from '@/components/ui/money-input'
import SearchBar from '@/components/ui/search-bar'
import { useConfirm } from '@/components/ConfirmProvider'

interface QoldiqItem {
  id: string; nomi: string; kategoriya: { id: string; nomi: string }; kategoriyaId: string; shtrixKod: string | null
  birlik: string; sotishNarxi: number; kelishNarxi: number
  minimalQoldiq: number; qoldiq: number; omborQoldiq: number; dokonQoldiq: number; kamQolgan: boolean
  rasmlar?: string[]
}
interface Taminotchi { id: string; nomi: string; manzil?: string | null }
interface Kategoriya { id: string; nomi: string }
interface OmborHarakat {
  id: string; turi: string; miqdor: number; narx: number
  sana: string; izoh: string | null
  tovar: { nomi: string; birlik: string }
  taminotchi: { nomi: string } | null
  foydalanuvchi: { ism: string }
}

const inputCls = 'w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 transition'

export default function OmborPage() {
  const confirm = useConfirm()
  const [qoldiqlar, setQoldiqlar] = useState<QoldiqItem[]>([])
  const [taminotchilar, setTaminotchilar] = useState<Taminotchi[]>([])
  const [yuklanmoqda, setYuklanmoqda] = useState(true)
  const [qidiruv, setQidiruv] = useState('')
  const [kamQolganFilter, setKamQolganFilter] = useState(false)
  const [view, setView] = useState<'table' | 'card'>('table')
  const [tarix, setTarix] = useState(false)
  const [harakatlar, setHarakatlar] = useState<OmborHarakat[]>([])
  const [harakatYuklanmoqda, setHarakatYuklanmoqda] = useState(false)
  const [harakatTur, setHarakatTur] = useState('')
  // O'tkazma (ombordan do'konga)
  const [otkazmaModal, setOtkazmaModal] = useState(false)
  const [otkazmaTovar, setOtkazmaTovar] = useState<QoldiqItem | null>(null)
  const [otkazmaMiqdor, setOtkazmaMiqdor] = useState('')
  // Kategoriyalar
  const [kategoriyalar, setKategoriyalar] = useState<Kategoriya[]>([])
  // Yangi mahsulot + kirim
  const [yangiModal, setYangiModal] = useState(false)
  const [yangiForm, setYangiForm] = useState({
    nomi: '', kategoriyaId: '', kelishNarxi: '', sotishNarxi: '', birlik: 'DONA',
    minimalQoldiq: '5', shtrixKod: '', miqdor: '', taminotchiId: '', izoh: ''
  })
  // Tahrirlash
  const [tahrirModal, setTahrirModal] = useState(false)
  const [tahrirTovar, setTahrirTovar] = useState<QoldiqItem | null>(null)
  const [tahrirForm, setTahrirForm] = useState({
    nomi: '', kategoriyaId: '', kelishNarxi: '', sotishNarxi: '', birlik: 'DONA',
    minimalQoldiq: '5', shtrixKod: ''
  })
  const [otkazmaSaqlanmoqda, setOtkazmaSaqlanmoqda] = useState(false)
  const [yangiSaqlanmoqda, setYangiSaqlanmoqda] = useState(false)
  const [tahrirSaqlanmoqda, setTahrirSaqlanmoqda] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('view-preference') as 'table' | 'card' | null
    setView(saved || 'table')
  }, [])

  function changeView(v: 'table' | 'card') {
    setView(v)
    localStorage.setItem('view-preference', v)
  }

  async function yuklash() {
    setYuklanmoqda(true)
    const [qd, tm, kt] = await Promise.all([
      fetch(`/api/ombor?q=${qidiruv}&kamQolgan=${kamQolganFilter}`).then(r => r.json()),
      fetch('/api/taminotchilar').then(r => r.json()),
      fetch('/api/kategoriyalar').then(r => r.json()),
    ])
    setQoldiqlar(qd || [])
    setTaminotchilar(tm || [])
    setKategoriyalar(kt || [])
    setYuklanmoqda(false)
  }

  useEffect(() => { yuklash() }, [qidiruv, kamQolganFilter])

  async function harakatlarYuklash() {
    setHarakatYuklanmoqda(true)
    const data = await fetch(`/api/ombor/harakatlar?limit=100${harakatTur ? `&tur=${harakatTur}` : ''}`).then(r => r.json())
    setHarakatlar(data || [])
    setHarakatYuklanmoqda(false)
  }

  useEffect(() => {
    if (tarix) harakatlarYuklash()
  }, [tarix, harakatTur])

  async function otkazmaQilish(e: React.FormEvent) {
    e.preventDefault()
    if (!otkazmaTovar) return
    setOtkazmaSaqlanmoqda(true)
    try {
      const res = await fetch('/api/ombor/otkazma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tovarId: otkazmaTovar.id, miqdor: otkazmaMiqdor }),
      })
      if (res.ok) {
        toast.success(`${otkazmaTovar.nomi} — ${otkazmaMiqdor} ta do'konga o'tkazildi`)
        setOtkazmaModal(false)
        setOtkazmaTovar(null)
        setOtkazmaMiqdor('')
        yuklash()
        if (tarix) harakatlarYuklash()
      } else {
        const err = await res.json()
        toast.error(err.xato || 'Xatolik')
      }
    } finally {
      setOtkazmaSaqlanmoqda(false)
    }
  }

  // Yangi mahsulot + kirim
  async function yangiMahsulotSaqlash(e: React.FormEvent) {
    e.preventDefault()
    setYangiSaqlanmoqda(true)
    try {
      const res = await fetch('/api/tovarlar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nomi: yangiForm.nomi,
          kategoriyaId: yangiForm.kategoriyaId,
          kelishNarxi: yangiForm.kelishNarxi,
          sotishNarxi: yangiForm.sotishNarxi,
          birlik: yangiForm.birlik,
          minimalQoldiq: yangiForm.minimalQoldiq,
          shtrixKod: yangiForm.shtrixKod,
          boshlangichQoldiq: yangiForm.miqdor,
        })
      })
      if (res.ok) {
        toast.success('Mahsulot yaratildi va omborga kirim qilindi!')
        setYangiModal(false)
        setYangiForm({ nomi: '', kategoriyaId: '', kelishNarxi: '', sotishNarxi: '', birlik: 'DONA', minimalQoldiq: '5', shtrixKod: '', miqdor: '', taminotchiId: '', izoh: '' })
        yuklash()
      } else {
        const err = await res.json()
        toast.error(err.xato || 'Xatolik')
      }
    } finally {
      setYangiSaqlanmoqda(false)
    }
  }

  // Tahrirlash
  function tahrirOchish(q: QoldiqItem) {
    setTahrirTovar(q)
    setTahrirForm({
      nomi: q.nomi, kategoriyaId: q.kategoriyaId || '', kelishNarxi: String(q.kelishNarxi),
      sotishNarxi: String(q.sotishNarxi), birlik: q.birlik, minimalQoldiq: String(q.minimalQoldiq),
      shtrixKod: q.shtrixKod || ''
    })
    setTahrirModal(true)
  }

  async function tahrirSaqlash(e: React.FormEvent) {
    e.preventDefault()
    if (!tahrirTovar) return
    setTahrirSaqlanmoqda(true)
    try {
      const res = await fetch(`/api/tovarlar/${tahrirTovar.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tahrirForm)
      })
      if (res.ok) {
        toast.success('Mahsulot yangilandi!')
        setTahrirModal(false)
        setTahrirTovar(null)
        yuklash()
      } else {
        const err = await res.json()
        toast.error(err.xato || 'Xatolik')
      }
    } finally {
      setTahrirSaqlanmoqda(false)
    }
  }

  // O'chirish
  async function ochirish(q: QoldiqItem) {
    if (!(await confirm(`"${q.nomi}" ni o'chirishni xohlaysizmi?`))) return
    const res = await fetch(`/api/tovarlar/${q.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Mahsulot o\'chirildi')
      yuklash()
    } else {
      const err = await res.json()
      toast.error(err.xato || 'O\'chirib bo\'lmadi')
    }
  }

  const [renderLimit, setRenderLimit] = useState(50)
  useEffect(() => { setRenderLimit(50) }, [qidiruv, kamQolganFilter])

  const kamQolganSoni = qoldiqlar.filter(q => q.kamQolgan).length
  const korsatiladiganQoldiqlar = qoldiqlar.slice(0, renderLimit)

  // Build combobox options from loaded data
  const taminotchiOptions = taminotchilar.map(t => ({
    value: t.id,
    label: t.manzil ? `${t.nomi} — ${t.manzil}` : t.nomi,
  }))

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3">
        <SearchBar value={qidiruv} onChange={setQidiruv} placeholder="Tovar nomi bo'yicha qidirish..." className="flex-1" />
        <ViewToggle view={view} onChange={changeView} />
        <button
          onClick={() => setKamQolganFilter(!kamQolganFilter)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition whitespace-nowrap ${kamQolganFilter ? 'bg-red-600 text-white' : 'bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-800'}`}
        >
          <AlertTriangle size={16} />
          Kam qolgan ({kamQolganSoni})
        </button>
        <button
          onClick={() => setTarix(!tarix)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition whitespace-nowrap ${tarix ? 'bg-blue-600 text-white' : 'bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-800'}`}
        >
          <History size={16} />
          Harakatlar tarixi
        </button>
        <button onClick={async () => { setYangiForm({ nomi: '', kategoriyaId: kategoriyalar[0]?.id || '', kelishNarxi: '', sotishNarxi: '', birlik: 'DONA', minimalQoldiq: '5', shtrixKod: '', miqdor: '', taminotchiId: '', izoh: '' }); setYangiModal(true); const r = await fetch('/api/tovarlar/keyingi-kod').then(r => r.json()); if (r.kod) setYangiForm(f => ({ ...f, shtrixKod: r.kod })) }} className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-medium transition whitespace-nowrap">
          <Plus size={16} />
          Yangi mahsulot
        </button>
      </div>

      {/* Table view */}
      {view === 'table' && (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-neutral-800 border-b border-gray-200 dark:border-neutral-800">
                  <th className="text-left text-gray-500 dark:text-gray-500 text-xs font-medium px-4 py-3 whitespace-nowrap">Tovar</th>
                  <th className="text-left text-gray-500 dark:text-gray-500 text-xs font-medium px-4 py-3 hidden sm:table-cell whitespace-nowrap">Kategoriya</th>
                  <th className="text-right text-gray-500 dark:text-gray-500 text-xs font-medium px-4 py-3 whitespace-nowrap">Ombor</th>
                  <th className="text-right text-gray-500 dark:text-gray-500 text-xs font-medium px-4 py-3 whitespace-nowrap">Do&apos;kon</th>
                  <th className="text-right text-gray-500 dark:text-gray-500 text-xs font-medium px-4 py-3 hidden md:table-cell whitespace-nowrap">Kelish narxi</th>
                  <th className="text-center text-gray-500 dark:text-gray-500 text-xs font-medium px-4 py-3 whitespace-nowrap">Amallar</th>
                </tr>
              </thead>
              <tbody>
                {yuklanmoqda ? (
                  <tr><td colSpan={6} className="text-center text-gray-400 dark:text-gray-600 py-12">Yuklanmoqda...</td></tr>
                ) : qoldiqlar.length === 0 ? (
                  <tr><td colSpan={6} className="text-center text-gray-400 dark:text-gray-600 py-12">Ma&apos;lumot topilmadi</td></tr>
                ) : korsatiladiganQoldiqlar.map((q, idx) => (
                  <tr key={q.id} className={`border-b border-gray-100 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-800 transition ${q.kamQolgan ? 'bg-red-50/50 dark:bg-red-950/20' : idx % 2 === 1 ? 'bg-gray-50/40 dark:bg-neutral-800/40' : ''}`}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-gray-900 dark:text-gray-100 text-sm font-medium">{q.nomi}</p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell whitespace-nowrap">
                      <span className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-lg font-medium">{q.kategoriya.nomi}</span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className={`font-bold text-sm ${q.omborQoldiq <= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                        {q.omborQoldiq} {q.birlik.toLowerCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className={`font-bold text-sm ${q.dokonQoldiq <= 0 ? 'text-gray-400' : 'text-green-600'}`}>
                        {q.dokonQoldiq} {q.birlik.toLowerCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400 dark:text-gray-600 text-sm hidden md:table-cell whitespace-nowrap">
                      {formatSum(q.kelishNarxi)}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        {q.omborQoldiq > 0 && (
                          <button onClick={() => { setOtkazmaTovar(q); setOtkazmaMiqdor(''); setOtkazmaModal(true) }} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition" title="Do'konga o'tkazma">
                            <ArrowRightLeft size={14} />
                          </button>
                        )}
                        <button onClick={() => tahrirOchish(q)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-lg transition" title="Tahrirlash">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => ochirish(q)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition" title="O'chirish">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {qoldiqlar.length > renderLimit && (
            <button onClick={() => setRenderLimit(r => r + 50)} className="w-full py-2.5 text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-gray-50 dark:hover:bg-neutral-800 transition border-t border-gray-200 dark:border-neutral-800">
              Yana {Math.min(50, qoldiqlar.length - renderLimit)} ta ko&apos;rsatish ({qoldiqlar.length - renderLimit} ta qoldi)
            </button>
          )}
        </div>
      )}

      {/* Card view */}
      {view === 'card' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {yuklanmoqda ? (
            <p className="text-gray-400 dark:text-gray-600 col-span-3 text-center py-12">Yuklanmoqda...</p>
          ) : qoldiqlar.length === 0 ? (
            <p className="text-gray-400 dark:text-gray-600 col-span-3 text-center py-12">Ma&apos;lumot topilmadi</p>
          ) : korsatiladiganQoldiqlar.map(q => (
            <div key={q.id} className={`bg-white dark:bg-neutral-900 border rounded-2xl overflow-hidden hover:shadow-lg transition-all ${q.kamQolgan ? 'border-red-200 dark:border-red-900' : 'border-gray-200 dark:border-neutral-800 hover:border-primary/30 dark:hover:border-primary/40'}`}>
              {/* Rasm o'rnini bosuvchi banner — katta ikonka + yumshoq nurlanish */}
              <div className={`h-40 flex items-center justify-center relative overflow-hidden ${q.kamQolgan ? 'bg-gradient-to-br from-red-50 to-white dark:from-red-950/20 dark:to-neutral-800' : 'bg-gradient-to-br from-primary-light to-white dark:from-primary/15 dark:to-neutral-800'}`}>
                <span className="absolute top-3 left-3 z-10 text-[11px] bg-primary text-white px-3 py-1.5 rounded-full font-semibold shadow-sm max-w-[55%] truncate" title={q.kategoriya.nomi}>
                  {q.kategoriya.nomi}
                </span>
                <span className={`absolute top-3 right-3 z-10 text-[11px] px-2.5 py-1 rounded-full font-medium shadow-sm ${q.kamQolgan ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>
                  {q.kamQolgan ? 'Kam qoldi' : 'Normal'}
                </span>
                {q.rasmlar?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={q.rasmlar[0]} alt={q.nomi} className="w-full h-full object-cover" />
                ) : (
                  <>
                    <div className={`absolute w-28 h-28 rounded-full blur-2xl ${q.kamQolgan ? 'bg-red-500/15' : 'bg-primary/15'}`} />
                    <Package size={64} className={q.kamQolgan ? 'text-red-500 relative drop-shadow-sm' : 'text-primary relative drop-shadow-sm'} strokeWidth={1.5} />
                  </>
                )}
              </div>

              <div className="p-4">
                <p className="text-gray-900 dark:text-gray-100 font-bold text-base truncate" title={q.nomi}>{q.nomi}</p>
                <p className="text-gray-400 dark:text-gray-600 text-xs mt-0.5">Mahsulot kodi: #{(q.shtrixKod || '').padStart(3, '0') || '—'}</p>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center bg-gray-50 dark:bg-neutral-800/60 rounded-xl py-3">
                  <div>
                    <p className="text-gray-400 dark:text-gray-600 text-[11px]">Ombor</p>
                    <p className={`font-bold text-sm mt-0.5 ${q.omborQoldiq <= 0 ? 'text-red-600' : 'text-blue-600'}`}>{q.omborQoldiq} {q.birlik.toLowerCase()}</p>
                  </div>
                  <div className="border-x border-gray-200 dark:border-neutral-700">
                    <p className="text-gray-400 dark:text-gray-600 text-[11px]">Do&apos;kon</p>
                    <p className={`font-bold text-sm mt-0.5 ${q.dokonQoldiq <= 0 ? 'text-gray-400' : 'text-green-600'}`}>{q.dokonQoldiq} {q.birlik.toLowerCase()}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 dark:text-gray-600 text-[11px]">Kelish</p>
                    <p className="text-gray-700 dark:text-gray-300 font-medium text-sm mt-0.5">{formatSum(q.kelishNarxi)}</p>
                  </div>
                </div>

                {q.omborQoldiq > 0 && (
                  <button onClick={() => { setOtkazmaTovar(q); setOtkazmaMiqdor(''); setOtkazmaModal(true) }} className="w-full mt-3 text-xs bg-primary-light dark:bg-primary/10 text-primary px-3 py-2 rounded-lg font-medium hover:bg-primary/20 transition flex items-center justify-center gap-1">
                    <ArrowRightLeft size={12} />
                    Do&apos;konga o&apos;tkazish
                  </button>
                )}
              </div>

              <div className="border-t border-gray-100 dark:border-neutral-800 grid grid-cols-2">
                <button onClick={() => tahrirOchish(q)} className="flex items-center justify-center gap-1.5 py-3 text-primary hover:bg-primary-light dark:hover:bg-primary/10 transition text-sm font-medium border-r border-gray-100 dark:border-neutral-800">
                  <Pencil size={14} /> Tahrirlash
                </button>
                <button onClick={() => ochirish(q)} className="flex items-center justify-center gap-1.5 py-3 text-primary hover:bg-primary-light dark:hover:bg-primary/10 transition text-sm font-medium">
                  <Trash2 size={14} /> O&apos;chirish
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Harakatlar tarixi modal */}
      {tarix && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl dark:border dark:border-neutral-800 w-full max-w-4xl flex flex-col" style={{ maxHeight: '90vh' }}>
            <div className="p-4 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between gap-3 flex-wrap shrink-0">
              <h2 className="text-gray-900 dark:text-gray-100 font-semibold flex items-center gap-2">
                <History size={16} className="text-blue-500" />
                Ombor harakatlari tarixi
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                {['', 'KIRIM', 'CHIQIM', 'OTKAZMA', 'QAYTARISH', 'YOQOTISH'].map(t => (
                  <button
                    key={t}
                    onClick={() => setHarakatTur(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${harakatTur === t ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700'}`}
                  >
                    {t || 'Barchasi'}
                  </button>
                ))}
                <button onClick={() => setTarix(false)} className="p-1.5 text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition ml-2">
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full">
                <thead className="sticky top-0">
                  <tr className="bg-gray-50 dark:bg-neutral-800 border-b border-gray-200 dark:border-neutral-800">
                    <th className="text-left text-gray-500 dark:text-gray-500 text-xs font-medium px-4 py-3 whitespace-nowrap">Sana</th>
                    <th className="text-left text-gray-500 dark:text-gray-500 text-xs font-medium px-4 py-3 whitespace-nowrap">Tovar</th>
                    <th className="text-center text-gray-500 dark:text-gray-500 text-xs font-medium px-4 py-3 whitespace-nowrap">Tur</th>
                    <th className="text-right text-gray-500 dark:text-gray-500 text-xs font-medium px-4 py-3 whitespace-nowrap">Miqdor</th>
                    <th className="text-left text-gray-500 dark:text-gray-500 text-xs font-medium px-4 py-3 hidden md:table-cell whitespace-nowrap">Ta&apos;minotchi</th>
                    <th className="text-left text-gray-500 dark:text-gray-500 text-xs font-medium px-4 py-3 hidden lg:table-cell whitespace-nowrap">Izoh</th>
                  </tr>
                </thead>
                <tbody>
                  {harakatYuklanmoqda ? (
                    <tr><td colSpan={6} className="text-center text-gray-400 dark:text-gray-600 py-12">Yuklanmoqda...</td></tr>
                  ) : harakatlar.length === 0 ? (
                    <tr><td colSpan={6} className="text-center text-gray-400 dark:text-gray-600 py-12">Harakatlar topilmadi</td></tr>
                  ) : harakatlar.map((h, idx) => {
                    const turConfig: Record<string, { cls: string; label: string }> = {
                      KIRIM: { cls: 'bg-green-100 text-green-700', label: 'Kirim' },
                      CHIQIM: { cls: 'bg-red-100 text-red-700', label: 'Chiqim' },
                      QAYTARISH: { cls: 'bg-blue-100 text-blue-700', label: 'Qaytarish' },
                      YOQOTISH: { cls: 'bg-orange-100 text-orange-700', label: "Yo'qotish" },
                      OTKAZMA: { cls: 'bg-purple-100 text-purple-700', label: "O'tkazma" },
                    }
                    const tc = turConfig[h.turi] || { cls: 'bg-gray-100 text-gray-700', label: h.turi }
                    return (
                      <tr key={h.id} className={`border-b border-gray-100 dark:border-neutral-800 ${idx % 2 === 1 ? 'bg-gray-50/40 dark:bg-neutral-800/40' : ''}`}>
                        <td className="px-4 py-3 text-gray-400 dark:text-gray-600 text-xs whitespace-nowrap">{formatSana(h.sana)}</td>
                        <td className="px-4 py-3 text-gray-900 dark:text-gray-100 text-sm font-medium whitespace-nowrap">{h.tovar.nomi}</td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <span className={`text-xs px-2 py-0.5 rounded-lg font-medium ${tc.cls}`}>{tc.label}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100 text-sm font-semibold whitespace-nowrap">
                          {(h.turi === 'CHIQIM' || h.turi === 'YOQOTISH' || h.turi === 'OTKAZMA') ? '-' : '+'}{h.miqdor} {h.tovar.birlik.toLowerCase()}
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-500 text-sm hidden md:table-cell whitespace-nowrap">
                          {h.taminotchi?.nomi || <span className="text-gray-300 dark:text-gray-700">—</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-400 dark:text-gray-600 text-xs hidden lg:table-cell">
                          {h.izoh || <span className="text-gray-300 dark:text-gray-700">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Ommaviy kirim modal */}
      {/* O'tkazma modal */}
      {otkazmaModal && otkazmaTovar && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4 pb-24 sm:pb-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl dark:border dark:border-neutral-800 w-full max-w-sm">
            <div className="p-5 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-gray-900 dark:text-gray-100 font-semibold flex items-center gap-2">
                <ArrowRightLeft size={18} className="text-blue-500" />
                Do&apos;konga o&apos;tkazma
              </h3>
              <button onClick={() => setOtkazmaModal(false)} className="p-1.5 text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={otkazmaQilish} className="p-5 space-y-4">
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl p-3">
                <p className="text-blue-800 dark:text-blue-200 font-semibold text-sm">{otkazmaTovar.nomi}</p>
                <p className="text-blue-600 dark:text-blue-400 text-xs mt-1">Omborda: <strong>{otkazmaTovar.omborQoldiq}</strong> {otkazmaTovar.birlik.toLowerCase()} | Do&apos;konda: <strong>{otkazmaTovar.dokonQoldiq}</strong> {otkazmaTovar.birlik.toLowerCase()}</p>
              </div>
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Miqdor *</label>
                <input
                  type="number"
                  value={otkazmaMiqdor}
                  onChange={e => setOtkazmaMiqdor(e.target.value)}
                  required
                  min="0.01"
                  max={otkazmaTovar.omborQoldiq}
                  step="0.01"
                  placeholder={`Maks: ${otkazmaTovar.omborQoldiq}`}
                  className={inputCls}
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setOtkazmaModal(false)}
                  className="flex-1 py-2.5 border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition font-medium">
                  Bekor
                </button>
                <button type="submit" disabled={otkazmaSaqlanmoqda}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-xl font-medium transition flex items-center justify-center gap-2">
                  {otkazmaSaqlanmoqda ? <Loader2 size={15} className="animate-spin" /> : <ArrowRightLeft size={15} />}
                  {otkazmaSaqlanmoqda ? "O'tkazilmoqda..." : "O'tkazish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Yangi mahsulot + kirim modal */}
      {yangiModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4 pb-24 sm:pb-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl dark:border dark:border-neutral-800 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-gray-900 dark:text-gray-100 font-semibold flex items-center gap-2">
                <Plus size={18} className="text-red-500" />
                Yangi mahsulot + kirim
              </h3>
              <button onClick={() => setYangiModal(false)} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition"><X size={18} /></button>
            </div>
            <form onSubmit={yangiMahsulotSaqlash} className="p-5 space-y-4">
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Mahsulot nomi *</label>
                <input value={yangiForm.nomi} onChange={e => setYangiForm(f => ({ ...f, nomi: e.target.value }))} required className={inputCls} autoFocus />
              </div>
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Kategoriya *</label>
                <Combobox options={kategoriyalar.map(k => ({ value: k.id, label: k.nomi }))} value={yangiForm.kategoriyaId} onChange={v => setYangiForm(f => ({ ...f, kategoriyaId: v }))} placeholder="Kategoriya tanlang" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Kirim miqdori *</label>
                  <input type="number" value={yangiForm.miqdor} onChange={e => setYangiForm(f => ({ ...f, miqdor: e.target.value }))} required min="0" step="0.01" className={inputCls} />
                </div>
                <div>
                  <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Tan narxi *</label>
                  <MoneyInput value={yangiForm.kelishNarxi} onChange={v => setYangiForm(f => ({ ...f, kelishNarxi: v }))} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Sotuv narxi *</label>
                  <MoneyInput value={yangiForm.sotishNarxi} onChange={v => setYangiForm(f => ({ ...f, sotishNarxi: v }))} required />
                </div>
                <div>
                  <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Birlik</label>
                  <select value={yangiForm.birlik} onChange={e => setYangiForm(f => ({ ...f, birlik: e.target.value }))} className={inputCls}>
                    <option value="DONA">Dona</option>
                    <option value="KG">Kg</option>
                    <option value="LITR">Litr</option>
                    <option value="METR">Metr</option>
                    <option value="PACHKA">Pachka</option>
                    <option value="QUTI">Quti</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Min qoldiq</label>
                  <input type="number" value={yangiForm.minimalQoldiq} onChange={e => setYangiForm(f => ({ ...f, minimalQoldiq: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Shtrix-kod</label>
                  <input value={yangiForm.shtrixKod} onChange={e => setYangiForm(f => ({ ...f, shtrixKod: e.target.value }))} className={inputCls} placeholder="Avtomatik" />
                </div>
              </div>
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Ta&apos;minotchi</label>
                <Combobox options={taminotchiOptions} value={yangiForm.taminotchiId} onChange={v => setYangiForm(f => ({ ...f, taminotchiId: v }))} placeholder="Ixtiyoriy" />
              </div>
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Izoh</label>
                <input value={yangiForm.izoh} onChange={e => setYangiForm(f => ({ ...f, izoh: e.target.value }))} className={inputCls} />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setYangiModal(false)} className="flex-1 py-2.5 border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition font-medium">Bekor</button>
                <button type="submit" disabled={yangiSaqlanmoqda} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white rounded-xl font-medium transition flex items-center justify-center gap-2">
                  {yangiSaqlanmoqda ? <Loader2 size={15} className="animate-spin" /> : null}
                  {yangiSaqlanmoqda ? 'Saqlanmoqda...' : 'Saqlash va kirim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tahrirlash modal */}
      {tahrirModal && tahrirTovar && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4 pb-24 sm:pb-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl dark:border dark:border-neutral-800 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-gray-900 dark:text-gray-100 font-semibold flex items-center gap-2">
                <Pencil size={18} className="text-amber-500" />
                Mahsulotni tahrirlash
              </h3>
              <button onClick={() => setTahrirModal(false)} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition"><X size={18} /></button>
            </div>
            <form onSubmit={tahrirSaqlash} className="p-5 space-y-4">
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Mahsulot nomi *</label>
                <input value={tahrirForm.nomi} onChange={e => setTahrirForm(f => ({ ...f, nomi: e.target.value }))} required className={inputCls} autoFocus />
              </div>
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Kategoriya *</label>
                <Combobox options={kategoriyalar.map(k => ({ value: k.id, label: k.nomi }))} value={tahrirForm.kategoriyaId} onChange={v => setTahrirForm(f => ({ ...f, kategoriyaId: v }))} placeholder="Kategoriya tanlang" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Tan narxi *</label>
                  <MoneyInput value={tahrirForm.kelishNarxi} onChange={v => setTahrirForm(f => ({ ...f, kelishNarxi: v }))} required />
                </div>
                <div>
                  <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Sotuv narxi *</label>
                  <MoneyInput value={tahrirForm.sotishNarxi} onChange={v => setTahrirForm(f => ({ ...f, sotishNarxi: v }))} required />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Birlik</label>
                  <select value={tahrirForm.birlik} onChange={e => setTahrirForm(f => ({ ...f, birlik: e.target.value }))} className={inputCls}>
                    <option value="DONA">Dona</option>
                    <option value="KG">Kg</option>
                    <option value="LITR">Litr</option>
                    <option value="METR">Metr</option>
                    <option value="PACHKA">Pachka</option>
                    <option value="QUTI">Quti</option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Min qoldiq</label>
                  <input type="number" value={tahrirForm.minimalQoldiq} onChange={e => setTahrirForm(f => ({ ...f, minimalQoldiq: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Shtrix-kod</label>
                  <input value={tahrirForm.shtrixKod} onChange={e => setTahrirForm(f => ({ ...f, shtrixKod: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setTahrirModal(false)} className="flex-1 py-2.5 border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition font-medium">Bekor</button>
                <button type="submit" disabled={tahrirSaqlanmoqda} className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white rounded-xl font-medium transition flex items-center justify-center gap-2">
                  {tahrirSaqlanmoqda ? <Loader2 size={15} className="animate-spin" /> : null}
                  {tahrirSaqlanmoqda ? 'Saqlanmoqda...' : 'Saqlash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
