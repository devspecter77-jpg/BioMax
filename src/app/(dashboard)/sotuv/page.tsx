'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { formatSum, formatSanaVaVaqt, formatPhone, playBeep, uzSearch } from '@/lib/utils'
import { buildChekHtml, chekChopEtish as printChek, type ChekData, type ChekTarkib } from '@/lib/chek-print'
import { kodniAjrat } from '@/lib/qr-kod'
import { toast } from 'sonner'
import type { Html5Qrcode } from 'html5-qrcode'
import { Search, ShoppingCart, Trash2, CheckCircle, Printer, Download, RotateCcw, Clock, X, Loader2, AlertTriangle, Pencil, Pause, Play, Archive, Languages, ScanLine, LayoutGrid, Link2, Share2, Package, Plus, Gift, Percent, MapPin, Send } from 'lucide-react'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { jsPDF } from 'jspdf'
import Combobox from '@/components/ui/combobox'
import MoneyInput from '@/components/ui/money-input'
import PhoneInput from '@/components/ui/phone-input'
import TovarNarxPaneli from '@/components/TovarNarxPaneli'
import ChipRow from '@/components/ui/chip-row'
import { useRuxsat } from '@/hooks/useRuxsat'
import { minNarxSomda } from '@/lib/ruxsat-amallar'
import {
  SODIQLIK_STANDART, sarflashniHisobla, ballSarflanadimi, formatBall,
  type SodiqlikSozlama,
} from '@/lib/sodiqlik'
import {
  POS_TOLOV_USULLARI, KANAL_USULLARI, TOLOV_MALUMOTI,
  tolovLabel, tolovQisqa, tolovBadge, tolovTaqsimoti, tolovKanallari,
  aralashJami, aralashTekshir,
  type KanalUsuli, type AralashKiritma,
} from '@/lib/tolov-usullari'

interface Tovar {
  id: string; nomi: string; sotishNarxi: number; kelishNarxi: number | null
  optomNarxi?: number | null; bolishNarxi?: number | null
  birlik: string; qoldiq: number; shtrixKod: string | null
  rasmlar?: string[]; valyuta?: string; kategoriya?: { id: string; nomi: string }
}
interface Kategoriya { id: string; nomi: string; ombor?: { id: string; nomi: string; faol: boolean } | null }

type NarxTuri = 'sotish' | 'optom' | 'bolish'
const NARX_TURI_LABEL: Record<NarxTuri, string> = { sotish: 'Chakana', optom: 'Optom', bolish: "Bo'lish" }

/** Server qaytargan sotuv — chek, oxirgi sotuv va qaytarish oynalari uchun */
interface SotuvTarkibi extends ChekTarkib {
  id: string
  tovarId: string
}
interface SotuvYozuvi extends ChekData {
  id: string
  tarkiblar: SotuvTarkibi[]
}

// Tanlangan narx turi bo'yicha narxni tanlaydi — o'sha tur uchun mahsulotda
// narx kiritilmagan bo'lsa, oddiy sotish narxiga qaytadi.
function narxTuriBoyicha(tovar: Tovar, turi: NarxTuri, kursi: number): number {
  const asosiy = turi === 'optom' && tovar.optomNarxi != null ? tovar.optomNarxi
    : turi === 'bolish' && tovar.bolishNarxi != null ? tovar.bolishNarxi
    : tovar.sotishNarxi
  return tovar.valyuta === 'USD' ? Math.round(asosiy * kursi) : asosiy
}
interface Mijoz { id: string; ism: string; telefon: string | null; telefon2?: string | null; qoshimchaTelefonlar?: string[]; manzil?: string | null; lokatsiyaLat?: number | null; lokatsiyaLng?: number | null }
interface SavatItem {
  tovarId: string; nomi: string; birlikNarxi: number; miqdor: number; birlik: string; chegirma: number; jami: number; mavjudQoldiq: number; bonus?: boolean
  narxTuri?: NarxTuri
}
// Saqlab qo'yilgan zakaz — serverda (Buyurtma jadvali). Brauzer
// xotirasida emas: boshqa kassir yoki qurilmadan ham ochilsin.
interface SaqlanganZakaz {
  id: string
  jamiSumma: number | string
  izoh: string | null
  yaratilgan: string
  mijoz: { id: string; ism: string; telefon: string | null } | null
  sotuvchi: { id: string; ism: string } | null
  tarkiblar: Array<{
    id: string
    tovarId: string
    miqdor: number | string
    birlikNarxi: number | string
    tovar: { id: string; nomi: string; birlik: string }
  }>
}

function MiqdorInput({ miqdor, max, onChange }: { miqdor: number; max: number; onChange: (v: number) => void }) {
  const [matn, setMatn] = useState(String(miqdor))

  useEffect(() => {
    setMatn(String(miqdor))
  }, [miqdor])

  return (
    <input
      type="text"
      inputMode="decimal"
      value={matn}
      onChange={e => {
        // Faqat raqam va nuqta
        const v = e.target.value.replace(/[^0-9.]/g, '')
        const num = parseFloat(v)
        // Mavjud qoldiqdan oshib yozib bo'lmaydi — darhol maksimalga cheklanadi
        if (!isNaN(num) && num > max) {
          setMatn(String(max))
          onChange(max)
          return
        }
        setMatn(v)
        if (!isNaN(num) && num > 0) onChange(num)
      }}
      onFocus={e => e.target.select()}
      onBlur={() => {
        const num = parseFloat(matn)
        if (isNaN(num) || num <= 0) setMatn(String(miqdor))
      }}
      onWheel={e => e.currentTarget.blur()}
      className="w-14 h-7 text-center text-sm font-medium text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-pos shrink-0"
    />
  )
}

const inputCls = 'w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-pos transition text-sm'

// Lotin → Kirill transliteratsiya
const lotinKirill: Record<string, string> = {
  'Sh':'Ш','sh':'ш','Ch':'Ч','ch':'ч','Ng':'Нг','ng':'нг',
  "O'":'Ў',"o'":'ў',"G'":'Ғ',"g'":'ғ',
  'Yo':'Ё','yo':'ё','Yu':'Ю','yu':'ю','Ya':'Я','ya':'я',
  'Ye':'Е','ye':'е','Ts':'Ц','ts':'ц',
  'A':'А','a':'а','B':'Б','b':'б','D':'Д','d':'д','E':'Э','e':'э',
  'F':'Ф','f':'ф','G':'Г','g':'г','H':'Ҳ','h':'ҳ','I':'И','i':'и',
  'J':'Ж','j':'ж','K':'К','k':'к','L':'Л','l':'л','M':'М','m':'м',
  'N':'Н','n':'н','O':'О','o':'о','P':'П','p':'п','Q':'Қ','q':'қ',
  'R':'Р','r':'р','S':'С','s':'с','T':'Т','t':'т','U':'У','u':'у',
  'V':'В','v':'в','X':'Х','x':'х','Y':'Й','y':'й','Z':'З','z':'з',
}
function kirill(text: string): string {
  let result = text
  // Avval ko'p harflilarni almashtirish (uzunroqlarini birinchi)
  const keys = Object.keys(lotinKirill).sort((a, b) => b.length - a.length)
  for (const lat of keys) {
    result = result.split(lat).join(lotinKirill[lat])
  }
  return result
}

