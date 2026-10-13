'use client'

import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { formatSum, formatNarx } from '@/lib/utils'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, X, Upload, Download, Loader2, Package, ImagePlus, ChevronLeft, ChevronRight, DollarSign, Eye, EyeOff, LayoutGrid, Search, Lock, Unlock, Barcode, Printer, Check, BookOpen, ArrowDownUp } from 'lucide-react'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import Modal from '@/components/ui/modal'
import { useRuxsat } from '@/hooks/useRuxsat'
import { normalizeUzbek } from '@/lib/utils'
import { asosiyNom, markaziyNomimi, omborKategoriyasi, type MaqsadOmbor } from '@/lib/tovar-ombori'
import { birlikMatni, miqdorMatni, oramlarniOqi, oramlarniTekshir, qismlardanJami, type Oram } from '@/lib/birlik'
import BirlikTanlash, { birlikTakliflariniOl } from '@/components/tovar/BirlikTanlash'
import OramlarMaydoni, { type OramQatori } from '@/components/tovar/OramlarMaydoni'
import MiqdorKiritish from '@/components/tovar/MiqdorKiritish'
import ViewToggle from '@/components/ViewToggle'
import Combobox from '@/components/ui/combobox'
import MoneyInput from '@/components/ui/money-input'
import SearchBar from '@/components/ui/search-bar'
import BarcodeScanner from '@/components/BarcodeScanner'
import TovarTafsilot from '@/components/TovarTafsilot'
import { yorliqlarHtml, yorliqSozlamasi, yorliqqaChiqadimi, varaqdagiYorliqlar, YORLIQ_OLCHAMLARI, A4_USTUNLAR, NUSXA_CHEGARA, type Yorliq } from '@/lib/yorliq'
import YorliqNamuna from '@/components/YorliqNamuna'
import { useSaqlanganQiymat } from '@/hooks/useSaqlanganQiymat'
import { katalogHtml, katalogSanasi, STANDART_KATALOG, ustunChegarasi, type KatalogKorinishi, type KatalogTovar } from '@/lib/katalog'
import { bosmaRasmlari } from '@/lib/rasm-bosma'
import { bosmaOynasiniOch } from '@/lib/bosma-oyna'
import { chekChopEtish } from '@/lib/chek-print'
import { useConfirm } from '@/components/ConfirmProvider'
import TovarNarxPaneli from '@/components/TovarNarxPaneli'
import { YASHIRILADIGAN_MAYDONLAR } from '@/lib/maydon-katalogi'

interface Kategoriya {
  id: string; nomi: string; _count?: { tovarlar: number }
  /** Ustki guruh — Ombor. Eski kategoriyalarda bo'lmasligi mumkin. */
  ombor?: { id: string; nomi: string; faol: boolean } | null
}
interface Tovar {
  id: string; nomi: string; kategoriya: Kategoriya
  /** № — do'kon ichidagi tartib raqami (baza beradi) */
  tartibRaqami: number | null
  kelishNarxi: number | null; sotishNarxi: number | null
  optomNarxi: number | null; bolishNarxi: number | null; valyuta: string
  birlik: string; minimalQoldiq: number; shtrixKod: string | null
  /** Qo'shimcha birliklar: [{ nomi: 'karobka', miqdor: 24 }] (JSON) */
  oramlar?: unknown
  holati: string; qoldiq: number | null; rasmlar: string[]
  yaroqlilikMuddati: string | null
  taminotchi: { id: string; nomi: string } | null
  keltirilganManzil: string | null
  qulflangan: boolean
}

interface Taminotchi { id: string; nomi: string }

/** Katalogda ko'rsatish mumkin bo'lgan narxlar. Kelish narxi ATAYIN yo'q —
 *  katalog mijozga beriladigan hujjat, tannarx unga tushmasligi kerak. */
type NarxTuri = 'chakana' | 'optom' | 'bolish'
const NARX_YORLIQLARI: { turi: NarxTuri; yorliq: string; maydon: 'sotishNarxi' | 'optomNarxi' | 'bolishNarxi' }[] = [
  { turi: 'chakana', yorliq: 'Chakana', maydon: 'sotishNarxi' },
  { turi: 'optom', yorliq: 'Optom', maydon: 'optomNarxi' },
  { turi: 'bolish', yorliq: 'Bo‘lib to‘lash', maydon: 'bolishNarxi' },
]

// Server bilan bir xil (lib/rasm.ts): onlayn vitrina galereyasi 10 tagacha rasm saqlaydi —
// tovar formasi ularni qirqib tashlamasligi kerak.
const MAX_RASM = 10
const inputCls = 'w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition'

// Ega tomonidan yashirilgan maydon uchun server null qaytaradi — "0 UZS" deb
// noto'g'ri o'qilmasligi uchun aniq "—" ko'rsatiladi.
function narxKorsat(narx: number | string | null, valyuta?: string) {
  if (narx === null || narx === undefined) return '—'
  return formatNarx(narx, valyuta)
}

interface AdminHisob { id: string; ism: string; login: string; filialId: string | null }

/** Formadagi ombor tanlovi uchun (Omborlar API'sidan) */
interface OmborQisqa { id: string; nomi: string; faol: boolean; tovarSoni: number }
/** "Markaziy ombor" — omborga biriktirilmagan mahsulotlar */
const MARKAZIY_QIYMAT = '__markaziy__'
/** Hali bazada yo'q (formada yozilgan) ombor — hech bir kategoriya unda emas */
const YANGI_OMBOR_ID = '__yangi__'
/** Yangi mahsulot formasi oxirgi kategoriyani (va uning omborini) eslab qoladi */
const FORMA_JOY_KALITI = 'tovar-forma-joy'

/** Ro'yxat tartibi — tanlov brauzerda eslab qolinadi */
type Saralash = 'raqam' | 'yangi' | 'nomi'
const SARALASHLAR: { qiymat: Saralash; nomi: string }[] = [
  { qiymat: 'raqam', nomi: '№ tartibida' },
  { qiymat: 'yangi', nomi: 'Yangilari avval' },
  { qiymat: 'nomi', nomi: 'Nomi (A–Z)' },
]

/** Yorliqqa tushadigan ma'lumot: №, nomi, shtrix-kod, chakana narx */
function yorliqMalumoti(t: Tovar): Yorliq {
  return { nomi: t.nomi, shtrixKod: t.shtrixKod, narx: narxKorsat(t.sotishNarxi, t.valyuta), tartibRaqami: t.tartibRaqami }
}

