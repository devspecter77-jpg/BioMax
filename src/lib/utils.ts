import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatSum(summa: number | string) {
  const n = typeof summa === 'string' ? parseFloat(summa) : summa
  return new Intl.NumberFormat('uz-UZ').format(n) + " so'm"
}

// Mahsulot o'z valyutasida (UZS/USD) ko'rsatiladi — masalan katalog/POS
// kartochkalarida. Sotuvga qo'shilganda esa har doim so'mga o'girilgan
// summa ishlatiladi (formatSum bilan), chunki chek/hisobotlar faqat so'mda.
export function formatNarx(narx: number | string, valyuta?: string) {
  const n = typeof narx === 'string' ? parseFloat(narx) : narx
  if (valyuta === 'USD') {
    return '$' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
  }
  return formatSum(n)
}

export function formatSana(sana: Date | string) {
  const d = typeof sana === 'string' ? new Date(sana) : sana
  const kun = String(d.getDate()).padStart(2, '0')
  const oy = String(d.getMonth() + 1).padStart(2, '0')
  const yil = d.getFullYear()
  return `${kun}.${oy}.${yil}`
}

export function formatSanaVaVaqt(sana: Date | string) {
  const d = typeof sana === 'string' ? new Date(sana) : sana
  return d.toLocaleString('uz-UZ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function generateChekRaqami(): string {
  const sana = new Date()
  const yil = sana.getFullYear().toString().slice(-2)
  const oy = String(sana.getMonth() + 1).padStart(2, '0')
  const kun = String(sana.getDate()).padStart(2, '0')
  const tasodifiy = Math.floor(Math.random() * 9000) + 1000
  return `CHK-${yil}${oy}${kun}-${tasodifiy}`
}

// Format a number as Uzbek currency with so'm suffix using ru-RU locale (space-separated thousands)
export function formatMoney(amount: number | string): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(n)) return "0 so'm"
  return new Intl.NumberFormat('ru-RU').format(Math.round(n)) + " so'm"
}

// Format a number in short human-readable form (mln, mlrd, ming)
export function formatMoneyShort(amount: number | string): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(n)) return "0"
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + ' mlrd'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + ' mln'
  if (n >= 1_000) return (n / 1_000).toFixed(0) + ' ming'
  return String(Math.round(n))
}

// Normalize Uzbek apostrophe variants to standard ASCII apostrophe for consistent search
export function normalizeUzbek(text: string): string {
  return text.replace(/[`ʻʼ\u2018\u2019\u02BC]/g, "'")
}

// Lotin → Kirill transliteratsiya
const L2K: Record<string, string> = {
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
const K2L: Record<string, string> = {}
for (const [lat, kir] of Object.entries(L2K)) K2L[kir] = lat
const l2kKeys = Object.keys(L2K).sort((a, b) => b.length - a.length)
const k2lKeys = Object.keys(K2L).sort((a, b) => b.length - a.length)

export function toKirill(text: string): string {
  let r = text
  for (const k of l2kKeys) r = r.split(k).join(L2K[k])
  return r
}
export function toLotin(text: string): string {
  let r = text
  for (const k of k2lKeys) r = r.split(k).join(K2L[k])
  return r
}

/** Universal qidiruv — lotin yoki kirill yozilsa ham ikkalasini tekshiradi */
export function uzSearch(haystack: string, needle: string): boolean {
  if (!needle) return true
  const h = normalizeUzbek(haystack.toLowerCase())
  const n = normalizeUzbek(needle.toLowerCase())
  if (h.includes(n)) return true
  // Kirill varianti bilan qidirish
  if (h.includes(toKirill(n).toLowerCase())) return true
  // Lotin varianti bilan qidirish
  if (h.includes(toLotin(n).toLowerCase())) return true
  return false
}

// Skaner beep ovozi
export function playBeep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 1200
    gain.gain.value = 0.3
    osc.start()
    osc.stop(ctx.currentTime + 0.15)
    setTimeout(() => ctx.close(), 200)
  } catch {}
}

// Format a phone number string to +998 (XX) XXX-XX-XX display format
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '').replace(/^998/, '').slice(0, 9)
  if (digits.length !== 9) return phone
  return `+998 (${digits.slice(0,2)}) ${digits.slice(2,5)}-${digits.slice(5,7)}-${digits.slice(7,9)}`
}
