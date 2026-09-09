// Kunlik hisobot — sof mantiq (bazasiz, testlanadigan).
//
// Ikki qismdan iborat:
//   1) Kam qolgan mahsulotlar — qoldiq minimal chegaradan pastga tushganlar
//   2) Top mahsulotlar — belgilangan davrda eng ko'p sotilganlar
//
// Bu fayl faqat hisob-kitob va matn formatlash bilan shug'ullanadi;
// baza so'rovlari `kunlik-hisobot-server.ts` da.

// ─── Toshkent vaqti ──────────────────────────────────────────────────────────
//
// Server localhostda Toshkent vaqtida, Vercel'da esa UTC'da ishlaydi.
// "Bugun" va "soat 9" ikkalasida ham bir xil bo'lishi uchun vaqt har doim
// UTC+5 ga o'tkaziladi (O'zbekistonda yozgi vaqt o'zgarishi yo'q).

export const UZ_OFFSET_MS = 5 * 60 * 60 * 1000

/** Toshkent vaqtidagi "hozir" — UTC maydonlari orqali o'qiladi. */
function uzVaqt(d: Date): Date {
  return new Date(d.getTime() + UZ_OFFSET_MS)
}

/** Toshkent vaqti bo'yicha soat (0–23). */
export function uzSoat(d: Date = new Date()): number {
  return uzVaqt(d).getUTCHours()
}

/** Toshkent vaqti bo'yicha kun kaliti — "2026-09-08". */
export function kunKaliti(d: Date = new Date()): string {
  return uzVaqt(d).toISOString().slice(0, 10)
}

/** Toshkent kunining boshlanishi, UTC Date sifatida (baza so'rovlari uchun). */
export function uzKunBoshi(d: Date = new Date()): Date {
  const u = uzVaqt(d)
  u.setUTCHours(0, 0, 0, 0)
  return new Date(u.getTime() - UZ_OFFSET_MS)
}

// ─── Sozlamalar ──────────────────────────────────────────────────────────────

export const HISOBOT_SOZLAMA = {
  yoqilgan: 'kunlik_hisobot_yoqilgan',
  soat: 'kunlik_hisobot_soati',
  topKun: 'kunlik_hisobot_top_kun',
  topSoni: 'kunlik_hisobot_top_soni',
  kamSoni: 'kunlik_hisobot_kam_soni',
} as const

export interface HisobotSozlamalari {
  yoqilgan: boolean
  /** Toshkent vaqti bo'yicha yuborish soati (0–23). */
  soat: number
  /** Top mahsulotlar necha kunlik davr bo'yicha hisoblanadi. */
  topKun: number
  /** Xabarda nechta top mahsulot ko'rsatiladi. */
  topSoni: number
  /** Xabarda nechta kam qolgan mahsulot ko'rsatiladi. */
  kamSoni: number
}

export const STANDART_SOZLAMA: HisobotSozlamalari = {
  yoqilgan: true,
  soat: 9,
  topKun: 7,
  topSoni: 10,
  kamSoni: 20,
}

function butun(qiymat: string | undefined, standart: number, min: number, max: number): number {
  const n = Number.parseInt(String(qiymat ?? ''), 10)
  if (!Number.isFinite(n)) return standart
  return Math.min(max, Math.max(min, n))
}

/** Sozlamalar jadvalidagi matnli qiymatlarni tipli obyektga aylantiradi. */
export function sozlamalarniOqi(xom: Record<string, string | undefined>): HisobotSozlamalari {
  const yoqilganXom = xom[HISOBOT_SOZLAMA.yoqilgan]
  return {
    // Kalit umuman yo'q bo'lsa — yoqilgan (standart holat)
    yoqilgan: yoqilganXom === undefined ? STANDART_SOZLAMA.yoqilgan : yoqilganXom === '1',
    soat: butun(xom[HISOBOT_SOZLAMA.soat], STANDART_SOZLAMA.soat, 0, 23),
    topKun: butun(xom[HISOBOT_SOZLAMA.topKun], STANDART_SOZLAMA.topKun, 1, 365),
    topSoni: butun(xom[HISOBOT_SOZLAMA.topSoni], STANDART_SOZLAMA.topSoni, 1, 50),
    kamSoni: butun(xom[HISOBOT_SOZLAMA.kamSoni], STANDART_SOZLAMA.kamSoni, 1, 100),
  }
}

// ─── Ma'lumot shakllari ──────────────────────────────────────────────────────

export interface KamQolganTovar {
  id: string
  nomi: string
  qoldiq: number
  minimalQoldiq: number
  birlik: string
  taminotchi: string | null
  /** Butunlay tugagan (qoldiq 0 yoki manfiy) — eng shoshilinch. */
  tugagan: boolean
}