export default function TovarlarPage() {
  const confirm = useConfirm()
  const { data: session } = useSession()
  const egaMi = !session?.user?.filialId
  // Haqiqiy Ega — ulashilgan admin emas. Faqat haqiqiy Ega boshqa filial
  // tanlashi va ulashish sozlamalarini boshqarishi mumkin.
  const haqiqiyEga = egaMi && !session?.user?.ulashilganEgaId
  // Ulashilgan admin uchun — Ega tomonidan berilgan tahrirlash/o'chirish ruxsati.
  // Sessiya (JWT) faqat login vaqtida to'ldiriladi — Ega ruxsatni keyin
  // o'zgartirsa, allaqachon login qilgan admin sessiyasi eskirib qoladi.
  // Shuning uchun ulashilgan admin uchun joriy ruxsatni bazadan jonli
  // qayta so'raymiz (server ham xuddi shunday tekshiradi — tovar-ruxsat.ts).
  const [ulashilganRuxsat, setUlashilganRuxsat] = useState<{ tahrirlashMumkin: boolean; ochirishMumkin: boolean } | null>(null)
  // Ustama foiz bazada saqlanmaydi (kelish/sotish narxidan hisoblanadi),
  // shuning uchun uni serverdagi kabi avtomatik yashirib bo'lmaydi — o'zimning
  // yashirilgan maydonlarim ro'yxatini shu yerda tekshirib, formada shunga
  // qarab ko'rsatamiz/yashiramiz.
  const [ozYashirilganMaydonlar, setOzYashirilganMaydonlar] = useState<Set<string>>(new Set())
  // Xodim ruxsatlari (Ruxsatlar bo'limi) — ulashilgan admin cheklovi bilan birga ishlaydi
  const ruxsat = useRuxsat()
  const ustamaFoizYashirilgan = ozYashirilganMaydonlar.has('ustamaFoiz') || !ruxsat.maydon('tovarlar.ustamaFoiz')
  const ulashishTahrir = haqiqiyEga || (ulashilganRuxsat ? ulashilganRuxsat.tahrirlashMumkin : !!session?.user?.tovarTahrirlashMumkin)
  const tahrirRuxsat = ulashishTahrir && ruxsat.bor('tovarlar.tahrirlash')
  const qoshishRuxsat = ulashishTahrir && ruxsat.bor('tovarlar.qoshish')
  const importRuxsat = ulashishTahrir && ruxsat.bor('tovarlar.import')
  const kategoriyaRuxsat = ruxsat.bor('tovarlar.qoshish') || ruxsat.bor('tovarlar.tahrirlash') || ruxsat.bor('omborlar.boshqarish')
  const ochirishRuxsat = (haqiqiyEga || (ulashilganRuxsat ? ulashilganRuxsat.ochirishMumkin : !!session?.user?.tovarOchirishMumkin)) && ruxsat.bor('tovarlar.ochirish')
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
  const [taminotchilar, setTaminotchilar] = useState<Taminotchi[]>([])
  const [yuklanmoqda, setYuklanmoqda] = useState(true)
  const [qidiruv, setQidiruv] = useState('')
  const [modal, setModal] = useState(false)
  const [saqlanmoqda, setSaqlanmoqda] = useState(false)
  const [tahrirlash, setTahrirlash] = useState<Tovar | null>(null)
  const [importYuklanmoqda, setImportYuklanmoqda] = useState(false)
  const [view, setView] = useState<'table' | 'card'>('table')
  const [aktifKategoriya, setAktifKategoriya] = useState<string | null>(null)
  // Kategoriya chiplari ekrandan chiqib ketganda suzuvchi tanlagich chiqadi —
  // ro'yxatning o'rtasida turib kategoriya almashtirish uchun tepaga
  // qaytishning hojati qolmaydi.
  const kategoriyaPaneliRef = useRef<HTMLDivElement>(null)
  const [kategoriyaKorinmayapti, setKategoriyaKorinmayapti] = useState(false)
  const [kategoriyaVarag, setKategoriyaVarag] = useState(false)
  const [kategoriyaQidiruv, setKategoriyaQidiruv] = useState('')
  const [qulflanmoqda, setQulflanmoqda] = useState<string | null>(null)
  // Mahsulot formasidagi ombor (Ombor → Kategoriya → Tovar): mavjud ombor
  // ID'si, MARKAZIY_QIYMAT yoki '' (tanlanmagan — kategoriya qayerda bo'lsa).
  // Formada YOZILGAN yangi ombor/kategoriya nomi alohida turadi: saqlanganda
  // server ularni mahsulot bilan bitta tranzaksiyada ochadi.
  const [formaOmbor, setFormaOmbor] = useState('')
  const [yangiOmbor, setYangiOmbor] = useState('')
  const [yangiKategoriya, setYangiKategoriya] = useState('')
  // Barcha omborlar (kategoriyasi yo'qlari ham) va yangisini ochish huquqi
  const [omborlar, setOmborlar] = useState<OmborQisqa[]>([])
  const [omborOchishMumkin, setOmborOchishMumkin] = useState(false)
  // Faqat qulflanganlarni ko'rsatish — qulflangan tovarni topib ochish uchun
  const [faqatQulflangan, setFaqatQulflangan] = useState(false)
  // Yorliq chop etish — tanlangan mahsulotlar
  const [tanlangan, setTanlangan] = useState<Set<string>>(new Set())
  const [yorliqModal, setYorliqModal] = useState(false)
  // Yorliq o'lchami va A4 ustunlari brauzerda eslab qolinadi (tafsilot oynasi ham shuni oladi)
  const [yorliqOlchamXom, setYorliqOlcham] = useSaqlanganQiymat<string>('yorliq-olcham', '58x40')
  const [yorliqUstunXom, setYorliqUstun] = useSaqlanganQiymat<string>('yorliq-ustun', '4')
  const [yorliqNusxa, setYorliqNusxa] = useState(1)
  const yorliqSozlama = useMemo(
    () => yorliqSozlamasi(yorliqOlchamXom, yorliqUstunXom, yorliqNusxa),
    [yorliqOlchamXom, yorliqUstunXom, yorliqNusxa],
  )
  const [saralashXom, setSaralash] = useSaqlanganQiymat<string>('tovar-saralash', 'raqam')
  const saralash: Saralash = SARALASHLAR.find(x => x.qiymat === saralashXom)?.qiymat ?? 'raqam'
  // Katalog (narxnoma) chop etish
  const [katalogModal, setKatalogModal] = useState(false)
  const [katalogHammasi, setKatalogHammasi] = useState(false)
  const [katalogOqim, setKatalogOqim] = useState<number | null>(null)
  const [katKorinish, setKatKorinish] = useState<KatalogKorinishi>(STANDART_KATALOG.korinish)
  const [katUstun, setKatUstun] = useState(STANDART_KATALOG.ustunlar)
  const [katNarxlar, setKatNarxlar] = useState<Set<NarxTuri>>(new Set<NarxTuri>(['chakana']))
  const [katKategoriya, setKatKategoriya] = useState(STANDART_KATALOG.kategoriyaBoyicha)
  const [katQoldiq, setKatQoldiq] = useState(false)
  const [katShtrix, setKatShtrix] = useState(false)
  const [katIzoh, setKatIzoh] = useState(STANDART_KATALOG.izoh ?? '')
  const [dokonInfo, setDokonInfo] = useState<Record<string, string>>({})
  const [katModal, setKatModal] = useState(false)
  const [katNomi, setKatNomi] = useState('')
  const [katYuklanmoqda, setKatYuklanmoqda] = useState(false)
  const [katTahrirId, setKatTahrirId] = useState<string | null>(null)
  const [katTahrirNomi, setKatTahrirNomi] = useState('')
  const [katTahrirSaqlanmoqda, setKatTahrirSaqlanmoqda] = useState(false)
  const [katOchirilayotganId, setKatOchirilayotganId] = useState<string | null>(null)
  const [rasmModal, setRasmModal] = useState<{ rasmlar: string[]; nomi: string; index: number } | null>(null)
  const [detailTovar, setDetailTovar] = useState<Tovar | null>(null)
  // detailTovar uchun scroll lock TovarTafsilot komponentining o'zida
  useBodyScrollLock(modal || katModal || korinishModal || !!rasmModal || kategoriyaVarag || yorliqModal || katalogModal)
  const [kursi, setKursi] = useState<number | null>(null)
  const [kursSana, setKursSana] = useState<string | null>(null)
  const [kursYangilanmoqda, setKursYangilanmoqda] = useState(false)
  const [form, setForm] = useState({
    nomi: '', kategoriyaId: '', shtrixKod: '', kelishNarxi: '',
    sotishNarxi: '', optomNarxi: '', bolishNarxi: '', foiz: '15', valyuta: 'UZS', birlik: 'DONA', minimalQoldiq: '5', boshlangichQoldiq: '0', qoldiqQoshish: '0',
    rasmlar: [] as string[], yaroqlilikMuddati: '', taminotchiId: '', keltirilganManzil: '',
    oramlar: [] as OramQatori[],
  })
  // Pastdagi miqdor qo'shimcha birliklarda: { karobka: '5', '': '3' } (lib/birlik.ts)
  const [qoldiqQismlari, setQoldiqQismlari] = useState<Record<string, string>>({})

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
  // Qulf filtri almashganda ro'yxat boshidan ko'rsatiladi
  useEffect(() => { setRenderLimit(50) }, [faqatQulflangan])

  useEffect(() => {
    const saved = localStorage.getItem('view-preference') as 'table' | 'card' | null
    setView(saved || 'table')
  }, [])

  function changeView(v: 'table' | 'card') {
    setView(v)
    localStorage.setItem('view-preference', v)
  }

  const yuklash = useCallback(async () => {
    setYuklanmoqda(true)
    const params = new URLSearchParams({
      q: normalizeUzbek(qidiruv),
      limit: '9999',
      ...(aktifKategoriya ? { kategoriya: aktifKategoriya } : {}),
      ...(tanlanganFilial ? { filialId: tanlanganFilial } : {}),
    })
    const [tv, kt, tm] = await Promise.all([
      fetch(`/api/tovarlar?${params}`).then(r => r.json()),
      fetch('/api/kategoriyalar').then(r => r.json()),
      fetch('/api/taminotchilar').then(r => r.json()).catch(() => []),
    ])
    setTovarlar(tv.tovarlar || [])
    setKategoriyalar(kt || [])
    setTaminotchilar(Array.isArray(tm) ? tm : [])
    setYuklanmoqda(false)
  }, [qidiruv, aktifKategoriya, tanlanganFilial])

  useEffect(() => { yuklash() }, [yuklash])

  // Omborlar qidiruvga bog'liq emas — bir marta (va yangi ombor ochilgach) yuklanadi
  const omborlarniYukla = useCallback(() => {
    fetch('/api/omborlar')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!d) return
        setOmborlar((Array.isArray(d.omborlar) ? d.omborlar : []).map((o: OmborQisqa) => ({
          id: o.id, nomi: o.nomi, faol: o.faol, tovarSoni: o.tovarSoni ?? 0,
        })))
        setOmborOchishMumkin(!!d.boshqaraOladi)
      })
      .catch(() => {})
  }, [])
  useEffect(() => { omborlarniYukla() }, [omborlarniYukla])

  // Katalog sarlavhasi uchun do'kon nomi/aloqasi — chekdagi bilan bir xil sozlamalar
  useEffect(() => {
    fetch('/api/sozlamalar').then(r => r.json()).then(d => setDokonInfo(d && typeof d === 'object' ? d : {})).catch(() => {})
  }, [])

  // IntersectionObserver — scroll hodisasidan farqli o'laroq tartib
  // (layout) o'zgarsa ham to'g'ri ishlaydi va desktopda ham, mobilda ham
  // bir xil: panel ko'rinmay qolsa tanlagich paydo bo'ladi.
  useEffect(() => {
    const el = kategoriyaPaneliRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const kuzatuvchi = new IntersectionObserver(
      ([yozuv]) => setKategoriyaKorinmayapti(!yozuv.isIntersecting),
      { threshold: 0.1 },
    )
    kuzatuvchi.observe(el)
    return () => kuzatuvchi.disconnect()
  }, [])

  // Haqiqiy Ega — Tovarlar sahifasida qaysi filialni ko'rish uchun tanlash imkoniyati
  useEffect(() => {
    if (!haqiqiyEga) return
    fetch('/api/filiallar').then(r => r.json()).then(d => setFiliallar(Array.isArray(d) ? d : [])).catch(() => {})
  }, [haqiqiyEga])

  // Ulashilgan admin — tahrirlash/o'chirish ruxsatini bazadan jonli olish
  // (sessiya eskirgan bo'lishi mumkin, tugmalar shunga qarab yashirinadi).
  useEffect(() => {
    const meId = session?.user?.id
    const ulashilganEgaId = session?.user?.ulashilganEgaId
    if (!meId || !ulashilganEgaId) return
    fetch(`/api/foydalanuvchilar/${meId}/yashirilgan-tovarlar`)
      .then(r => r.json())
      .then(d => {
        setUlashilganRuxsat({ tahrirlashMumkin: d?.tahrirlashMumkin ?? true, ochirishMumkin: d?.ochirishMumkin ?? true })
        setOzYashirilganMaydonlar(new Set(Array.isArray(d?.maydonlar) ? d.maydonlar : []))
      })
      .catch(() => {})
  }, [session])

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
    const meId = session?.user?.id
    setAdminlar(Array.isArray(data) ? (data as (AdminHisob & { rol: string; ulashilganEgaId: string | null })[]).filter(u => u.rol === 'ADMIN' && u.ulashilganEgaId === meId) : [])
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
        sotishNarxi: sotish === null ? '' : String(sotish),
        optomNarxi: tovar.optomNarxi === null ? '' : String(tovar.optomNarxi),
        bolishNarxi: tovar.bolishNarxi === null ? '' : String(tovar.bolishNarxi),
        foiz: String(foiz), valyuta: tovar.valyuta || 'UZS', birlik: tovar.birlik,
        minimalQoldiq: String(tovar.minimalQoldiq), boshlangichQoldiq: '0', qoldiqQoshish: '0',
        rasmlar: tovar.rasmlar || [],
        yaroqlilikMuddati: tovar.yaroqlilikMuddati ? tovar.yaroqlilikMuddati.slice(0, 10) : '',
        taminotchiId: tovar.taminotchi?.id || '',
        keltirilganManzil: tovar.keltirilganManzil || '',
        oramlar: oramlarniOqi(tovar.oramlar).map(o => ({ nomi: o.nomi, miqdor: String(o.miqdor) })),
      })
      // Mahsulotning kategoriyasi qaysi omborga tegishli bo'lsa o'sha tanlanadi
      const k = kategoriyalar.find(x => x.id === tovar.kategoriya.id)
      setFormaOmbor(k?.ombor?.id ?? (omborMaydoni ? MARKAZIY_QIYMAT : ''))
    } else {
      setTahrirlash(null)
      // Ketma-ket kiritishda ombor va kategoriya har safar qayta tanlanmasin —
      // oxirgi qo'shilgan mahsulotniki olinadi (hali bo'lmasa — bo'sh, jim
      // "birinchi kategoriya"ga tushib qolmaydi)
      let oxirgiKategoriya = ''
      try { oxirgiKategoriya = JSON.parse(localStorage.getItem(FORMA_JOY_KALITI) || '{}')?.kategoriyaId ?? '' } catch { /* saqlash yopiq */ }
      const k = kategoriyalar.find(x => x.id === oxirgiKategoriya)
      setFormaOmbor(k ? (k.ombor?.id ?? (omborMaydoni ? MARKAZIY_QIYMAT : '')) : '')
      setForm({ nomi: '', kategoriyaId: k?.id ?? '', shtrixKod: '',
        kelishNarxi: '', sotishNarxi: '', optomNarxi: '', bolishNarxi: '', foiz: '15', valyuta: 'UZS', birlik: 'DONA', minimalQoldiq: '5', boshlangichQoldiq: '0', qoldiqQoshish: '0',
        rasmlar: [], yaroqlilikMuddati: '', taminotchiId: '', keltirilganManzil: '', oramlar: [] })
    }
    setQoldiqQismlari({})
    setYangiOmbor('')
    setYangiKategoriya('')
    setModal(true)
  }

  // Qulflash/ochish — bitta maydonli qisman yangilash.
  // PUT payloadda YO'Q maydonlarga tegmaydi, shuning uchun boshqa
  // ma'lumotlar (rasm, ta'minotchi, narxlar) o'z joyida qoladi.
  async function qulfToggle(t: Tovar) {
    const yangiHolat = !t.qulflangan
    setQulflanmoqda(t.id)
    try {
      const res = await fetch(`/api/tovarlar/${t.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qulflangan: yangiHolat }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.xato || 'Xatolik yuz berdi')
        return
      }
      setTovarlar(prev => prev.map(x => x.id === t.id ? { ...x, qulflangan: yangiHolat } : x))
      // Tafsilot oynasi ochiq bo'lsa uning nusxasi ham yangilanadi —
      // aks holda ikkinchi bosishda eski holat ishlatilardi.
      setDetailTovar(d => d && d.id === t.id ? { ...d, qulflangan: yangiHolat } : d)
      toast.success(yangiHolat
        ? `"${t.nomi}" qulflandi — sotuvda ko'rinmaydi`
        : `"${t.nomi}" ochildi — sotuvga qaytdi`)
    } catch {
      toast.error('Tarmoq xatosi')
    } finally {
      setQulflanmoqda(null)
    }
  }

  function tanlashTogla(id: string) {
    setTanlangan(p => {
      const n = new Set(p)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  // Shtrix-kod yorliqlari: tepada № va nomi, o'rtada shtrix-kod, pastda narx.
  // Hujjat brauzerda tayyorlanadi (server kerak emas) — oyna bosilgan zahoti ochiladi.
  function yorliqChopEt() {
    const royxat = tartiblanganTovarlar.filter(t => tanlangan.has(t.id))
    if (royxat.length === 0) { toast.error('Avval mahsulot tanlang'); return }
    const { html, soni, otkazildi } = yorliqlarHtml(royxat.map(yorliqMalumoti), yorliqSozlama)
    if (soni === 0) {
      toast.error("Tanlangan mahsulotlarda shtrix-kod yo'q — avval kod kiriting")
      return
    }
    if (otkazildi.length > 0) toast.info(`${otkazildi.length} ta mahsulot shtrix-kodsiz — o'tkazib yuborildi`)
    chekChopEtish(html)
    setYorliqModal(false)
  }

  /** Katalogga tushadigan mahsulotlar: tanlanganlar yoki ko'rinib turgan hammasi. */
  function katalogRoyxati(): Tovar[] {
    return katalogHammasi ? korinadiganTovarlar : tartiblanganTovarlar.filter(t => tanlangan.has(t.id))
  }

  /**
   * Narxnoma (katalog) chop etish.
   *
   * Rasmlar bazada 1080px — bosma uchun kichraytiriladi, aks holda 200 ta
   * mahsulotli hujjat o'nlab MB bo'lib, bosma oynasi qotib qolardi.
   */
  async function katalogChopEt() {
    const royxat = katalogRoyxati()
    if (royxat.length === 0) { toast.error('Avval mahsulot tanlang'); return }
    const turlar = NARX_YORLIQLARI.filter(n => katNarxlar.has(n.turi))
    if (turlar.length === 0) { toast.error('Kamida bitta narx turini tanlang'); return }

    // Oyna BOSILGAN ZAHOTI ochiladi — rasm tayyorlashdan keyin ochilsa brauzer to'sadi
    const oyna = bosmaOynasiniOch('Katalog tayyorlanmoqda…')
    if (!oyna) {
      toast.error('Brauzer yangi oynani to‘sdi — manzil satrida qalqib chiquvchi oynalarga ruxsat bering')
      return
    }

    setKatalogOqim(0)
    try {
      const kichik = await bosmaRasmlari(
        royxat.map(t => t.rasmlar?.[0] ?? null),
        { oqim: n => setKatalogOqim(n) },
      )
      const tovarlarKatalog: KatalogTovar[] = royxat.map((t, i) => ({
        id: t.id,
        nomi: t.nomi,
        kategoriya: t.kategoriya?.nomi ?? null,
        rasm: kichik[i],
        shtrixKod: katShtrix ? (t.shtrixKod || null) : null,
        qoldiq: katQoldiq && t.qoldiq !== null ? `${t.qoldiq} ${t.birlik}` : null,
        // Yashirilgan yoki kiritilmagan narx chiqmaydi — "—" o'rniga shunchaki yo'q
        narxlar: turlar
          .filter(n => t[n.maydon] !== null && t[n.maydon] !== undefined)
          .map(n => ({ yorliq: n.yorliq, qiymat: formatNarx(t[n.maydon] as number, t.valyuta) })),
      }))

      await oyna.chopEt(katalogHtml(tovarlarKatalog, {
        korinish: katKorinish,
        ustunlar: katUstun,
        // Sozlamada nom bo'lmasa — kirish sahifasidagi kabi brend nomi
        dokonNomi: dokonInfo.dokon_nomi?.trim() || 'BioMax',
        telefon: dokonInfo.telefon || null,
        manzil: dokonInfo.manzil || null,
        sarlavha: STANDART_KATALOG.sarlavha,
        izoh: katIzoh.trim() || null,
        kategoriyaBoyicha: katKategoriya,
        narxYorliqlari: turlar.length > 1,
        sana: katalogSanasi(new Date()),
      }))
      setKatalogModal(false)
    } catch {
      oyna.yop()
      toast.error('Katalog tayyorlanmadi')
    } finally {
      setKatalogOqim(null)
    }
  }

  /** Katalog oynasini ochadi; `hammasi` — tanlovga qaramay barcha ko'rinayotgan mahsulotlar. */
  function katalogniOch(hammasi: boolean) {
    setKatalogHammasi(hammasi)
    // Ko'rinishga mos bo'lmagan ustun soni qolib ketmasin
    const mumkin = ustunChegarasi(katKorinish)
    if (!mumkin.includes(katUstun)) setKatUstun(mumkin[Math.floor(mumkin.length / 2)])
    setKatalogModal(true)
  }

  async function saqlash(e: React.FormEvent) {
    e.preventDefault()
    if (!form.kategoriyaId && !yangiKategoriya) { toast.error('Kategoriyani tanlang yoki yangisini yozing'); return }
    // Qo'shimcha birliklar — server bilan bir xil tekshiruv; miqdor ulardan jamlanadi
    const oramTekshiruv = oramlarniTekshir(form.oramlar, form.birlik)
    if (!oramTekshiruv.ok) { toast.error(oramTekshiruv.xato); return }
    const kiritilganMiqdor = String(qismlardanJami(qoldiqQismlari, oramTekshiruv.oramlar))
    setSaqlanmoqda(true)
    try {
      const url = tahrirlash ? `/api/tovarlar/${tahrirlash.id}` : '/api/tovarlar'
      const method = tahrirlash ? 'PUT' : 'POST'
      // Ombor: yangi nom, aniq ombor, Markaziy (null) — yoki umuman yo'q
      // (tanlanmagan: mahsulot kategoriyasi turgan omborda qoladi)
      const yangiNarsa = !!(yangiOmbor || yangiKategoriya)
      const tana = {
        ...form,
        oramlar: oramTekshiruv.oramlar,
        ...(tahrirlash ? { qoldiqQoshish: kiritilganMiqdor } : { boshlangichQoldiq: kiritilganMiqdor }),
        kategoriyaId: yangiKategoriya ? '' : form.kategoriyaId,
        ...(yangiKategoriya ? { yangiKategoriya } : {}),
        ...(yangiOmbor
          ? { yangiOmbor }
          : formaOmbor === MARKAZIY_QIYMAT ? { omborId: null }
            : formaOmbor ? { omborId: formaOmbor } : {}),
      }
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tana) })
      if (res.ok) {
        const natija = await res.json()
        // Yangi birlik yoki o'ram nomi keyingi formada taklif bo'lib chiqsin
        void birlikTakliflariniOl(true)
        const joyi = natija.kategoriya
          ? ` — ${natija.kategoriya.ombor ? `«${natija.kategoriya.ombor.nomi}» ombori` : 'Markaziy ombor'}, «${natija.kategoriya.nomi}»`
          : ''
        toast.success((tahrirlash ? 'Tovar yangilandi' : "Tovar qo'shildi") + (yangiNarsa ? joyi : ''))
        setModal(false)
        if (!tahrirlash && natija.kategoriya?.id) {
          try { localStorage.setItem(FORMA_JOY_KALITI, JSON.stringify({ kategoriyaId: natija.kategoriya.id })) } catch { /* saqlash yopiq */ }
        }
        // Yangi ombor yoki kategoriya ochilgan bo'lsa — ro'yxatlar qayta olinadi.
        // Ungacha server qaytarganini darhol qo'shamiz: ketma-ket kiritishda
        // keyingi forma qayta yuklash tugashini kutmasdan ularni tanlay oladi.
        if (yangiNarsa) {
          const k = natija.kategoriya as { id: string; nomi: string; ombor: { id: string; nomi: string } | null } | undefined
          if (k) {
            setKategoriyalar(prev => prev.some(x => x.id === k.id) ? prev : [...prev, {
              id: k.id, nomi: k.nomi, ombor: k.ombor ? { ...k.ombor, faol: true } : null,
            }])
            const o = k.ombor
            if (o) setOmborlar(prev => prev.some(x => x.id === o.id) ? prev : [...prev, { ...o, faol: true, tovarSoni: 1 }])
          }
          omborlarniYukla()
        }
        if (tahrirlash && !yangiNarsa) {
          const tahrirId = tahrirlash.id
          const qoshiladigan = parseFloat(kiritilganMiqdor) || 0
          setTovarlar(prev => prev
            .map(t => t.id !== tahrirId ? t : {
              ...t,
              nomi: natija.nomi,
              kategoriya: natija.kategoriya,
              shtrixKod: natija.shtrixKod,
              valyuta: natija.valyuta,
              birlik: natija.birlik,
              oramlar: natija.oramlar,
              minimalQoldiq: natija.minimalQoldiq,
              rasmlar: natija.rasmlar,
              yaroqlilikMuddati: natija.yaroqlilikMuddati,
              // Bu ikkisi ham yangilanishi SHART: tahrirlash formasi
              // ro'yxatdagi qatordan to'ldiriladi, eskirgan qiymat qolsa
              // keyingi saqlashda ustidan yozilib ketardi.
              taminotchi: natija.taminotchi ?? null,
              keltirilganManzil: natija.keltirilganManzil ?? null,
              qulflangan: natija.qulflangan ?? false,
              sotishNarxi: natija.sotishNarxi,
              optomNarxi: natija.optomNarxi,
              bolishNarxi: natija.bolishNarxi,
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
        if (data.xatolar > 0) {
          toast.error(`${data.xatolar} ta qator saqlanmadi`, {
            description: Array.isArray(data.xatoSabablari) ? data.xatoSabablari.join('\n') : undefined,
          })
        }
        yuklash()
        // Fayldagi "Ombor" ustunidan yangi ombor ochilgan bo'lishi mumkin
        omborlarniYukla()
      } else {
        toast.error(data.xato || 'Import xatoligi')
      }
    } catch {
      toast.error('Import amalga oshmadi')
    } finally {
      setImportYuklanmoqda(false)
    }
  }

  // Formadagi yaroqli qo'shimcha birliklar — pastdagi miqdor shu bo'yicha kiritiladi
  const formaOramlari: Oram[] = (() => {
    const t = oramlarniTekshir(form.oramlar.filter(q => q.nomi.trim() && q.miqdor.trim()), form.birlik)
    return t.ok ? t.oramlar : oramlarniOqi(form.oramlar.map(q => ({ nomi: q.nomi.trim().toLowerCase(), miqdor: Number(q.miqdor.replace(',', '.')) })))
  })()

  // Formadagi ombor ro'yxati: "Markaziy ombor" va FAOL omborlar. Istisno:
  // tahrirlanayotgan tovar nofaol omborda tursa, o'sha ombor ro'yxatda
  // qoladi — aks holda forma ochilganda tanlov o'z-o'zidan yo'qolardi.
  const formaOmborlari = useMemo(() => [
    { value: MARKAZIY_QIYMAT, label: 'Markaziy ombor', izoh: 'omborsiz' },
    ...omborlar
      .filter(o => o.faol || o.id === formaOmbor)
      .map(o => ({ value: o.id, label: o.nomi, izoh: `${o.tovarSoni} ta` })),
  ], [omborlar, formaOmbor])
  // Ombor maydoni: omborlar bor yoki yangisini ochish mumkin bo'lsa
  const omborMaydoni = omborlar.length > 0 || omborOchishMumkin
  const omborNomlari = useMemo(() => omborlar.map(o => o.nomi), [omborlar])

  // Tanlangan ombor (null — tanlanmagan): kategoriya ro'yxati shu bo'yicha
  // toraytiriladi va yozilgan kategoriya nomi shu omborga moslanadi
  const maqsadOmbor: MaqsadOmbor | null = yangiOmbor
    ? { id: YANGI_OMBOR_ID, nomi: yangiOmbor }
    : formaOmbor === MARKAZIY_QIYMAT
      ? { id: null, nomi: null }
      : formaOmbor ? { id: formaOmbor, nomi: omborlar.find(o => o.id === formaOmbor)?.nomi ?? null } : null
  const maqsadOmborNomi = maqsadOmbor ? (maqsadOmbor.id === null ? 'Markaziy ombor' : maqsadOmbor.nomi) : null

  const kategoriyaQisqa = useMemo(
    () => kategoriyalar.map(k => ({ id: k.id, nomi: k.nomi, omborId: k.ombor?.id ?? null })),
    [kategoriyalar],
  )
  const formaKategoriyalari = maqsadOmbor
    ? kategoriyalar.filter(k => (k.ombor?.id ?? null) === maqsadOmbor.id)
    : kategoriyalar
  // Yozilgan kategoriya qaysi nom bilan ochiladi: nomi boshqa omborda band
  // bo'lsa — "Fenlar (Sklad 2)" (o'tkazmalardagi qoida bilan bir xil)
  const yangiKategoriyaNomi = (() => {
    if (!yangiKategoriya) return null
    const n = omborKategoriyasi(yangiKategoriya, maqsadOmbor ?? { id: null, nomi: null }, kategoriyaQisqa, omborNomlari)
    return n && 'yangi' in n ? n.yangi : yangiKategoriya
  })()

  /** Kategoriya nomini omborga moslaydi: shu omborda shu nomlisi bo'lsa o'sha
   *  tanlanadi, bo'lmasa — yangi kategoriya (saqlanganda server ochadi). */
  function kategoriyaniMosla(nomi: string, maqsad: MaqsadOmbor) {
    const n = omborKategoriyasi(nomi, maqsad, kategoriyaQisqa, omborNomlari)
    if (n && 'mavjud' in n) {
      setForm(f => ({ ...f, kategoriyaId: n.mavjud.id }))
      setYangiKategoriya('')
    } else {
      setForm(f => ({ ...f, kategoriyaId: '' }))
      setYangiKategoriya(asosiyNom(nomi, omborNomlari))
    }
  }

  function omborTanlandi(qiymat: string) {
    if (!qiymat) { setFormaOmbor(''); setYangiOmbor(''); return }
    // Combobox yozilgan yangi nomni ham shu yerga beradi. "Markaziy" deb
    // yozilsa — bu omborsiz qism, shu nomli yangi ombor emas
    const v = !omborlar.some(o => o.id === qiymat) && markaziyNomimi(qiymat) ? MARKAZIY_QIYMAT : qiymat
    const mavjud = v === MARKAZIY_QIYMAT || omborlar.some(o => o.id === v)
    const nom = v.trim().replace(/\s+/g, ' ')
    const maqsad: MaqsadOmbor = !mavjud
      ? { id: YANGI_OMBOR_ID, nomi: nom }
      : v === MARKAZIY_QIYMAT ? { id: null, nomi: null } : { id: v, nomi: omborlar.find(o => o.id === v)?.nomi ?? null }
    setFormaOmbor(mavjud ? v : '')
    setYangiOmbor(mavjud ? '' : nom)
    // Tanlangan kategoriya bu omborda bo'lmasa — nomi saqlanib, shu omborga
    // moslanadi ("Fenlar" Sklad 2 da "Fenlar (Sklad 2)" bo'lib ochiladi)
    const k = kategoriyalar.find(x => x.id === form.kategoriyaId)
    const nomi = k?.nomi ?? yangiKategoriya
    if (nomi && (!k || (k.ombor?.id ?? null) !== maqsad.id)) kategoriyaniMosla(nomi, maqsad)
  }

  function kategoriyaTanlandi(v: string) {
    if (!v) { setForm(f => ({ ...f, kategoriyaId: '' })); setYangiKategoriya(''); return }
    const k = kategoriyalar.find(x => x.id === v)
    if (k) {
      setForm(f => ({ ...f, kategoriyaId: k.id }))
      setYangiKategoriya('')
      // Ombor hali tanlanmagan bo'lsa — kategoriyaning ombori ko'rinib turadi
      if (!formaOmbor && !yangiOmbor && omborMaydoni) setFormaOmbor(k.ombor?.id ?? MARKAZIY_QIYMAT)
      return
    }
    // Yangi nom yozildi — ombor tanlanmagan bo'lsa Markaziy omborda ochiladi
    kategoriyaniMosla(v.trim().replace(/\s+/g, ' '), maqsadOmbor ?? { id: null, nomi: null })
    if (!formaOmbor && !yangiOmbor && omborMaydoni) setFormaOmbor(MARKAZIY_QIYMAT)
  }

  const qulflanganSoni = tovarlar.filter(t => t.qulflangan).length
  // Tartib: № bo'yicha (standart) yoki yangilari avval. "Nomi" — server
  // qaytargan tartib (bazada nomi bo'yicha saralangan).
  const tartiblanganTovarlar = useMemo(() => {
    if (saralash === 'nomi') return tovarlar
    const yangi = saralash === 'yangi'
    // Raqamsiz (bo'lmasligi kerak) — har doim oxirida
    const raqam = (t: Tovar) => t.tartibRaqami ?? (yangi ? -1 : Number.MAX_SAFE_INTEGER)
    return [...tovarlar].sort((a, b) => (yangi ? raqam(b) - raqam(a) : raqam(a) - raqam(b)))
  }, [tovarlar, saralash])
  // Qulf filtri MIJOZ tomonda qo'llanadi: ro'yxat allaqachon to'liq
  // yuklangan, shuning uchun serverga qayta murojaat qilish shart emas.
  const korinadiganTovarlar = faqatQulflangan ? tartiblanganTovarlar.filter(t => t.qulflangan) : tartiblanganTovarlar

  // Katalog oynasi uchun — faqat ochiq bo'lganda hisoblanadi
  const katalogTovarlari = katalogModal ? katalogRoyxati() : []
  const katalogRasmsiz = katalogTovarlari.filter(t => !t.rasmlar?.[0]).length
  // Taxminiy sahifa soni: A4 ga sig'adigan katak (sarlavha joyi hisobga olingan)
  const katalogSahifa = Math.max(1, Math.ceil(katalogTovarlari.length
    / (katKorinish === 'karta' ? ({ 2: 6, 3: 9, 4: 16 } as Record<number, number>)[katUstun] ?? 9 : katUstun * 18)))
  // Ro'yxat filtrlangan bo'lsa "Hammasi" — shu filtr ichidagi hammasi
  const katalogFiltri = [
    aktifKategoriya ? `«${kategoriyalar.find(k => k.id === aktifKategoriya)?.nomi ?? 'kategoriya'}» kategoriyasi` : null,
    qidiruv.trim() ? `«${qidiruv.trim()}» qidiruvi` : null,
    faqatQulflangan ? 'faqat qulflanganlar' : null,
  ].filter(Boolean).join(', ')
  const tanlovCls = (faol: boolean) => `flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed ${
    faol
      ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
      : 'border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800'
  }`

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
        <SearchBar
          value={qidiruv}
          onChange={setQidiruv}
          onScan={setQidiruv}
          placeholder="Tovar nomi, № yoki shtrix-kod..."
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
          {ruxsat.bor('tovarlar.export') && (
            <button
              type="button"
              onClick={() => katalogniOch(tanlangan.size === 0)}
              disabled={korinadiganTovarlar.length === 0}
              title="Rasmli katalog / narxnoma — A4 chop etish"
              className="flex items-center gap-2 p-2.5 sm:px-4 rounded-xl font-medium transition whitespace-nowrap border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-50"
            >
              <BookOpen size={16} />
              <span className="hidden sm:inline">Katalog</span>
            </button>
          )}
          {ruxsat.bor('tovarlar.export') && (
            <a
              href={`/api/tovarlar/export${tanlanganFilial ? `?filialId=${tanlanganFilial}` : ''}`}
              title="Excel export"
              className="flex items-center gap-2 p-2.5 sm:px-4 rounded-xl font-medium transition whitespace-nowrap border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800"
            >
              <Download size={16} />
              <span className="hidden sm:inline">Excel export</span>
            </a>
          )}
          {/* Excel import */}
          {importRuxsat && (
            <label title="Excel import" className={`flex items-center gap-2 p-2.5 sm:px-4 rounded-xl font-medium transition whitespace-nowrap cursor-pointer border ${importYuklanmoqda ? 'opacity-60 cursor-not-allowed border-gray-300 dark:border-neutral-700 text-gray-400' : 'border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800'}`}>
              {importYuklanmoqda ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              <span className="hidden sm:inline">{importYuklanmoqda ? 'Yuklanmoqda...' : 'Excel import'}</span>
              <input
                suppressHydrationWarning
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                disabled={importYuklanmoqda}
                onChange={excelTanlash}
              />
            </label>
          )}
          {qoshishRuxsat && (
            <button onClick={() => ochModal()} aria-label="Tovar qo'shish" title="Tovar qo'shish" className="flex items-center gap-2 p-2.5 sm:px-5 sm:py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-medium transition whitespace-nowrap">
              <Plus size={16} />
              <span className="hidden sm:inline">Tovar qo&apos;shish</span>
            </button>
          )}
        </div>
      </div>

      {/* Category navbar */}
      {/* Tanlash paneli — kamida bitta mahsulot belgilanganda chiqadi */}
      {tanlangan.size > 0 && (
        <div className="flex items-center justify-between gap-x-3 gap-y-2 flex-wrap px-4 py-2.5 rounded-xl bg-primary/5 border border-primary/20">
          {/* Telefonda ikki qator: hisob va havolalar, ostida amal tugmalari */}
          <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
            <span className="text-sm text-gray-700 dark:text-gray-300 font-medium whitespace-nowrap">
              {tanlangan.size} ta mahsulot tanlandi
            </span>
            <button
              onClick={() => setTanlangan(new Set(tovarlar.map(t => t.id)))}
              className="text-xs text-primary hover:underline whitespace-nowrap"
            >
              Hammasini tanlash ({tovarlar.length})
            </button>
            <button onClick={() => setTanlangan(new Set())} className="text-xs text-gray-500 hover:underline">
              Bekor
            </button>
          </div>
          <div className="flex items-center gap-2">
            {ruxsat.bor('tovarlar.export') && (
              <button
                onClick={() => katalogniOch(false)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-primary/40 text-primary text-sm font-medium hover:bg-primary/10 transition whitespace-nowrap"
              >
                <BookOpen size={15} /> Katalog
              </button>
            )}
            <button
              onClick={() => setYorliqModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90 transition whitespace-nowrap"
            >
              <Barcode size={15} /> Yorliq chop etish
            </button>
          </div>
        </div>
      )}

      {/* Qulflanganlar filtri — qulflangan tovarni tez topib, qulfini
          ochish uchun. Qulflangan tovar bo'lmasa tugma ham chiqmaydi. */}
      {qulflanganSoni > 0 && (
        <button
          onClick={() => setFaqatQulflangan(v => !v)}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition w-fit ${
            faqatQulflangan
              ? 'bg-amber-500 text-white'
              : 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900 hover:bg-amber-100 dark:hover:bg-amber-950/40'
          }`}
        >
          <Lock size={14} />
          Qulflangan ({qulflanganSoni})
          {faqatQulflangan && <X size={13} className="opacity-80" />}
        </button>
      )}

      <div ref={kategoriyaPaneliRef} className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setAktifKategoriya(null)}
          className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition whitespace-nowrap ${
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
            <button onClick={() => setAktifKategoriya(k.id)} className="pl-4 pr-1 py-2">
              {k.nomi}
            </button>
            {/* Chip'ning o'zida — modalni ochmasdan darhol tahrirlash/o'chirish */}
            {kategoriyaRuxsat && (<>
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
            </>)}
          </div>
        ))}
        {kategoriyaRuxsat && <button
          onClick={() => { setKatNomi(''); setKatTahrirId(null); setKatModal(true) }}
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-gray-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400 transition font-bold text-lg leading-none"
          title="Kategoriyalarni boshqarish"
        >
          +
        </button>}
      </div>

      {/* Ro'yxat sarlavhasi — nechta mahsulot va qaysi tartibda */}
      {!yuklanmoqda && tovarlar.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
            {korinadiganTovarlar.length} ta mahsulot
          </p>
          <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
            <ArrowDownUp size={14} className="shrink-0" aria-hidden="true" />
            <select
              id="tovar-saralash"
              aria-label="Ro'yxat tartibi"
              value={saralash}
              onChange={e => setSaralash(e.target.value)}
              className="py-1.5 pl-2 pr-7 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-700 dark:text-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              {SARALASHLAR.map(x => <option key={x.qiymat} value={x.qiymat}>{x.nomi}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Table view */}
      {(() => {
        const filteredTovarlar = korinadiganTovarlar.slice(0, renderLimit)
        return (<>
      {view === 'table' && (
        <div className="hidden sm:block bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-neutral-800 border-b border-gray-200 dark:border-neutral-800">
                  <th className="w-10 px-3 py-3">
                    {/* `suppressHydrationWarning`: parol menejeri / forma to'ldiruvchi
                        kengaytmalar React'dan oldin `fdprocessedid` atributini qo'shadi.
                        Bayroq faqat shu elementga ta'sir qiladi. */}
                    <input
                      suppressHydrationWarning
                      type="checkbox"
                      aria-label="Hammasini tanlash"
                      checked={filteredTovarlar.length > 0 && filteredTovarlar.every(t => tanlangan.has(t.id))}
                      onChange={e => setTanlangan(e.target.checked
                        ? new Set(filteredTovarlar.map(t => t.id))
                        : new Set())}
                      className="w-4 h-4 accent-red-600"
                    />
                  </th>
                  <th scope="col" className="text-left text-gray-500 dark:text-gray-400 text-xs font-medium pl-1 pr-2 py-3 whitespace-nowrap">№</th>
                  <th className="text-left text-gray-500 dark:text-gray-400 text-xs font-medium px-4 py-3 whitespace-nowrap">Tovar nomi</th>
                  <th className="text-right text-gray-500 dark:text-gray-400 text-xs font-medium px-3 py-3 whitespace-nowrap">Miqdori</th>
                  <th className="text-right text-gray-500 dark:text-gray-400 text-xs font-medium px-3 py-3 whitespace-nowrap">Kelish narxi</th>
                  <th className="text-right text-gray-500 dark:text-gray-400 text-xs font-medium px-3 py-3 whitespace-nowrap">Sotish narxi</th>
                  <th className="text-right text-gray-500 dark:text-gray-400 text-xs font-medium px-3 py-3 whitespace-nowrap">Optom narxi</th>
                  <th className="text-right text-gray-500 dark:text-gray-400 text-xs font-medium px-3 py-3 whitespace-nowrap">Bo&apos;lish narxi</th>
                  <th className="text-right text-gray-500 dark:text-gray-400 text-xs font-medium px-3 py-3 whitespace-nowrap">Kategoriya</th>
                  <th className="text-right text-gray-500 dark:text-gray-400 text-xs font-medium px-3 py-3 whitespace-nowrap">Amal</th>
                </tr>
              </thead>
              <tbody>
                {yuklanmoqda ? (
                  <tr><td colSpan={10} className="text-center text-gray-500 dark:text-gray-400 py-12">Yuklanmoqda...</td></tr>
                ) : filteredTovarlar.length === 0 ? (
                  <tr><td colSpan={10} className="py-12">
                    <div className="text-center">
                      <p className="text-gray-500 dark:text-gray-400 text-sm">
                        {qidiruv || aktifKategoriya || faqatQulflangan ? 'Shu shart bo\'yicha tovar topilmadi' : 'Hali tovar qo\'shilmagan'}
                      </p>
                      {qidiruv || aktifKategoriya || faqatQulflangan ? (
                        <button
                          onClick={() => { setQidiruv(''); setAktifKategoriya(null); setFaqatQulflangan(false) }}
                          className="mt-3 px-4 py-2 rounded-xl border border-gray-300 dark:border-neutral-700 text-sm text-gray-600 dark:text-gray-400 hover:border-primary/50 hover:text-primary transition"
                        >
                          Filtrni tozalash
                        </button>
                      ) : qoshishRuxsat ? (
                        <button
                          onClick={() => ochModal()}
                          className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90 transition"
                        >
                          <Plus size={15} /> Birinchi tovarni qo&apos;shish
                        </button>
                      ) : null}
                    </div>
                  </td></tr>
                ) : filteredTovarlar.map((t, idx) => (
                  <tr
                    key={t.id}
                    onClick={() => setDetailTovar(t)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailTovar(t) } }}
                    tabIndex={0}
                    role="button"
                    title="Batafsil ma'lumot"
                    className={`border-b border-gray-100 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-800 transition cursor-pointer ${idx % 2 === 0 ? '' : 'bg-gray-50/40 dark:bg-neutral-800/40'}`}
                  >
                    {/* Tovar nomi — title for full text on hover */}
                    <td className="w-10 px-3 py-3" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`${t.nomi} tanlash`}
                        checked={tanlangan.has(t.id)}
                        onChange={() => tanlashTogla(t.id)}
                        className="w-4 h-4 accent-red-600"
                      />
                    </td>
                    <td className="pl-1 pr-2 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap">
                      {t.tartibRaqami ?? '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap max-w-[220px]">
                      <div className="flex items-center gap-1.5">
                        {t.qulflangan && (
                          <Lock size={12} className="text-amber-600 shrink-0" aria-label="Qulflangan" />
                        )}
                        <p
                          className={`text-sm font-medium truncate ${t.qulflangan ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}
                          title={t.qulflangan ? `${t.nomi} — qulflangan, sotuvda ko'rinmaydi` : t.nomi}
                        >
                          {t.nomi}
                        </p>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      {t.qoldiq === null ? (
                        <span className="text-sm text-gray-500 dark:text-gray-400">—</span>
                      ) : (
                        <>
                          <span className={`text-sm font-medium ${t.qoldiq <= t.minimalQoldiq ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'}`}>
                            {t.qoldiq} {birlikMatni(t.birlik)}
                          </span>
                          {t.qoldiq > 0 && oramlarniOqi(t.oramlar).length > 0 && (
                            <span className="block text-[11px] text-gray-500 dark:text-gray-400">{miqdorMatni(t.qoldiq, t.birlik, oramlarniOqi(t.oramlar))}</span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-500 dark:text-gray-400 text-sm whitespace-nowrap">
                      {narxKorsat(t.kelishNarxi, t.valyuta)}
                    </td>
                    <td className="px-3 py-3 text-right text-green-600 text-sm font-semibold whitespace-nowrap">
                      {narxKorsat(t.sotishNarxi, t.valyuta)}
                    </td>
                    {/* Ranglar mahsulot kartasi va tafsilot oynasidagi bilan bir xil:
                        optom — ko'k, bo'lish — sariq. Kiritilmagan narx "—". */}
                    <td className={`px-3 py-3 text-right text-sm font-medium whitespace-nowrap ${t.optomNarxi === null ? 'text-gray-400 dark:text-gray-500' : 'text-blue-600 dark:text-blue-400'}`}>
                      {narxKorsat(t.optomNarxi, t.valyuta)}
                    </td>
                    <td className={`px-3 py-3 text-right text-sm font-medium whitespace-nowrap ${t.bolishNarxi === null ? 'text-gray-400 dark:text-gray-500' : 'text-amber-600 dark:text-amber-400'}`}>
                      {narxKorsat(t.bolishNarxi, t.valyuta)}
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <span className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-lg font-medium" title={t.kategoriya.nomi}>{t.kategoriya.nomi}</span>
                    </td>
                    {/* Qator bosilganda tafsilot ochiladi — amal tugmalari
                        o'sha bosishni yuqoriga o'tkazmasligi kerak. */}
                    <td className="px-3 py-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {tahrirRuxsat && (
                          <button
                            onClick={() => void qulfToggle(t)}
                            disabled={qulflanmoqda === t.id}
                            title={t.qulflangan ? "Qulfni ochish — sotuvga qaytadi" : "Qulflash — sotuvda ko'rinmaydi"}
                            className={`p-1.5 rounded-lg transition disabled:opacity-50 ${
                              t.qulflangan
                                ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                                : 'text-gray-500 dark:text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                            }`}
                          >
                            {qulflanmoqda === t.id
                              ? <Loader2 size={15} className="animate-spin" />
                              : t.qulflangan ? <Lock size={15} /> : <Unlock size={15} />}
                          </button>
                        )}
                        {tahrirRuxsat && (
                          <button onClick={() => ochModal(t)} title="Tahrirlash" className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg transition">
                            <Pencil size={15} />
                          </button>
                        )}
                        {ochirishRuxsat && (
                          <button onClick={() => ochirish(t.id)} title="O'chirish" className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition">
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
          {korinadiganTovarlar.length > renderLimit && (
            <button onClick={() => setRenderLimit(r => r + 50)} className="w-full py-2.5 text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-gray-50 dark:hover:bg-neutral-800 transition border-t border-gray-200 dark:border-neutral-800">
              Yana ko&apos;rsatish ({korinadiganTovarlar.length - renderLimit} ta qoldi)
            </button>
          )}
        </div>
      )}

      {/* Card view — mobilda har doim ko'rinadi, desktopda faqat view==='card' bo'lsa */}
      <div className={`grid grid-cols-1 gap-3 sm:gap-4 ${view === 'card' ? 'lg:grid-cols-4' : 'sm:hidden'}`}>
          {yuklanmoqda ? (
            <p className="text-gray-500 dark:text-gray-400 col-span-full text-center py-12">Yuklanmoqda...</p>
          ) : filteredTovarlar.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {qidiruv || aktifKategoriya || faqatQulflangan ? 'Shu shart bo\'yicha tovar topilmadi' : 'Hali tovar qo\'shilmagan'}
              </p>
              {qidiruv || aktifKategoriya || faqatQulflangan ? (
                <button
                  onClick={() => { setQidiruv(''); setAktifKategoriya(null); setFaqatQulflangan(false) }}
                  className="mt-3 px-4 py-2 rounded-xl border border-gray-300 dark:border-neutral-700 text-sm text-gray-600 dark:text-gray-400 hover:border-primary/50 hover:text-primary transition"
                >
                  Filtrni tozalash
                </button>
              ) : qoshishRuxsat ? (
                <button
                  onClick={() => ochModal()}
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90 transition"
                >
                  <Plus size={15} /> Birinchi tovarni qo&apos;shish
                </button>
              ) : null}
            </div>
          ) : filteredTovarlar.map(t => (
            <div key={t.id} className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden hover:shadow-lg hover:border-primary/30 dark:hover:border-primary/40 transition-all">
              {/* Rasm va matn qismi bosilsa tafsilot ochiladi; pastdagi
                  tugmalar paneli bu joydan tashqarida qoladi. */}
              <div
                onClick={() => setDetailTovar(t)}
                title="Batafsil ma'lumot"
                className="cursor-pointer"
              >
              {/* Mahsulot rasmi (agar bo'lsa), aks holda ikonka + yumshoq nurlanish */}
              <div className="aspect-[4/3] bg-gradient-to-br from-primary-light to-white dark:from-primary/15 dark:to-neutral-800 flex items-center justify-center relative overflow-hidden">
                <span className="absolute top-2 left-2 sm:top-3 sm:left-3 z-10 text-[11px] sm:text-[11px] bg-primary text-white px-2 py-1 sm:px-3 sm:py-1.5 rounded-full font-semibold shadow-sm max-w-[70%] truncate" title={t.kategoriya.nomi}>
                  {t.kategoriya.nomi}
                </span>
                {t.qulflangan && (
                  <span className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10 text-[11px] sm:text-[11px] bg-amber-500 text-white px-2 py-1 rounded-full font-semibold shadow-sm flex items-center gap-1">
                    <Lock size={10} /> Qulflangan
                  </span>
                )}
                {/* Tanlash — yorliq chop etish uchun */}
                <label
                  onClick={e => e.stopPropagation()}
                  className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 z-10 w-7 h-7 rounded-lg bg-white/90 dark:bg-neutral-900/90 shadow-sm flex items-center justify-center cursor-pointer"
                >
                  <input
                    type="checkbox"
                    aria-label={`${t.nomi} tanlash`}
                    checked={tanlangan.has(t.id)}
                    onChange={() => tanlashTogla(t.id)}
                    className="w-4 h-4 accent-red-600"
                  />
                </label>
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
                <div className="flex items-center gap-1.5 min-w-0">
                  {t.tartibRaqami !== null && (
                    <span className="shrink-0 px-1.5 py-0.5 rounded-md border border-gray-300 dark:border-neutral-600 text-gray-600 dark:text-gray-300 text-[11px] font-bold leading-none tabular-nums">
                      № {t.tartibRaqami}
                    </span>
                  )}
                  <p className="min-w-0 text-gray-900 dark:text-gray-100 font-bold text-sm sm:text-base truncate" title={t.nomi}>{t.nomi}</p>
                </div>
                <p className="text-gray-500 dark:text-gray-400 text-[11px] sm:text-xs mt-0.5 truncate">Shtrix-kod: {t.shtrixKod || '—'}</p>

                <TovarNarxPaneli
                  qoldiq={t.qoldiq}
                  birlik={t.birlik}
                  oramlar={oramlarniOqi(t.oramlar)}
                  kamQoldi={t.qoldiq !== null && t.qoldiq <= t.minimalQoldiq}
                  kelishNarxi={t.kelishNarxi}
                  sotishNarxi={t.sotishNarxi}
                  optomNarxi={t.optomNarxi}
                  bolishNarxi={t.bolishNarxi}
                  valyuta={t.valyuta}
                />
              </div>
              </div>

              <div className={`border-t border-gray-100 dark:border-neutral-800 grid ${{ 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' }[1 + (tahrirRuxsat ? 2 : 0) + (ochirishRuxsat ? 1 : 0)]}`}>
                <button onClick={() => setDetailTovar(t)} title="Batafsil" className="flex items-center justify-center py-2.5 sm:py-3 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-800 transition border-r border-gray-100 dark:border-neutral-800">
                  <Eye size={16} />
                </button>
                {tahrirRuxsat && (
                  <button
                    onClick={() => void qulfToggle(t)}
                    disabled={qulflanmoqda === t.id}
                    title={t.qulflangan ? "Qulfni ochish" : "Qulflash"}
                    className={`flex items-center justify-center py-2.5 sm:py-3 transition border-r border-gray-100 dark:border-neutral-800 disabled:opacity-50 ${
                      t.qulflangan
                        ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                        : 'text-gray-500 dark:text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                    }`}
                  >
                    {qulflanmoqda === t.id
                      ? <Loader2 size={16} className="animate-spin" />
                      : t.qulflangan ? <Lock size={16} /> : <Unlock size={16} />}
                  </button>
                )}
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
        <Modal
          olcham="sm"
          sarlavha={<>Kategoriyalarni boshqarish</>}
          onYopish={() => setKatModal(false)}
          tashqaridanYopish={true}
          zClassName="z-[60]"
        >
          <div className="space-y-4">
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
                  <p className="text-center text-gray-500 dark:text-gray-400 text-sm py-6">Hali kategoriya yo&apos;q</p>
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
                          <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">{k._count.tovarlar} ta</span>
                        )}
                        <button onClick={() => kategoriyaTahrirBoshlash(k)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition" title="Tahrirlash">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => kategoriyaOchirish(k)} disabled={katOchirilayotganId === k.id} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition disabled:opacity-50" title="O'chirish">
                          {katOchirilayotganId === k.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
          </div>
        </Modal>
      )}


      {/* Modal */}
      {modal && (
        <Modal
          olcham="lg"
          sarlavha={<>{tahrirlash ? 'Tovarni tahrirlash' : 'Yangi tovar'}</>}
          onYopish={() => setModal(false)}
          onSubmit={saqlash}
          footer={<>
            <button type="button" onClick={() => setModal(false)}
              className="flex-1 py-2.5 border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition font-medium">
              Bekor qilish
            </button>
            <button type="submit" disabled={saqlanmoqda} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white rounded-xl font-medium transition flex items-center justify-center gap-2">
              {saqlanmoqda ? <Loader2 size={15} className="animate-spin" /> : null}
              {saqlanmoqda ? 'Saqlanmoqda...' : (tahrirlash ? 'Saqlash' : "Qo'shish")}
            </button>
          </>}
        >
          <div className="space-y-4">
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
              {/* ── OMBOR (SKLAD) ──
                  Mahsulot qaysi omborda turadi: ro'yxatdan tanlanadi yoki
                  yangi nom yoziladi (mahsulot bilan birga ochiladi). Ombor
                  tanlansa kategoriyalar shu ombornikilar bilan cheklanadi. */}
              {omborMaydoni && (
                <div>
                  <label htmlFor="tovar-ombor" className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">
                    Ombor (sklad) <span className="text-gray-400 font-normal text-xs">— qayerda saqlanadi</span>
                  </label>
                  <Combobox
                    id="tovar-ombor"
                    options={formaOmborlari}
                    value={yangiOmbor || formaOmbor}
                    onChange={omborTanlandi}
                    placeholder={omborOchishMumkin ? 'Omborni tanlang yoki yangisini yozing' : 'Omborni tanlang'}
                    searchPlaceholder={omborOchishMumkin ? 'Ombor nomi — tanlang yoki yozing' : 'Ombor qidirish...'}
                    emptyMessage="Bunday ombor yo'q"
                    allowCustom={omborOchishMumkin}
                    customLabel={m => `«${m}» — yangi ombor qo'shish`}
                  />
                  {yangiOmbor && (
                    <p className="mt-1 text-xs text-primary flex items-start gap-1">
                      <Plus size={12} className="mt-0.5 shrink-0" />
                      <span>Yangi ombor «{yangiOmbor}» — mahsulot saqlanganda ochiladi</span>
                    </p>
                  )}
                </div>
              )}

              <div>
                <label htmlFor="tovar-kategoriya" className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Kategoriya *</label>
                {kategoriyalar.length === 0 && !kategoriyaRuxsat ? (
                  <div className="px-3 py-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl">
                    <span className="text-amber-700 dark:text-amber-500 text-sm">Hali kategoriya yo&apos;q</span>
                  </div>
                ) : (
                  /* Qidiriladigan ro'yxat; huquq bo'lsa yangi nom yozish ham mumkin */
                  <Combobox
                    id="tovar-kategoriya"
                    options={formaKategoriyalari.map(k => ({
                      value: k.id,
                      label: k.nomi,
                      // Ombor tanlanmagan bo'lsa qaysi omborda ekani ko'rinadi
                      izoh: maqsadOmbor || !omborMaydoni ? undefined : (k.ombor?.nomi ?? 'Markaziy'),
                    }))}
                    value={yangiKategoriya || form.kategoriyaId}
                    onChange={kategoriyaTanlandi}
                    placeholder={kategoriyaRuxsat ? 'Kategoriyani tanlang yoki yozing' : 'Kategoriya tanlang'}
                    searchPlaceholder={kategoriyaRuxsat ? 'Kategoriya — tanlang yoki yozing' : 'Kategoriya qidirish...'}
                    emptyMessage={maqsadOmborNomi ? `«${maqsadOmborNomi}» da hali kategoriya yo'q` : 'Topilmadi'}
                    allowCustom={kategoriyaRuxsat}
                    customLabel={m => `«${m}» — yangi kategoriya`}
                  />
                )}
                {yangiKategoriya && (
                  <p className="mt-1 text-xs text-primary flex items-start gap-1">
                    <Plus size={12} className="mt-0.5 shrink-0" />
                    <span>
                      Yangi kategoriya «{yangiKategoriyaNomi}»{maqsadOmborNomi ? ` — «${maqsadOmborNomi}» da` : ''}
                      {yangiKategoriyaNomi !== yangiKategoriya && (
                        <span className="text-gray-500 dark:text-gray-400"> («{yangiKategoriya}» nomi boshqa omborda band)</span>
                      )}
                    </span>
                  </p>
                )}
              </div>

              {/* Ta'minotchi — bu tovar kimdan keladi. Ixtiyoriy:
                  belgilansa, boshlang'ich kirim ham shu ta'minotchiga
                  bog'lanadi va ombor tarixida ko'rinadi. */}
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">
                  Ta&apos;minotchi <span className="text-gray-400 font-normal">(kimdan keladi)</span>
                </label>
                {taminotchilar.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-xs px-3 py-2 border border-dashed border-gray-300 dark:border-neutral-700 rounded-xl">
                    Hali ta&apos;minotchi qo&apos;shilmagan — &quot;Ta&apos;minotchilar&quot; bo&apos;limidan qo&apos;shing
                  </p>
                ) : (
                  <Combobox
                    options={taminotchilar.map(t => ({ value: t.id, label: t.nomi }))}
                    value={form.taminotchiId}
                    onChange={v => setForm(f => ({ ...f, taminotchiId: v }))}
                    placeholder="Tanlanmagan"
                    searchPlaceholder="Ta'minotchi qidirish..."
                  />
                )}
              </div>
              {/* Erkin matn: ro'yxatdagi ta'minotchisi bo'lmagan tovar ham
                  qayerdan kelgani yozib qo'yilsin (bozor, shahar, do'kon nomi). */}
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">
                  Keltirilgan manzil <span className="text-gray-400 font-normal">(qayerdan olib kelindi)</span>
                </label>
                <input
                  value={form.keltirilganManzil}
                  onChange={e => setForm(f => ({ ...f, keltirilganManzil: e.target.value }))}
                  maxLength={300}
                  placeholder="Masalan: Chorsu bozori, 12-rasta"
                  className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
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
                      value={ustamaFoizYashirilgan ? '' : form.foiz}
                      onChange={e => foizOzgardi(e.target.value)}
                      disabled={ustamaFoizYashirilgan}
                      className={inputCls + ' pr-8'}
                      placeholder={ustamaFoizYashirilgan ? 'Sizga yashirilgan' : '15'}
                    />
                    {!ustamaFoizYashirilgan && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm">%</span>
                    )}
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
                  <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                    ≈ {formatSum(Math.round((parseFloat(form.sotishNarxi) || 0) * kursi))} (joriy kurs: {formatSum(kursi)}/$)
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">
                    Optom narxi <span className="text-gray-400 font-normal">(ixtiyoriy)</span>
                  </label>
                  <MoneyInput
                    value={form.optomNarxi}
                    onChange={v => setForm(f => ({ ...f, optomNarxi: v }))}
                    placeholder="0"
                    suffix={form.valyuta === 'USD' ? '$' : 'UZS'}
                  />
                </div>
                <div>
                  <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">
                    Bo&apos;lish narxi <span className="text-gray-400 font-normal">(ixtiyoriy)</span>
                  </label>
                  <MoneyInput
                    value={form.bolishNarxi}
                    onChange={v => setForm(f => ({ ...f, bolishNarxi: v }))}
                    placeholder="0"
                    suffix={form.valyuta === 'USD' ? '$' : 'UZS'}
                  />
                </div>
              </div>
              {/* ── O'lchov birligi: asosiysi va qo'shimchalari (karobka, qop…) ── */}
              <div className="space-y-3">
                <div>
                  <label htmlFor="tovar-birlik" className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">O‘lchov birligi</label>
                  <BirlikTanlash id="tovar-birlik" value={form.birlik} onChange={v => setForm(f => ({ ...f, birlik: v }))} />
                  <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                    Qoldiq va sotuv shu birlikda sanaladi. Ro‘yxatda yo‘q bo‘lsa — yozib qo‘shing (masalan, juft, rulon).
                  </p>
                </div>
                <div>
                  <p className="text-gray-700 dark:text-gray-300 text-sm mb-1.5 font-medium">
                    Qo‘shimcha birliklar <span className="text-gray-400 font-normal">(ixtiyoriy — karobka, qop…)</span>
                  </p>
                  <OramlarMaydoni asosiy={form.birlik} qatorlar={form.oramlar} onChange={o => setForm(f => ({ ...f, oramlar: o }))} />
                </div>
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
                      <span className="text-[11px]">Qo&apos;shish</span>
                      <input suppressHydrationWarning type="file" accept="image/*" className="hidden" onChange={rasmTanlash} />
                    </label>
                  )}
                </div>
              </div>
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">
                  Yaroqlilik muddati <span className="text-gray-500 dark:text-gray-400 font-normal">(ixtiyoriy)</span>
                </label>
                <input
                  type="date"
                  value={form.yaroqlilikMuddati}
                  onChange={e => setForm(f => ({ ...f, yaroqlilikMuddati: e.target.value }))}
                  className={inputCls}
                />
              </div>
              {/* ── Miqdor: dona, karobka, qop… bo'yicha — jami asosiy birlikda saqlanadi ── */}
              <div>
                <p className="text-gray-700 dark:text-gray-300 text-sm mb-1.5 font-medium">
                  {tahrirlash
                    ? <>Yana qancha qo‘shiladi <span className="text-gray-500 dark:text-gray-400 font-normal">(ixtiyoriy)</span></>
                    : formaOramlari.length > 0 ? 'Qancha bor' : `Necha ${birlikMatni(form.birlik)} bor`}
                </p>
                {tahrirlash && (
                  <p className="text-gray-500 dark:text-gray-400 text-xs mb-1.5">
                    Hozirgi qoldiq: <span className="font-medium text-gray-600 dark:text-gray-400">{tahrirlash.qoldiq ?? 0} {birlikMatni(form.birlik)}</span>
                    {(tahrirlash.qoldiq ?? 0) > 0 && formaOramlari.length > 0 && ` (${miqdorMatni(tahrirlash.qoldiq ?? 0, form.birlik, formaOramlari)})`}
                    {' '}— kiritilgani shunga qo&apos;shiladi.
                  </p>
                )}
                <MiqdorKiritish
                  idPrefiks="tovar-miqdor"
                  asosiy={form.birlik}
                  oramlar={formaOramlari}
                  qismlar={qoldiqQismlari}
                  onChange={setQoldiqQismlari}
                />
              </div>
          </div>
        </Modal>
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
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 sm:p-4" onClick={() => setKorinishModal(false)}>
          <div role="dialog" aria-modal="true" aria-label="Ko'rinish sozlamalari" className="bg-white dark:bg-neutral-900 rounded-t-2xl sm:rounded-2xl shadow-xl dark:border dark:border-neutral-800 w-full max-w-lg max-h-[calc(100dvh-0.75rem)] sm:max-h-[90dvh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between shrink-0">
              <h3 className="text-gray-900 dark:text-gray-100 font-semibold flex items-center gap-2">
                <EyeOff size={18} className="text-primary" />
                Ko&apos;rinish sozlamalari
              </h3>
              <button onClick={() => setKorinishModal(false)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition">
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
                    <p className="text-gray-500 dark:text-gray-400 text-xs mb-2">
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

                    <p className="text-gray-500 dark:text-gray-400 text-xs mb-2 mt-4">
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
      {/* ── Shtrix-kod yorliqlarini chop etish ── */}
      {yorliqModal && (() => {
        const tanlanganlar = tartiblanganTovarlar.filter(t => tanlangan.has(t.id))
        const chiqadi = tanlanganlar.filter(t => yorliqqaChiqadimi(t.shtrixKod))
        const kodsiz = tanlanganlar.filter(t => !yorliqqaChiqadimi(t.shtrixKod))
        const jami = chiqadi.length * yorliqSozlama.nusxa
        const a4 = yorliqSozlama.olcham === 'a4'
        const varaqda = varaqdagiYorliqlar(yorliqSozlama)
        return (
          <Modal
            belgi={<Barcode size={18} className="text-primary" />}
            sarlavha={<>Shtrix-kod yorliqlari</>}
            tavsif="Tepada № va nomi, o‘rtada shtrix-kod, pastda narx"
            onYopish={() => setYorliqModal(false)}
            tashqaridanYopish={true}
            footer={<>
              <button onClick={yorliqChopEt} disabled={jami === 0}
                className="flex-1 py-2.5 bg-primary text-white rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                <Printer size={15} />
                Chop etish{jami > 0 ? ` · ${jami} ta` : ''}
              </button>
              <button onClick={() => setYorliqModal(false)}
                className="px-5 py-2.5 border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400 rounded-xl font-medium">
                Yopish
              </button>
            </>}
          >
            <div className="space-y-4">
              {chiqadi[0] ? (
                <div>
                  <YorliqNamuna yorliq={yorliqMalumoti(chiqadi[0])} sozlama={yorliqSozlama} />
                  <p className="mt-1.5 text-center text-gray-500 dark:text-gray-400 text-[11px]">
                    Namuna{chiqadi.length > 1 ? ` — birinchi mahsulot (jami ${chiqadi.length} xil)` : ''}
                  </p>
                </div>
              ) : (
                <p className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
                  Tanlangan mahsulotlarda shtrix-kod yo&apos;q. Mahsulotni tahrirlab kod kiriting —
                  yorliq shu kod bilan chiqadi va kassa skaneri uni taniydi.
                </p>
              )}

              <fieldset>
                <legend className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Yorliq o‘lchami</legend>
                <div className="grid grid-cols-3 gap-2">
                  {YORLIQ_OLCHAMLARI.map(o => (
                    <button key={o.qiymat} type="button" aria-pressed={yorliqSozlama.olcham === o.qiymat}
                      onClick={() => setYorliqOlcham(o.qiymat)}
                      className={`flex flex-col items-center justify-center gap-0.5 px-2 py-2.5 rounded-xl border text-sm font-medium transition ${
                        yorliqSozlama.olcham === o.qiymat
                          ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                          : 'border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800'
                      }`}>
                      <span className="whitespace-nowrap">{o.nomi}</span>
                      <span className="text-[11px] font-normal opacity-75 whitespace-nowrap">{o.izoh}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className={`grid gap-3 ${a4 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {a4 && (
                  <div>
                    <label htmlFor="yorliq-ustun" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Bir qatorda
                    </label>
                    <select id="yorliq-ustun" value={yorliqSozlama.ustunlar} onChange={e => setYorliqUstun(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500">
                      {A4_USTUNLAR.map(n => <option key={n} value={n}>{n} ta</option>)}
                    </select>
                    <p className="text-gray-500 dark:text-gray-400 text-[11px] mt-1">varaqda {varaqda} ta yorliq</p>
                  </div>
                )}
                <div>
                  <label htmlFor="yorliq-nusxa" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Har biridan
                  </label>
                  <input id="yorliq-nusxa" type="number" min={1} max={NUSXA_CHEGARA} value={yorliqNusxa}
                    onChange={e => setYorliqNusxa(Math.min(NUSXA_CHEGARA, Math.max(1, Math.floor(Number(e.target.value)) || 1)))}
                    className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500" />
                  <p className="text-gray-500 dark:text-gray-400 text-[11px] mt-1">nusxa (masalan, qutidagi soni)</p>
                </div>
              </div>

              <div className="rounded-xl bg-gray-50 dark:bg-neutral-800/60 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 space-y-1">
                <p className="tabular-nums">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{jami} ta yorliq</span>
                  {' '}— {chiqadi.length} ta mahsulot{yorliqSozlama.nusxa > 1 ? ` × ${yorliqSozlama.nusxa}` : ''}
                  {a4 && jami > 0 ? `, ${Math.ceil(jami / varaqda)} varaq A4` : ''}
                </p>
                {kodsiz.length > 0 && (
                  <p className="text-amber-700 dark:text-amber-400 text-xs">
                    Shtrix-kodsiz {kodsiz.length} ta chiqmaydi: {kodsiz.slice(0, 3).map(t => t.nomi).join(', ')}{kodsiz.length > 3 ? ` va yana ${kodsiz.length - 3} ta` : ''}
                  </p>
                )}
                <p className="text-gray-500 dark:text-gray-400 text-xs">
                  {a4
                    ? 'Oddiy printerda A4 ga chiqadi — chiziqlar bo‘ylab qirqib oling.'
                    : 'Chop etish oynasida yorliq printerini tanlang — qog‘oz o‘lchami avtomatik qo‘yiladi.'}
                </p>
              </div>
            </div>
          </Modal>
        )
      })()}

      {katalogModal && (
        <Modal
          belgi={<BookOpen size={18} className="text-primary" />}
          sarlavha={<>Katalog — A4 chop etish</>}
          tavsif="Mahsulotlar rasmi va narxi bilan, kitobcha ko‘rinishida"
          onYopish={() => setKatalogModal(false)}
          yopishMumkin={katalogOqim === null}
          tashqaridanYopish={true}
          olcham="lg"
          footer={<>
            <button onClick={() => void katalogChopEt()}
              disabled={katalogOqim !== null || katalogTovarlari.length === 0 || katNarxlar.size === 0}
              className="flex-1 py-2.5 bg-primary text-white rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2">
              {katalogOqim !== null
                ? <><Loader2 size={15} className="animate-spin" /> Rasmlar tayyorlanmoqda {katalogOqim}/{katalogTovarlari.length}</>
                : <><Printer size={15} /> Chop etish</>}
            </button>
            <button onClick={() => setKatalogModal(false)} disabled={katalogOqim !== null}
              className="px-5 py-2.5 border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400 rounded-xl font-medium disabled:opacity-50">
              Yopish
            </button>
          </>}
        >
          <div className="space-y-5">
            {/* Qaysi mahsulotlar */}
            <fieldset>
              <legend className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Qaysi mahsulotlar</legend>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setKatalogHammasi(false)} disabled={tanlangan.size === 0}
                  aria-pressed={!katalogHammasi} className={tanlovCls(!katalogHammasi)}>
                  Tanlanganlar <span className="tabular-nums opacity-80">({tanlangan.size})</span>
                </button>
                <button type="button" onClick={() => setKatalogHammasi(true)}
                  aria-pressed={katalogHammasi} className={tanlovCls(katalogHammasi)}>
                  Hammasi <span className="tabular-nums opacity-80">({korinadiganTovarlar.length})</span>
                </button>
              </div>
              {katalogHammasi && katalogFiltri && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1.5">
                  Ro‘yxat filtrlangan: {katalogFiltri}. Butun katalog kerak bo‘lsa, avval filtrni olib tashlang.
                </p>
              )}
              {tanlangan.size === 0 && (
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5">
                  Faqat ba’zilarini chiqarish uchun ro‘yxatda belgilang.
                </p>
              )}
            </fieldset>

            {/* Ko'rinish */}
            <fieldset>
              <legend className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Ko‘rinish</legend>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ['karta', 'Rasmli katalog', 'Katta rasm, kitobcha'],
                  ['ixcham', 'Ixcham narxnoma', 'Kichik rasm, zich ro‘yxat'],
                ] as const).map(([k, nomi, izoh]) => (
                  <button key={k} type="button" aria-pressed={katKorinish === k}
                    onClick={() => {
                      setKatKorinish(k)
                      const mumkin = ustunChegarasi(k)
                      if (!mumkin.includes(katUstun)) setKatUstun(mumkin[Math.floor(mumkin.length / 2)])
                    }}
                    className={`${tanlovCls(katKorinish === k)} flex-col !items-start text-left !py-3`}>
                    {/* Kichik namuna — qaysi ko'rinish ekanini bir qarashda */}
                    <span aria-hidden className="w-full h-10 mb-1.5 rounded-md bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 p-1 flex gap-1">
                      {k === 'karta'
                        ? [0, 1, 2].map(i => (
                            <span key={i} className="flex-1 flex flex-col gap-0.5">
                              <span className="flex-1 rounded-sm bg-gray-200 dark:bg-neutral-700" />
                              <span className="h-1 rounded-full bg-gray-300 dark:bg-neutral-600" />
                            </span>
                          ))
                        : (
                            <span className="flex-1 flex flex-col justify-between">
                              {[0, 1, 2].map(i => (
                                <span key={i} className="flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-[2px] bg-gray-200 dark:bg-neutral-700" />
                                  <span className="flex-1 h-1 rounded-full bg-gray-300 dark:bg-neutral-600" />
                                  <span className="w-3 h-1 rounded-full bg-gray-400 dark:bg-neutral-500" />
                                </span>
                              ))}
                            </span>
                          )}
                    </span>
                    <span>{nomi}</span>
                    <span className="text-[11px] font-normal opacity-70">{izoh}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Bir qatorda */}
            <fieldset>
              <legend className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Bir qatorda</legend>
              <div className={`grid gap-2 ${katKorinish === 'karta' ? 'grid-cols-3' : 'grid-cols-2'}`}>
                {ustunChegarasi(katKorinish).map(n => (
                  <button key={n} type="button" onClick={() => setKatUstun(n)} aria-pressed={katUstun === n}
                    className={tanlovCls(katUstun === n)}>
                    {n} ta
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Narxlar */}
            <fieldset>
              <legend className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Qaysi narx chiqsin</legend>
              <div className="flex flex-wrap gap-2">
                {NARX_YORLIQLARI.map(n => {
                  const faol = katNarxlar.has(n.turi)
                  return (
                    <button key={n.turi} type="button" aria-pressed={faol}
                      onClick={() => setKatNarxlar(prev => {
                        const yangi = new Set(prev)
                        if (yangi.has(n.turi)) yangi.delete(n.turi)
                        else yangi.add(n.turi)
                        return yangi
                      })}
                      className={tanlovCls(faol)}>
                      {faol && <Check size={14} />} {n.yorliq}
                    </button>
                  )
                })}
              </div>
              {katNarxlar.size === 0 && (
                <p className="text-[11px] text-red-600 mt-1.5">Kamida bitta narxni tanlang</p>
              )}
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5">
                Kelish narxi katalogga hech qachon chiqmaydi. Narxi kiritilmagan tovarda o‘sha narx ko‘rsatilmaydi.
              </p>
            </fieldset>

            {/* Qo'shimcha */}
            <fieldset className="space-y-2">
              <legend className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Qo‘shimcha</legend>
              {([
                [katKategoriya, setKatKategoriya, 'Kategoriyalar bo‘yicha bo‘limlarga ajratish'],
                [katQoldiq, setKatQoldiq, 'Ombordagi qoldiqni ko‘rsatish'],
                [katShtrix, setKatShtrix, 'Shtrix-kodni ko‘rsatish'],
              ] as const).map(([qiymat, ozgartir, matn]) => (
                <label key={matn} className="flex items-center gap-2.5 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={qiymat} onChange={e => ozgartir(e.target.checked)}
                    className="w-4 h-4 rounded accent-red-600" />
                  {/* Matn alohida elementda: aks holda globals.css dagi "faqat katakcha"
                      qoidasi yorliqni 40px inline tugmaga aylantirib, qatorlar yopishadi */}
                  <span>{matn}</span>
                </label>
              ))}
            </fieldset>

            <div>
              <label htmlFor="katalog-izoh" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Pastki eslatma <span className="font-normal text-gray-400">(ixtiyoriy)</span>
              </label>
              <input id="katalog-izoh" value={katIzoh} onChange={e => setKatIzoh(e.target.value)} maxLength={160}
                placeholder="Masalan: Narxlar 1 haftaga amal qiladi"
                className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>

            {/* Yakun */}
            <div className="rounded-xl bg-gray-50 dark:bg-neutral-800/50 px-3.5 py-2.5 text-sm text-gray-700 dark:text-gray-300">
              <b className="tabular-nums">{katalogTovarlari.length}</b> ta mahsulot ·
              taxminan <b className="tabular-nums">{katalogSahifa}</b> sahifa A4
              {katalogRasmsiz > 0 && (
                <span className="block text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  {katalogRasmsiz} tasida rasm yo‘q — o‘rnida bo‘sh joy chiqadi
                </span>
              )}
              <span className="block text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                Bosma oynasida «PDF sifatida saqlash»ni tanlab, mijozga Telegram orqali ham yuborish mumkin.
              </span>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Suzuvchi kategoriya tanlagich ──
          Mahsulotlar ro'yxati uzun bo'lgani uchun pastga tushilganda tepadagi
          chiplar ko'rinmay qoladi. Shu tugma o'sha paytda paydo bo'ladi va
          bosilganda ro'yxat pastdan chiqadi — kategoriyalar ko'p bo'lsa
          ro'yxatning o'zi aylantiriladi (sig'masligi muammo emas). */}
      {kategoriyaKorinmayapti && !kategoriyaVarag && !modal && !katModal && !detailTovar && !rasmModal && (
        <button
          onClick={() => { setKategoriyaQidiruv(''); setKategoriyaVarag(true) }}
          title="Kategoriya tanlash"
          className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 lg:bottom-8 lg:right-8 z-30 flex items-center gap-2.5 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30 transition active:scale-95 pl-4 pr-5 py-3.5 max-w-[70vw]"
        >
          <LayoutGrid size={18} className="shrink-0" />
          <div className="text-left leading-tight min-w-0">
            <span className="block text-[11px] font-medium opacity-90">Kategoriya</span>
            <span className="block text-sm font-bold truncate">
              {aktifKategoriya
                ? (kategoriyalar.find(k => k.id === aktifKategoriya)?.nomi ?? 'Barchasi')
                : 'Barchasi'}
            </span>
          </div>
        </button>
      )}

      {/* Kategoriya varag'i — mobilda pastdan chiqadi, desktopda markazda */}
      {kategoriyaVarag && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={() => setKategoriyaVarag(false)}
        >
          <div
            className="bg-white dark:bg-neutral-900 rounded-t-2xl sm:rounded-2xl shadow-xl dark:border dark:border-neutral-800 w-full max-w-md max-h-[80dvh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between gap-3 shrink-0">
              <h3 className="text-gray-900 dark:text-gray-100 font-semibold flex items-center gap-2">
                <LayoutGrid size={17} className="text-primary" /> Kategoriya tanlash
              </h3>
              <button
                onClick={() => setKategoriyaVarag(false)}
                className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Kategoriyalar ko'p bo'lsa qidiruv bilan topiladi */}
            {kategoriyalar.length > 8 && (
              <div className="px-4 pt-3 shrink-0">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={kategoriyaQidiruv}
                    onChange={e => setKategoriyaQidiruv(e.target.value)}
                    placeholder="Kategoriya qidirish..."
                    autoFocus
                    className="w-full pl-9 pr-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>
            )}

            <div className="overflow-y-auto flex-1 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3">
              <button
                onClick={() => { setAktifKategoriya(null); setKategoriyaVarag(false) }}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                  aktifKategoriya === null
                    ? 'bg-red-600 text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800'
                }`}
              >
                <span>Barchasi</span>
                {aktifKategoriya === null && <Check size={15} />}
              </button>

              {kategoriyalar
                .filter(k => !kategoriyaQidiruv.trim() || normalizeUzbek(k.nomi).includes(normalizeUzbek(kategoriyaQidiruv)))
                .map(k => (
                  <button
                    key={k.id}
                    onClick={() => { setAktifKategoriya(k.id); setKategoriyaVarag(false) }}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition mt-1 ${
                      aktifKategoriya === k.id
                        ? 'bg-red-600 text-white'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <span className="truncate text-left">{k.nomi}</span>
                    <span className="flex items-center gap-2 shrink-0">
                      {k._count?.tovarlar !== undefined && (
                        <span className={`text-[11px] tabular-nums ${aktifKategoriya === k.id ? 'opacity-80' : 'text-gray-500 dark:text-gray-400'}`}>
                          {k._count.tovarlar}
                        </span>
                      )}
                      {aktifKategoriya === k.id && <Check size={15} />}
                    </span>
                  </button>
                ))}

              {kategoriyalar.length > 0 &&
                kategoriyalar.filter(k => !kategoriyaQidiruv.trim() || normalizeUzbek(k.nomi).includes(normalizeUzbek(kategoriyaQidiruv))).length === 0 && (
                <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">Topilmadi</p>
              )}
            </div>
          </div>
        </div>
      )}

      {detailTovar && (
        <TovarTafsilot
          key={detailTovar.id}
          tovarId={detailTovar.id}
          onYopish={() => setDetailTovar(null)}
          onTahrir={tahrirRuxsat ? () => { const t = detailTovar; setDetailTovar(null); ochModal(t) } : undefined}
          onRasmOch={(rasmlar, nomi, index) => setRasmModal({ rasmlar, nomi, index })}
          onQulfTogla={tahrirRuxsat ? async () => { await qulfToggle(detailTovar) } : undefined}
        />
      )}
    </div>
  )
}