export default function SotuvPage() {
  const [tovarlar, setTovarlar] = useState<Tovar[]>([])
  const [kursi, setKursi] = useState<number>(12700)
  // Xodim ruxsatlari — server ham har bir sotuvda tekshiradi (chegirma, nasiya)
  const ruxsat = useRuxsat()
  const chegirmaRuxsat = ruxsat.bor('sotuv.chegirma')
  const nasiyaRuxsat = ruxsat.bor('sotuv.nasiya')
  const qaytarishRuxsat = ruxsat.bor('sotuv.qaytarish')
  const saqlashRuxsat = ruxsat.bor('sotuv.saqlash')
  const [tovarlarYuklanmoqda, setTovarlarYuklanmoqda] = useState(true)
  const [tovarlarXato, setTovarlarXato] = useState<string | null>(null)
  const [mijozlar, setMijozlar] = useState<Mijoz[]>([])
  const [savat, setSavat] = useState<SavatItem[]>([])
  const [qidiruv, setQidiruv] = useState('')
  const [kategoriyalar, setKategoriyalar] = useState<Kategoriya[]>([])
  // Ombor — kategoriyalarning ustki guruhi. POS ikki bosqichli
  // filtr beradi: avval ombor, so'ng uning ichidagi kategoriya.
  const [aktifOmbor, setAktifOmbor] = useState<string | null>(null)

  // kategoriyaId -> omborId. Mahsulotda ombor yo'q, faqat kategoriya bor,
  // shuning uchun ombor bo'yicha filtrlash uchun shu xarita kerak.
  const kategoriyaOmbori = useMemo(() => {
    const m = new Map<string, string>()
    for (const k of kategoriyalar) if (k.ombor) m.set(k.id, k.ombor.id)
    return m
  }, [kategoriyalar])

  // Omborlar ro'yxati — kategoriyalardan yig'iladi, alohida so'rov shart emas
  const omborlar = useMemo(() => {
    const m = new Map<string, string>()
    // Nofaol ombor yorliq bermaydi — lekin uning kategoriyalari va
    // tovarlari "Hammasi" ostida ko'rinaveradi, ya'ni zaxira
    // kassirdan yashirilmaydi.
    for (const k of kategoriyalar) if (k.ombor?.faol) m.set(k.ombor.id, k.ombor.nomi)
    return [...m].map(([id, nomi]) => ({ id, nomi }))
  }, [kategoriyalar])

  // Tanlangan omborga tegishli kategoriyalar
  const korinadiganKategoriyalar = useMemo(
    () => aktifOmbor ? kategoriyalar.filter(k => k.ombor?.id === aktifOmbor) : kategoriyalar,
    [kategoriyalar, aktifOmbor],
  )
  // Bo'limlar varag'i — kategoriya ko'p bo'lganda qidirib tanlash uchun
  const [kategoriyaVaraq, setKategoriyaVaraq] = useState(false)
  const [kategoriyaQidiruv, setKategoriyaQidiruv] = useState('')
  const [aktifKategoriya, setAktifKategoriya] = useState<string | null>(null)
  const [tolovUsuli, setTolovUsuli] = useState('NAQD')
  // ARALASH: har bir kanal uchun kassir qo'lda kiritadigan summa.
  // Oldin faqat "naqd qism" so'ralib, qolgani bitta kanalga yozilardi —
  // shuning uchun chekda pul qaysi kanaldan kelgani noaniq qolardi.
  const [aralashSummalar, setAralashSummalar] = useState<Record<KanalUsuli, string>>(
    { NAQD: '', KARTA: '', CLICK: '', BANK: '' }
  )
  // ── Sodiqlik (ballar va keshbeklar) ──
  // Qoida do'kon bo'yicha umumiy, balans esa tanlangan mijozniki.
  // Balans har sotuvdan keyin o'zgargani uchun mijoz tanlanganda
  // har safar yangidan olinadi (ro'yxatdagi eskirgan qiymatga tayanmaydi).
  const [sodiqlikSozlama, setSodiqlikSozlama] = useState<SodiqlikSozlama>(SODIQLIK_STANDART)
  const [mijozBalans, setMijozBalans] = useState<{ ball: number; keshbek: number } | null>(null)
  const [sarfBall, setSarfBall] = useState('')
  const [sarfKeshbek, setSarfKeshbek] = useState('')
  const aralashBoshlangich: Record<KanalUsuli, string> = { NAQD: '', KARTA: '', CLICK: '', BANK: '' }
  const [qolBilanSumma, setQolBilanSumma] = useState('')
  const [chegirmaFoizOchiq, setChegirmaFoizOchiq] = useState(false)
  const [chegirmaFoiz, setChegirmaFoiz] = useState('')
  const [bonusTanlashRejimi, setBonusTanlashRejimi] = useState(false)
  // Qaysi narx bilan sotilyapti — chakana/optom/bo'lish. Savatga yangi
  // qo'shilayotgan mahsulotlar shu tur bo'yicha narxlanadi.
  const [narxTuri, setNarxTuri] = useState<NarxTuri>('sotish')
  const [mijozId, setMijozId] = useState('')
  const [nasiyaMuddat, setNasiyaMuddat] = useState('')
  const [yuklanmoqda, setYuklanmoqda] = useState(false)
  const [chekModal, setChekModal] = useState(false)
  const [oxirgiSotuv, setOxirgiSotuv] = useState<SotuvYozuvi | null>(null)
  // Chek Telegramga ATAYLAB avtomatik ketmaydi — kassir o'zi qaror qiladi.
  // 'yuborildi' bo'lgach tugma holatini o'zgartiramiz, ikki marta
  // bosib mijozga bir xil xabar ikki marta ketmasin.
  const [chekYuborish, setChekYuborish] = useState<'tayyor' | 'ketmoqda' | 'yuborildi'>('tayyor')
  const [dokonInfo, setDokonInfo] = useState<Record<string, string>>({})
  const [editNarx, setEditNarx] = useState<{ tovarId: string; val: string } | null>(null)
  const [mobileTab, setMobileTab] = useState<'tovarlar' | 'savat'>('tovarlar')
  // Kassa oynasi: mahsulot qidirib pastga tushilganda savat ustuni
  // ko'rinmay qoladi — shunda suzuvchi tugma chiqadi va kassa shu yerda ochiladi.
  const [kassaOchiq, setKassaOchiq] = useState(false)
  const [savatKorinmayapti, setSavatKorinmayapti] = useState(false)
  const savatUstuniRef = useRef<HTMLDivElement>(null)

  // Yopishgan (sticky) asboblar paneli ekran tepasiga tegib turibdimi.
  // Tegib turgandagina soya va ajratuvchi chiziq chiqadi — shundagina
  // panel "ustidagi qatlam"dek o'qiladi va ostidan sirg'alib o'tayotgan
  // kartalar nosozlikdek emas, ataylab shunday qilingandek ko'rinadi.
  const asboblarRef = useRef<HTMLDivElement>(null)
  const [asboblarYopishgan, setAsboblarYopishgan] = useState(false)

  // Mijoz ma'lumotlari (har bir sotuvda so'raladi)
  const [mijozModal, setMijozModal] = useState(false)
  const [mijozTelefon, setMijozTelefon] = useState('')
  const [mijozIsmi, setMijozIsmi] = useState('')
  const [mijozManzil, setMijozManzil] = useState('')
  // Mavjud mijoz tanlanganda uning saqlangan GPS joylashuvi (bo'lsa) shu yerda
  // ko'rsatiladi — telefon/ism qo'lda o'zgartirilsa avtomatik tozalanadi.
  const [mijozLokatsiya, setMijozLokatsiya] = useState<{ lat: number; lng: number } | null>(null)
  const [mijozAniqlanmoqda, setMijozAniqlanmoqda] = useState(false)
  const [telefonTaklifOchiq, setTelefonTaklifOchiq] = useState(false)
  const [ismTaklifOchiq, setIsmTaklifOchiq] = useState(false)

  // Qaytarish
  const [qaytarishModal, setQaytarishModal] = useState(false)
  const [qaytarishSotuv, setQaytarishSotuv] = useState<SotuvYozuvi | null>(null)
  const [qaytarishTanlangan, setQaytarishTanlangan] = useState<Record<string, { miqdor: number; birlikNarxi: number; checked: boolean }>>({})
  const [qaytarishSabab, setQaytarishSabab] = useState('')
  const [qaytarishYuklanmoqda, setQaytarishYuklanmoqda] = useState(false)
  const [sotuvlarRoyxati, setSotuvlarRoyxati] = useState<SotuvYozuvi[]>([])
  const [sotuvlarYuklanmoqda, setSotuvlarYuklanmoqda] = useState(false)
  const [sotuvQidiruv, setSotuvQidiruv] = useState('')

  // Til (lotin / kirill)
  const [til, setTil] = useState<'lotin' | 'kirill'>('lotin')

  // Barcode skaner
  const [skanerOchiq, setSkanerOchiq] = useState(false)
  const skanerRef = useRef<Html5Qrcode | null>(null)
  const oxirgiSkanRef = useRef<string>('')
  // Har doim oxirgi tovarlar ro'yxatini olish uchun ref
  const tovarlarRef = useRef<Tovar[]>([])
  const savatQoshRef = useRef<(t: Tovar) => void>(() => {})

  const skanerniYopish = useCallback(() => {
    const s = skanerRef.current
    if (s) {
      if (s.isScanning) s.stop().then(() => s.clear()).catch(() => {})
      skanerRef.current = null
    }
    oxirgiSkanRef.current = ''
    setSkanerOchiq(false)
  }, [])

  // Shtrix-kod bo'yicha tovar topish — bir nechta strategiya bilan
  function tovarniTopish(kod: string): Tovar | undefined {
    const n = kod.trim()
    if (!n) return undefined
    const list = tovarlarRef.current
    // 1) Aynan mos keladigan
    let topilgan = list.find(t => t.shtrixKod === n)
    if (topilgan) return topilgan
    // 2) Trim qilingan
    topilgan = list.find(t => (t.shtrixKod || '').trim() === n)
    if (topilgan) return topilgan
    // 3) Boshidagi 0 ni olib tashlab taqqoslash (EAN-13 vs UPC-A)
    const nNoZero = n.replace(/^0+/, '')
    topilgan = list.find(t => {
      const kodi = (t.shtrixKod || '').trim()
      return kodi.replace(/^0+/, '') === nNoZero
    })
    if (topilgan) return topilgan
    // 4) Nol bilan to'ldirib taqqoslash (UPC-A → EAN-13)
    topilgan = list.find(t => (t.shtrixKod || '').trim() === '0' + n)
    return topilgan
  }

  // Local cache'da topilmasa API'dan to'g'ridan-to'g'ri qidirish.
  // Tovarlar yuklanmagan/eskirgan bo'lsa ham skaner ishlaydi.
  async function tovarniApidanTopish(kod: string): Promise<Tovar | null> {
    // Skaner QR ham o'qiydi — QR ichida to'liq manzil bo'ladi.
    // `kodniAjrat` ikkalasini ham bir xil kodga keltiradi.
    const n = kodniAjrat(kod)
    if (!n) return null
    try {
      const r = await fetch(`/api/tovarlar/by-shtrix/${encodeURIComponent(n)}`)
      if (!r.ok) return null
      const data = await r.json()
      if (!data || !data.id) return null
      const tovar: Tovar = {
        id: data.id,
        nomi: data.nomi,
        sotishNarxi: Number(data.sotishNarxi),
        kelishNarxi: data.kelishNarxi === null ? null : Number(data.kelishNarxi),
        birlik: data.birlik,
        qoldiq: Number(data.qoldiq ?? 0),
        shtrixKod: data.shtrixKod ?? null,
        rasmlar: data.rasmlar ?? [],
        valyuta: data.valyuta,
      }
      // Topilgan tovarni local cache'ga qo'shamiz — keyingi skanlar tezlashadi
      setTovarlar(prev => prev.some(t => t.id === tovar.id) ? prev : [tovar, ...prev])
      return tovar
    } catch {
      return null
    }
  }

  const skanerniOchish = useCallback(async () => {
    setSkanerOchiq(true)
    oxirgiSkanRef.current = ''
    setTimeout(async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        const scanner = new Html5Qrcode('skaner-reader')
        skanerRef.current = scanner
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 15, qrbox: { width: 280, height: 160 } },
          (kod) => {
            const n = kod.trim()
            if (!n) return
            // Bir xil kodni ketma-ket scan qilmasligi uchun
            if (oxirgiSkanRef.current === n) return
            oxirgiSkanRef.current = n
            setTimeout(() => { oxirgiSkanRef.current = '' }, 1500)

            playBeep()
            const topilgan = tovarniTopish(n)
            if (topilgan) {
              savatQoshRef.current(topilgan)
              toast.success(`${topilgan.nomi} qo'shildi`)
            } else {
              // Local'da yo'q — API'dan qidiramiz (tovarlar yuklanmagan yoki yangi qo'shilgan bo'lishi mumkin)
              tovarniApidanTopish(n).then(t => {
                if (t) {
                  savatQoshRef.current(t)
                  toast.success(`${t.nomi} qo'shildi`)
                } else {
                  setQidiruv(n)
                  toast.error(`Tovar topilmadi: ${n}`)
                }
              })
            }
          },
          () => {}
        )
      } catch {
        toast.error('Kamera ochilmadi')
        setSkanerOchiq(false)
      }
    }, 100)
  }, [])

  // Saqlangan savatlar
  const [saqlanganiSavatlar, setSaqlanganiSavatlar] = useState<SaqlanganZakaz[]>([])
  const [saqlanganiModal, setSaqlanganiModal] = useState(false)
  // Saqlash oynasi — mijoz va izoh shu yerda so'raladi
  const [saqlashModal, setSaqlashModal] = useState(false)
  const [zakazIzoh, setZakazIzoh] = useState('')
  const [zakazMijozId, setZakazMijozId] = useState('')
  const [zakazSaqlanmoqda, setZakazSaqlanmoqda] = useState(false)
  const [zakazlarYuklanmoqda, setZakazlarYuklanmoqda] = useState(false)
  useBodyScrollLock(mijozModal || chekModal || saqlanganiModal || saqlashModal || qaytarishModal || kategoriyaVaraq)

  const tovarlarniYuklash = useCallback(async () => {
    setTovarlarYuklanmoqda(true)
    setTovarlarXato(null)
    try {
      // sotuvUchun=1 — qulflangan tovarlar serverda filtrlanadi
      const r = await fetch('/api/tovarlar?sotuvUchun=1')
      if (!r.ok) {
        const errBody = await r.json().catch(() => ({}))
        throw new Error(errBody.xato || `Server xatosi (${r.status})`)
      }
      const tv = await r.json()
      setTovarlar(Array.isArray(tv.tovarlar) ? tv.tovarlar : [])
    } catch (e) {
      const xabar = e instanceof Error ? e.message : ''
      setTovarlarXato(xabar || 'Tovarlarni yuklashda xato')
      toast.error(xabar || 'Tovarlarni yuklab bo\'lmadi')
    } finally {
      setTovarlarYuklanmoqda(false)
    }
  }, [])

  useEffect(() => {
    // Sahifa yangilanganda tiklanadigan savat va uning mijozi — URL'dagi mijoz
    // bilan solishtirish uchun, ular state'ga yozilishidan OLDIN o'qib olinadi
    const tiklanganSavatSoni = (() => {
      try { const x = JSON.parse(localStorage.getItem('aktiv-savat') || '[]'); return Array.isArray(x) ? x.length : 0 } catch { return 0 }
    })()
    const tiklanganMijozId: string = (() => {
      try { return JSON.parse(localStorage.getItem('aktiv-tolov') || 'null')?.mijozId || '' } catch { return '' }
    })()

    async function yuklashQoshimcha() {
      try {
        const [mj, sz, kt, sd] = await Promise.all([
          fetch('/api/mijozlar').then(r => r.json()).catch(() => []),
          fetch('/api/sozlamalar').then(r => r.json()).catch(() => ({})),
          fetch('/api/kategoriyalar').then(r => r.json()).catch(() => []),
          fetch('/api/sodiqlik/sozlamalar').then(r => r.json()).catch(() => null),
        ])
        setMijozlar(Array.isArray(mj) ? mj : [])
        setDokonInfo(sz && typeof sz === 'object' ? sz : {})
        setKategoriyalar(Array.isArray(kt) ? kt : [])
        if (sd && typeof sd === 'object' && !sd.xato) setSodiqlikSozlama(sd as SodiqlikSozlama)
        const royxat: Mijoz[] = Array.isArray(mj) ? mj : []
        // Mijoz kartasidagi savatcha ("Sotuvni boshlash") orqali kelingan bo'lsa —
        // mijoz shu zahoti tanlanadi va to'lashda qayta so'ralmaydi.
        const boshlanguvchiMijozId = new URLSearchParams(window.location.search).get('mijozId')
        if (boshlanguvchiMijozId) {
          const topilgan = royxat.find(m => m.id === boshlanguvchiMijozId)
          if (topilgan) {
            mijozTanlash(topilgan)
            if (tiklanganSavatSoni > 0 && tiklanganMijozId !== topilgan.id) {
              // Oldingi (boshqa mijoz yoki mijozsiz) yig'ilgan savat tiklandi — kassir bilmasdan unga sotib yubormasin
              toast.warning(`Savatda avval yig‘ilgan ${tiklanganSavatSoni} ta tovar bor — ular ham ${topilgan.ism} ga sotiladi`, {
                duration: 12_000,
                action: { label: 'Savatni tozalash', onClick: () => { setSavat([]); setAralashSummalar(aralashBoshlangich); setSarfBall(''); setSarfKeshbek('') } },
              })
            } else {
              toast.success(`${topilgan.ism} uchun savdo — tovarlarni tanlang`)
            }
          } else {
            toast.error('Mijoz topilmadi — u o‘chirilgan yoki boshqa filialga tegishli')
            urlMijozniOlibTashla()
          }
        } else if (tiklanganMijozId) {
          // Tiklangan savatning mijozi hali bormi — yo'q bo'lsa jimgina unga bog'lanib qolmasin
          const tiklangan = royxat.find(m => m.id === tiklanganMijozId)
          if (tiklangan) mijozTanlash(tiklangan)
          else setMijozId('')
        }
      } catch {
        // qo'shimcha ma'lumotlar muhim emas — sotuv ishlay beradi
      }
    }
    tovarlarniYuklash()
    yuklashQoshimcha()
    fetch('/api/kurs').then(r => r.json()).then(d => { if (d.kursi) setKursi(d.kursi) }).catch(() => {})
    // Oxirgi sotuv localStorage dan yuklash
    const saved = localStorage.getItem('oxirgi-sotuv')
    if (saved) { try { setOxirgiSotuv(JSON.parse(saved)) } catch {} }
    // Saqlangan savatlarni yuklash
    void zakazlarniYuklash()
    // Aktiv savat (refresh/navigatsiya'dan keyin tiklash)
    const aktiv = localStorage.getItem('aktiv-savat')
    if (aktiv) {
      try {
        const parsed = JSON.parse(aktiv)
        if (Array.isArray(parsed) && parsed.length > 0) setSavat(parsed)
      } catch {}
    }
    // Aktiv to'lov ma'lumotlarini tiklash
    const aktivPay = localStorage.getItem('aktiv-tolov')
    if (aktivPay) {
      try {
        const p = JSON.parse(aktivPay)
        if (p.tolovUsuli) setTolovUsuli(p.tolovUsuli)
        if (p.mijozId) setMijozId(p.mijozId)
        if (p.aralashSummalar) setAralashSummalar({ NAQD: '', KARTA: '', CLICK: '', BANK: '', ...p.aralashSummalar })
        if (p.qolBilanSumma) setQolBilanSumma(p.qolBilanSumma)
        if (p.nasiyaMuddat) setNasiyaMuddat(p.nasiyaMuddat)
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Aktiv savatni har o'zgarishda localStorage'ga yozish
  useEffect(() => {
    if (savat.length > 0) {
      localStorage.setItem('aktiv-savat', JSON.stringify(savat))
    } else {
      localStorage.removeItem('aktiv-savat')
    }
  }, [savat])

  // Aktiv to'lov ma'lumotlarini saqlash
  useEffect(() => {
    if (savat.length > 0) {
      localStorage.setItem('aktiv-tolov', JSON.stringify({
        tolovUsuli, mijozId, aralashSummalar, qolBilanSumma, nasiyaMuddat,
      }))
    } else {
      localStorage.removeItem('aktiv-tolov')
    }
  }, [savat.length, tolovUsuli, mijozId, aralashSummalar, qolBilanSumma, nasiyaMuddat])

  // Tovarlar yuklangach savatdagi mavjud qoldiqni yangilash (stale data oldini olish)
  useEffect(() => {
    if (tovarlar.length === 0 || savat.length === 0) return
    setSavat(prev => {
      let changed = false
      const updated = prev.map(item => {
        const tovar = tovarlar.find(t => t.id === item.tovarId)
        if (tovar && tovar.qoldiq !== item.mavjudQoldiq) {
          changed = true
          const yangiMiqdor = Math.min(item.miqdor, tovar.qoldiq)
          return { ...item, mavjudQoldiq: tovar.qoldiq, miqdor: yangiMiqdor, jami: yangiMiqdor * item.birlikNarxi }
        }
        return item
      })
      return changed ? updated : prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tovarlar])

  const filteredTovarlar = tovarlar.filter(t =>
    (!aktifOmbor || kategoriyaOmbori.get(t.kategoriya?.id ?? '') === aktifOmbor) &&
    (!aktifKategoriya || t.kategoriya?.id === aktifKategoriya) &&
    (uzSearch(t.nomi, qidiruv) || (t.shtrixKod && t.shtrixKod.includes(qidiruv)))
  )
  const korsatiladiganTovarlar = filteredTovarlar

  function savatQosh(tovar: Tovar) {
    if (tovar.qoldiq <= 0) {
      toast.error(`${tovar.nomi}: qoldiq yo'q`)
      return
    }
    if (bonusTanlashRejimi) {
      // Bonus xuddi shu mahsulotdan ham bo'lishi mumkin (masalan 5ta sotib
      // olib, 1tasi bonusga xuddi o'shanidan) — shuning uchun tovarId bir xil
      // bo'lgan oddiy (pullik) qator borligi to'sqinlik qilmaydi, faqat
      // ALLAQACHON bonus qatori bo'lsa, shunga miqdor qo'shiladi (dublikat
      // qator ochilmaydi).
      const mavjudBonus = savat.find(s => s.tovarId === tovar.id && s.bonus)
      if (mavjudBonus) {
        if (mavjudBonus.miqdor + 1 > tovar.qoldiq) {
          toast.error(`${tovar.nomi}: omborda faqat ${tovar.qoldiq} ${tovar.birlik.toLowerCase()}`)
          return
        }
        setSavat(prev => prev.map(s => (s.tovarId === tovar.id && s.bonus) ? { ...s, miqdor: s.miqdor + 1 } : s))
        setBonusTanlashRejimi(false)
        setMobileTab('savat')
        toast.success(`${tovar.nomi} bonus miqdori oshirildi`)
        return
      }
      setSavat(prev => [{
        tovarId: tovar.id, nomi: tovar.nomi, birlikNarxi: 0,
        miqdor: 1, birlik: tovar.birlik, chegirma: 0,
        jami: 0, mavjudQoldiq: tovar.qoldiq, bonus: true,
      }, ...prev])
      setBonusTanlashRejimi(false)
      setMobileTab('savat')
      toast.success(`${tovar.nomi} bonus sifatida qo'shildi`)
      return
    }
    // Joriy tanlangan narx turi (chakana/optom/bo'lish) bo'yicha — mahsulotda
    // o'sha tur uchun narx kiritilmagan bo'lsa, oddiy sotish narxiga tushadi.
    const narxSomda = narxTuriBoyicha(tovar, narxTuri, kursi)
    // `savat` state'idan (setSavat ichidagi `prev`dan emas — u yangilanish
    // React tomonidan keyinroq bajarilishi mumkin) — shu mahsulot savatda
    // birinchi marta qo'shilayotganini oldindan bilib olamiz.
    const yangiQator = !savat.some(s => s.tovarId === tovar.id && !s.bonus)
    setSavat(prev => {
      // Faqat oddiy (bonus bo'lmagan) qator bilan birlashtiriladi — bonus
      // qatori (bor bo'lsa) tegilmasdan saqlanib qoladi. Mavjud qatorning
      // narxi (va turi) o'zgartirilmaydi — faqat miqdor qo'shiladi, narx
      // turini almashtirish kerak bo'lsa narxni qo'lda tahrirlash mumkin.
      const mavjud = prev.find(s => s.tovarId === tovar.id && !s.bonus)
      if (mavjud) {
        if (mavjud.miqdor + 1 > tovar.qoldiq) {
          toast.error(`${tovar.nomi}: omborda faqat ${tovar.qoldiq} ${tovar.birlik.toLowerCase()}`)
          return prev
        }
        const yangilangan = { ...mavjud, miqdor: mavjud.miqdor + 1, jami: (mavjud.miqdor + 1) * mavjud.birlikNarxi }
        return [yangilangan, ...prev.filter(s => !(s.tovarId === tovar.id && !s.bonus))]
      }
      return [{
        tovarId: tovar.id, nomi: tovar.nomi, birlikNarxi: narxSomda,
        miqdor: 1, birlik: tovar.birlik, chegirma: 0,
        jami: narxSomda, mavjudQoldiq: tovar.qoldiq, narxTuri,
      }, ...prev]
    })
    // Mijoz allaqachon tanlangan bo'lsa — bu mahsulot birinchi marta
    // savatga qo'shilayotganda (miqdor oshirilayotganda emas) darhol
    // eslatma tekshiriladi, keshlangan tarix orqali (yangi so'rovsiz).
    if (yangiQator && mijozId && mijozTarixi[tovar.id]) {
      eslatmaKorsat([{
        tovarId: tovar.id, nomi: tovar.nomi, birlikNarxi: narxSomda,
        miqdor: 1, birlik: tovar.birlik, chegirma: 0, jami: narxSomda, mavjudQoldiq: tovar.qoldiq,
      }], mijozTarixi, mijozIsmi)
    }
  }

  // Skaner uchun har doim eng so'nggi tovarlar va savatQosh funksiyasi
  // Savat ustuni ekranda ko'rinyaptimi — suzuvchi tugma AYNAN shunga
  // qarab chiqadi. Scroll hodisasini sanashdan ko'ra ishonchli: mobil
  // tabda yashiringan bo'lsa ham, desktopda pastga tushilsa ham to'g'ri
  // ishlaydi va tartib (layout) o'zgarsa moslashib ketadi.
  useEffect(() => {
    const el = savatUstuniRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const kuzatuvchi = new IntersectionObserver(
      ([yozuv]) => setSavatKorinmayapti(!yozuv.isIntersecting),
      { threshold: 0.12 },
    )
    kuzatuvchi.observe(el)
    return () => kuzatuvchi.disconnect()
  }, [])

  // Asboblar paneli yopishgan holatga o'tganini aniqlash.
  // IntersectionObserver o'rniga scroll: sentinel element qo'shilsa
  // ota `flex gap-4` unga ham bo'shliq berib, panelni pastga surib
  // qo'yardi. `requestAnimationFrame` bilan kadrga bir marta hisoblanadi.
  useEffect(() => {
    const el = asboblarRef.current
    const konteyner = el?.closest('main')
    if (!el || !konteyner) return
    let kadr = 0
    const tekshir = () => {
      kadr = 0
      // `scrollTop > 0` sharti muhim: desktopda panel manfiy margin tufayli
      // scroll boshida ham AYNAN yuqori chetda turadi, ya'ni faqat
      // koordinataga qarab "yopishgan" deb bo'lmaydi — soya sahifa
      // qimirlamasdan turib chiqib qolardi.
      const yopishgan = konteyner.scrollTop > 0
        && el.getBoundingClientRect().top <= konteyner.getBoundingClientRect().top + 1
      setAsboblarYopishgan(oldingi => (oldingi === yopishgan ? oldingi : yopishgan))
    }
    const surildi = () => { if (!kadr) kadr = requestAnimationFrame(tekshir) }
    konteyner.addEventListener('scroll', surildi, { passive: true })
    tekshir()
    return () => {
      konteyner.removeEventListener('scroll', surildi)
      if (kadr) cancelAnimationFrame(kadr)
    }
  }, [])

  // Kassa oynasi ochiq bo'lsa orqa fon scroll bo'lmasin
  useBodyScrollLock(kassaOchiq)

  // Escape — kassa oynasini yopadi (klaviaturali kassada qo'l tezroq)
  useEffect(() => {
    if (!kassaOchiq && !kategoriyaVaraq) return
    const bosildi = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Ustidagi oyna avval yopiladi
      if (kategoriyaVaraq) setKategoriyaVaraq(false)
      else setKassaOchiq(false)
    }
    window.addEventListener('keydown', bosildi)
    return () => window.removeEventListener('keydown', bosildi)
  }, [kassaOchiq, kategoriyaVaraq])

  useEffect(() => { tovarlarRef.current = tovarlar }, [tovarlar])
  useEffect(() => { savatQoshRef.current = savatQosh })

  // Bitta mahsulotdan bir vaqtda ham oddiy, ham bonus qator bo'lishi mumkin
  // (tovarId bir xil) — shuning uchun har doim `bonus` bayrog'i bilan birga
  // aniq qatorni ko'rsatib beriladi, aks holda ikkalasi ham o'zgarib qolardi.
  function miqdorOzgartir(tovarId: string, bonus: boolean | undefined, yangiMiqdor: number) {
    if (yangiMiqdor <= 0) {
      setSavat(prev => prev.filter(s => !(s.tovarId === tovarId && !!s.bonus === !!bonus)))
      return
    }
    setSavat(prev => prev.map(s => {
      if (!(s.tovarId === tovarId && !!s.bonus === !!bonus)) return s
      const cheklangan = Math.min(yangiMiqdor, s.mavjudQoldiq)
      return { ...s, miqdor: cheklangan, jami: cheklangan * s.birlikNarxi }
    }))
  }

  function narxiOzgartir(tovarId: string, yangiNarx: number) {
    if (yangiNarx <= 0) return
    setSavat(prev => prev.map(s => (s.tovarId === tovarId && !s.bonus)
      ? { ...s, birlikNarxi: yangiNarx, jami: s.miqdor * yangiNarx }
      : s
    ))
  }

  function narxTasdiqla(tovarId: string) {
    if (!editNarx) return
    const val = parseFloat(editNarx.val.replace(/\s/g, ''))
    if (!isNaN(val) && val > 0) {
      // Chegirma ruxsati yo'q xodim narxni ro'yxatdagi eng past narxdan tushira olmaydi
      const tovar = tovarlar.find(t => t.id === tovarId)
      const min = tovar ? minNarxSomda(tovar, kursi) : null
      if (!chegirmaRuxsat && min && min.somda > 0 && val < min.somda) {
        toast.error(`Narxni ${formatSum(min.somda)} dan pasaytirishga ruxsatingiz yo‘q`)
      } else {
        narxiOzgartir(tovarId, val)
      }
    }
    setEditNarx(null)
  }

  // Savatdagi bitta qator uchun narx turini (chakana/optom/bo'lish) tanlash —
  // narxni o'sha tovarning o'zidagi mos narxga o'zgartiradi va turini eslab qoladi.
  function savatNarxTuriTanlash(tovarId: string, turi: NarxTuri) {
    const tovar = tovarlar.find(t => t.id === tovarId)
    if (!tovar) return
    const narx = narxTuriBoyicha(tovar, turi, kursi)
    setSavat(prev => prev.map(s => (s.tovarId === tovarId && !s.bonus)
      ? { ...s, birlikNarxi: narx, jami: s.miqdor * narx, narxTuri: turi }
      : s
    ))
  }

  const jamiSumma = savat.reduce((s, i) => s + i.miqdor * i.birlikNarxi, 0)
  const qolBilan = qolBilanSumma ? parseFloat(qolBilanSumma.replace(/\s/g, '')) : NaN
  // Chegirmadan keyingi, LEKIN ball/keshbek sarflashdan OLDINGI summa.
  // Sodiqlik hisob-kitobi ham, serverdagi tekshiruv ham shu songa tayanadi.
  const chekSummasi = (!isNaN(qolBilan) && qolBilan >= 0) ? Math.min(jamiSumma, qolBilan) : jamiSumma
  const chegirma = jamiSumma - chekSummasi

  // Ball/keshbek sarflash — server bilan AYNAN bir xil funksiya orqali,
  // shuning uchun kassada ko'ringan summa bazaga yozilgani bilan bir xil.
  const sodiqlikNatija = sarflashniHisobla({
    chekSummasi,
    ballBalans: mijozBalans?.ball ?? 0,
    keshbekBalans: mijozBalans?.keshbek ?? 0,
    soralgan: {
      ball: parseFloat(sarfBall.replace(/\s/g, '')) || 0,
      keshbek: parseFloat(sarfKeshbek.replace(/\s/g, '')) || 0,
    },
    sozlama: sodiqlikSozlama,
  })

  // To'lov kanallari bilan yopiladigan yakuniy summa
  const yakuniySumma = chekSummasi - sodiqlikNatija.jamiChegirma

  // Stock yetishmaydigan itemlarni tekshirish — bitta mahsulotdan oddiy va
  // bonus qatori bo'lishi mumkin, shuning uchun ikkalasi QO'SHIB tekshiriladi
  // (har biri alohida qoldiqdan oshmasa ham, birgalikda oshib ketishi mumkin).
  const jamiTalabMap = new Map<string, number>()
  for (const s of savat) jamiTalabMap.set(s.tovarId, (jamiTalabMap.get(s.tovarId) || 0) + s.miqdor)
  const ortiqchaTovarIdlar = new Set(
    savat.filter(s => (jamiTalabMap.get(s.tovarId) || 0) > s.mavjudQoldiq).map(s => s.tovarId)
  )
  const ortiqchaItemlar = savat.filter(s => ortiqchaTovarIdlar.has(s.tovarId))

  // Aralash to'lovda kiritilgan kanal summalari holati — tugmani bloklash
  // va qolgan/ortiqcha summani ko‘rsatish uchun.
  const aralashKiritilgan = aralashJami(aralashSummalar as AralashKiritma)
  const aralashQoldi = yakuniySumma - aralashKiritilgan
  const aralashNatija = aralashTekshir(aralashSummalar as AralashKiritma, yakuniySumma)
  const aralashXato = tolovUsuli === 'ARALASH' && !aralashNatija.ok ? aralashNatija.xato : null

  // Tanlangan mijoz — faqat ro'yxatda haqiqatda bor bo'lsa (eskirgan id hisobga olinmaydi)
  const tanlanganMijoz = mijozId ? mijozlar.find(m => m.id === mijozId) ?? null : null

  /** `?mijozId=` URL'dan olib tashlanadi — sotuvdan keyin sahifa yangilansa o'sha mijoz qayta tanlanmasin */
  function urlMijozniOlibTashla() {
    const url = new URL(window.location.href)
    if (!url.searchParams.has('mijozId')) return
    url.searchParams.delete('mijozId')
    window.history.replaceState(null, '', url)
  }

  function mijozniOlibTashla() {
    setMijozId('')
    setMijozTelefon('')
    setMijozIsmi('')
    setMijozManzil('')
    setMijozLokatsiya(null)
    urlMijozniOlibTashla()
  }

  async function sotuvYakunla() {
    if (yuklanmoqda) return
    if (savat.length === 0) { toast.error('Savat bo\'sh!'); return }

    if (ortiqchaItemlar.length > 0) {
      const nomlar = Array.from(new Set(ortiqchaItemlar.map(i => i.nomi)))
      toast.error('Zaxira yetarli emas: ' + nomlar.join(', '))
      return
    }

    // Aralash to'lov to'liq taqsimlanmagan bo'lsa — sotuvga o'tkazmaymiz.
    // Jimgina “to'g'rilab” qo'yish kassirning xatosini yashirardi.
    if (aralashXato) { toast.error(aralashXato); return }

    // Mijoz allaqachon tanlangan (kartadagi savatcha, saqlangan zakaz yoki
    // tiklangan savat) — ma'lumotlar qayta so'ralmaydi, sotuv shu mijozga yoziladi
    if (tanlanganMijoz) {
      await sotuvYuborish(tanlanganMijoz.id)
      return
    }

    setMijozTelefon('')
    setMijozIsmi('')
    setMijozManzil('')
    setMijozLokatsiya(null)
    setMijozModal(true)
  }

  // Telefon yoki ism bo'yicha mavjud mijozlarni filtrlab, tanlash uchun taklif ro'yxati.
  // Hech narsa kiritilmagan bo'lsa ham (default holat) mavjud mijozlar ko'rsatiladi.
  const telefonTaklifi = mijozTelefon.length >= 2
    ? mijozlar.filter(m => [m.telefon, m.telefon2, ...(m.qoshimchaTelefonlar ?? [])].some(x => x && x.replace(/\D/g, '').includes(mijozTelefon))).slice(0, 5)
    : mijozlar.slice(0, 8)
  const ismTaklifi = mijozIsmi.trim().length >= 1
    ? mijozlar.filter(m => uzSearch(m.ism, mijozIsmi)).slice(0, 5)
    : mijozlar.slice(0, 8)

  function mijozTanlash(m: Mijoz) {
    const digits = (m.telefon || '').replace(/\D/g, '')
    setMijozTelefon(digits.length === 12 && digits.startsWith('998') ? digits.slice(3) : digits.slice(0, 9))
    setMijozIsmi(m.ism)
    setMijozManzil(m.manzil || '')
    setMijozLokatsiya(m.lokatsiyaLat != null && m.lokatsiyaLng != null ? { lat: m.lokatsiyaLat, lng: m.lokatsiyaLng } : null)
    setTelefonTaklifOchiq(false)
    setIsmTaklifOchiq(false)
    // Mijozning haqiqiy id'sini shu zahoti bilamiz — to'lov tugashini
    // kutmasdan darhol o'rnatamiz, shunda quyidagi useEffect (tarix
    // yuklash + eslatma) va savatga qo'shishdagi eslatma ham ishlay oladi.
    setMijozId(m.id)
  }

  // Mijoz avval nimalarni sotib olganini (mahsulot -> {narx, sana}) keshlab
  // qo'yamiz — mijoz tanlanganda BIR marta yuklanadi, keyin savatga har bir
  // mahsulot qo'shilganda qayta so'rovsiz tekshiriladi.
  const [mijozTarixi, setMijozTarixi] = useState<Record<string, { narx: number; sana: string }>>({})

  // Bir yoki bir nechta savat qatorini mijozning oldingi xaridlari bilan
  // solishtirib, mos kelsa eslatma ko'rsatadi (X tugmasi bosilmaguncha
  // ochiq turadi). Sotuvga xalaqit bermaydi — sof, sinxron tekshiruv.
  function eslatmaKorsat(itemlar: SavatItem[], tarix: Record<string, { narx: number; sana: string }>, mijozIsm: string) {
    const mosKelganlar = itemlar.filter(item => tarix[item.tovarId] && !item.bonus)
    if (mosKelganlar.length === 0) return

    const matn = mosKelganlar.length === 1
      ? `${mijozIsm} avval "${mosKelganlar[0].nomi}"ni ${formatSum(tarix[mosKelganlar[0].tovarId].narx)}dan sotib olgan edi`
      : `${mijozIsm} avval bu mahsulotlarni ham olgan: ${mosKelganlar.slice(0, 3).map(i => i.nomi).join(', ')}${mosKelganlar.length > 3 ? ` va yana ${mosKelganlar.length - 3} ta` : ''}`

    toast(matn, { icon: '🔔', duration: Infinity, closeButton: true })
  }

  // Mijoz o'rnatilganda (tanlanganda yoki mijoz kartasidan "Sotuvni
  // boshlash" bilan kelinganda) — tarixni bir marta yuklab keshlaymiz va
  // hozircha savatda bor mahsulotlarni shu zahoti tekshiramiz.
  useEffect(() => {
    if (!mijozId) {
      setMijozTarixi({})
      setMijozBalans(null)
      setSarfBall('')
      setSarfKeshbek('')
      return
    }
    // Balans — har safar yangidan (oldingi sotuv uni o'zgartirgan bo'lishi mumkin)
    fetch(`/api/sodiqlik/mijoz/${mijozId}`)
      .then(r => r.ok ? r.json() : null)
      .then(b => { if (b && !b.xato) setMijozBalans({ ball: b.ball, keshbek: b.keshbek }) })
      .catch(() => {})
    let bekor = false
    fetch(`/api/mijozlar/${mijozId}/tarix`).then(r => r.json()).then(tarix => {
      if (bekor) return
      setMijozTarixi(tarix)
      eslatmaKorsat(savat, tarix, mijozlar.find(m => m.id === mijozId)?.ism || mijozIsmi)
    }).catch(() => {})
    return () => { bekor = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mijozId])

  async function mijozTasdiqlaVaYubor(e: React.FormEvent) {
    e.preventDefault()
    if (mijozTelefon.length < 9) { toast.error("To'liq telefon raqam kiriting!"); return }
    if (!mijozIsmi.trim()) { toast.error('Mijoz ismini kiriting!'); return }

    setMijozAniqlanmoqda(true)
    try {
      // Server telefon bo'yicha mavjud mijozni topib qaytaradi — qayta yaratmaydi
      const res = await fetch('/api/mijozlar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ism: mijozIsmi, telefon: mijozTelefon, manzil: mijozManzil || null }),
      })
      if (!res.ok) { toast.error("Mijoz qo'shilmadi"); return }
      const natija = await res.json()
      if (!mijozlar.some(m => m.id === natija.id)) {
        setMijozlar(prev => [...prev, natija])
      }

      setMijozId(natija.id)
      setMijozModal(false)
      await sotuvYuborish(natija.id)
    } finally {
      setMijozAniqlanmoqda(false)
    }
  }

  async function sotuvYuborish(aniqMijozId?: string) {
    setYuklanmoqda(true)
    // Kanal summalari server bilan AYNAN bir xil funksiyadan hisoblanadi
    // (server baribir qayta hisoblaydi — bu yerdagisi optimistik ko'rinish uchun).
    const kanalSummalari = tolovTaqsimoti({
      tolovUsuli,
      yakuniySumma,
      aralash: aralashSummalar as AralashKiritma,
    })

    const body = {
      mijozId: aniqMijozId || mijozId || null,
      jamiSumma,
      chegirma,
      yakuniySumma,
      tolovUsuli,
      ...kanalSummalari,
      aralash: aralashSummalar,
      // Server bu qiymatlarni mijozning haqiqiy balansidan QAYTA hisoblaydi
      // va yakuniy summa mos kelmasa sotuvni rad etadi.
      sodiqlikSarf: { ball: sodiqlikNatija.ball, keshbek: sodiqlikNatija.keshbek },
      nasiyaMuddat: tolovUsuli === 'NASIYA' ? nasiyaMuddat : null,
      tarkiblar: savat.map(s => ({
        tovarId: s.tovarId, miqdor: s.miqdor, birlikNarxi: s.birlikNarxi,
        chegirma: 0, jami: s.miqdor * s.birlikNarxi
      }))
    }

    const res = await fetch('/api/sotuvlar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    setYuklanmoqda(false)

    if (res.ok) {
      const sotuv = await res.json()
      setOxirgiSotuv(sotuv)
      setChekYuborish('tayyor')
      localStorage.setItem('oxirgi-sotuv', JSON.stringify(sotuv))
      // Kassa oynasidan sotilgan bo'lsa — u yopiladi, chek ochiladi
      setKassaOchiq(false)
      setChekModal(true)
      setSavat([])
      setMijozId('')
      urlMijozniOlibTashla()
      setAralashSummalar(aralashBoshlangich)
      setSarfBall('')
      setSarfKeshbek('')
      setMijozBalans(null)
      setQolBilanSumma('')
      setChegirmaFoizOchiq(false)
      setChegirmaFoiz('')
      setBonusTanlashRejimi(false)
      setTolovUsuli('NAQD')
      toast.success(`Sotuv yakunlandi! Chek: ${sotuv.chekRaqami}`)
      const tv = await fetch('/api/tovarlar').then(r => r.json())
      setTovarlar(tv.tovarlar || [])
    } else {
      const err = await res.json()
      toast.error(err.xato || 'Sotuv amalga oshmadi')
    }
  }

  // Chekni mijozga Telegram orqali yuborish (chek oynasidagi tugma).
  async function chekniTelegramgaYubor() {
    if (!oxirgiSotuv?.id) return
    setChekYuborish('ketmoqda')
    try {
      const res = await fetch(`/api/sotuvlar/${oxirgiSotuv.id}/chek-yuborish`, { method: 'POST' })
      const d = await res.json()
      if (!res.ok) {
        toast.error(d.xato || 'Yuborilmadi')
        setChekYuborish('tayyor')
        return
      }
      toast.success(
        d.nasiyami
          ? `Nasiya ma'lumoti ${d.mijoz} ga yuborildi`
          : `Chek ${d.mijoz} ga Telegram orqali yuborildi`,
      )
      setChekYuborish('yuborildi')
    } catch {
      toast.error('Tarmoq xatosi')
      setChekYuborish('tayyor')
    }
  }

  async function sotuvlarYuklash() {
    setSotuvlarYuklanmoqda(true)
    const res = await fetch('/api/sotuvlar?limit=50')
    const data = await res.json()
    setSotuvlarRoyxati(data.sotuvlar || [])
    setSotuvlarYuklanmoqda(false)
  }

  function sotuvTanlash(sotuv: SotuvYozuvi) {
    setQaytarishSotuv(sotuv)
    const init: Record<string, { miqdor: number; birlikNarxi: number; checked: boolean }> = {}
    for (const t of sotuv.tarkiblar) {
      init[t.tovarId] = { miqdor: Number(t.miqdor), birlikNarxi: Number(t.birlikNarxi), checked: true }
    }
    setQaytarishTanlangan(init)
  }

  async function qaytarishYuborish() {
    if (!qaytarishSotuv) return
    const tarkiblar = qaytarishSotuv.tarkiblar
      .filter(t => qaytarishTanlangan[t.tovarId]?.checked)
      .map(t => {
        const sel = qaytarishTanlandan(t.tovarId)
        return { tovarId: t.tovarId, miqdor: sel.miqdor, birlikNarxi: sel.birlikNarxi, jami: sel.miqdor * sel.birlikNarxi }
      })
    if (tarkiblar.length === 0) { toast.error('Hech narsa tanlanmadi'); return }
    setQaytarishYuklanmoqda(true)
    const res = await fetch('/api/qaytarish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aslSotuvId: qaytarishSotuv.id, tarkiblar, sabab: qaytarishSabab })
    })
    setQaytarishYuklanmoqda(false)
    if (res.ok) {
      toast.success('Qaytarish amalga oshdi!')
      setQaytarishModal(false)
      setQaytarishSotuv(null)
      setQaytarishSabab('')
      const tv = await fetch('/api/tovarlar?limit=500').then(r => r.json())
      setTovarlar(tv.tovarlar || [])
    } else {
      const err = await res.json()
      toast.error(err.xato || 'Xatolik yuz berdi')
    }
  }

  function qaytarishTanlandan(tovarId: string) {
    return qaytarishTanlangan[tovarId] || { miqdor: 0, birlikNarxi: 0, checked: false }
  }

  // Saqlangan zakazlarni serverdan olish (faqat KUTILMOQDA holatdagilar)
  async function zakazlarniYuklash() {
    setZakazlarYuklanmoqda(true)
    try {
      const d = await fetch('/api/buyurtmalar?holati=KUTILMOQDA').then(r => r.ok ? r.json() : [])
      setSaqlanganiSavatlar(Array.isArray(d) ? d : [])
    } catch {
      // Sokin: zakazlar yuklanmasa ham kassa ishlayveradi
    } finally {
      setZakazlarYuklanmoqda(false)
    }
  }

  // "Saqlab qo'yish" tugmasi — avval mijoz va izoh so'raladi
  function saqlashOynasiniOch() {
    if (savat.length === 0) { toast.error("Savat bo'sh!"); return }
    setZakazMijozId(mijozId || '')
    setZakazIzoh('')
    setSaqlashModal(true)
  }

  // Savatni serverga zakaz sifatida saqlash
  async function zakazniSaqlash() {
    if (savat.length === 0) { toast.error("Savat bo'sh!"); return }
    setZakazSaqlanmoqda(true)
    try {
      const res = await fetch('/api/buyurtmalar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mijozId: zakazMijozId || null,
          izoh: zakazIzoh,
          tarkiblar: savat.map(x => ({
            tovarId: x.tovarId,
            miqdor: x.miqdor,
            birlikNarxi: x.birlikNarxi,
          })),
        }),
      })
      const d = await res.json()
      if (!res.ok) { toast.error(d.xato || 'Saqlanmadi'); return }

      setSaqlashModal(false)
      savatniTozalash()
      await zakazlarniYuklash()
      toast.success('Zakaz saqlandi')
    } finally {
      setZakazSaqlanmoqda(false)
    }
  }

  // Savat va u bilan bog'liq barcha kiritmalarni tozalash — saqlashdan
  // keyin ham, yangi zakaz yuklashdan oldin ham bir xil ishlaydi.
  function savatniTozalash() {
    setSavat([])
    setMijozId('')
    setAralashSummalar(aralashBoshlangich)
    setSarfBall('')
    setSarfKeshbek('')
    setQolBilanSumma('')
    setChegirmaFoizOchiq(false)
    setChegirmaFoiz('')
    setBonusTanlashRejimi(false)
    setTolovUsuli('NAQD')
  }

  // Saqlangan zakazni savatga qaytarish va savdoni davom ettirish.
  // Narx zakazda yozilganicha qoladi (mijozga aytilgan narx o'zgarmasin),
  // qoldiq esa hozirgi holatga qarab yangilanadi.
  async function zakazniYuklash(zakaz: SaqlanganZakaz) {
    const yangiSavat: SavatItem[] = zakaz.tarkiblar.map(t => {
      const tovar = tovarlar.find(x => x.id === t.tovarId)
      const birlikNarxi = Number(t.birlikNarxi)
      const miqdor = Number(t.miqdor)
      return {
        tovarId: t.tovarId,
        nomi: tovar?.nomi ?? t.tovar.nomi,
        birlikNarxi,
        miqdor,
        birlik: tovar?.birlik ?? t.tovar.birlik,
        chegirma: 0,
        jami: miqdor * birlikNarxi,
        mavjudQoldiq: tovar?.qoldiq ?? miqdor,
        bonus: birlikNarxi === 0 || undefined,
      }
    })

    savatniTozalash()
    setSavat(yangiSavat)
    if (zakaz.mijoz) setMijozId(zakaz.mijoz.id)

    // Zakaz ro'yxatdan chiqadi, lekin tarixda qoladi
    await fetch(`/api/buyurtmalar/${zakaz.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ holati: 'TASDIQLANGAN' }),
    }).catch(() => {})

    setSaqlanganiSavatlar(prev => prev.filter(z => z.id !== zakaz.id))
    setSaqlanganiModal(false)
    setMobileTab('savat')
    toast.success(
      zakaz.mijoz ? `${zakaz.mijoz.ism} uchun zakaz yuklandi` : 'Zakaz yuklandi',
    )
  }

  // O'chirish — yozuv tarixda BEKOR_QILINGAN bo'lib qoladi
  async function zakazniOchirish(id: string) {
    setSaqlanganiSavatlar(prev => prev.filter(z => z.id !== id))
    await fetch(`/api/buyurtmalar/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ holati: 'BEKOR_QILINGAN' }),
    }).catch(() => toast.error("O'chirilmadi"))
  }

  // Til bo'yicha matn tarjima qilish
  const t = (text: string) => til === 'kirill' ? kirill(text) : text

  function chekHtml(s: SotuvYozuvi) {
    return buildChekHtml({
      data: s,
      dokonInfo,
      til,
      fontSize: 11,
    })
  }

  function chekChopEtish(s: SotuvYozuvi) {
    printChek(chekHtml(s))
  }

  function chekPdfYuklash(s: SotuvYozuvi) {
    const dokonNomi = t(dokonInfo.dokon_nomi || "Do'kon")
    const manzil = t(dokonInfo.manzil || '')
    const tel = dokonInfo.telefon || ''
    const chekMatn = t(dokonInfo.chek_matn || '')
    const kassirTel = s.kassir?.telefon || ''

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [80, 200] })
    const w = 80
    const mx = 5 // margin x
    const cw = w - mx * 2 // content width
    let y = 8

    // === HEADER ===
    doc.setFillColor(220, 38, 38)
    doc.rect(0, 0, w, 26, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(dokonNomi, w / 2, y + 4, { align: 'center' })
    y += 9
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    if (manzil) { doc.text(manzil, w / 2, y + 2, { align: 'center' }); y += 4 }
    if (tel) { doc.text('Tel: ' + tel, w / 2, y + 2, { align: 'center' }); y += 4 }
    y = 30

    // === META ===
    doc.setTextColor(80, 80, 80)
    doc.setFontSize(8)
    doc.text(t('Chek') + ':', mx, y)
    doc.setFont('helvetica', 'bold')
    doc.text(String(s.chekRaqami || ''), w - mx, y, { align: 'right' })
    y += 4
    doc.setFont('helvetica', 'normal')
    doc.text(t('Sana') + ':', mx, y)
    doc.text(formatSanaVaVaqt(s.sana), w - mx, y, { align: 'right' })
    y += 4
    if (kassirTel) {
      doc.text(t('Kassir') + ':', mx, y)
      doc.text(kassirTel, w - mx, y, { align: 'right' })
      y += 4
    }

    // Separator line
    y += 1
    doc.setDrawColor(220, 38, 38)
    doc.setLineWidth(0.5)
    doc.line(mx, y, w - mx, y)
    y += 4

    // === TABLE HEADER ===
    doc.setFillColor(245, 245, 245)
    doc.rect(mx, y - 3, cw, 6, 'F')
    doc.setFontSize(6.5)
    doc.setTextColor(120, 120, 120)
    doc.setFont('helvetica', 'bold')
    doc.text(t('TOVAR'), mx + 1, y)
    doc.text(t('SONI'), mx + 38, y, { align: 'center' })
    doc.text(t('NARX'), mx + 52, y, { align: 'right' })
    doc.text(t('JAMI'), w - mx - 1, y, { align: 'right' })
    y += 5

    // === TABLE ROWS ===
    doc.setTextColor(30, 30, 30)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    const tarkiblar = s.tarkiblar || []
    for (const item of tarkiblar) {
      if (y > 185) {
        doc.addPage([80, 200])
        y = 8
      }
      const bonusmi = Number(item.birlikNarxi) === 0
      const nomi = t(item.tovar?.nomi || '—') + (bonusmi ? ` (${t('Bonus')})` : '')
      const miqdor = String(Number(item.miqdor))
      const narx = bonusmi ? t('Bepul') : formatSum(item.birlikNarxi)
      const jami = bonusmi ? t('Bepul') : formatSum(item.jami)

      // Truncate long names
      const maxNomiW = 34
      let nomiText = nomi
      while (doc.getTextWidth(nomiText) > maxNomiW && nomiText.length > 3) {
        nomiText = nomiText.slice(0, -1)
      }
      if (nomiText !== nomi) nomiText += '..'

      doc.text(nomiText, mx + 1, y)
      doc.text(miqdor, mx + 38, y, { align: 'center' })
      doc.text(narx, mx + 52, y, { align: 'right' })
      doc.setFont('helvetica', 'bold')
      doc.text(jami, w - mx - 1, y, { align: 'right' })
      doc.setFont('helvetica', 'normal')
      y += 4.5

      // Light row separator
      doc.setDrawColor(240, 240, 240)
      doc.setLineWidth(0.1)
      doc.line(mx, y - 1.5, w - mx, y - 1.5)
    }

    // === CHEGIRMA ===
    if (Number(s.chegirma) > 0) {
      const jamiSummaHisob = Number(s.chegirma) + Number(s.yakuniySumma)
      const chegirmaFoizi = jamiSummaHisob > 0 ? Math.round((Number(s.chegirma) / jamiSummaHisob) * 100) : 0
      y += 1
      doc.setFontSize(7.5)
      doc.setTextColor(100, 100, 100)
      doc.text(`${t('Chegirma')} (${chegirmaFoizi}%):`, mx, y)
      doc.text('-' + formatSum(s.chegirma), w - mx, y, { align: 'right' })
      y += 4
    }

    // === TOTAL ===
    y += 1
    doc.setDrawColor(220, 38, 38)
    doc.setLineWidth(0.7)
    doc.line(mx, y, w - mx, y)
    y += 5
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(220, 38, 38)
    doc.text(t('JAMI') + ':', mx, y)
    doc.text(formatSum(s.yakuniySumma), w - mx, y, { align: 'right' })
    y += 6

    // === PAYMENT INFO ===
    doc.setDrawColor(230, 230, 230)
    doc.setLineWidth(0.2)
    doc.line(mx, y, w - mx, y)
    y += 4
    doc.setFontSize(7.5)
    doc.setTextColor(80, 80, 80)
    doc.setFont('helvetica', 'normal')
    if (s.tolovUsuli === 'ARALASH') {
      // Har bir kanal alohida qator — naqd+karta, naqd+Click, naqd+o'tkazma
      for (const kanal of tolovKanallari(s)) {
        doc.text(tolovQisqa(kanal.usul, til) + ':', mx, y)
        doc.text(formatSum(kanal.summa), w - mx, y, { align: 'right' })
        y += 4
      }
    } else if (s.tolovUsuli === 'NASIYA') {
      doc.text(t("To'lov") + ':', mx, y)
      doc.text(t('Nasiya'), w - mx, y, { align: 'right' })
      y += 4
      doc.text(t('Mijoz') + ':', mx, y)
      doc.text(t(s.mijoz?.ism || '—'), w - mx, y, { align: 'right' })
      y += 4
    } else {
      doc.text(t("To'lov") + ':', mx, y)
      doc.text(tolovLabel(s.tolovUsuli, til), w - mx, y, { align: 'right' })
      y += 4
    }

    // === FOOTER ===
    y += 3
    doc.setDrawColor(230, 230, 230)
    doc.setLineWidth(0.2)
    doc.line(mx, y, w - mx, y)
    y += 5
    if (chekMatn) {
      doc.setFontSize(6.5)
      doc.setTextColor(150, 150, 150)
      doc.text(chekMatn, w / 2, y, { align: 'center' })
      y += 4
    }
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(220, 38, 38)
    doc.text(t('Rahmat') + '!', w / 2, y, { align: 'center' })
    y += 4
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.setFont('helvetica', 'normal')
    doc.text(dokonNomi, w / 2, y, { align: 'center' })

    // Trim page height
    const pageH = y + 10
    doc.internal.pageSize.height = pageH

    doc.save(`chek-${s.chekRaqami || 'sotuv'}.pdf`)
  }

  // Savat va kassa paneli — BITTA joyda yozilgan, ikki joyda
  // ko‘rsatiladi: odatdagi ustunda yoki "Kassa" oynasida.
  // Nusxa ko‘chirilsa ikkalasi vaqt o‘tib ayrilib ketardi.
  const savatPaneli = (
    <>
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl flex-1 min-h-0">
          <div className="p-3 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart size={16} className="text-gray-500 dark:text-gray-400" />
              <h2 className="text-gray-900 dark:text-gray-100 font-semibold text-sm">Savat ({savat.length})</h2>
            </div>
            <div className="flex items-center gap-1">
              {savat.length > 0 && saqlashRuxsat && (
                <button
                  onClick={saqlashOynasiniOch}
                  className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950 rounded-lg transition"
                  title="Zakazni saqlab qo'yish"
                >
                  <Pause size={15} />
                </button>
              )}
              {/* Ruxsati bor kassirga har doim ko'rinadi — "zakaz bormi?" deb tekshira olsin.
                  Oldin ro'yxat bo'sh bo'lsa tugma umuman yo'q edi. */}
              {saqlashRuxsat && <button
                onClick={() => { setSaqlanganiModal(true); void zakazlarniYuklash() }}
                className="relative p-1.5 text-gray-500 dark:text-gray-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950 rounded-lg transition"
                title="Saqlangan zakazlar"
              >
                <Archive size={15} />
                {saqlanganiSavatlar.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-violet-600 text-white text-[9px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">{saqlanganiSavatlar.length}</span>
                )}
              </button>}
              {oxirgiSotuv && (
                <button
                  onClick={() => setChekModal(true)}
                  className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg transition"
                  title="Oxirgi chek"
                >
                  <Clock size={15} />
                </button>
              )}
              {qaytarishRuxsat && <button
                onClick={() => { setQaytarishModal(true); setQaytarishSotuv(null); setSotuvQidiruv(''); sotuvlarYuklash() }}
                className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950 rounded-lg transition"
                title="Qaytarish"
              >
                <RotateCcw size={15} />
              </button>}
              {savat.length > 0 && (
                <button onClick={() => { setSavat([]); setAralashSummalar(aralashBoshlangich); setSarfBall(''); setSarfKeshbek('') }} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition">
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>

          {/* Tanlangan mijoz — to'lashda qayta so'ralmaydi, shuning uchun kassir aniq ko'rib tursin */}
          {tanlanganMijoz && (
            <div className="px-3 py-2 border-b border-gray-200 dark:border-neutral-800 bg-emerald-50/70 dark:bg-emerald-950/20 flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold" aria-hidden>
                {tanlanganMijoz.ism.trim().charAt(0).toUpperCase() || '?'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium leading-tight text-emerald-700 dark:text-emerald-400">Mijoz uchun savdo</p>
                <p className="text-sm font-semibold leading-tight text-gray-900 dark:text-gray-100 truncate">{tanlanganMijoz.ism}</p>
                {tanlanganMijoz.telefon && <p className="text-xs leading-tight text-gray-500 dark:text-gray-400 truncate">{formatPhone(tanlanganMijoz.telefon)}</p>}
              </div>
              <button
                type="button" onClick={mijozniOlibTashla} disabled={yuklanmoqda}
                title="Mijozni olib tashlash" aria-label="Mijozni olib tashlash"
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition disabled:opacity-50"
              >
                <X size={15} />
              </button>
            </div>
          )}

          {savat.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <ShoppingCart size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">Savat bo&apos;sh</p>
              <p className="text-xs mt-1">Tovar tanlang</p>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-72">
              {savat.map(item => {
                const itemTovar = tovarlar.find(t => t.id === item.tovarId)
                const isNarxOzgartirilgan = item.birlikNarxi !== itemTovar?.sotishNarxi
                const isEditing = editNarx?.tovarId === item.tovarId
                // Faqat narxi kiritilgan turlar ko'rsatiladi — bo'sh bo'lsa tugma chiqmaydi
                const mavjudTurlar: NarxTuri[] = ['sotish',
                  ...(itemTovar?.optomNarxi != null ? ['optom' as const] : []),
                  ...(itemTovar?.bolishNarxi != null ? ['bolish' as const] : []),
                ]
                return (
                <div key={item.tovarId + (item.bonus ? '-bonus' : '')} className="px-3 py-2.5 border-b border-gray-100 dark:border-neutral-800 last:border-b-0">
                  {/* Row 1: nomi + delete */}
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <p className="text-gray-900 dark:text-gray-100 text-sm font-medium leading-tight flex-1 truncate flex items-center gap-1.5" title={item.nomi}>
                      {item.nomi}
                      {item.bonus && (
                        <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 px-1.5 py-0.5 rounded-full shrink-0">
                          <Gift size={9} /> Bonus
                        </span>
                      )}
                      {!item.bonus && item.narxTuri && item.narxTuri !== 'sotish' && (
                        <span className="inline-flex items-center text-[11px] font-semibold bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full shrink-0">
                          {NARX_TURI_LABEL[item.narxTuri]}
                        </span>
                      )}
                    </p>
                    <button onClick={() => miqdorOzgartir(item.tovarId, item.bonus, 0)} className="text-gray-300 dark:text-gray-600 hover:text-red-500 transition shrink-0 ml-1">
                      <X size={13} />
                    </button>
                  </div>
                  {/* Row 1.5: narx turi tanlash — mahsulotda optom/bo'lish narxi bo'lsagina chiqadi */}
                  {!item.bonus && mavjudTurlar.length > 1 && (
                    <div className="flex items-center gap-1 mb-1.5">
                      {mavjudTurlar.map(turi => (
                        <button
                          key={turi}
                          type="button"
                          onClick={() => savatNarxTuriTanlash(item.tovarId, turi)}
                          className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition ${
                            (item.narxTuri || 'sotish') === turi
                              ? 'bg-pos text-white'
                              : 'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700'
                          }`}
                        >
                          {NARX_TURI_LABEL[turi]}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Row 2: [narx input] × [miqdor] = [jami] */}
                  <div className="flex items-center gap-1.5">
                    {item.bonus ? (
                      <span className="flex-1 min-w-0 h-7 flex items-center px-2 text-xs rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 font-medium">
                        Bepul
                      </span>
                    ) : (
                    /* Narx — always editable input */
                    <div className="relative flex-1 min-w-0">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={isEditing ? editNarx.val.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : String(item.birlikNarxi).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
                        onFocus={e => { setEditNarx({ tovarId: item.tovarId, val: String(item.birlikNarxi) }); e.target.select() }}
                        onChange={e => setEditNarx({ tovarId: item.tovarId, val: e.target.value.replace(/[^\d]/g, '') })}
                        onBlur={() => narxTasdiqla(item.tovarId)}
                        onKeyDown={e => { if (e.key === 'Enter') { narxTasdiqla(item.tovarId); (e.target as HTMLInputElement).blur() } if (e.key === 'Escape') setEditNarx(null) }}
                        title="Narxni o'zgartirish mumkin"
                        className={`w-full h-7 pl-2 pr-5 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-blue-400 transition
                          ${isNarxOzgartirilgan
                            ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium'
                            : 'border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-600 dark:text-gray-400'
                          }`}
                      />
                      <Pencil size={9} className={`absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none ${isNarxOzgartirilgan ? 'text-blue-400' : 'text-gray-300 dark:text-gray-600'}`} />
                    </div>
                    )}
                    <span className="text-gray-500 dark:text-gray-400 text-xs shrink-0">×</span>
                    <MiqdorInput miqdor={item.miqdor} max={item.mavjudQoldiq} onChange={v => miqdorOzgartir(item.tovarId, item.bonus, v)} />
                    <span className="text-gray-500 dark:text-gray-400 text-xs shrink-0">=</span>
                    <span className={`text-sm font-bold shrink-0 min-w-[65px] text-right ${item.bonus ? 'text-violet-600 dark:text-violet-400' : 'text-green-600'}`}>{item.bonus ? 'Bepul' : formatSum(item.jami)}</span>
                  </div>
                  {ortiqchaTovarIdlar.has(item.tovarId) && (
                    <div className="flex items-center gap-1 mt-1.5 text-amber-600 dark:text-amber-400">
                      <AlertTriangle size={11} />
                      <span className="text-[11px]">Qoldiq: {item.mavjudQoldiq}, yetarli emas!</span>
                    </div>
                  )}
                </div>
                )
              })}
            </div>
          )}
        </div>

        {/* To'lov */}
        {savat.length > 0 && (
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>Hisoblangan jami:</span>
              <span className="text-gray-900 dark:text-gray-100 font-medium">{formatSum(jamiSumma)}</span>
            </div>

            {/* Umumiy summa o'zgartirish — chegirma ruxsati bilan */}
            {chegirmaRuxsat && <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">Yakuniy summa:</span>
              <input
                type="text"
                inputMode="numeric"
                value={qolBilanSumma}
                onChange={e => setQolBilanSumma(e.target.value.replace(/[^\d]/g, ''))}
                placeholder={String(Math.round(jamiSumma))}
                className="flex-1 px-2 py-1 text-sm text-right bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-pos text-gray-900 dark:text-gray-100 font-medium"
              />
            </div>}

            {chegirma > 0 && (
              <div className="flex justify-between text-xs text-amber-600 dark:text-amber-400">
                <span>Chegirma:</span><span>-{formatSum(chegirma)}</span>
              </div>
            )}

            {/* Chegirma foizi va bonus mahsulot */}
            <div className="flex items-center gap-3">
              {!chegirmaFoizOchiq ? (
                <button
                  type="button"
                  onClick={() => setChegirmaFoizOchiq(true)}
                  className="flex items-center gap-1 text-xs text-pos hover:underline font-medium"
                >
                  <Plus size={12} /> Chegirma foizi
                </button>
              ) : (
                <div className="flex items-center gap-1.5 flex-1">
                  <Percent size={12} className="text-gray-500 dark:text-gray-400 shrink-0" />
                  <input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    value={chegirmaFoiz}
                    onChange={e => {
                      const v = e.target.value.replace(/[^\d]/g, '')
                      setChegirmaFoiz(v)
                      const foiz = Math.min(100, parseFloat(v) || 0)
                      setQolBilanSumma(v ? String(Math.round(jamiSumma * (1 - foiz / 100))) : '')
                    }}
                    placeholder="foiz"
                    className="w-16 px-2 py-1 text-xs text-right bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-pos text-gray-900 dark:text-gray-100 font-medium"
                  />
                  <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">%</span>
                  <button
                    type="button"
                    onClick={() => { setChegirmaFoizOchiq(false); setChegirmaFoiz(''); setQolBilanSumma('') }}
                    className="text-gray-300 dark:text-gray-600 hover:text-red-500 transition shrink-0 ml-auto"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}
              {!chegirmaRuxsat ? null : !bonusTanlashRejimi ? (
                <button
                  type="button"
                  onClick={() => { setBonusTanlashRejimi(true); setMobileTab('tovarlar') }}
                  className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 hover:underline font-medium shrink-0"
                >
                  <Plus size={12} /> Bonus mahsulot
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setBonusTanlashRejimi(false)}
                  className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 font-medium shrink-0"
                >
                  <Gift size={12} /> Tanlanmoqda... <X size={12} />
                </button>
              )}
            </div>

            {/* ── Ball va keshbek sarflash ──
                Faqat dastur yoqilgan, mijoz tanlangan va balansi bor
                bo'lsa ko'rinadi — bo'sh panel kassirni chalg'itmasin. */}
            {sodiqlikSozlama.faol && mijozBalans
              && (mijozBalans.keshbek > 0 || (ballSarflanadimi(sodiqlikSozlama) && mijozBalans.ball > 0)) && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/10 p-2.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-500 flex items-center gap-1">
                    <Gift size={13} /> Ball va keshbek
                  </span>
                  <span className="text-[11px] text-amber-600 dark:text-amber-500 tabular-nums">
                    {formatBall(mijozBalans.ball)} ball &middot; {formatSum(mijozBalans.keshbek)}
                  </span>
                </div>

                {mijozBalans.keshbek > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 w-14 shrink-0">Keshbek</span>
                    <div className="flex-1 min-w-0">
                      <MoneyInput
                        value={sarfKeshbek}
                        onChange={setSarfKeshbek}
                        max={Math.min(mijozBalans.keshbek, chekSummasi)}
                        min={0}
                        placeholder="0"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setSarfKeshbek(String(Math.floor(Math.min(mijozBalans.keshbek, chekSummasi))))}
                      className="text-[11px] text-amber-700 dark:text-amber-500 hover:underline shrink-0"
                    >
                      hammasi
                    </button>
                  </div>
                )}

                {ballSarflanadimi(sodiqlikSozlama) && mijozBalans.ball > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 w-14 shrink-0">Ball</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={sarfBall}
                      onChange={e => setSarfBall(e.target.value.replace(/[^0-9.]/g, ''))}
                      placeholder="0"
                      className="flex-1 min-w-0 px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-pos"
                    />
                    <button
                      type="button"
                      onClick={() => setSarfBall(formatBall(mijozBalans.ball))}
                      className="text-[11px] text-amber-700 dark:text-amber-500 hover:underline shrink-0"
                    >
                      hammasi
                    </button>
                  </div>
                )}

                {sodiqlikNatija.jamiChegirma > 0 && (
                  <div className="flex justify-between text-xs pt-1 border-t border-amber-200/70 dark:border-amber-900/40">
                    <span className="text-amber-700 dark:text-amber-500">
                      Hisobdan
                      {sodiqlikNatija.ball > 0 && ` (${formatBall(sodiqlikNatija.ball)} ball)`}
                    </span>
                    <span className="font-semibold text-amber-700 dark:text-amber-500 tabular-nums">
                      -{formatSum(sodiqlikNatija.jamiChegirma)}
                    </span>
                  </div>
                )}
                {sodiqlikNatija.ogohlantirish && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-500">{sodiqlikNatija.ogohlantirish}</p>
                )}
              </div>
            )}

            <div className="flex justify-between font-bold border-t border-gray-100 dark:border-neutral-800 pt-2">
              <span className="text-gray-900 dark:text-gray-100">To&apos;lov:</span>
              <span className="text-green-600 text-lg">{formatSum(yakuniySumma)}</span>
            </div>

            {/* To'lov usuli */}
            <div className="grid grid-cols-2 gap-1.5">
              {POS_TOLOV_USULLARI.filter(usul => usul !== 'NASIYA' || nasiyaRuxsat).map(usul => (
                <button
                  key={usul}
                  type="button"
                  onClick={() => setTolovUsuli(usul)}
                  className={`py-2 px-3 rounded-xl text-xs font-medium transition ${
                    tolovUsuli === usul
                      ? 'bg-pos text-white'
                      : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  {TOLOV_MALUMOTI[usul].label}
                </button>
              ))}
            </div>

            {tolovUsuli === 'NASIYA' && (
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">Nasiya muddati</p>
                <input type="date" value={nasiyaMuddat} onChange={e => setNasiyaMuddat(e.target.value)} className={inputCls} />
              </div>
            )}

            {tolovUsuli === 'ARALASH' && (
              <div className="space-y-2">
                {/* Har bir kanal uchun alohida input — kassir naqddan
                    qancha, kartadan qancha, Click'dan qancha olganini
                    qo'lda kiritadi. Oldin faqat "naqd qism" so'ralib,
                    qolgani bitta kanalga yozilardi va pul aslida qaysi
                    kanaldan kelgani chekda ko'rinmasdi. */}
                {KANAL_USULLARI.map(kanal => (
                  <div key={kanal} className="flex items-center gap-2">
                    <span className="text-gray-500 dark:text-gray-400 text-xs w-16 shrink-0">
                      {TOLOV_MALUMOTI[kanal].qisqa}
                    </span>
                    <div className="flex-1 min-w-0">
                      <MoneyInput
                        value={aralashSummalar[kanal]}
                        onChange={v => setAralashSummalar(oldingi => ({ ...oldingi, [kanal]: v }))}
                        max={yakuniySumma}
                        min={0}
                        placeholder="0"
                      />
                    </div>
                  </div>
                ))}

                {/* Qolgan/ortiqcha summa — kassir qayerda xato qilganini
                    darhol ko'rsin. Tugma ham shu holatga qarab bloklanadi. */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100 dark:border-neutral-800 text-xs">
                  <span className="text-gray-500 dark:text-gray-400">Kiritildi</span>
                  <span className="text-gray-900 dark:text-gray-100 font-medium tabular-nums">
                    {formatSum(aralashKiritilgan)}
                  </span>
                </div>
                {Math.abs(aralashQoldi) >= 1 && (
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className={aralashQoldi > 0 ? 'text-amber-600' : 'text-red-600'}>
                      {aralashQoldi > 0 ? 'Qoldi' : 'Ortiqcha'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        // Qolgan summani bitta bosishda naqdga yozish —
                        // eng ko'p uchraydigan holat uchun qisqa yo'l.
                        if (aralashQoldi <= 0) return
                        const joriy = parseFloat(aralashSummalar.NAQD || '0') || 0
                        setAralashSummalar(oldingi => ({ ...oldingi, NAQD: String(Math.round(joriy + aralashQoldi)) }))
                      }}
                      disabled={aralashQoldi <= 0}
                      className={`font-semibold tabular-nums ${aralashQoldi > 0 ? 'text-amber-600 hover:underline' : 'text-red-600 cursor-default'}`}
                      title={aralashQoldi > 0 ? "Qolganini naqdga yozish" : undefined}
                    >
                      {formatSum(Math.abs(aralashQoldi))}
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={sotuvYakunla}
                disabled={yuklanmoqda || !!aralashXato}
                title={aralashXato ?? undefined}
                className="flex-1 py-3 bg-pos-pay hover:bg-pos-pay-hover disabled:opacity-60 text-white font-bold rounded-xl transition text-sm shadow-md shadow-pos-pay/20 flex items-center justify-center gap-2"
              >
                <CheckCircle size={18} />
                {yuklanmoqda ? 'Amalga oshirilmoqda...' : tanlanganMijoz ? `To'lash · ${tanlanganMijoz.ism.split(' ')[0]}` : "To'lash"}
              </button>
            </div>
          </div>
        )}
    </>
  )

  return (
    // `lg:h-full` OLIB TASHLANDI: u ustun balandligini ekran bilan
    // cheklab qo'yardi va `sticky` qidiruv/kategoriya paneli desktopda
    // ushlanmasdan yuqoriga chiqib ketardi. Tabiiy balandlikda sahifaning
    // o'zi aylanadi — panel ham, suzuvchi "Kassa" tugmasi ham ishlaydi.
    <div className="flex flex-col lg:flex-row gap-4 lg:items-start">
      {/* Mobile tab switcher */}
      <div className="flex lg:hidden border-b border-gray-200 dark:border-neutral-800 mb-0">
        <button
          onClick={() => setMobileTab('tovarlar')}
          className={`flex-1 py-2.5 text-sm font-medium ${mobileTab === 'tovarlar' ? 'text-pos border-b-2 border-pos' : 'text-gray-500 dark:text-gray-400'}`}
        >
          Tovarlar
        </button>
        <button
          onClick={() => setMobileTab('savat')}
          className={`flex-1 py-2.5 text-sm font-medium relative ${mobileTab === 'savat' ? 'text-pos border-b-2 border-pos' : 'text-gray-500 dark:text-gray-400'}`}
        >
          Savat {savat.length > 0 && <span className="ml-1 bg-pos text-white text-xs rounded-full px-1.5">{savat.length}</span>}
        </button>
      </div>

      {/* Chap: Tovarlar */}
      <div className={`flex-1 flex flex-col gap-4 min-w-0 lg:flex ${mobileTab === 'tovarlar' ? 'flex' : 'hidden'}`}>
        {/* ── ASBOBLAR PANELI: ekran tepasida yopishib turadi ──
            Mahsulot ro'yxati uzun. Pastga tushilganda kassirda qidiruv,
            ombor, bo'lim VA narx turi qo'l ostida qolishi shart — narx
            turi savatga qo'shilayotgan tovar qaysi narxda hisoblanishini
            belgilaydi, uni ko'rmasdan bosish noto'g'ri chek demakdir.
            Shu sababli to'rttalasi ham bitta yopishgan qatlamda.

            O'lchamlar nega aynan shunday:
            • `-top-4 lg:-top-6` — `<main>` ning ichki bo'shlig'i (p-4 / lg:p-6).
              `top-0` da panel o'sha bo'shliqning OSTIGA yopishardi va tepada
              16–24px lik tirqish qolardi: mahsulotlar aynan o'sha tirqishdan
              sirg'alib o'tib ko'rinardi. Manfiy `top` panelni scroll
              maydonining eng chetiga bosadi — tirqish yo'qoladi.
            • Chap chet manfiy margin bilan ekran chetigacha cho'ziladi,
              O'NG chet esa `lg` da cho'zilmaydi (`lg:mr-0`): ilgari
              `lg:-mx-6` panelni 24px o'ngga chiqarib, 16px lik ustunlar
              orasidan o'tib savat panelining chap chetiga 8px bosib
              turardi. `lg` da o'ng tomonda hech narsa panel ostiga
              kirmaydi — savat alohida ustun, uni yopish shart emas.
            • `-mt-4 lg:-mt-6` — manfiy `top` uchun qo'shilgan `pt` oddiy
              holatda ikki karra bo'shliq bermasin.
            • Fon shaffofmas va sahifa foni bilan bir xil — ost tomondan
              hech narsa sizib chiqmaydi. */}
        <div
          ref={asboblarRef}
          className={`sticky -top-4 lg:-top-6 z-20 -mx-4 px-4 lg:-ml-6 lg:pl-6 lg:mr-0 lg:pr-0 -mt-4 lg:-mt-6 pt-4 lg:pt-6 pb-3 bg-gray-50 dark:bg-neutral-950 flex flex-col gap-2.5 border-b transition-[box-shadow,border-color] duration-200 ${
            asboblarYopishgan
              // Yopishgan holatda soya + ingichka chiziq. Kartalarning panel
              // ostiga kirib ketishi shundagina "qatlam" bo'lib o'qiladi;
              // busiz ular shunchaki qirqilib qolgandek ko'rinardi.
              // Chegara har doim turadi (faqat rangi almashadi) — aks holda
              // 1px balandlik o'zgarib, panel sakrab ketardi.
              ? 'border-gray-200 dark:border-neutral-800 shadow-[0_10px_22px_-16px_rgba(0,0,0,0.55)]'
              : 'border-transparent'
          }`}
        >
          {/* Qidiruv qatori. `flex-wrap`: joy tor bo'lsa (masalan 1024px
              ekranda savat ustuni 384px olib qo'yganda) narx turi o'z-o'zidan
              pastki qatorga tushadi — qidiruv maydoni hech qachon siqilib
              ketmaydi. Joy yetsa esa bir qatorda turib, yopishgan paneldan
              butun bir qator balandlikni tejaydi. */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={skanerOchiq ? skanerniYopish : skanerniOchish}
              className={`shrink-0 p-2.5 rounded-xl border transition ${skanerOchiq ? 'bg-pos border-pos text-white' : 'bg-white dark:bg-neutral-900 border-gray-300 dark:border-neutral-700 text-gray-500 dark:text-gray-400 hover:border-pos/50 hover:text-pos'}`}
              title="Skaner"
            >
              <ScanLine size={18} />
            </button>
            <div className="relative flex-1 min-w-[11rem]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400" size={16} />
              {/* `suppressHydrationWarning`: parol menejeri / forma to'ldiruvchi
                  kengaytmalar React'dan oldin `fdprocessedid` atributini qo'shadi.
                  Bayroq faqat shu elementga ta'sir qiladi. */}
              <input
                suppressHydrationWarning
                value={qidiruv}
                onChange={e => setQidiruv(e.target.value)}
                placeholder="Tovar qidirish yoki shtrix-kod..."
                className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-pos"
              />
            </div>
            {/* Narx turi — savatga YANGI qo'shiladigan mahsulot shu narx
                bilan hisoblanadi. Endi yopishgan panel ichida: pastga
                tushib mahsulot bosilganda ham qaysi narx amal qilayotgani
                ko'rinib turadi va bir bosishda almashtiriladi. */}
            <div
              role="group"
              aria-label="Narx turi"
              className="shrink-0 flex items-center gap-1 bg-gray-100 dark:bg-neutral-800 rounded-xl p-1"
            >
              {(['sotish', 'optom', 'bolish'] as NarxTuri[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setNarxTuri(t)}
                  aria-pressed={narxTuri === t}
                  className={`px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition ${narxTuri === t ? 'bg-white dark:bg-neutral-700 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                >
                  {NARX_TURI_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          {/* ── OMBORLAR (katta kategoriya) ──
              Kategoriyalardan yuqorida turadi. Ombor tanlansa quyidagi
              kategoriya chiplari ham, mahsulotlar ham shu ombor ichidagilar
              bilan cheklanadi. */}
          {omborlar.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Ombor
              </span>
              <ChipRow label="Omborlar">
                <button
                  onClick={() => { setAktifOmbor(null); setAktifKategoriya(null) }}
                  aria-pressed={aktifOmbor === null}
                  className={`shrink-0 px-3.5 py-2 rounded-full text-sm font-medium transition whitespace-nowrap ${
                    aktifOmbor === null
                      ? 'bg-gray-800 dark:bg-neutral-200 text-white dark:text-neutral-900'
                      : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  Hammasi
                </button>
                {omborlar.map(o => (
                  <button
                    key={o.id}
                    onClick={() => {
                      // Ombor almashganda eski kategoriya tanlovi mos
                      // kelmasligi mumkin — shuning uchun tozalanadi.
                      setAktifOmbor(o.id)
                      setAktifKategoriya(null)
                    }}
                    aria-pressed={aktifOmbor === o.id}
                    className={`shrink-0 px-3.5 py-2 rounded-full text-sm font-medium transition whitespace-nowrap ${
                      aktifOmbor === o.id
                        ? 'bg-gray-800 dark:bg-neutral-200 text-white dark:text-neutral-900'
                        : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700'
                    }`}
                  >
                    {o.nomi}
                  </button>
                ))}
              </ChipRow>
            </div>
          )}

          {kategoriyalar.length > 0 && (
            <div className="flex items-center gap-2 min-w-0">
              {/* Kategoriya ko'p bo'lsa yonma-yon sig'maydi — bu tugma
                  hammasini varaqda ochadi va qidirib topish imkonini beradi. */}
              {kategoriyalar.length > 4 && (
                <button
                  onClick={() => { setKategoriyaQidiruv(''); setKategoriyaVaraq(true) }}
                  title="Barcha bo'limlar"
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700 transition"
                >
                  <LayoutGrid size={14} />
                  <span className="hidden sm:inline">Bo&apos;limlar</span>
                </button>
              )}
              <ChipRow label="Bo'limlar">
                <button
                  onClick={() => setAktifKategoriya(null)}
                  aria-pressed={aktifKategoriya === null}
                  className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition whitespace-nowrap ${
                    aktifKategoriya === null
                      ? 'bg-pos text-white'
                      : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  Barchasi
                </button>
                {korinadiganKategoriyalar.map(k => (
                  <button
                    key={k.id}
                    onClick={() => setAktifKategoriya(k.id)}
                    aria-pressed={aktifKategoriya === k.id}
                    className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition whitespace-nowrap ${
                      aktifKategoriya === k.id
                        ? 'bg-pos text-white'
                        : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700'
                    }`}
                  >
                    {k.nomi}
                  </button>
                ))}
              </ChipRow>
            </div>
          )}
        </div>
        {skanerOchiq && (
          <div className="bg-black rounded-xl overflow-hidden relative">
            <div id="skaner-reader" style={{ width: '100%' }} />
          </div>
        )}
        {bonusTanlashRejimi && (
          <div className="flex items-center justify-between gap-2 bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 rounded-xl px-4 py-2.5">
            <span className="flex items-center gap-2 text-sm text-violet-700 dark:text-violet-400 font-medium">
              <Gift size={16} /> Bonus uchun mahsulot tanlang
            </span>
            <button type="button" onClick={() => setBonusTanlashRejimi(false)} className="text-violet-400 hover:text-violet-600 transition">
              <X size={16} />
            </button>
          </div>
        )}
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl">
          {tovarlarYuklanmoqda ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="p-3 bg-gray-50 dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 animate-pulse">
                  <div className="h-3.5 bg-gray-200 dark:bg-neutral-700 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-200 dark:bg-neutral-700 rounded w-1/2 mb-1.5" />
                  <div className="h-2.5 bg-gray-200 dark:bg-neutral-700 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : tovarlarXato ? (
            <div className="p-8 text-center">
              <AlertTriangle size={36} className="mx-auto mb-3 text-red-500 opacity-70" />
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Tovarlarni yuklab bo&apos;lmadi</p>
              <p className="text-xs mt-1 text-gray-500 dark:text-gray-400 mb-3">{tovarlarXato}</p>
              <button
                onClick={tovarlarniYuklash}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-pos hover:bg-pos-hover text-white rounded-xl text-sm font-medium transition"
              >
                <RotateCcw size={14} />
                Qayta urinish
              </button>
            </div>
          ) : tovarlar.length === 0 ? (
            <div className="p-8 text-center">
              <ShoppingCart size={36} className="mx-auto mb-3 text-gray-300 dark:text-gray-700" />
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Tovarlar yo&apos;q</p>
              <p className="text-xs mt-1 text-gray-500 dark:text-gray-400 mb-3">Avval Tovarlar bo&apos;limidan mahsulot qo&apos;shing</p>
              <a
                href="/tovarlar"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-pos hover:bg-pos-hover text-white rounded-xl text-sm font-medium transition"
              >
                Tovarlar bo&apos;limiga o&apos;tish
              </a>
            </div>
          ) : korsatiladiganTovarlar.length === 0 ? (
            <div className="p-8 text-center">
              <Search size={36} className="mx-auto mb-3 text-gray-300 dark:text-gray-700" />
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Hech narsa topilmadi</p>
              <p className="text-xs mt-1 text-gray-500 dark:text-gray-400">&laquo;{qidiruv}&raquo; bo&apos;yicha tovar yo&apos;q</p>
            </div>
          ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4 p-4">
            {/* Ustunlar soni EKRAN eniga emas, MAVJUD joyga qarab tanlanadi.
                Ilgari `lg:grid-cols-3` edi va savat paneli joyning uchdan
                birini olgani uchun kartalar 137px gacha siqilardi: kategoriya
                nomi "Z..." ga aylanib, uzun narxlar qirqilardi. `auto-fill`
                bilan ustun faqat sig'sa qo'shiladi, karta esa hech qachon
                180px dan tor bo'lmaydi — bu nishonlar qatori va narxning
                o'qilishi uchun kerak bo'lgan eng kichik en. */}
            {korsatiladiganTovarlar.map(t => {
              // Oddiy va bonus qatorlari birga qo'shiladi — bitta mahsulotdan
              // ikkalasi ham bo'lishi mumkin (masalan 5ta sotuv + 1ta bonus).
              const savatdagi = savat.filter(s => s.tovarId === t.id).reduce((sum, s) => sum + s.miqdor, 0)
              const tugagan = t.qoldiq <= 0
              const kamQoldi = !tugagan && t.qoldiq <= 5
              return (
                <button
                  key={t.id}
                  onClick={() => savatQosh(t)}
                  disabled={tugagan}
                  className="group relative text-left bg-white dark:bg-neutral-800 rounded-2xl border border-gray-200 dark:border-neutral-700 overflow-hidden transition-all hover:border-pos hover:shadow-lg active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:border-gray-200 dark:disabled:hover:border-neutral-700 disabled:hover:shadow-none disabled:active:scale-100"
                >
                  <div className="aspect-[16/10] bg-gradient-to-br from-pos-light to-white dark:from-pos/15 dark:to-neutral-800 flex items-center justify-center relative overflow-hidden">
                    {t.rasmlar?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.rasmlar[0]} alt={t.nomi} className="w-full h-full object-cover" />
                    ) : (
                      <Package size={48} className="text-pos/60 group-hover:text-pos group-hover:scale-110 transition-all" />
                    )}

                    {/* ── NISHONLAR BITTA QATORDA ──
                        Ilgari uchtasi ham mustaqil `absolute` edi va kategoriya
                        `left-9` degan sehrli siljish bilan qo'yilardi. Tor
                        kartada (3 ustunli tarhda ~137px) kategoriya qoldiq
                        nishoni ustiga chiqib ketardi — o'lchov bilan tasdiqlangan.
                        Endi ular bitta flex qatorda: kategoriya qisqaradi
                        (`min-w-0 truncate`), qoldiq esa qisqarmaydi
                        (`shrink-0`), ya'ni to'qnashuv TUZILISH JIHATIDAN
                        imkonsiz — kartaning eni qanday bo'lishidan qat'i nazar. */}
                    <div className="absolute inset-x-2 top-2 z-10 flex items-start justify-between gap-2 pointer-events-none">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {savatdagi > 0 && (
                          <span className="shrink-0 bg-pos text-white text-xs font-bold rounded-full min-w-6 h-6 px-1.5 flex items-center justify-center shadow">
                            {savatdagi}
                          </span>
                        )}
                        {t.kategoriya && (
                          // Kategoriya — MA'LUMOT, savat soni esa HOLAT.
                          // Ilgari ikkalasi ham bir xil qizil edi va bir-biridan
                          // farqlanmasdi; endi kategoriya betaraf shisha chip.
                          <span
                            title={t.kategoriya.nomi}
                            className="min-w-0 truncate text-[11px] bg-white/85 dark:bg-neutral-900/80 text-gray-700 dark:text-gray-200 px-2 py-1 rounded-full font-medium shadow-sm backdrop-blur-sm"
                          >
                            {t.kategoriya.nomi}
                          </span>
                        )}
                      </div>
                      <span className={`shrink-0 text-xs px-2 py-1 rounded-lg font-semibold shadow-sm whitespace-nowrap ${
                        tugagan ? 'bg-red-500 text-white' : kamQoldi ? 'bg-amber-500 text-white' : 'bg-white/90 dark:bg-neutral-900/80 text-gray-600 dark:text-gray-300'
                      }`}>
                        {tugagan ? 'Tugagan' : `${t.qoldiq} ${t.birlik.toLowerCase()}`}
                      </span>
                    </div>
                  </div>

                  <div className="p-3">
                    {/* Ajratilgan joy AYNAN ikki qator: `leading-snug` = 1.375, ya'ni
                        2.75em. Ilgari 2.6em edi — bir qatorli va ikki qatorli
                        nomli kartalar 3px farq qilib, tarh qatorlari tekis
                        chiqmasdi. */}
                    <p className="text-gray-900 dark:text-gray-100 text-base font-semibold leading-snug line-clamp-2 min-h-[2.75em]">{t.nomi}</p>
                    <p className="text-gray-400 dark:text-gray-500 text-[11px] mt-0.5 tabular-nums">
                      #{(t.shtrixKod || '').padStart(3, '0') || '—'}
                    </p>

                    {/* Qoldiq rasm ustidagi nishonda ko'rinadi — panelda
                        takrorlanmaydi: bir xil raqam ikki joyda turishi
                        kartani uzaytirar va foyda bermasdi. */}
                    <TovarNarxPaneli
                      qoldiq={t.qoldiq}
                      birlik={t.birlik}
                      kamQoldi={kamQoldi}
                      kelishNarxi={t.kelishNarxi}
                      sotishNarxi={t.sotishNarxi}
                      valyuta={t.valyuta}
                      sotishRangi="text-pos"
                      olcham="keng"
                      miqdorKorsatilsinmi={false}
                    />
                  </div>
                </button>
              )
            })}
          </div>
          )}
        </div>
      </div>

      {/* O'ng: Savat. Kassa oynasi ochiq bo'lsa panel o'sha yerga ko'chadi —
          shuning uchun bu yerda ko’rsatilmaydi (ikki nusxa bo’lib qolmasin). */}
      <div
        ref={savatUstuniRef}
        className={`lg:w-96 flex flex-col gap-3 lg:flex ${mobileTab === 'savat' ? 'flex' : 'hidden'}`}
      >
        {!kassaOchiq && savatPaneli}
      </div>

      {/* ── Bo'limlar varag'i ──
          Kategoriya ko'p bo'lganda gorizontal tasma bilan qidirish qiyin.
          Bu varaq hammasini bir ekranda ko'rsatadi va qidirish maydoni
          bilan tez tanlash imkonini beradi. */}
      {kategoriyaVaraq && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={() => setKategoriyaVaraq(false)}
        >
          <div
            className="bg-white dark:bg-neutral-900 rounded-t-2xl sm:rounded-2xl shadow-xl dark:border dark:border-neutral-800 w-full max-w-md max-h-[80dvh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between gap-3 shrink-0">
              <h3 className="text-gray-900 dark:text-gray-100 font-semibold flex items-center gap-2">
                <LayoutGrid size={17} className="text-pos" /> Bo&apos;limlar
              </h3>
              <button
                onClick={() => setKategoriyaVaraq(false)}
                className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition"
              >
                <X size={18} />
              </button>
            </div>

            {kategoriyalar.length > 8 && (
              <div className="px-4 pt-3 shrink-0">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={kategoriyaQidiruv}
                    onChange={e => setKategoriyaQidiruv(e.target.value)}
                    placeholder="Bo'lim qidirish..."
                    autoFocus
                    className="w-full pl-9 pr-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-pos"
                  />
                </div>
              </div>
            )}

            <div className="overflow-y-auto flex-1 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3">
              <button
                onClick={() => { setAktifKategoriya(null); setKategoriyaVaraq(false) }}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                  aktifKategoriya === null
                    ? 'bg-pos text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800'
                }`}
              >
                <span>Barchasi</span>
                <span className="text-[11px] tabular-nums opacity-70">{tovarlar.length}</span>
              </button>

              {korinadiganKategoriyalar
                .filter(k => !kategoriyaQidiruv.trim() || uzSearch(k.nomi, kategoriyaQidiruv))
                .map(k => {
                  const soni = tovarlar.filter(t => t.kategoriya?.id === k.id).length
                  return (
                    <button
                      key={k.id}
                      onClick={() => { setAktifKategoriya(k.id); setKategoriyaVaraq(false) }}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition mt-1 ${
                        aktifKategoriya === k.id
                          ? 'bg-pos text-white'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800'
                      }`}
                    >
                      <span className="truncate text-left">{k.nomi}</span>
                      {/* Nechta mahsulot borligi — bo'sh bo'limga kirib ovora bo'lmaslik uchun */}
                      <span className={`text-[11px] tabular-nums shrink-0 ${
                        aktifKategoriya === k.id ? 'opacity-70' : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {soni}
                      </span>
                    </button>
                  )
                })}

              {korinadiganKategoriyalar.length > 0 &&
                korinadiganKategoriyalar.filter(k => !kategoriyaQidiruv.trim() || uzSearch(k.nomi, kategoriyaQidiruv)).length === 0 && (
                <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">Topilmadi</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Suzuvchi "Kassa" tugmasi ──
          Mahsulot qidirib pastga tushilganda savat ustuni ekrandan
          chiqib ketadi. Shunda o'ng pastda dumaloq tugma paydo bo'ladi:
          bosilsa kassa o'sha yerning o'zida ochiladi va boshqa joyga
          qaytmasdan savdo yakunlanadi. */}
      {savatKorinmayapti && !kassaOchiq && (
        <button
          onClick={() => setKassaOchiq(true)}
          className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 lg:bottom-8 lg:right-8 z-30 flex items-center gap-2.5 rounded-full bg-pos-pay hover:bg-pos-pay-hover text-white shadow-lg shadow-pos-pay/30 transition active:scale-95 pl-4 pr-5 py-3.5"
          title="Kassani ochish"
        >
          <div className="relative">
            <ShoppingCart size={20} />
            {savat.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-white text-pos-pay text-[11px] font-bold rounded-full min-w-[17px] h-[17px] px-1 flex items-center justify-center">
                {savat.length}
              </span>
            )}
          </div>
          <div className="text-left leading-tight">
            <span className="block text-[11px] font-medium opacity-90">Kassa</span>
            <span className="block text-sm font-bold tabular-nums whitespace-nowrap">
              {savat.length > 0 ? formatSum(yakuniySumma) : 'Ochish'}
            </span>
          </div>
        </button>
      )}

      {/* ── Kassa oynasi ──
          Savat paneli AYNAN o'sha komponent — bu yerda faqat o'rami
          boshqacha (pastdan chiquvchi varaq / markazdagi oyna). */}
      {kassaOchiq && (
        <div
          /* z-[45]: mobil navbar (z-40) USTIDA, lekin boshqa modallar
             (z-50 — mijoz, chek, qaytarish) OSTIDA. Kassadan ochilgan
             oyna kassaning orqasida qolib ketmasin. */
          className="fixed inset-0 z-[45] flex items-end sm:items-center justify-center bg-black/50 sm:p-4"
          onClick={() => setKassaOchiq(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            /* dvh — mobil brauzerda manzil paneli ochilib-yopilganda
               balandlik sakramasin (vh buni hisobga olmaydi).
               flex-col: sarlavha qotib turadi, faqat tana aylanadi. */
            className="w-full sm:max-w-md flex flex-col max-h-[88dvh] sm:max-h-[88dvh] bg-gray-50 dark:bg-neutral-950 sm:bg-transparent sm:dark:bg-transparent rounded-t-2xl sm:rounded-none shadow-2xl sm:shadow-none"
          >
            {/* Mobil sarlavha + tortish belgisi */}
            <div className="sm:hidden shrink-0 border-b border-gray-200 dark:border-neutral-800">
              <div className="flex justify-center pt-2 pb-1.5">
                <span className="w-9 h-1 rounded-full bg-gray-300 dark:bg-neutral-700" />
              </div>
              <div className="flex items-center justify-between px-4 pb-2">
                <span className="text-gray-700 dark:text-gray-300 text-sm font-semibold">Kassa</span>
                <button
                  onClick={() => setKassaOchiq(false)}
                  className="p-1.5 -mr-1.5 text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-800 rounded-lg transition"
                  aria-label="Yopish"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Aylanadigan tana. Pastki bo'shliq — iPhone'dagi uy
                chizig'i uchun: "To'lash" tugmasi uning ostida qolmasin. */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-0 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-0">
              <div className="flex flex-col gap-3 relative">
                <button
                  onClick={() => setKassaOchiq(false)}
                  className="hidden sm:flex absolute -top-2 -right-2 z-10 w-8 h-8 items-center justify-center rounded-full bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 shadow transition"
                  title="Yopish"
                >
                  <X size={16} />
                </button>
                {savatPaneli}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mijoz ma'lumotlari modal — har bir sotuvda so'raladi */}
      {mijozModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl dark:border dark:border-neutral-800 w-full max-w-sm">
            <div className="p-5 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-gray-900 dark:text-gray-100 font-semibold">Mijoz ma&apos;lumotlari</h3>
              <button onClick={() => setMijozModal(false)} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={mijozTasdiqlaVaYubor} className="p-5 space-y-4">
              <div className="relative">
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Telefon raqam *</label>
                <PhoneInput
                  value={mijozTelefon}
                  onChange={v => { setMijozTelefon(v); setMijozLokatsiya(null); setTelefonTaklifOchiq(true) }}
                  onFocus={() => setTelefonTaklifOchiq(true)}
                  onBlur={() => setTimeout(() => setTelefonTaklifOchiq(false), 150)}
                  required
                />
                {telefonTaklifOchiq && telefonTaklifi.length > 0 && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl shadow-lg overflow-hidden">
                    {telefonTaklifi.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onMouseDown={() => mijozTanlash(m)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-neutral-700 transition flex items-center justify-between gap-2"
                      >
                        <span className="text-gray-900 dark:text-gray-100 text-sm font-medium truncate">{m.ism}</span>
                        <span className="text-gray-400 dark:text-gray-500 text-xs shrink-0">{m.telefon}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Ism *</label>
                <input
                  value={mijozIsmi}
                  onChange={e => { setMijozIsmi(e.target.value); setMijozLokatsiya(null); setIsmTaklifOchiq(true) }}
                  onFocus={() => setIsmTaklifOchiq(true)}
                  onBlur={() => setTimeout(() => setIsmTaklifOchiq(false), 150)}
                  required
                  autoFocus={false}
                  className={inputCls}
                />
                {ismTaklifOchiq && ismTaklifi.length > 0 && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl shadow-lg overflow-hidden">
                    {ismTaklifi.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onMouseDown={() => mijozTanlash(m)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-neutral-700 transition flex items-center justify-between gap-2"
                      >
                        <span className="text-gray-900 dark:text-gray-100 text-sm font-medium truncate">{m.ism}</span>
                        <span className="text-gray-400 dark:text-gray-500 text-xs shrink-0">{m.telefon}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Manzil</label>
                <input value={mijozManzil} onChange={e => setMijozManzil(e.target.value)} placeholder="Ixtiyoriy" className={inputCls} />
              </div>
              {mijozLokatsiya && (
                <a
                  href={`https://www.google.com/maps?q=${mijozLokatsiya.lat},${mijozLokatsiya.lng}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 bg-primary-light dark:bg-primary/10 text-primary rounded-xl text-sm font-medium hover:underline w-fit"
                >
                  <MapPin size={14} /> Mijozning GPS joylashuvi — xaritada ko&apos;rish
                </a>
              )}
              <div className="flex gap-3">
                <button type="button" onClick={() => setMijozModal(false)} className="flex-1 py-2.5 border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition font-medium">
                  Bekor
                </button>
                <button type="submit" disabled={mijozAniqlanmoqda} className="flex-1 py-2.5 bg-pos-pay hover:bg-pos-pay-hover disabled:opacity-60 text-white rounded-xl font-medium transition flex items-center justify-center gap-2">
                  {mijozAniqlanmoqda ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                  {mijozAniqlanmoqda ? 'Sotilmoqda...' : 'Sotish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Chek modal */}
      {chekModal && oxirgiSotuv && (() => {
        const s = oxirgiSotuv
        const dokonNomi = t(dokonInfo.dokon_nomi || "Do'kon")
        const manzil = t(dokonInfo.manzil || '')
        const tel = dokonInfo.telefon || ''
        const chekMatn = t(dokonInfo.chek_matn || '')
        const kassirTel = s.kassir?.telefon || ''

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl dark:border dark:border-neutral-800 w-full max-w-sm overflow-hidden">
              <div className="bg-pos-pay px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-7 h-7 text-white shrink-0" />
                  <div>
                    <p className="text-white font-bold">{t('Sotuv amalga oshdi')}!</p>
                    <p className="text-white/75 text-xs font-mono">{s.chekRaqami}</p>
                  </div>
                </div>
                <button
                  onClick={() => setTil(til === 'lotin' ? 'kirill' : 'lotin')}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-medium transition"
                >
                  <Languages size={14} />
                  {til === 'lotin' ? 'Кирилл' : 'Lotin'}
                </button>
              </div>

              <div className="chek-print bg-white max-h-[55vh] overflow-y-auto" style={{ fontFamily: "'Courier New', Consolas, monospace", fontSize: 12, color: '#000', width: '100%', padding: '12px 16px' }}>
                <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 14, marginBottom: 2 }}>{dokonNomi}</div>
                {manzil && <div style={{ textAlign: 'center', fontSize: 11, marginBottom: 1 }}>{manzil}</div>}
                {tel && <div style={{ textAlign: 'center', fontSize: 11 }}>Tel: {tel}</div>}
                <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
                <div>{t('Chek')}: {s.chekRaqami}</div>
                <div>{t('Sana')}: {formatSanaVaVaqt(s.sana)}</div>
                {kassirTel && <div>{t('Kassir tel')}: {kassirTel}</div>}
                <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
                {s.tarkiblar?.map(item => {
                  const bonusmi = Number(item.birlikNarxi) === 0
                  return (
                  <div key={item.id} style={{ marginBottom: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ flex: 1 }}>
                        {t(item.tovar?.nomi || '—')}
                        {bonusmi && <span style={{ fontSize: 10, fontWeight: 'normal', color: '#8b5cf6', marginLeft: 4 }}>({t('Bonus')})</span>}
                      </span>
                    </div>
                    {bonusmi ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8b5cf6' }}>
                        <span>{Number(item.miqdor)} × {t('Bepul')}</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#555' }}>{Number(item.miqdor)} × {formatSum(item.birlikNarxi)}</span>
                        <span style={{ fontWeight: 'bold' }}>{formatSum(item.jami)}</span>
                      </div>
                    )}
                  </div>
                  )
                })}
                <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
                {Number(s.chegirma) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{t('Chegirma')} ({Math.round((Number(s.chegirma) / (Number(s.chegirma) + Number(s.yakuniySumma))) * 100)}%):</span><span>-{formatSum(s.chegirma)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: 13 }}>
                  <span>{t('JAMI')}:</span><span>{formatSum(s.yakuniySumma)}</span>
                </div>
                <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
                {s.tolovUsuli === 'ARALASH' ? (
                  <>
                    {tolovKanallari(s).map(kanal => (
                      <div key={kanal.usul} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{tolovQisqa(kanal.usul, til)}:</span><span>{formatSum(kanal.summa)}</span>
                      </div>
                    ))}
                  </>
                ) : s.tolovUsuli === 'NASIYA' ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t("To'lov")}:</span><span>{t('Nasiya')}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Mijoz')}:</span><span>{t(s.mijoz?.ism || '—')}</span></div>
                  </>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{t("To'lov")}:</span><span>{tolovLabel(s.tolovUsuli, til)}</span>
                  </div>
                )}
                {chekMatn && (
                  <>
                    <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
                    <div style={{ textAlign: 'center', fontSize: 11 }}>{chekMatn}</div>
                  </>
                )}
                <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
                <div style={{ textAlign: 'center', fontSize: 11 }}>{t('Rahmat')}!</div>
              </div>

              <div className="p-4 space-y-2">
                {/* Chek linki */}
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-neutral-800 rounded-xl">
                  <Link2 size={14} className="text-gray-400 shrink-0" />
                  <input
                    readOnly
                    value={`${window.location.origin}/chek/${encodeURIComponent(s.chekRaqami)}`}
                    className="flex-1 bg-transparent text-xs text-gray-600 dark:text-gray-400 font-mono outline-none select-all"
                    onClick={e => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/chek/${encodeURIComponent(s.chekRaqami)}`
                      navigator.clipboard.writeText(url).then(() => toast.success('Link nusxalandi!'))
                    }}
                    className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg transition font-medium"
                  >
                    Nusxalash
                  </button>
                  {typeof navigator !== 'undefined' && navigator.share && (
                    <button
                      onClick={() => {
                        navigator.share({
                          title: `Chek ${s.chekRaqami}`,
                          url: `${window.location.origin}/chek/${encodeURIComponent(s.chekRaqami)}`,
                        }).catch(() => {})
                      }}
                      className="p-1 text-gray-400 hover:text-blue-600 transition"
                    >
                      <Share2 size={14} />
                    </button>
                  )}
                </div>

                {/* Telegramga yuborish — mijoz bog'langan bo'lsagina.
                    Xabar avtomatik ketmaydi: kassir kerak deb hisoblasa
                    shu tugma bilan o'zi jo'natadi. */}
                {s.mijoz && (
                  <button
                    onClick={chekniTelegramgaYubor}
                    disabled={chekYuborish !== 'tayyor'}
                    className={`w-full py-2.5 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 mb-2 ${
                      chekYuborish === 'yuborildi'
                        ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900/50'
                        : 'bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white'
                    }`}
                  >
                    {chekYuborish === 'ketmoqda' ? (
                      <><Loader2 size={15} className="animate-spin" /> Yuborilmoqda...</>
                    ) : chekYuborish === 'yuborildi' ? (
                      <><CheckCircle size={15} /> {s.mijoz.ism} ga yuborildi</>
                    ) : (
                      <><Send size={15} /> {s.mijoz.ism} ga Telegramga yuborish</>
                    )}
                  </button>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => chekChopEtish(s)}
                    className="flex-1 py-2 border border-gray-200 dark:border-neutral-700 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-neutral-800 transition flex items-center justify-center gap-1.5 text-gray-600 dark:text-gray-400"
                  >
                    <Printer size={14} />
                    {t('Chop etish')}
                  </button>
                  <button
                    onClick={() => chekPdfYuklash(s)}
                    className="flex-1 py-2 border border-gray-200 dark:border-neutral-700 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-neutral-800 transition flex items-center justify-center gap-1.5 text-gray-600 dark:text-gray-400"
                  >
                    <Download size={14} />
                    PDF
                  </button>
                  <button
                    onClick={() => setChekModal(false)}
                    className="flex-1 py-2 bg-pos-pay hover:bg-pos-pay-hover text-white rounded-xl text-sm transition font-medium"
                  >
                    {t('Yopish')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Saqlangan savatlar modal */}
      {/* Zakazni saqlash — mijoz va izoh so'raladi */}
      {saqlashModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl dark:border dark:border-neutral-800 w-full max-w-sm">
            <div className="p-4 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Archive size={18} className="text-emerald-600" />
                <h3 className="text-gray-900 dark:text-gray-100 font-semibold">Zakazni saqlab qo&apos;yish</h3>
              </div>
              <button onClick={() => setSaqlashModal(false)} className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between text-sm bg-gray-50 dark:bg-neutral-800/60 rounded-xl px-3 py-2">
                <span className="text-gray-500 dark:text-gray-400">{savat.length} ta mahsulot</span>
                <span className="text-gray-900 dark:text-gray-100 font-semibold">{formatSum(jamiSumma)}</span>
              </div>

              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">
                  Mijoz <span className="text-gray-400 font-normal">(ixtiyoriy)</span>
                </label>
                <Combobox
                  options={mijozlar.map(m => ({
                    value: m.id,
                    label: m.telefon ? `${m.ism} — ${formatPhone(m.telefon)}` : m.ism,
                  }))}
                  value={zakazMijozId}
                  onChange={setZakazMijozId}
                  placeholder="Mijozni tanlang"
                  searchPlaceholder="Ism yoki telefon..."
                />
              </div>

              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">
                  Izoh <span className="text-gray-400 font-normal">(kimga va nima uchun)</span>
                </label>
                <textarea
                  value={zakazIzoh}
                  onChange={e => setZakazIzoh(e.target.value)}
                  rows={3}
                  autoFocus
                  placeholder="masalan: Aziz akaga to'y uchun, juma kuni oladi"
                  className={`${inputCls} resize-none`}
                />
                <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                  Bu izoh saqlangan zakazlar ro&apos;yxatida ko&apos;rinib turadi.
                </p>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setSaqlashModal(false)}
                  className="flex-1 py-2.5 border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition font-medium">
                  Bekor
                </button>
                <button
                  type="button"
                  onClick={zakazniSaqlash}
                  disabled={zakazSaqlanmoqda}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-xl font-medium transition flex items-center justify-center gap-2"
                >
                  {zakazSaqlanmoqda ? <Loader2 size={16} className="animate-spin" /> : <Archive size={16} />}
                  Saqlash
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {saqlanganiModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl dark:border dark:border-neutral-800 w-full max-w-md max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Archive size={18} className="text-violet-600" />
                <h3 className="text-gray-900 dark:text-gray-100 font-semibold">Saqlangan zakazlar</h3>
              </div>
              <button onClick={() => setSaqlanganiModal(false)} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[70vh]">
              {zakazlarYuklanmoqda ? (
                <div className="p-8 flex justify-center"><Loader2 size={20} className="animate-spin text-violet-600" /></div>
              ) : saqlanganiSavatlar.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">Saqlangan zakaz yo&apos;q</div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                  {saqlanganiSavatlar.map(zakaz => (
                    <div key={zakaz.id} className="p-3 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {/* Mijoz — kimga yig'ilgani birinchi o'rinda */}
                          {zakaz.mijoz ? (
                            <p className="text-gray-900 dark:text-gray-100 font-semibold text-sm truncate">
                              {zakaz.mijoz.ism}
                              {zakaz.mijoz.telefon && (
                                <span className="text-gray-500 dark:text-gray-400 font-normal ml-1.5 text-xs">
                                  {formatPhone(zakaz.mijoz.telefon)}
                                </span>
                              )}
                            </p>
                          ) : (
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Mijoz ko&apos;rsatilmagan</p>
                          )}
                          <p className="text-gray-500 dark:text-gray-400 text-[11px] mt-0.5">
                            {formatSanaVaVaqt(zakaz.yaratilgan)}
                            {zakaz.sotuvchi && ` · ${zakaz.sotuvchi.ism}`}
                          </p>
                          <p className="text-green-600 font-bold text-sm mt-0.5">{formatSum(zakaz.jamiSumma)}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => zakazniYuklash(zakaz)}
                            className="px-2.5 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs rounded-lg transition font-medium flex items-center gap-1"
                          >
                            <Play size={12} />
                            Davom ettirish
                          </button>
                          <button
                            onClick={() => zakazniOchirish(zakaz.id)}
                            className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-500 rounded-lg transition"
                            title="O&apos;chirish"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Izoh — nima uchun yig'ilgani. Ko'zga tashlanib tursin. */}
                      {zakaz.izoh && (
                        <p className="mt-2 text-xs text-amber-800 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-lg px-2.5 py-1.5">
                          {zakaz.izoh}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-1 mt-2">
                        {zakaz.tarkiblar.map(item => (
                          <span key={item.id} className="text-[11px] bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded">
                            {item.tovar.nomi} ×{Number(item.miqdor)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Qaytarish modal */}
      {qaytarishModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl dark:border dark:border-neutral-800 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw size={18} className="text-amber-600" />
                <h3 className="text-gray-900 dark:text-gray-100 font-semibold">Qaytarish</h3>
              </div>
              <button onClick={() => setQaytarishModal(false)} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Chek tanlash */}
              {!qaytarishSotuv && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-gray-700 dark:text-gray-300 text-sm font-medium">Chekni tanlang</label>
                    {sotuvlarYuklanmoqda && <Loader2 size={14} className="animate-spin text-gray-400" />}
                  </div>
                  <input
                    value={sotuvQidiruv}
                    onChange={e => setSotuvQidiruv(e.target.value)}
                    placeholder="Chek raqami yoki mijoz nomi..."
                    className={`${inputCls} mb-2`}
                  />
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {sotuvlarRoyxati
                      .filter(s =>
                        !sotuvQidiruv ||
                        s.chekRaqami.toLowerCase().includes(sotuvQidiruv.toLowerCase()) ||
                        (s.mijoz?.ism?.toLowerCase().includes(sotuvQidiruv.toLowerCase()))
                      )
                      .map(s => (
                        <button
                          key={s.id}
                          onClick={() => sotuvTanlash(s)}
                          className="w-full text-left px-3 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-gray-900 dark:text-gray-100 text-sm font-medium truncate">{s.chekRaqami}</span>
                            <span className="text-green-600 text-sm font-bold shrink-0">{formatSum(s.yakuniySumma)}</span>
                          </div>
                          <div className="flex items-center justify-between mt-1 gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-gray-500 dark:text-gray-400 text-xs truncate">{formatSanaVaVaqt(s.sana)}</span>
                              {s.mijoz && <span className="text-gray-500 dark:text-gray-400 text-xs truncate">• {s.mijoz.ism}</span>}
                            </div>
                            <span className={`text-[11px] px-2 py-0.5 rounded-md shrink-0 ${tolovBadge(s.tolovUsuli)}`}>
                              {tolovQisqa(s.tolovUsuli)}
                            </span>
                          </div>
                        </button>
                      ))
                    }
                    {!sotuvlarYuklanmoqda && sotuvlarRoyxati.length === 0 && (
                      <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">Sotuvlar topilmadi</p>
                    )}
                  </div>
                </div>
              )}

              {/* Tanlangan sotuv */}
              {qaytarishSotuv && (
                <>
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl p-3 text-sm">
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-gray-900 dark:text-gray-100 truncate">{qaytarishSotuv.chekRaqami}</span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-md shrink-0 ${tolovBadge(qaytarishSotuv.tolovUsuli)}`}>
                          {tolovQisqa(qaytarishSotuv.tolovUsuli)}
                        </span>
                      </div>
                      <button
                        onClick={() => setQaytarishSotuv(null)}
                        className="text-xs text-amber-600 hover:text-amber-800 dark:text-amber-400 hover:underline shrink-0"
                      >
                        ← Orqaga
                      </button>
                    </div>
                    <div className="flex justify-between text-gray-500 dark:text-gray-400">
                      <span>Sana:</span><span>{formatSanaVaVaqt(qaytarishSotuv.sana)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500 dark:text-gray-400">
                      <span>Jami:</span><span className="text-green-600 font-bold">{formatSum(qaytarishSotuv.yakuniySumma)}</span>
                    </div>
                    {qaytarishSotuv.tolovUsuli === 'NASIYA' && qaytarishSotuv.mijoz && (
                      <div className="mt-1.5 pt-1.5 border-t border-amber-200 dark:border-amber-800/40 text-red-700 dark:text-red-400 text-xs font-medium">
                        Nasiyaga olingan — mijoz: {qaytarishSotuv.mijoz.ism}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-gray-700 dark:text-gray-300 text-sm font-medium">Qaytariladigan mahsulotlar:</p>
                    {qaytarishSotuv.tarkiblar.map(t => {
                      const sel = qaytarishTanlandan(t.tovarId)
                      return (
                        <div key={t.tovarId} className="border border-gray-200 dark:border-neutral-700 rounded-xl p-3">
                          <div className="flex items-center gap-3 mb-2">
                            <input
                              type="checkbox"
                              checked={sel.checked}
                              onChange={e => setQaytarishTanlangan(prev => ({
                                ...prev,
                                [t.tovarId]: { ...sel, checked: e.target.checked }
                              }))}
                              className="w-4 h-4 accent-red-600"
                            />
                            <span className="text-gray-900 dark:text-gray-100 text-sm font-medium flex-1">{t.tovar?.nomi || '—'}</span>
                            <span className="text-gray-500 dark:text-gray-400 text-xs">max: {Number(t.miqdor)}</span>
                          </div>
                          {sel.checked && (
                            <div className="grid grid-cols-2 gap-2 ml-7">
                              <div>
                                <label className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 block">Miqdor</label>
                                <input
                                  type="number"
                                  min={0.001}
                                  max={Number(t.miqdor)}
                                  step="any"
                                  value={sel.miqdor}
                                  onChange={e => setQaytarishTanlangan(prev => ({
                                    ...prev,
                                    [t.tovarId]: { ...sel, miqdor: parseFloat(e.target.value) || 0 }
                                  }))}
                                  onWheel={e => e.currentTarget.blur()}
                                  className={inputCls}
                                />
                              </div>
                              <div>
                                <label className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 block">
                                  Narx (sotuv narxi)
                                </label>
                                <div className="px-3 py-2 bg-gray-50 dark:bg-neutral-800/50 border border-gray-200 dark:border-neutral-700 rounded-xl text-gray-700 dark:text-gray-300 text-sm">
                                  {formatSum(Number(t.birlikNarxi))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <div>
                    <label className="text-gray-700 dark:text-gray-300 text-sm font-medium mb-1 block">Sabab (ixtiyoriy)</label>
                    <input
                      value={qaytarishSabab}
                      onChange={e => setQaytarishSabab(e.target.value)}
                      placeholder="Qaytarish sababi..."
                      className={inputCls}
                    />
                  </div>

                  <div className="flex gap-3">
                    <button type="button" onClick={() => setQaytarishModal(false)}
                      className="flex-1 py-2.5 border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition font-medium">
                      Bekor qilish
                    </button>
                    <button type="button" onClick={qaytarishYuborish} disabled={qaytarishYuklanmoqda}
                      className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl font-medium transition flex items-center justify-center gap-2">
                      {qaytarishYuklanmoqda ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                      Qaytarish
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