export interface TopTovar {
  id: string
  nomi: string
  birlik: string
  miqdor: number
  summa: number
}

export interface KunlikHisobot {
  kunKaliti: string
  doiraNomi: string
  topKun: number
  kamQolganlar: KamQolganTovar[]
  /** Chegaradan pastga tushganlarning UMUMIY soni (ro'yxat qisqartirilgan bo'lishi mumkin). */
  kamQolganSoni: number
  tugaganSoni: number
  topTovarlar: TopTovar[]
  /** Kechagi savdo — hisobot kontekst uchun. */
  kecha: { summa: number; soni: number }
}

// ─── Saralash ────────────────────────────────────────────────────────────────

/**
 * Shoshilinchlik tartibi: avval butunlay tugaganlar, so'ng chegaraga nisbatan
 * eng past qolganlar (nisbat bo'yicha — 100 talik mahsulotdan 5 ta qolishi
 * 5 talikdan 4 ta qolishidan jiddiyroq).
 */
export function kamQolganSarala(royxat: KamQolganTovar[]): KamQolganTovar[] {
  return [...royxat].sort((a, b) => {
    if (a.tugagan !== b.tugagan) return a.tugagan ? -1 : 1
    const an = a.minimalQoldiq > 0 ? a.qoldiq / a.minimalQoldiq : 0
    const bn = b.minimalQoldiq > 0 ? b.qoldiq / b.minimalQoldiq : 0
    if (an !== bn) return an - bn
    return a.nomi.localeCompare(b.nomi)
  })
}

// ─── Telegram xabari ─────────────────────────────────────────────────────────

const BIRLIK_QISQA: Record<string, string> = {
  DONA: 'dona', KG: 'kg', LITR: 'l', METR: 'm', PACHKA: 'pachka', QUTI: 'quti',
}

export function birlikQisqa(birlik: string): string {
  return BIRLIK_QISQA[birlik] ?? birlik.toLowerCase()
}

function summa(n: number): string {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n))
}

/** Kasrli miqdorni ortiqcha nol bilan ko'rsatmaslik uchun. */
function miqdor(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

function sanaMatni(kun: string): string {
  const [y, m, d] = kun.split('-')
  return `${d}.${m}.${y}`
}

/**
 * Telegram uchun matn. Formatlash oddiy matn — Telegram userbot
 * xabarlari `parse_mode`siz yuboriladi, shuning uchun markdown ishlatilmaydi.
 */
export function hisobotMatni(h: KunlikHisobot, dokonNomi: string): string {
  const q: string[] = []

  q.push(`📋 Kunlik hisobot — ${sanaMatni(h.kunKaliti)}`)
  q.push(`🏪 ${dokonNomi}${h.doiraNomi ? ` · ${h.doiraNomi}` : ''}`)
  q.push('')
  q.push(`💰 Kechagi savdo: ${summa(h.kecha.summa)} so'm (${h.kecha.soni} ta chek)`)
  q.push('')

  // ── Kam qolganlar ──
  if (h.kamQolganSoni === 0) {
    q.push('✅ Kam qolgan mahsulot yo\'q — barcha qoldiqlar yetarli.')
  } else {
    q.push(`⚠️ Kam qolgan mahsulotlar: ${h.kamQolganSoni} ta` +
      (h.tugaganSoni > 0 ? ` (shundan ${h.tugaganSoni} tasi tugagan)` : ''))
    q.push('')
    for (const t of h.kamQolganlar) {
      const belgi = t.tugagan ? '🔴' : '🟡'
      const holat = t.tugagan
        ? 'TUGAGAN'
        : `${miqdor(t.qoldiq)} ${birlikQisqa(t.birlik)} qoldi (min ${t.minimalQoldiq})`
      q.push(`${belgi} ${t.nomi} — ${holat}`)
      if (t.taminotchi) q.push(`     ↳ ${t.taminotchi}`)
    }
    const qolgan = h.kamQolganSoni - h.kamQolganlar.length
    if (qolgan > 0) q.push(`… va yana ${qolgan} ta mahsulot`)
  }

  // ── Top mahsulotlar ──
  q.push('')
  q.push(`🏆 Eng ko'p sotilgan mahsulotlar (${h.topKun} kun)`)
  if (h.topTovarlar.length === 0) {
    q.push('Bu davrda savdo bo\'lmagan.')
  } else {
    h.topTovarlar.forEach((t, i) => {
      q.push(`${i + 1}. ${t.nomi} — ${miqdor(t.miqdor)} ${birlikQisqa(t.birlik)} · ${summa(t.summa)} so'm`)
    })
  }

  return q.join('\n')
}
