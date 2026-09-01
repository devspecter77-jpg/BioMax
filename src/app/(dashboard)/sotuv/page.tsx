'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { formatSum, formatNarx, formatSanaVaVaqt, playBeep, uzSearch } from '@/lib/utils'
import { buildChekHtml, chekChopEtish as printChek } from '@/lib/chek-print'
import { toast } from 'sonner'
import { Search, ShoppingCart, Trash2, CheckCircle, Printer, Download, RotateCcw, Clock, X, Loader2, AlertTriangle, Pencil, Pause, Play, Archive, Languages, ScanLine, Link2, Share2, Package, Plus, Gift, Percent } from 'lucide-react'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { jsPDF } from 'jspdf'
import Combobox from '@/components/ui/combobox'
import MoneyInput from '@/components/ui/money-input'
import PhoneInput from '@/components/ui/phone-input'

const TOLOV_USULI_BADGE: Record<string, { label: string; cls: string }> = {
  NAQD: { label: 'Naqd', cls: 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400' },
  KARTA: { label: 'Karta', cls: 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400' },
  ARALASH: { label: 'Aralash', cls: 'bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400' },
  NASIYA: { label: 'Nasiya', cls: 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 font-semibold' },
  SHERIK: { label: 'Sherik', cls: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400' },
}

interface Tovar {
  id: string; nomi: string; sotishNarxi: number; kelishNarxi: number | null
  optomNarxi?: number | null; bolishNarxi?: number | null
  birlik: string; qoldiq: number; shtrixKod: string | null
  rasmlar?: string[]; valyuta?: string; kategoriya?: { nomi: string }
}

type NarxTuri = 'sotish' | 'optom' | 'bolish'
const NARX_TURI_LABEL: Record<NarxTuri, string> = { sotish: 'Chakana', optom: 'Optom', bolish: "Bo'lish" }

// Mahsulot USD'da narxlangan bo'lsa, savatga qo'shishda joriy kurs bo'yicha
// so'mga o'giriladi — chek/hisobotlar hammasi so'mda bo'lishi shart.
function sotishNarxiSomda(tovar: Tovar, kursi: number): number {
  return tovar.valyuta === 'USD' ? Math.round(tovar.sotishNarxi * kursi) : tovar.sotishNarxi
}
// Tanlangan narx turi bo'yicha narxni tanlaydi — o'sha tur uchun mahsulotda
// narx kiritilmagan bo'lsa, oddiy sotish narxiga qaytadi.
function narxTuriBoyicha(tovar: Tovar, turi: NarxTuri, kursi: number): number {
  const asosiy = turi === 'optom' && tovar.optomNarxi != null ? tovar.optomNarxi
    : turi === 'bolish' && tovar.bolishNarxi != null ? tovar.bolishNarxi
    : tovar.sotishNarxi
  return tovar.valyuta === 'USD' ? Math.round(asosiy * kursi) : asosiy
}
interface Mijoz { id: string; ism: string; telefon: string | null; manzil?: string | null }
interface SavatItem {
  tovarId: string; nomi: string; birlikNarxi: number; miqdor: number; birlik: string; chegirma: number; jami: number; mavjudQoldiq: number; bonus?: boolean
  narxTuri?: NarxTuri
}
interface SaqlanganiSavat {
  id: string; savat: SavatItem[]; sana: string; jami: number
}

function MiqdorInput({ miqdor, max, onChange }: { miqdor: number; max: number; onChange: (v: number) => void }) {
  const [matn, setMatn] = useState(String(miqdor))

  useEffect(() => {
    setMatn(String(miqdor))
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

const TOLOV_USULLARI = [
  { value: 'NAQD', label: 'Naqd pul' },
  { value: 'KARTA', label: 'Bank kartasi' },
  { value: 'ARALASH', label: 'Aralash' },
  { value: 'NASIYA', label: 'Nasiya' },
]

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
  const [tovarlarYuklanmoqda, setTovarlarYuklanmoqda] = useState(true)
  const [tovarlarXato, setTovarlarXato] = useState<string | null>(null)
  const [mijozlar, setMijozlar] = useState<Mijoz[]>([])
  const [savat, setSavat] = useState<SavatItem[]>([])
  const [qidiruv, setQidiruv] = useState('')
  const [tolovUsuli, setTolovUsuli] = useState('NAQD')
  const [naqdTolangan, setNaqdTolangan] = useState('')
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
  const [oxirgiSotuv, setOxirgiSotuv] = useState<any>(null)
  const [dokonInfo, setDokonInfo] = useState<Record<string, string>>({})
  const [editNarx, setEditNarx] = useState<{ tovarId: string; val: string } | null>(null)
  const [mobileTab, setMobileTab] = useState<'tovarlar' | 'savat'>('tovarlar')

  // Mijoz ma'lumotlari (har bir sotuvda so'raladi)
  const [mijozModal, setMijozModal] = useState(false)
  const [mijozTelefon, setMijozTelefon] = useState('')
  const [mijozIsmi, setMijozIsmi] = useState('')
  const [mijozManzil, setMijozManzil] = useState('')
  const [mijozAniqlanmoqda, setMijozAniqlanmoqda] = useState(false)
  const [telefonTaklifOchiq, setTelefonTaklifOchiq] = useState(false)
  const [ismTaklifOchiq, setIsmTaklifOchiq] = useState(false)

  // Qaytarish
  const [qaytarishModal, setQaytarishModal] = useState(false)
  const [qaytarishSotuv, setQaytarishSotuv] = useState<any>(null)
  const [qaytarishTanlangan, setQaytarishTanlangan] = useState<Record<string, { miqdor: number; birlikNarxi: number; checked: boolean }>>({})
  const [qaytarishSabab, setQaytarishSabab] = useState('')
  const [qaytarishYuklanmoqda, setQaytarishYuklanmoqda] = useState(false)
  const [sotuvlarRoyxati, setSotuvlarRoyxati] = useState<any[]>([])
  const [sotuvlarYuklanmoqda, setSotuvlarYuklanmoqda] = useState(false)
  const [sotuvQidiruv, setSotuvQidiruv] = useState('')

  // Til (lotin / kirill)
  const [til, setTil] = useState<'lotin' | 'kirill'>('lotin')
  const [logoBase64, setLogoBase64] = useState<string>('')

  // Barcode skaner
  const [skanerOchiq, setSkanerOchiq] = useState(false)
  const skanerRef = useRef<any>(null)
  const oxirgiSkanRef = useRef<string>('')
  // Har doim oxirgi tovarlar ro'yxatini olish uchun ref
  const tovarlarRef = useRef<Tovar[]>([])
  const savatQoshRef = useRef<(t: Tovar) => void>(() => {})

  const skanerniYopish = useCallback(() => {
    const s = skanerRef.current
    if (s) {
      s.isScanning && s.stop().then(() => s.clear()).catch(() => {})
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
    const n = kod.trim()
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
      } catch (err) {
        toast.error('Kamera ochilmadi')
        setSkanerOchiq(false)
      }
    }, 100)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Saqlangan savatlar
  const [saqlanganiSavatlar, setSaqlanganiSavatlar] = useState<SaqlanganiSavat[]>([])
  const [saqlanganiModal, setSaqlanganiModal] = useState(false)
  useBodyScrollLock(mijozModal || chekModal || saqlanganiModal || qaytarishModal)

  const tovarlarniYuklash = useCallback(async () => {
    setTovarlarYuklanmoqda(true)
    setTovarlarXato(null)
    try {
      const r = await fetch('/api/tovarlar')
      if (!r.ok) {
        const errBody = await r.json().catch(() => ({}))
        throw new Error(errBody.xato || `Server xatosi (${r.status})`)
      }
      const tv = await r.json()
      setTovarlar(Array.isArray(tv.tovarlar) ? tv.tovarlar : [])
    } catch (e: any) {
      setTovarlarXato(e?.message || 'Tovarlarni yuklashda xato')
      toast.error(e?.message || 'Tovarlarni yuklab bo\'lmadi')
    } finally {
      setTovarlarYuklanmoqda(false)
    }
  }, [])

  useEffect(() => {
    async function yuklashQoshimcha() {
      try {
        const [mj, sz] = await Promise.all([
          fetch('/api/mijozlar').then(r => r.json()).catch(() => []),
          fetch('/api/sozlamalar').then(r => r.json()).catch(() => ({})),
        ])
        setMijozlar(Array.isArray(mj) ? mj : [])
        setDokonInfo(sz && typeof sz === 'object' ? sz : {})
      } catch {
        // qo'shimcha ma'lumotlar muhim emas — sotuv ishlay beradi
      }
    }
    tovarlarniYuklash()
    yuklashQoshimcha()
    fetch('/api/kurs').then(r => r.json()).then(d => { if (d.kursi) setKursi(d.kursi) }).catch(() => {})
    const blobToBase64 = (url: string) =>
      fetch(url).then(r => r.blob()).then(blob => new Promise<string>(resolve => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      }))
    blobToBase64('/chek.png').then(setLogoBase64).catch(() => {})
    // Oxirgi sotuv localStorage dan yuklash
    const saved = localStorage.getItem('oxirgi-sotuv')
    if (saved) { try { setOxirgiSotuv(JSON.parse(saved)) } catch {} }
    // Saqlangan savatlarni yuklash
    const drafts = localStorage.getItem('saqlangan-savatlar')
    if (drafts) { try { setSaqlanganiSavatlar(JSON.parse(drafts)) } catch {} }
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
        if (p.naqdTolangan) setNaqdTolangan(p.naqdTolangan)
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
        tolovUsuli, mijozId, naqdTolangan, qolBilanSumma, nasiyaMuddat,
      }))
    } else {
      localStorage.removeItem('aktiv-tolov')
    }
  }, [savat.length, tolovUsuli, mijozId, naqdTolangan, qolBilanSumma, nasiyaMuddat])

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
    uzSearch(t.nomi, qidiruv) ||
    (t.shtrixKod && t.shtrixKod.includes(qidiruv))
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
  }

  // Skaner uchun har doim eng so'nggi tovarlar va savatQosh funksiyasi
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
    if (!isNaN(val) && val > 0) narxiOzgartir(tovarId, val)
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
  const yakuniySumma = (!isNaN(qolBilan) && qolBilan >= 0) ? Math.min(jamiSumma, qolBilan) : jamiSumma
  const chegirma = jamiSumma - yakuniySumma

  // Stock yetishmaydigan itemlarni tekshirish — bitta mahsulotdan oddiy va
  // bonus qatori bo'lishi mumkin, shuning uchun ikkalasi QO'SHIB tekshiriladi
  // (har biri alohida qoldiqdan oshmasa ham, birgalikda oshib ketishi mumkin).
  const jamiTalabMap = new Map<string, number>()
  for (const s of savat) jamiTalabMap.set(s.tovarId, (jamiTalabMap.get(s.tovarId) || 0) + s.miqdor)
  const ortiqchaTovarIdlar = new Set(
    savat.filter(s => (jamiTalabMap.get(s.tovarId) || 0) > s.mavjudQoldiq).map(s => s.tovarId)
  )
  const ortiqchaItemlar = savat.filter(s => ortiqchaTovarIdlar.has(s.tovarId))

  async function sotuvYakunla() {
    if (savat.length === 0) { toast.error('Savat bo\'sh!'); return }

    if (ortiqchaItemlar.length > 0) {
      const nomlar = Array.from(new Set(ortiqchaItemlar.map(i => i.nomi)))
      toast.error('Zaxira yetarli emas: ' + nomlar.join(', '))
      return
    }

    setMijozTelefon('')
    setMijozIsmi('')
    setMijozManzil('')
    setMijozModal(true)
  }

  // Telefon yoki ism bo'yicha mavjud mijozlarni filtrlab, tanlash uchun taklif ro'yxati.
  // Hech narsa kiritilmagan bo'lsa ham (default holat) mavjud mijozlar ko'rsatiladi.
  const telefonTaklifi = mijozTelefon.length >= 2
    ? mijozlar.filter(m => m.telefon && m.telefon.replace(/\D/g, '').includes(mijozTelefon)).slice(0, 5)
    : mijozlar.slice(0, 8)
  const ismTaklifi = mijozIsmi.trim().length >= 1
    ? mijozlar.filter(m => uzSearch(m.ism, mijozIsmi)).slice(0, 5)
    : mijozlar.slice(0, 8)

  function mijozTanlash(m: Mijoz) {
    const digits = (m.telefon || '').replace(/\D/g, '')
    setMijozTelefon(digits.length === 12 && digits.startsWith('998') ? digits.slice(3) : digits.slice(0, 9))
    setMijozIsmi(m.ism)
    setMijozManzil(m.manzil || '')
    setTelefonTaklifOchiq(false)
    setIsmTaklifOchiq(false)
    // Mijoz mavjudlar ro'yxatidan tanlangan zahoti eslatma — to'lov
    // tugagunicha kutmaydi, kassir hali qaror qabul qila oladigan paytda.
    mijozOldingiXaridlarniEslatish(m.id, m.ism, savat)
  }

  // Mijoz avval hozirgi savatdagi mahsulotlardan sotib olganmi — bo'lsa
  // kassirga eslatma (5 soniya turib o'zi yopiladi). Sotuvni to'xtatmaydi —
  // fon vazifasi, xato bo'lsa ham sokin o'tkazib yuboriladi.
  async function mijozOldingiXaridlarniEslatish(mijozId: string, mijozIsm: string, savatHozir: SavatItem[]) {
    try {
      const tarix: Record<string, { narx: number; sana: string }> = await fetch(`/api/mijozlar/${mijozId}/tarix`).then(r => r.json())
      const mosKelganlar = savatHozir.filter(item => tarix[item.tovarId] && !item.bonus)
      if (mosKelganlar.length === 0) return

      const matn = mosKelganlar.length === 1
        ? `${mijozIsm} avval "${mosKelganlar[0].nomi}"ni ${formatSum(tarix[mosKelganlar[0].tovarId].narx)}dan sotib olgan edi`
        : `${mijozIsm} avval bu mahsulotlarni ham olgan: ${mosKelganlar.slice(0, 3).map(i => i.nomi).join(', ')}${mosKelganlar.length > 3 ? ` va yana ${mosKelganlar.length - 3} ta` : ''}`

      toast(matn, { icon: '🔔', duration: 5000 })
    } catch {
      // eslatma ko'rsatilmasa ham sotuvga xalaqit bermaydi
    }
  }

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
    const naqdQ = tolovUsuli === 'NAQD' ? yakuniySumma : (tolovUsuli === 'ARALASH' ? parseFloat(naqdTolangan || '0') : 0)
    const kartaQ = tolovUsuli === 'KARTA' ? yakuniySumma : (tolovUsuli === 'ARALASH' ? (yakuniySumma - parseFloat(naqdTolangan || '0')) : 0)

    const body: any = {
      mijozId: aniqMijozId || mijozId || null,
      jamiSumma,
      chegirma,
      yakuniySumma,
      tolovUsuli,
      naqdTolangan: naqdQ,
      kartaTolangan: kartaQ,
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
      localStorage.setItem('oxirgi-sotuv', JSON.stringify(sotuv))
      setChekModal(true)
      setSavat([])
      setMijozId('')
      setNaqdTolangan('')
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

  async function sotuvlarYuklash() {
    setSotuvlarYuklanmoqda(true)
    const res = await fetch('/api/sotuvlar?limit=50')
    const data = await res.json()
    setSotuvlarRoyxati(data.sotuvlar || [])
    setSotuvlarYuklanmoqda(false)
  }

  function sotuvTanlash(sotuv: any) {
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
      .filter((t: any) => qaytarishTanlangan[t.tovarId]?.checked)
      .map((t: any) => {
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

  function savatniSaqlash() {
    if (savat.length === 0) { toast.error('Savat bo\'sh!'); return }
    const yangi: SaqlanganiSavat = {
      id: Date.now().toString(),
      savat: [...savat],
      sana: new Date().toISOString(),
      jami: savat.reduce((s, i) => s + i.miqdor * i.birlikNarxi, 0),
    }
    const yangilangan = [...saqlanganiSavatlar, yangi]
    setSaqlanganiSavatlar(yangilangan)
    localStorage.setItem('saqlangan-savatlar', JSON.stringify(yangilangan))
    setSavat([])
    setMijozId('')
    setNaqdTolangan('')
    setQolBilanSumma('')
    setChegirmaFoizOchiq(false)
    setChegirmaFoiz('')
    setBonusTanlashRejimi(false)
    setTolovUsuli('NAQD')
    toast.success('Savat saqlandi!')
  }

  function savatniYuklash(draft: SaqlanganiSavat) {
    if (savat.length > 0) {
      // Hozirgi savatni avval saqlaymiz
      const hozirgi: SaqlanganiSavat = {
        id: Date.now().toString(),
        savat: [...savat],
        sana: new Date().toISOString(),
        jami: savat.reduce((s, i) => s + i.miqdor * i.birlikNarxi, 0),
      }
      const yangilangan = [...saqlanganiSavatlar.filter(d => d.id !== draft.id), hozirgi]
      setSaqlanganiSavatlar(yangilangan)
      localStorage.setItem('saqlangan-savatlar', JSON.stringify(yangilangan))
    } else {
      const yangilangan = saqlanganiSavatlar.filter(d => d.id !== draft.id)
      setSaqlanganiSavatlar(yangilangan)
      localStorage.setItem('saqlangan-savatlar', JSON.stringify(yangilangan))
    }
    // Qoldiq ma'lumotlarni yangilash
    const yangiSavat = draft.savat.map(item => {
      const tovar = tovarlar.find(t => t.id === item.tovarId)
      return tovar ? { ...item, mavjudQoldiq: tovar.qoldiq } : item
    })
    setSavat(yangiSavat)
    setSaqlanganiModal(false)
    setMobileTab('savat')
    toast.success('Savat yuklandi!')
  }

  function saqlanganiOchirish(id: string) {
    const yangilangan = saqlanganiSavatlar.filter(d => d.id !== id)
    setSaqlanganiSavatlar(yangilangan)
    localStorage.setItem('saqlangan-savatlar', JSON.stringify(yangilangan))
  }

  // Til bo'yicha matn tarjima qilish
  const t = (text: string) => til === 'kirill' ? kirill(text) : text

  function chekHtml(s: any) {
    return buildChekHtml({
      data: s,
      dokonInfo,
      til,
      fontSize: 11,
    })
  }

  function chekChopEtish(s: any) {
    printChek(chekHtml(s))
  }

  function chekPdfYuklash(s: any) {
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
      doc.text(t('Naqd') + ':', mx, y)
      doc.text(formatSum(s.naqdTolangan), w - mx, y, { align: 'right' })
      y += 4
      doc.text(t('Karta') + ':', mx, y)
      doc.text(formatSum(s.kartaTolangan), w - mx, y, { align: 'right' })
      y += 4
    } else if (s.tolovUsuli === 'NASIYA') {
      doc.text(t("To'lov") + ':', mx, y)
      doc.text(t('Nasiya'), w - mx, y, { align: 'right' })
      y += 4
      doc.text(t('Mijoz') + ':', mx, y)
      doc.text(t(s.mijoz?.ism || '—'), w - mx, y, { align: 'right' })
      y += 4
    } else {
      doc.text(t("To'lov") + ':', mx, y)
      doc.text(s.tolovUsuli === 'KARTA' ? t('Karta') : t('Naqd pul'), w - mx, y, { align: 'right' })
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

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:h-full">
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
        <div className="flex gap-2">
          <button
            onClick={skanerOchiq ? skanerniYopish : skanerniOchish}
            className={`shrink-0 p-2.5 rounded-xl border transition ${skanerOchiq ? 'bg-pos border-pos text-white' : 'bg-white dark:bg-neutral-900 border-gray-300 dark:border-neutral-700 text-gray-500 dark:text-gray-400 hover:border-pos/50 hover:text-pos'}`}
            title="Skaner"
          >
            <ScanLine size={18} />
          </button>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-600" size={16} />
            <input
              value={qidiruv}
              onChange={e => setQidiruv(e.target.value)}
              placeholder="Tovar qidirish yoki shtrix-kod..."
              className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-pos"
            />
          </div>
        </div>
        {/* Narx turi — savatga yangi qo'shiladigan mahsulotlar shu narx bilan hisoblanadi */}
        <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-neutral-800 rounded-xl p-1 w-fit">
          {(['sotish', 'optom', 'bolish'] as NarxTuri[]).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setNarxTuri(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${narxTuri === t ? 'bg-white dark:bg-neutral-700 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
              {NARX_TURI_LABEL[t]}
            </button>
          ))}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
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
                  {savatdagi > 0 && (
                    <span className="absolute top-2 left-2 z-10 bg-pos text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow">
                      {savatdagi}
                    </span>
                  )}
                  <div className="aspect-[4/3] bg-gradient-to-br from-pos-light to-white dark:from-pos/15 dark:to-neutral-800 flex items-center justify-center relative overflow-hidden">
                    {t.kategoriya && (
                      <span className={`absolute ${savatdagi > 0 ? 'left-9' : 'left-2'} top-2 z-10 text-[11px] bg-pos text-white px-2.5 py-1 rounded-full font-semibold shadow-sm max-w-[55%] truncate`} title={t.kategoriya.nomi}>
                        {t.kategoriya.nomi}
                      </span>
                    )}
                    {t.rasmlar?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.rasmlar[0]} alt={t.nomi} className="w-full h-full object-cover" />
                    ) : (
                      <Package size={56} className="text-pos/60 group-hover:text-pos group-hover:scale-110 transition-all" />
                    )}
                    <span className={`absolute top-2 right-2 text-xs px-2 py-1 rounded-lg font-semibold shadow-sm ${
                      tugagan ? 'bg-red-500 text-white' : kamQoldi ? 'bg-amber-500 text-white' : 'bg-white/90 dark:bg-neutral-900/80 text-gray-600 dark:text-gray-300'
                    }`}>
                      {tugagan ? 'Tugagan' : `${t.qoldiq} ${t.birlik.toLowerCase()}`}
                    </span>
                  </div>
                  <div className="p-4">
                    <p className="text-gray-900 dark:text-gray-100 text-lg font-semibold leading-tight line-clamp-2 min-h-[2.6em]">{t.nomi}</p>
                    <p className="text-gray-400 dark:text-gray-600 text-xs mt-0.5">Mahsulot kodi: #{(t.shtrixKod || '').padStart(3, '0') || '—'}</p>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-center bg-gray-50 dark:bg-neutral-900/60 rounded-xl py-2.5">
                      <div>
                        <p className="text-gray-400 dark:text-gray-600 text-[11px]">Miqdori</p>
                        <p className={`font-bold text-sm mt-0.5 ${kamQoldi ? 'text-amber-600' : 'text-gray-900 dark:text-gray-100'}`}>
                          {t.qoldiq} {t.birlik.toLowerCase()}
                        </p>
                      </div>
                      <div className="border-x border-gray-200 dark:border-neutral-700">
                        <p className="text-gray-400 dark:text-gray-600 text-[11px]">Kelish</p>
                        <p className="text-gray-700 dark:text-gray-300 font-medium text-sm mt-0.5">
                          {t.kelishNarxi === null ? '—' : formatNarx(t.kelishNarxi, t.valyuta)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 dark:text-gray-600 text-[11px]">Sotish</p>
                        <p className="text-pos font-bold text-sm mt-0.5">{formatNarx(t.sotishNarxi, t.valyuta)}</p>
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
          )}
        </div>
      </div>

      {/* O'ng: Savat */}
      <div className={`lg:w-96 flex flex-col gap-3 lg:flex ${mobileTab === 'savat' ? 'flex' : 'hidden'}`}>
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl flex-1 min-h-0">
          <div className="p-3 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart size={16} className="text-gray-500 dark:text-gray-500" />
              <h2 className="text-gray-900 dark:text-gray-100 font-semibold text-sm">Savat ({savat.length})</h2>
            </div>
            <div className="flex items-center gap-1">
              {savat.length > 0 && (
                <button
                  onClick={savatniSaqlash}
                  className="p-1.5 text-gray-400 dark:text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950 rounded-lg transition"
                  title="Savatni saqlash"
                >
                  <Pause size={15} />
                </button>
              )}
              {saqlanganiSavatlar.length > 0 && (
                <button
                  onClick={() => setSaqlanganiModal(true)}
                  className="relative p-1.5 text-gray-400 dark:text-gray-600 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950 rounded-lg transition"
                  title="Saqlangan savatlar"
                >
                  <Archive size={15} />
                  <span className="absolute -top-1 -right-1 bg-violet-600 text-white text-[9px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">{saqlanganiSavatlar.length}</span>
                </button>
              )}
              {oxirgiSotuv && (
                <button
                  onClick={() => setChekModal(true)}
                  className="p-1.5 text-gray-400 dark:text-gray-600 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg transition"
                  title="Oxirgi chek"
                >
                  <Clock size={15} />
                </button>
              )}
              <button
                onClick={() => { setQaytarishModal(true); setQaytarishSotuv(null); setSotuvQidiruv(''); sotuvlarYuklash() }}
                className="p-1.5 text-gray-400 dark:text-gray-600 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950 rounded-lg transition"
                title="Qaytarish"
              >
                <RotateCcw size={15} />
              </button>
              {savat.length > 0 && (
                <button onClick={() => setSavat([])} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition">
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>

          {savat.length === 0 ? (
            <div className="p-8 text-center text-gray-400 dark:text-gray-600">
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
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 px-1.5 py-0.5 rounded-full shrink-0">
                          <Gift size={9} /> Bonus
                        </span>
                      )}
                      {!item.bonus && item.narxTuri && item.narxTuri !== 'sotish' && (
                        <span className="inline-flex items-center text-[10px] font-semibold bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full shrink-0">
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
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition ${
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
                    <span className="text-gray-400 dark:text-gray-600 text-xs shrink-0">×</span>
                    <MiqdorInput miqdor={item.miqdor} max={item.mavjudQoldiq} onChange={v => miqdorOzgartir(item.tovarId, item.bonus, v)} />
                    <span className="text-gray-400 dark:text-gray-600 text-xs shrink-0">=</span>
                    <span className={`text-sm font-bold shrink-0 min-w-[65px] text-right ${item.bonus ? 'text-violet-600 dark:text-violet-400' : 'text-green-600'}`}>{item.bonus ? 'Bepul' : formatSum(item.jami)}</span>
                  </div>
                  {ortiqchaTovarIdlar.has(item.tovarId) && (
                    <div className="flex items-center gap-1 mt-1.5 text-amber-600 dark:text-amber-400">
                      <AlertTriangle size={11} />
                      <span className="text-[10px]">Qoldiq: {item.mavjudQoldiq}, yetarli emas!</span>
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
            <div className="flex justify-between text-sm text-gray-500 dark:text-gray-500">
              <span>Hisoblangan jami:</span>
              <span className="text-gray-900 dark:text-gray-100 font-medium">{formatSum(jamiSumma)}</span>
            </div>

            {/* Umumiy summa o'zgartirish */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-500 shrink-0">Yakuniy summa:</span>
              <input
                type="text"
                inputMode="numeric"
                value={qolBilanSumma}
                onChange={e => setQolBilanSumma(e.target.value.replace(/[^\d]/g, ''))}
                placeholder={String(Math.round(jamiSumma))}
                className="flex-1 px-2 py-1 text-sm text-right bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-pos text-gray-900 dark:text-gray-100 font-medium"
              />
            </div>

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
                  <Percent size={12} className="text-gray-400 dark:text-gray-600 shrink-0" />
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
                  <span className="text-xs text-gray-400 dark:text-gray-600 shrink-0">%</span>
                  <button
                    type="button"
                    onClick={() => { setChegirmaFoizOchiq(false); setChegirmaFoiz(''); setQolBilanSumma('') }}
                    className="text-gray-300 dark:text-gray-600 hover:text-red-500 transition shrink-0 ml-auto"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}
              {!bonusTanlashRejimi ? (
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

            <div className="flex justify-between font-bold border-t border-gray-100 dark:border-neutral-800 pt-2">
              <span className="text-gray-900 dark:text-gray-100">To&apos;lov:</span>
              <span className="text-green-600 text-lg">{formatSum(yakuniySumma)}</span>
            </div>

            {/* To'lov usuli */}
            <div className="grid grid-cols-2 gap-1.5">
              {TOLOV_USULLARI.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTolovUsuli(t.value)}
                  className={`py-2 px-3 rounded-xl text-xs font-medium transition ${
                    tolovUsuli === t.value
                      ? 'bg-pos text-white'
                      : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tolovUsuli === 'NASIYA' && (
              <div>
                <p className="text-gray-500 dark:text-gray-500 text-xs mb-1">Nasiya muddati</p>
                <input type="date" value={nasiyaMuddat} onChange={e => setNasiyaMuddat(e.target.value)} className={inputCls} />
              </div>
            )}

            {tolovUsuli === 'ARALASH' && (
              <div>
                <p className="text-gray-500 dark:text-gray-500 text-xs mb-1">Naqd qism</p>
                <MoneyInput
                  value={naqdTolangan}
                  onChange={setNaqdTolangan}
                  max={yakuniySumma}
                  min={0}
                  placeholder="0"
                />
                {naqdTolangan && (
                  <p className="text-gray-400 dark:text-gray-600 text-xs mt-1">
                    Karta: {formatSum(yakuniySumma - parseFloat(naqdTolangan || '0'))}
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={sotuvYakunla}
                disabled={yuklanmoqda}
                className="flex-1 py-3 bg-pos-pay hover:bg-pos-pay-hover disabled:opacity-60 text-white font-bold rounded-xl transition text-sm shadow-md shadow-pos-pay/20 flex items-center justify-center gap-2"
              >
                <CheckCircle size={18} />
                {yuklanmoqda ? 'Amalga oshirilmoqda...' : "To'lash"}
              </button>
            </div>
          </div>
        )}
      </div>

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
                  onChange={v => { setMijozTelefon(v); setTelefonTaklifOchiq(true) }}
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
                  onChange={e => { setMijozIsmi(e.target.value); setIsmTaklifOchiq(true) }}
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
                {s.tarkiblar?.map((item: any) => {
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
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Naqd')}:</span><span>{formatSum(s.naqdTolangan)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Karta')}:</span><span>{formatSum(s.kartaTolangan)}</span></div>
                  </>
                ) : s.tolovUsuli === 'NASIYA' ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t("To'lov")}:</span><span>{t('Nasiya')}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Mijoz')}:</span><span>{t(s.mijoz?.ism || '—')}</span></div>
                  </>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{t("To'lov")}:</span><span>{s.tolovUsuli === 'KARTA' ? t('Karta') : t('Naqd pul')}</span>
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
      {saqlanganiModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl dark:border dark:border-neutral-800 w-full max-w-md max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Archive size={18} className="text-violet-600" />
                <h3 className="text-gray-900 dark:text-gray-100 font-semibold">Saqlangan savatlar</h3>
              </div>
              <button onClick={() => setSaqlanganiModal(false)} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[70vh]">
              {saqlanganiSavatlar.length === 0 ? (
                <div className="p-8 text-center text-gray-400 dark:text-gray-600 text-sm">Saqlangan savatlar yo&apos;q</div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                  {saqlanganiSavatlar.map(draft => (
                    <div key={draft.id} className="p-3 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-500 dark:text-gray-400 text-[11px]">{formatSanaVaVaqt(draft.sana)}</p>
                          <p className="text-green-600 font-bold text-sm">{formatSum(draft.jami)}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => savatniYuklash(draft)}
                            className="px-2.5 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs rounded-lg transition font-medium flex items-center gap-1"
                          >
                            <Play size={12} />
                            Yuklash
                          </button>
                          <button
                            onClick={() => saqlanganiOchirish(draft.id)}
                            className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-500 rounded-lg transition"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {draft.savat.map(item => (
                          <span key={item.tovarId + (item.bonus ? '-bonus' : '')} className="text-[10px] bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded">
                            {item.nomi} ×{item.miqdor}
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
                              <span className="text-gray-400 dark:text-gray-600 text-xs truncate">{formatSanaVaVaqt(s.sana)}</span>
                              {s.mijoz && <span className="text-gray-500 dark:text-gray-500 text-xs truncate">• {s.mijoz.ism}</span>}
                            </div>
                            {TOLOV_USULI_BADGE[s.tolovUsuli] && (
                              <span className={`text-[10px] px-2 py-0.5 rounded-md shrink-0 ${TOLOV_USULI_BADGE[s.tolovUsuli].cls}`}>
                                {TOLOV_USULI_BADGE[s.tolovUsuli].label}
                              </span>
                            )}
                          </div>
                        </button>
                      ))
                    }
                    {!sotuvlarYuklanmoqda && sotuvlarRoyxati.length === 0 && (
                      <p className="text-gray-400 dark:text-gray-600 text-sm text-center py-4">Sotuvlar topilmadi</p>
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
                        {TOLOV_USULI_BADGE[qaytarishSotuv.tolovUsuli] && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-md shrink-0 ${TOLOV_USULI_BADGE[qaytarishSotuv.tolovUsuli].cls}`}>
                            {TOLOV_USULI_BADGE[qaytarishSotuv.tolovUsuli].label}
                          </span>
                        )}
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
                    {qaytarishSotuv.tarkiblar.map((t: any) => {
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
                            <span className="text-gray-400 dark:text-gray-600 text-xs">max: {Number(t.miqdor)}</span>
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
