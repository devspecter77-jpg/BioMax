'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { formatSum, formatNarx } from '@/lib/utils'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, X, Upload, Download, Loader2, Package, ImagePlus, ChevronLeft, ChevronRight, DollarSign, Eye, EyeOff, Barcode, Tag, Calendar, Check } from 'lucide-react'
import { normalizeUzbek } from '@/lib/utils'
import ViewToggle from '@/components/ViewToggle'
import Combobox from '@/components/ui/combobox'
import MoneyInput from '@/components/ui/money-input'
import SearchBar from '@/components/ui/search-bar'
import BarcodeScanner from '@/components/BarcodeScanner'
import { useConfirm } from '@/components/ConfirmProvider'
import { YASHIRILADIGAN_MAYDONLAR } from '@/lib/maydon-katalogi'

interface Kategoriya { id: string; nomi: string; _count?: { tovarlar: number } }
interface Tovar {
  id: string; nomi: string; kategoriya: Kategoriya
  kelishNarxi: number | null; sotishNarxi: number | null; valyuta: string
  birlik: string; minimalQoldiq: number; shtrixKod: string | null
  holati: string; qoldiq: number | null; rasmlar: string[]
  yaroqlilikMuddati: string | null
}

const MAX_RASM = 3
const BIRLIKLAR = ['DONA', 'KG', 'LITR', 'METR', 'PACHKA', 'QUTI']
const QOLDIQ_LABEL: Record<string, string> = {
  DONA: 'Necha dona bor?', KG: 'Necha kg bor?', LITR: 'Necha litr bor?',
  METR: 'Necha metr bor?', PACHKA: 'Necha pachka bor?', QUTI: 'Necha quti bor?',
}
const QOLDIQ_QOSHISH_LABEL: Record<string, string> = {
  DONA: "Yana necha dona qo'shmoqchisiz?", KG: "Yana necha kg qo'shmoqchisiz?", LITR: "Yana necha litr qo'shmoqchisiz?",
  METR: "Yana necha metr qo'shmoqchisiz?", PACHKA: "Yana necha pachka qo'shmoqchisiz?", QUTI: "Yana necha quti qo'shmoqchisiz?",
}

const inputCls = 'w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition'

// Ega tomonidan yashirilgan maydon uchun server null qaytaradi — "0 UZS" deb
// noto'g'ri o'qilmasligi uchun aniq "—" ko'rsatiladi.
function narxKorsat(narx: number | string | null, valyuta?: string) {
  if (narx === null || narx === undefined) return '—'
  return formatNarx(narx, valyuta)
}

interface AdminHisob { id: string; ism: string; login: string; filialId: string | null }

export default function TovarlarPage() {
  const confirm = useConfirm()
  const { data: session } = useSession()
  const egaMi = !(session?.user as any)?.filialId
  // Haqiqiy Ega — ulashilgan admin emas. Faqat haqiqiy Ega boshqa filial
  // tanlashi va ulashish sozlamalarini boshqarishi mumkin.
  const haqiqiyEga = egaMi && !(session?.user as any)?.ulashilganEgaId
  // Ulashilgan admin uchun — Ega tomonidan berilgan tahrirlash/o'chirish ruxsati.
  const tahrirRuxsat = haqiqiyEga || !!(session?.user as any)?.tovarTahrirlashMumkin
  const ochirishRuxsat = haqiqiyEga || !!(session?.user as any)?.tovarOchirishMumkin
  const [tovarlar, setTovarlar] = useState<Tovar[]>([])
  const [korinishModal, setKorinishModal] = useState(false)
  const [adminlar, setAdminlar] = useState<AdminHisob[]>([])
  const [tanlanganAdmin, setTanlanganAdmin] = useState('')
  const [yashirilganMaydonlar, setYashirilganMaydonlar] = useState<Set<string>>(new Set())
  const [korinishTahrirlashMumkin, setKorinishTahrirlashMumkin] = useState(true)
  const [korinishOchirishMumkin, setKorinishOchirishMumkin] = useState(true)
  const [korinishYuklanmoqda, setKorinishYuklanmoqda] = useState(false)
  const [korinishSaqlanmoqda, setKorinishSaqlanmoqda] = useState(false)
  // Ega uchun — Tovarlar sahifasida qaysi filialni ko'rish tanlanadi
  const [filiallar, setFiliallar] = useState<{ id: string; nomi: string }[]>([])
  const [tanlanganFilial, setTanlanganFilial] = useState('')
  const [kategoriyalar, setKategoriyalar] = useState<Kategoriya[]>([])
  const [yuklanmoqda, setYuklanmoqda] = useState(true)
  const [qidiruv, setQidiruv] = useState('')
  const [modal, setModal] = useState(false)
  const [saqlanmoqda, setSaqlanmoqda] = useState(false)
  const [tahrirlash, setTahrirlash] = useState<Tovar | null>(null)
  const [importYuklanmoqda, setImportYuklanmoqda] = useState(false)
  const [view, setView] = useState<'table' | 'card'>('table')
  const [aktifKategoriya, setAktifKategoriya] = useState<string | null>(null)
  const [katModal, setKatModal] = useState(false)
  const [katNomi, setKatNomi] = useState('')
  const [katYuklanmoqda, setKatYuklanmoqda] = useState(false)
  const [katTahrirId, setKatTahrirId] = useState<string | null>(null)
  const [katTahrirNomi, setKatTahrirNomi] = useState('')
  const [katTahrirSaqlanmoqda, setKatTahrirSaqlanmoqda] = useState(false)
  const [katOchirilayotganId, setKatOchirilayotganId] = useState<string | null>(null)
  const [rasmModal, setRasmModal] = useState<{ rasmlar: string[]; nomi: string; index: number } | null>(null)
  const [detailTovar, setDetailTovar] = useState<Tovar | null>(null)
  const [kursi, setKursi] = useState<number | null>(null)
  const [kursSana, setKursSana] = useState<string | null>(null)
  const [kursYangilanmoqda, setKursYangilanmoqda] = useState(false)
  const [form, setForm] = useState({
    nomi: '', kategoriyaId: '', shtrixKod: '', kelishNarxi: '',
    sotishNarxi: '', foiz: '15', valyuta: 'UZS', birlik: 'DONA', minimalQoldiq: '5', boshlangichQoldiq: '0', qoldiqQoshish: '0',
    rasmlar: [] as string[], yaroqlilikMuddati: '',
  })

  // Kelish narxi / ustama foiz / sotish narxi — uchtasi bir-biriga bog'liq.
  // Kelish yoki foiz o'zgarsa -> sotish avtomatik hisoblanadi.
  function kelishNarxiOzgardi(v: string) {
    const kelish = parseFloat(v) || 0
    const foiz = parseFloat(form.foiz) || 0
    setForm(f => ({ ...f, kelishNarxi: v, sotishNarxi: kelish > 0 ? String(Math.round(kelish * (1 + foiz / 100))) : f.sotishNarxi }))
  }
  function foizOzgardi(v: string) {
    const foiz = parseFloat(v) || 0
    const kelish = parseFloat(form.kelishNarxi) || 0
    setForm(f => ({ ...f, foiz: v, sotishNarxi: kelish > 0 ? String(Math.round(kelish * (1 + foiz / 100))) : f.sotishNarxi }))
  }
  // Sotish to'g'ridan-to'g'ri o'zgartirilsa -> foiz avtomatik hisoblanadi.
  function sotishNarxiOzgardi(v: string) {
    const sotish = parseFloat(v) || 0
    const kelish = parseFloat(form.kelishNarxi) || 0
    const yangiFoiz = kelish > 0 ? Math.round(((sotish - kelish) / kelish) * 1000) / 10 : null
    setForm(f => ({ ...f, sotishNarxi: v, foiz: yangiFoiz !== null ? String(yangiFoiz) : f.foiz }))
  }

  // Render limit
  const [renderLimit, setRenderLimit] = useState(50)

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
    const params = new URLSearchParams({
      q: normalizeUzbek(qidiruv),
      limit: '9999',
      ...(aktifKategoriya ? { kategoriya: aktifKategoriya } : {}),
      ...(tanlanganFilial ? { filialId: tanlanganFilial } : {}),
    })
    const [tv, kt] = await Promise.all([
      fetch(`/api/tovarlar?${params}`).then(r => r.json()),
      fetch('/api/kategoriyalar').then(r => r.json()),
    ])
    setTovarlar(tv.tovarlar || [])
    setKategoriyalar(kt || [])
    setYuklanmoqda(false)
  }

  useEffect(() => { yuklash() }, [qidiruv, aktifKategoriya, tanlanganFilial])

  // Haqiqiy Ega — Tovarlar sahifasida qaysi filialni ko'rish uchun tanlash imkoniyati
  useEffect(() => {
    if (!haqiqiyEga) return
    fetch('/api/filiallar').then(r => r.json()).then(d => setFiliallar(Array.isArray(d) ? d : [])).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [haqiqiyEga])

  useEffect(() => {
    fetch('/api/kurs').then(r => r.json()).then(d => { if (d.kursi) { setKursi(d.kursi); setKursSana(d.sana) } })
  }, [])

  // Markaziy bankdan majburiy qayta yuklash — qo'lda kiritish yo'q,
  // faqat rasmiy kursni qayta so'rash mumkin.
  async function kursniYangilash() {
    setKursYangilanmoqda(true)
    try {
      const res = await fetch('/api/kurs', { method: 'PUT' })
      const data = await res.json()
      if (res.ok) {
        setKursi(data.kursi)
        setKursSana(data.sana)
        toast.success("Dollar kursi Markaziy bankdan yangilandi")
      } else {
        toast.error(data.xato || 'Xatolik')
      }
    } finally {
      setKursYangilanmoqda(false)
    }
  }

  // Ko'rinish sozlamalari — Ega o'zi ulashgan admin hisobidan ayrim
  // MAYDONLARNI (masalan kelish narxi) yashirish va tahrirlash/o'chirish
  // ruxsatini boshqarish (faqat haqiqiy Ega uchun ko'rinadi).
  async function korinishModalniOchish() {
    setKorinishModal(true)
    setTanlanganAdmin('')
    setYashirilganMaydonlar(new Set())
    setKorinishTahrirlashMumkin(true)
    setKorinishOchirishMumkin(true)
    const data = await fetch('/api/foydalanuvchilar').then(r => r.json()).catch(() => [])
    const meId = (session?.user as any)?.id
    setAdminlar(Array.isArray(data) ? data.filter((u: any) => u.rol === 'ADMIN' && u.ulashilganEgaId === meId) : [])
  }

  async function adminTanlash(id: string) {
    setTanlanganAdmin(id)
    setYashirilganMaydonlar(new Set())
    setKorinishTahrirlashMumkin(true)
    setKorinishOchirishMumkin(true)
    if (!id) return
    setKorinishYuklanmoqda(true)
    try {
      const data = await fetch(`/api/foydalanuvchilar/${id}/yashirilgan-tovarlar`).then(r => r.json())
      setYashirilganMaydonlar(new Set(Array.isArray(data?.maydonlar) ? data.maydonlar : []))
      setKorinishTahrirlashMumkin(data?.tahrirlashMumkin ?? true)
      setKorinishOchirishMumkin(data?.ochirishMumkin ?? true)
    } finally {
      setKorinishYuklanmoqda(false)
    }
  }

  function maydonYashirishToggle(kalit: string) {
    setYashirilganMaydonlar(prev => {
      const yangi = new Set(prev)
      if (yangi.has(kalit)) yangi.delete(kalit)
      else yangi.add(kalit)
      return yangi
    })
  }

  async function korinishSaqlash() {
    if (!tanlanganAdmin) return
    setKorinishSaqlanmoqda(true)
    try {
      const res = await fetch(`/api/foydalanuvchilar/${tanlanganAdmin}/yashirilgan-tovarlar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maydonlar: Array.from(yashirilganMaydonlar),
          tahrirlashMumkin: korinishTahrirlashMumkin,
          ochirishMumkin: korinishOchirishMumkin,
        }),
      })
      if (res.ok) {
        toast.success('Ko\'rinish sozlamalari saqlandi')
        setKorinishModal(false)
      } else {
        toast.error("Saqlashda xatolik")
      }
    } finally {
      setKorinishSaqlanmoqda(false)
    }
  }

  function ochModal(tovar?: Tovar) {
    if (tovar) {
      setTahrirlash(tovar)
      const kelish = tovar.kelishNarxi
      const sotish = tovar.sotishNarxi
      const foiz = kelish !== null && sotish !== null && kelish > 0 ? Math.round(((sotish - kelish) / kelish) * 1000) / 10 : 15
      setForm({
        nomi: tovar.nomi, kategoriyaId: tovar.kategoriya.id,
        shtrixKod: tovar.shtrixKod || '', kelishNarxi: kelish === null ? '' : String(kelish),
        sotishNarxi: sotish === null ? '' : String(sotish), foiz: String(foiz), valyuta: tovar.valyuta || 'UZS', birlik: tovar.birlik,
        minimalQoldiq: String(tovar.minimalQoldiq), boshlangichQoldiq: '0', qoldiqQoshish: '0',
        rasmlar: tovar.rasmlar || [],
        yaroqlilikMuddati: tovar.yaroqlilikMuddati ? tovar.yaroqlilikMuddati.slice(0, 10) : '',
      })
    } else {
      setTahrirlash(null)
      setForm({ nomi: '', kategoriyaId: kategoriyalar[0]?.id || '', shtrixKod: '',
        kelishNarxi: '', sotishNarxi: '', foiz: '15', valyuta: 'UZS', birlik: 'DONA', minimalQoldiq: '5', boshlangichQoldiq: '0', qoldiqQoshish: '0',
        rasmlar: [], yaroqlilikMuddati: '' })
    }
    setModal(true)
  }

  async function saqlash(e: React.FormEvent) {
    e.preventDefault()
    if (!form.kategoriyaId) { toast.error('Avval kategoriya tanlang yoki yarating'); return }
    setSaqlanmoqda(true)
    try {
      const url = tahrirlash ? `/api/tovarlar/${tahrirlash.id}` : '/api/tovarlar'
      const method = tahrirlash ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (res.ok) {
        const natija = await res.json()
        toast.success(tahrirlash ? 'Tovar yangilandi' : "Tovar qo'shildi")
        setModal(false)
        if (tahrirlash) {
          const tahrirId = tahrirlash.id
          const qoshiladigan = parseFloat(form.qoldiqQoshish) || 0
          setTovarlar(prev => prev
            .map(t => t.id !== tahrirId ? t : {
              ...t,
              nomi: natija.nomi,
              kategoriya: natija.kategoriya,
              shtrixKod: natija.shtrixKod,
              valyuta: natija.valyuta,
              birlik: natija.birlik,
              minimalQoldiq: natija.minimalQoldiq,
              rasmlar: natija.rasmlar,
              yaroqlilikMuddati: natija.yaroqlilikMuddati,
              sotishNarxi: natija.sotishNarxi,
              // Kelish narxi shu hisobdan yashirilgan bo'lsa (null), API javobi
              // asl qiymatni yashirmasdan qaytaradi — shu sababli uni serverdan
              // olmaymiz, aks holda yashirilgan narx ekranda ko'rinib qolardi.
              kelishNarxi: t.kelishNarxi === null ? null : natija.kelishNarxi,
              qoldiq: t.qoldiq === null ? null : t.qoldiq + qoshiladigan,
            })
            // Aktiv kategoriya filtri bilan mos kelmay qolgan bo'lsa (tovar
            // boshqa kategoriyaga ko'chirildi) — ro'yxatdan chiqib ketadi.
            .filter(t => !aktifKategoriya || t.id !== tahrirId || t.kategoriya.id === aktifKategoriya))
        } else {
          yuklash()
        }
      } else {
        const err = await res.json()
        toast.error(err.xato || 'Xatolik yuz berdi')
      }
    } finally {
      setSaqlanmoqda(false)
    }
  }

  function rasmTanlash(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error("Faqat rasm fayli tanlang"); return }
    const reader = new FileReader()
    reader.onload = () => {
      setForm(f => f.rasmlar.length >= MAX_RASM ? f : { ...f, rasmlar: [...f.rasmlar, reader.result as string] })
    }
    reader.readAsDataURL(file)
  }

  function rasmOchirish(index: number) {
    setForm(f => ({ ...f, rasmlar: f.rasmlar.filter((_, i) => i !== index) }))
  }

  async function kategoriyaQoshish() {
    if (!katNomi.trim()) return
    setKatYuklanmoqda(true)
    const res = await fetch('/api/kategoriyalar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nomi: katNomi.trim() }),
    })
    if (res.ok) {
      const yangi = await res.json()
      toast.success("Kategoriya qo'shildi")
      setKategoriyalar(prev => [...prev, yangi])
      setAktifKategoriya(yangi.id)
      setKatNomi('')
    } else {
      toast.error("Xatolik yuz berdi")
    }
    setKatYuklanmoqda(false)
  }

  function kategoriyaTahrirBoshlash(k: Kategoriya) {
    setKatTahrirId(k.id)
    setKatTahrirNomi(k.nomi)
  }

  async function kategoriyaTahrirSaqlash() {
    if (!katTahrirId || !katTahrirNomi.trim()) return
    setKatTahrirSaqlanmoqda(true)
    try {
      const res = await fetch(`/api/kategoriyalar/${katTahrirId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomi: katTahrirNomi.trim() }),
      })
      if (res.ok) {
        const yangilangan = await res.json()
        setKategoriyalar(prev => prev.map(k => k.id === katTahrirId ? { ...k, nomi: yangilangan.nomi } : k))
        setTovarlar(prev => prev.map(t => t.kategoriya.id === katTahrirId ? { ...t, kategoriya: { ...t.kategoriya, nomi: yangilangan.nomi } } : t))
        toast.success('Kategoriya yangilandi')
        setKatTahrirId(null)
      } else {
        const err = await res.json()
        toast.error(err.xato || 'Xatolik yuz berdi')
      }
    } finally {
      setKatTahrirSaqlanmoqda(false)
    }
  }

  async function kategoriyaOchirish(k: Kategoriya) {
    if (!(await confirm(`"${k.nomi}" kategoriyasini o'chirasizmi?`))) return
    setKatOchirilayotganId(k.id)
    try {
      const res = await fetch(`/api/kategoriyalar/${k.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Kategoriya o\'chirildi')
        setKategoriyalar(prev => prev.filter(x => x.id !== k.id))
        if (aktifKategoriya === k.id) setAktifKategoriya(null)
      } else {
        const err = await res.json()
        toast.error(err.xato || "O'chirishda xatolik")
      }
    } finally {
      setKatOchirilayotganId(null)
    }
  }

  async function ochirish(id: string) {
    if (!(await confirm('Tovarni arxivlashni xohlaysizmi?'))) return
    const res = await fetch(`/api/tovarlar/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Tovar arxivlandi')
      setTovarlar(prev => prev.filter(t => t.id !== id))
    } else {
      toast.error('Xatolik yuz berdi')
    }
  }

  async function excelTanlash(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImportYuklanmoqda(true)
    const fd = new FormData()
    fd.append('file', file)
    if (tanlanganFilial) fd.append('filialId', tanlanganFilial)
    try {
      const res = await fetch('/api/tovarlar/import', { method: 'POST', body: fd })
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

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
        <SearchBar
          value={qidiruv}
          onChange={setQidiruv}
          onScan={setQidiruv}
          placeholder="Tovar nomi yoki shtrix-kod..."
          className="flex-1"
        />
        {haqiqiyEga && filiallar.length > 0 && (
          <select
            value={tanlanganFilial}
            onChange={e => setTanlanganFilial(e.target.value)}
            title="Qaysi mahsulotlarni ko'rish"
            className="px-3 py-2.5 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-700 dark:text-gray-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="">Mening mahsulotlarim</option>
            {filiallar.map(f => (
              <option key={f.id} value={f.id}>{f.nomi}</option>
            ))}
          </select>
        )}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={kursniYangilash}
            disabled={kursYangilanmoqda}
            title={`Markaziy bank kursi${kursSana ? ` (${kursSana})` : ''} — bosilsa qayta yuklanadi`}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2.5 rounded-xl font-medium transition whitespace-nowrap border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-60 text-sm"
          >
            {kursYangilanmoqda ? <Loader2 size={16} className="animate-spin" /> : <DollarSign size={16} />}
            {kursi ? formatSum(kursi) : '...'}
          </button>
          {haqiqiyEga && (
            <button
              onClick={korinishModalniOchish}
              title="Ulashilgan adminlar uchun ko'rinish va ruxsatlar"
              className="p-2.5 rounded-xl border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition"
            >
              <EyeOff size={16} />
            </button>
          )}
          <div className="hidden sm:block">
            <ViewToggle view={view} onChange={changeView} />
          </div>
          <a
            href={`/api/tovarlar/export${tanlanganFilial ? `?filialId=${tanlanganFilial}` : ''}`}
            title="Excel export"
            className="flex items-center gap-2 p-2.5 sm:px-4 rounded-xl font-medium transition whitespace-nowrap border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800"
          >
            <Download size={16} />
            <span className="hidden sm:inline">Excel export</span>
          </a>
          {/* Excel import */}
          {tahrirRuxsat && (
            <label title="Excel import" className={`flex items-center gap-2 p-2.5 sm:px-4 rounded-xl font-medium transition whitespace-nowrap cursor-pointer border ${importYuklanmoqda ? 'opacity-60 cursor-not-allowed border-gray-300 dark:border-neutral-700 text-gray-400' : 'border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800'}`}>
              {importYuklanmoqda ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              <span className="hidden sm:inline">{importYuklanmoqda ? 'Yuklanmoqda...' : 'Excel import'}</span>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                disabled={importYuklanmoqda}
                onChange={excelTanlash}
              />
            </label>
          )}
          {tahrirRuxsat && (
            <button onClick={() => ochModal()} className="flex items-center gap-2 p-2.5 sm:px-5 sm:py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-medium transition whitespace-nowrap">
              <Plus size={16} />
              <span className="hidden sm:inline">Tovar qo&apos;shish</span>
            </button>
          )}
        </div>
      </div>

      {/* Category navbar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setAktifKategoriya(null)}
          className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition whitespace-nowrap ${
            aktifKategoriya === null
              ? 'bg-red-600 text-white'
              : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700'
          }`}
        >
          Barchasi
        </button>
        {kategoriyalar.map(k => (
          <div
            key={k.id}
            className={`shrink-0 flex items-center rounded-full text-sm font-medium transition whitespace-nowrap ${
              aktifKategoriya === k.id
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700'
            }`}
          >
            <button onClick={() => setAktifKategoriya(k.id)} className="pl-4 pr-1 py-1.5">
              {k.nomi}
            </button>
            {/* Chip'ning o'zida — modalni ochmasdan darhol tahrirlash/o'chirish */}
            <button
              onClick={e => { e.stopPropagation(); kategoriyaTahrirBoshlash(k); setKatModal(true) }}
              title="Tahrirlash"
              className={`p-1.5 rounded-full transition ${aktifKategoriya === k.id ? 'hover:bg-white/20' : 'hover:bg-gray-300 dark:hover:bg-neutral-700'}`}
            >
              <Pencil size={11} />
            </button>
            <button
              onClick={e => { e.stopPropagation(); kategoriyaOchirish(k) }}
              disabled={katOchirilayotganId === k.id}
              title="O'chirish"
              className={`p-1.5 mr-1 rounded-full transition disabled:opacity-50 ${aktifKategoriya === k.id ? 'hover:bg-white/20' : 'hover:bg-gray-300 dark:hover:bg-neutral-700'}`}
            >
              {katOchirilayotganId === k.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
            </button>
          </div>
        ))}
        <button
          onClick={() => { setKatNomi(''); setKatTahrirId(null); setKatModal(true) }}
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-gray-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400 transition font-bold text-lg leading-none"
          title="Kategoriyalarni boshqarish"
        >
          +
        </button>
      </div>

      {/* Table view */}
      {(() => {
        const filteredTovarlar = tovarlar.slice(0, renderLimit)
        return (<>
      {view === 'table' && (
        <div className="hidden sm:block bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-neutral-800 border-b border-gray-200 dark:border-neutral-800">
                  <th className="text-left text-gray-500 dark:text-gray-500 text-xs font-medium px-4 py-3 whitespace-nowrap">Tovar nomi</th>
                  <th className="text-right text-gray-500 dark:text-gray-500 text-xs font-medium px-4 py-3 whitespace-nowrap">Miqdori</th>
                  <th className="text-right text-gray-500 dark:text-gray-500 text-xs font-medium px-4 py-3 whitespace-nowrap">Kelish narxi</th>
                  <th className="text-right text-gray-500 dark:text-gray-500 text-xs font-medium px-4 py-3 whitespace-nowrap">Sotish narxi</th>
                  <th className="text-right text-gray-500 dark:text-gray-500 text-xs font-medium px-4 py-3 whitespace-nowrap">Kategoriya</th>
                  <th className="text-right text-gray-500 dark:text-gray-500 text-xs font-medium px-4 py-3 whitespace-nowrap">Amal</th>
                </tr>
              </thead>
              <tbody>
                {yuklanmoqda ? (
                  <tr><td colSpan={6} className="text-center text-gray-400 dark:text-gray-600 py-12">Yuklanmoqda...</td></tr>
                ) : filteredTovarlar.length === 0 ? (
                  <tr><td colSpan={6} className="text-center text-gray-400 dark:text-gray-600 py-12">Tovarlar topilmadi</td></tr>
                ) : filteredTovarlar.map((t, idx) => (
                  <tr key={t.id} className={`border-b border-gray-100 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-800 transition ${idx % 2 === 0 ? '' : 'bg-gray-50/40 dark:bg-neutral-800/40'}`}>
                    {/* Tovar nomi — title for full text on hover */}
                    <td className="px-4 py-3 whitespace-nowrap max-w-[200px]">
                      <p className="text-gray-900 dark:text-gray-100 text-sm font-medium truncate" title={t.nomi}>{t.nomi}</p>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {t.qoldiq === null ? (
                        <span className="text-sm text-gray-400 dark:text-gray-600">—</span>
                      ) : (
                        <span className={`text-sm font-medium ${t.qoldiq <= t.minimalQoldiq ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'}`}>
                          {t.qoldiq} {t.birlik.toLowerCase()}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400 text-sm whitespace-nowrap">
                      {narxKorsat(t.kelishNarxi, t.valyuta)}
                    </td>
                    <td className="px-4 py-3 text-right text-green-600 text-sm font-semibold whitespace-nowrap">
                      {narxKorsat(t.sotishNarxi, t.valyuta)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-lg font-medium" title={t.kategoriya.nomi}>{t.kategoriya.nomi}</span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {tahrirRuxsat && (
                          <button onClick={() => ochModal(t)} className="p-1.5 text-gray-400 dark:text-gray-600 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg transition">
                            <Pencil size={15} />
                          </button>
                        )}
                        {ochirishRuxsat && (
                          <button onClick={() => ochirish(t.id)} className="p-1.5 text-gray-400 dark:text-gray-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition">
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {tovarlar.length > renderLimit && (
            <button onClick={() => setRenderLimit(r => r + 50)} className="w-full py-2.5 text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-gray-50 dark:hover:bg-neutral-800 transition border-t border-gray-200 dark:border-neutral-800">
              Yana ko&apos;rsatish ({tovarlar.length - renderLimit} ta qoldi)
            </button>
          )}
        </div>
      )}

      {/* Card view — mobilda har doim ko'rinadi, desktopda faqat view==='card' bo'lsa */}
      <div className={`grid grid-cols-1 gap-3 sm:gap-4 ${view === 'card' ? 'lg:grid-cols-4' : 'sm:hidden'}`}>
          {yuklanmoqda ? (
            <p className="text-gray-400 dark:text-gray-600 col-span-full text-center py-12">Yuklanmoqda...</p>
          ) : filteredTovarlar.length === 0 ? (
            <p className="text-gray-400 dark:text-gray-600 col-span-full text-center py-12">Tovarlar topilmadi</p>
          ) : filteredTovarlar.map(t => (
            <div key={t.id} className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden hover:shadow-lg hover:border-primary/30 dark:hover:border-primary/40 transition-all">
              {/* Mahsulot rasmi (agar bo'lsa), aks holda ikonka + yumshoq nurlanish */}
              <div className="aspect-[4/3] bg-gradient-to-br from-primary-light to-white dark:from-primary/15 dark:to-neutral-800 flex items-center justify-center relative overflow-hidden">
                <span className="absolute top-2 left-2 sm:top-3 sm:left-3 z-10 text-[10px] sm:text-[11px] bg-primary text-white px-2 py-1 sm:px-3 sm:py-1.5 rounded-full font-semibold shadow-sm max-w-[70%] truncate" title={t.kategoriya.nomi}>
                  {t.kategoriya.nomi}
                </span>
                {t.rasmlar?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={t.rasmlar[0]}
                    alt={t.nomi}
                    className="w-full h-full object-cover cursor-zoom-in"
                    onClick={(e) => { e.stopPropagation(); setRasmModal({ rasmlar: t.rasmlar, nomi: t.nomi, index: 0 }) }}
                  />
                ) : (
                  <>
                    <div className="absolute w-20 h-20 sm:w-28 sm:h-28 bg-primary/15 rounded-full blur-2xl" />
                    <Package size={40} className="text-primary relative drop-shadow-sm sm:hidden" strokeWidth={1.5} />
                    <Package size={56} className="text-primary relative drop-shadow-sm hidden sm:block" strokeWidth={1.5} />
                  </>
                )}
              </div>

              <div className="p-3 sm:p-4">
                <p className="text-gray-900 dark:text-gray-100 font-bold text-sm sm:text-base truncate" title={t.nomi}>{t.nomi}</p>
                <p className="text-gray-400 dark:text-gray-600 text-[11px] sm:text-xs mt-0.5">Mahsulot kodi: #{(t.shtrixKod || '').padStart(3, '0') || '—'}</p>

                <div className="mt-2.5 sm:mt-3 grid grid-cols-3 gap-1.5 sm:gap-2 text-center bg-gray-50 dark:bg-neutral-800/60 rounded-xl py-2 sm:py-3">
                  <div>
                    <p className="text-gray-400 dark:text-gray-600 text-[10px] sm:text-[11px]">Miqdori</p>
                    {t.qoldiq === null ? (
                      <p className="font-bold text-xs sm:text-sm mt-0.5 text-gray-400 dark:text-gray-600">—</p>
                    ) : (
                      <p className={`font-bold text-xs sm:text-sm mt-0.5 ${t.qoldiq <= t.minimalQoldiq ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'}`}>
                        {t.qoldiq} {t.birlik.toLowerCase()}
                      </p>
                    )}
                  </div>
                  <div className="border-x border-gray-200 dark:border-neutral-700">
                    <p className="text-gray-400 dark:text-gray-600 text-[10px] sm:text-[11px]">Kelish</p>
                    <p className="text-gray-700 dark:text-gray-300 font-medium text-xs sm:text-sm mt-0.5">{narxKorsat(t.kelishNarxi, t.valyuta)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 dark:text-gray-600 text-[10px] sm:text-[11px]">Sotish</p>
                    <p className="text-green-600 font-semibold text-xs sm:text-sm mt-0.5">{narxKorsat(t.sotishNarxi, t.valyuta)}</p>
                  </div>
                </div>
              </div>

              <div className={`border-t border-gray-100 dark:border-neutral-800 grid ${{ 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3' }[1 + (tahrirRuxsat ? 1 : 0) + (ochirishRuxsat ? 1 : 0)]}`}>
                <button onClick={() => setDetailTovar(t)} title="Batafsil" className="flex items-center justify-center py-2.5 sm:py-3 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-800 transition border-r border-gray-100 dark:border-neutral-800">
                  <Eye size={16} />
                </button>
                {tahrirRuxsat && (
                  <button onClick={() => ochModal(t)} title="Tahrirlash" className="flex items-center justify-center py-2.5 sm:py-3 text-primary hover:bg-primary-light dark:hover:bg-primary/10 transition border-r border-gray-100 dark:border-neutral-800">
                    <Pencil size={16} />
                  </button>
                )}
                {ochirishRuxsat && (
                  <button onClick={() => ochirish(t.id)} title="O'chirish" className="flex items-center justify-center py-2.5 sm:py-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
      </div>

      </>)})()}

      {/* Kategoriyalarni boshqarish modali — qo'shish, tahrirlash, o'chirish. Tovar modali ustida chiqishi uchun yuqoriroq z-index */}
      {katModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4" onClick={() => setKatModal(false)}>
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl dark:border dark:border-neutral-800 w-full max-w-sm max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between shrink-0">
              <h3 className="text-gray-900 dark:text-gray-100 font-semibold">Kategoriyalarni boshqarish</h3>
              <button onClick={() => setKatModal(false)} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Yangi kategoriya qo'shish */}
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={katNomi}
                  onChange={e => setKatNomi(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && kategoriyaQoshish()}
                  placeholder="Yangi kategoriya nomi..."
                  className={inputCls}
                />
                <button type="button" onClick={kategoriyaQoshish} disabled={katYuklanmoqda || !katNomi.trim()}
                  title="Qo'shish"
                  className="shrink-0 w-10 h-10 flex items-center justify-center bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl transition">
                  {katYuklanmoqda ? <Loader2 size={16} className="animate-spin" /> : <Plus size={18} />}
                </button>
              </div>

              {/* Mavjud kategoriyalar ro'yxati — tahrirlash/o'chirish */}
              <div className="border border-gray-200 dark:border-neutral-700 rounded-xl divide-y divide-gray-100 dark:divide-neutral-800">
                {kategoriyalar.length === 0 ? (
                  <p className="text-center text-gray-400 dark:text-gray-600 text-sm py-6">Hali kategoriya yo&apos;q</p>
                ) : kategoriyalar.map(k => (
                  <div key={k.id} className="flex items-center gap-2 px-3 py-2.5">
                    {katTahrirId === k.id ? (
                      <>
                        <input
                          autoFocus
                          value={katTahrirNomi}
                          onChange={e => setKatTahrirNomi(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') kategoriyaTahrirSaqlash(); if (e.key === 'Escape') setKatTahrirId(null) }}
                          className="flex-1 min-w-0 px-2.5 py-1.5 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                        <button onClick={kategoriyaTahrirSaqlash} disabled={katTahrirSaqlanmoqda || !katTahrirNomi.trim()} className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30 rounded-lg transition disabled:opacity-50" title="Saqlash">
                          {katTahrirSaqlanmoqda ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        </button>
                        <button onClick={() => setKatTahrirId(null)} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition" title="Bekor qilish">
                          <X size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 min-w-0 text-sm text-gray-900 dark:text-gray-100 truncate">{k.nomi}</span>
                        {typeof k._count?.tovarlar === 'number' && (
                          <span className="shrink-0 text-xs text-gray-400 dark:text-gray-600">{k._count.tovarlar} ta</span>
                        )}
                        <button onClick={() => kategoriyaTahrirBoshlash(k)} className="p-1.5 text-gray-400 dark:text-gray-600 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition" title="Tahrirlash">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => kategoriyaOchirish(k)} disabled={katOchirilayotganId === k.id} className="p-1.5 text-gray-400 dark:text-gray-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition disabled:opacity-50" title="O'chirish">
                          {katOchirilayotganId === k.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4 pb-24 sm:pb-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl dark:shadow-none dark:border dark:border-neutral-800 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-gray-900 dark:text-gray-100 font-semibold">{tahrirlash ? 'Tovarni tahrirlash' : 'Yangi tovar'}</h3>
              <button onClick={() => setModal(false)} className="p-1.5 text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={saqlash} className="p-5 space-y-4">
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Nomi *</label>
                <input value={form.nomi} onChange={e => setForm(f => ({...f, nomi: e.target.value}))} required className={inputCls} />
              </div>
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Shtrix-kod</label>
                <div className="flex gap-2">
                  <input
                    value={form.shtrixKod}
                    onChange={e => setForm(f => ({ ...f, shtrixKod: e.target.value }))}
                    className={inputCls}
                    placeholder="Bo'sh qoldirsangiz avtomatik beriladi"
                  />
                  <BarcodeScanner onScan={kod => setForm(f => ({ ...f, shtrixKod: kod }))} title="Shtrix-kodni skanerlang" />
                </div>
              </div>
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Kategoriya *</label>
                {kategoriyalar.length === 0 ? (
                  <div className="flex items-center justify-between gap-3 px-3 py-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl">
                    <span className="text-amber-700 dark:text-amber-500 text-sm">Hali kategoriya yo&apos;q</span>
                    <button
                      type="button"
                      onClick={() => { setKatNomi(''); setKatModal(true) }}
                      className="shrink-0 px-3 py-1.5 bg-primary hover:bg-primary-hover text-white text-xs font-medium rounded-lg transition"
                    >
                      + Kategoriya yaratish
                    </button>
                  </div>
                ) : (
                  /* Combobox replaces plain <select> for searchable category selection */
                  <Combobox
                    options={kategoriyalar.map(k => ({ value: k.id, label: k.nomi }))}
                    value={form.kategoriyaId}
                    onChange={v => setForm(f => ({ ...f, kategoriyaId: v }))}
                    placeholder="Kategoriya tanlang"
                    searchPlaceholder="Kategoriya qidirish..."
                  />
                )}
              </div>
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Valyuta</label>
                <div className="flex items-center bg-gray-100 dark:bg-neutral-800 rounded-xl p-1 gap-1 w-fit">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, valyuta: 'UZS' }))}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${form.valyuta === 'UZS' ? 'bg-white dark:bg-neutral-700 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}
                  >
                    UZS (so&apos;m)
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, valyuta: 'USD' }))}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${form.valyuta === 'USD' ? 'bg-white dark:bg-neutral-700 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}
                  >
                    USD ($)
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Kelish narxi *</label>
                  {/* MoneyInput for formatted currency entry */}
                  <MoneyInput
                    value={form.kelishNarxi}
                    onChange={kelishNarxiOzgardi}
                    required={!(tahrirlash && tahrirlash.kelishNarxi === null)}
                    disabled={!!tahrirlash && tahrirlash.kelishNarxi === null}
                    placeholder={tahrirlash && tahrirlash.kelishNarxi === null ? "Sizga yashirilgan" : '0'}
                    suffix={form.valyuta === 'USD' ? '$' : 'UZS'}
                  />
                </div>
                <div>
                  <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Ustama foiz</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={form.foiz}
                      onChange={e => foizOzgardi(e.target.value)}
                      className={inputCls + ' pr-8'}
                      placeholder="15"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-600 text-sm">%</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Sotish narxi *</label>
                {/* MoneyInput for formatted currency entry */}
                <MoneyInput
                  value={form.sotishNarxi}
                  onChange={sotishNarxiOzgardi}
                  required
                  placeholder="0"
                  suffix={form.valyuta === 'USD' ? '$' : 'UZS'}
                />
                {form.valyuta === 'USD' && kursi && form.sotishNarxi && (
                  <p className="text-gray-400 dark:text-gray-600 text-xs mt-1">
                    ≈ {formatSum(Math.round((parseFloat(form.sotishNarxi) || 0) * kursi))} (joriy kurs: {formatSum(kursi)}/$)
                  </p>
                )}
              </div>
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Birlik</label>
                <select value={form.birlik} onChange={e => setForm(f => ({...f, birlik: e.target.value}))} className={inputCls}>
                  {BIRLIKLAR.map(b => <option key={b} value={b}>{b.toLowerCase()}</option>)}
                </select>
              </div>
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">
                  Rasmlar <span className="text-gray-400 font-normal">(ixtiyoriy, maksimal {MAX_RASM} ta)</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {form.rasmlar.map((rasm, i) => (
                    <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 dark:border-neutral-700 group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={rasm} alt={`Rasm ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => rasmOchirish(i)}
                        className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  {form.rasmlar.length < MAX_RASM && (
                    <label className="aspect-square rounded-xl border-2 border-dashed border-gray-300 dark:border-neutral-700 hover:border-primary dark:hover:border-primary flex flex-col items-center justify-center gap-1 cursor-pointer text-gray-400 hover:text-primary transition">
                      <ImagePlus size={20} />
                      <span className="text-[10px]">Qo&apos;shish</span>
                      <input type="file" accept="image/*" className="hidden" onChange={rasmTanlash} />
                    </label>
                  )}
                </div>
              </div>
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">
                  Yaroqlilik muddati <span className="text-gray-400 dark:text-gray-600 font-normal">(ixtiyoriy)</span>
                </label>
                <input
                  type="date"
                  value={form.yaroqlilikMuddati}
                  onChange={e => setForm(f => ({ ...f, yaroqlilikMuddati: e.target.value }))}
                  className={inputCls}
                />
              </div>
              {!tahrirlash ? (
                <div>
                  <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">{QOLDIQ_LABEL[form.birlik] || 'Necha dona bor?'}</label>
                  {/* MoneyInput for initial stock quantity */}
                  <MoneyInput
                    value={form.boshlangichQoldiq}
                    onChange={v => setForm(f => ({ ...f, boshlangichQoldiq: v }))}
                    placeholder="0"
                    suffix=""
                  />
                </div>
              ) : (
                <div>
                  <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">
                    {QOLDIQ_QOSHISH_LABEL[form.birlik] || "Yana necha dona qo'shmoqchisiz?"}
                    <span className="text-gray-400 dark:text-gray-600 font-normal"> (ixtiyoriy)</span>
                  </label>
                  <p className="text-gray-400 dark:text-gray-600 text-xs mb-1.5">
                    Hozirgi qoldiq: <span className="font-medium text-gray-600 dark:text-gray-400">{tahrirlash.qoldiq} {form.birlik.toLowerCase()}</span> — kiritilgan miqdor shunga qo&apos;shiladi.
                  </p>
                  <MoneyInput
                    value={form.qoldiqQoshish}
                    onChange={v => setForm(f => ({ ...f, qoldiqQoshish: v }))}
                    placeholder="0"
                    suffix=""
                  />
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(false)}
                  className="flex-1 py-2.5 border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition font-medium">
                  Bekor qilish
                </button>
                <button type="submit" disabled={saqlanmoqda} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white rounded-xl font-medium transition flex items-center justify-center gap-2">
                  {saqlanmoqda ? <Loader2 size={15} className="animate-spin" /> : null}
                  {saqlanmoqda ? 'Saqlanmoqda...' : (tahrirlash ? 'Saqlash' : "Qo'shish")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rasm lightbox */}
      {rasmModal && (
        <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-6" onClick={() => setRasmModal(null)}>
          <button
            onClick={() => setRasmModal(null)}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition"
          >
            <X size={20} />
          </button>
          {rasmModal.rasmlar.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setRasmModal(m => m && ({ ...m, index: (m.index - 1 + m.rasmlar.length) % m.rasmlar.length })) }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setRasmModal(m => m && ({ ...m, index: (m.index + 1) % m.rasmlar.length })) }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition"
              >
                <ChevronRight size={22} />
              </button>
            </>
          )}
          <div className="flex flex-col items-center gap-3 max-w-3xl max-h-full" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={rasmModal.rasmlar[rasmModal.index]} alt={rasmModal.nomi} className="max-w-full max-h-[75vh] object-contain rounded-2xl" />
            <div className="text-white text-center">
              <p className="font-medium">{rasmModal.nomi}</p>
              {rasmModal.rasmlar.length > 1 && (
                <p className="text-white/60 text-sm mt-1">{rasmModal.index + 1} / {rasmModal.rasmlar.length}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Ko'rinish sozlamalari — bog'langan admindan mahsulot yashirish */}
      {korinishModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4 pb-24 sm:pb-4" onClick={() => setKorinishModal(false)}>
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl dark:border dark:border-neutral-800 w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between shrink-0">
              <h3 className="text-gray-900 dark:text-gray-100 font-semibold flex items-center gap-2">
                <EyeOff size={18} className="text-primary" />
                Ko&apos;rinish sozlamalari
              </h3>
              <button onClick={() => setKorinishModal(false)} className="p-1.5 text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Qaysi admin uchun sozlanadi?</label>
                <Combobox
                  options={adminlar.map(a => ({ value: a.id, label: `${a.ism} — ${a.login}` }))}
                  value={tanlanganAdmin}
                  onChange={adminTanlash}
                  placeholder="Admin tanlang"
                  emptyMessage="Ulashilgan admin topilmadi"
                />
              </div>

              {tanlanganAdmin && (
                korinishYuklanmoqda ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 size={22} className="animate-spin text-primary" />
                  </div>
                ) : (
                  <div>
                    <p className="text-gray-400 dark:text-gray-600 text-xs mb-2">
                      Belgilangan maydonlar shu admin hisobiga BARCHA mahsulotlarda yashiriladi (masalan kelish narxi).
                    </p>
                    <div className="border border-gray-200 dark:border-neutral-700 rounded-xl divide-y divide-gray-100 dark:divide-neutral-800">
                      {YASHIRILADIGAN_MAYDONLAR.map(m => (
                        <label key={m.kalit} className="flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800 transition">
                          <input
                            type="checkbox"
                            checked={yashirilganMaydonlar.has(m.kalit)}
                            onChange={() => maydonYashirishToggle(m.kalit)}
                            className="w-4 h-4 rounded accent-primary shrink-0"
                          />
                          <span className="text-sm text-gray-900 dark:text-gray-100 flex-1">{m.label}</span>
                        </label>
                      ))}
                    </div>

                    <p className="text-gray-400 dark:text-gray-600 text-xs mb-2 mt-4">
                      Ushbu admin ulashilgan mahsulotlar ustida qanday amallarni bajara oladi.
                    </p>
                    <div className="border border-gray-200 dark:border-neutral-700 rounded-xl divide-y divide-gray-100 dark:divide-neutral-800">
                      <label className="flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800 transition">
                        <input
                          type="checkbox"
                          checked={korinishTahrirlashMumkin}
                          onChange={() => setKorinishTahrirlashMumkin(v => !v)}
                          className="w-4 h-4 rounded accent-primary shrink-0"
                        />
                        <span className="text-sm text-gray-900 dark:text-gray-100 flex-1">Mahsulot qo&apos;shish / tahrirlash mumkin</span>
                      </label>
                      <label className="flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800 transition">
                        <input
                          type="checkbox"
                          checked={korinishOchirishMumkin}
                          onChange={() => setKorinishOchirishMumkin(v => !v)}
                          className="w-4 h-4 rounded accent-primary shrink-0"
                        />
                        <span className="text-sm text-gray-900 dark:text-gray-100 flex-1">Mahsulot o&apos;chirish mumkin</span>
                      </label>
                    </div>
                  </div>
                )
              )}
            </div>
            {tanlanganAdmin && (
              <div className="p-5 border-t border-gray-200 dark:border-neutral-800 flex gap-3 shrink-0">
                <button type="button" onClick={() => setKorinishModal(false)} className="flex-1 py-2.5 border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition font-medium">
                  Bekor qilish
                </button>
                <button onClick={korinishSaqlash} disabled={korinishSaqlanmoqda} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white rounded-xl font-medium transition flex items-center justify-center gap-2">
                  {korinishSaqlanmoqda ? <Loader2 size={15} className="animate-spin" /> : null}
                  {korinishSaqlanmoqda ? 'Saqlanmoqda...' : 'Saqlash'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mahsulot batafsil ma'lumoti */}
      {detailTovar && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4 pb-24 sm:pb-4" onClick={() => setDetailTovar(null)}>
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl dark:border dark:border-neutral-800 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-gray-900 dark:text-gray-100 font-semibold flex items-center gap-2">
                <Eye size={18} className="text-primary" />
                Mahsulot ma&apos;lumotlari
              </h3>
              <button onClick={() => setDetailTovar(null)} className="p-1.5 text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {detailTovar.rasmlar?.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {detailTovar.rasmlar.map((rasm, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={rasm}
                      alt={`${detailTovar.nomi} ${i + 1}`}
                      className="aspect-square object-cover rounded-xl border border-gray-200 dark:border-neutral-700 cursor-zoom-in"
                      onClick={() => setRasmModal({ rasmlar: detailTovar.rasmlar, nomi: detailTovar.nomi, index: i })}
                    />
                  ))}
                </div>
              ) : (
                <div className="aspect-[4/3] bg-gradient-to-br from-primary-light to-white dark:from-primary/15 dark:to-neutral-800 rounded-xl flex items-center justify-center">
                  <Package size={56} className="text-primary" strokeWidth={1.5} />
                </div>
              )}

              <div>
                <p className="text-gray-900 dark:text-gray-100 font-bold text-lg">{detailTovar.nomi}</p>
                <span className="inline-block mt-1 text-xs bg-red-50 dark:bg-red-950/30 text-red-600 px-2.5 py-1 rounded-full font-medium">{detailTovar.kategoriya.nomi}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 dark:bg-neutral-800/60 rounded-xl p-3">
                  <p className="text-gray-400 dark:text-gray-600 text-[11px] flex items-center gap-1"><Tag size={11} /> Kelish narxi</p>
                  <p className="text-gray-900 dark:text-gray-100 font-semibold mt-0.5">{narxKorsat(detailTovar.kelishNarxi, detailTovar.valyuta)}</p>
                </div>
                <div className="bg-gray-50 dark:bg-neutral-800/60 rounded-xl p-3">
                  <p className="text-gray-400 dark:text-gray-600 text-[11px] flex items-center gap-1"><Tag size={11} /> Sotish narxi</p>
                  <p className="text-green-600 font-semibold mt-0.5">{narxKorsat(detailTovar.sotishNarxi, detailTovar.valyuta)}</p>
                </div>
                <div className="bg-gray-50 dark:bg-neutral-800/60 rounded-xl p-3">
                  <p className="text-gray-400 dark:text-gray-600 text-[11px]">Miqdori</p>
                  {detailTovar.qoldiq === null ? (
                    <p className="font-semibold mt-0.5 text-gray-400 dark:text-gray-600">—</p>
                  ) : (
                    <p className={`font-semibold mt-0.5 ${detailTovar.qoldiq <= detailTovar.minimalQoldiq ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'}`}>
                      {detailTovar.qoldiq} {detailTovar.birlik.toLowerCase()}
                    </p>
                  )}
                </div>
                <div className="bg-gray-50 dark:bg-neutral-800/60 rounded-xl p-3">
                  <p className="text-gray-400 dark:text-gray-600 text-[11px] flex items-center gap-1"><Barcode size={11} /> Shtrix-kod</p>
                  <p className="text-gray-900 dark:text-gray-100 font-semibold mt-0.5">#{(detailTovar.shtrixKod || '').padStart(3, '0') || '—'}</p>
                </div>
                {detailTovar.yaroqlilikMuddati && (
                  <div className="bg-gray-50 dark:bg-neutral-800/60 rounded-xl p-3 col-span-2">
                    <p className="text-gray-400 dark:text-gray-600 text-[11px] flex items-center gap-1"><Calendar size={11} /> Yaroqlilik muddati</p>
                    <p className="text-gray-900 dark:text-gray-100 font-semibold mt-0.5">{detailTovar.yaroqlilikMuddati.slice(0, 10)}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                {tahrirRuxsat && (
                  <button onClick={() => { setDetailTovar(null); ochModal(detailTovar) }} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-medium transition flex items-center justify-center gap-2">
                    <Pencil size={15} /> Tahrirlash
                  </button>
                )}
                <button onClick={() => setDetailTovar(null)} className="flex-1 py-2.5 border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition font-medium">
                  Yopish
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
