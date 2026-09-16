// Xarajat kategoriyalari — yagona manba (yorliq, rang, ikonka nomi).
//
// Bu fayl serverga bog'liq emas: client formada ham, server tekshiruvida
// ham bir xil ro'yxat ishlatiladi. Yangi kategoriya qo'shilganda faqat
// shu yerga va Prisma enum'iga qo'shiladi.

export const XARAJAT_KATEGORIYALARI = [
  'IJARA', 'MAOSH', 'TRANSPORT', 'KOMMUNAL',
  'OVQAT', 'SOLIQ', 'TAMIRLASH', 'REKLAMA', 'BOSHQA',
] as const

export type XarajatKategoriya = (typeof XARAJAT_KATEGORIYALARI)[number]

export interface KategoriyaMalumoti {
  label: string
  izoh: string
  badge: string
  /** Xodimga bog'lash mantiqiy bo'lgan kategoriyalar. */
  xodimgaBoglanadi: boolean
}

export const XARAJAT_MALUMOTI: Record<XarajatKategoriya, KategoriyaMalumoti> = {
  IJARA: {
    label: 'Ijara', izoh: "Do'kon yoki ombor ijarasi",
    badge: 'bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400',
    xodimgaBoglanadi: false,
  },
  MAOSH: {
    label: 'Maosh', izoh: 'Oylik, bonus, avans',
    badge: 'bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400',
    xodimgaBoglanadi: true,
  },
  TRANSPORT: {
    label: 'Transport', izoh: "Mashina, yoqilg'i, yetkazib berish",
    badge: 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400',
    xodimgaBoglanadi: true,
  },
  KOMMUNAL: {
    label: 'Kommunal', izoh: 'Svet, suv, gaz, internet',
    badge: 'bg-cyan-50 dark:bg-cyan-950/30 text-cyan-600 dark:text-cyan-400',
    xodimgaBoglanadi: false,
  },
  OVQAT: {
    label: 'Ovqat', izoh: 'Obed, choy-nonushta',
    badge: 'bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400',
    xodimgaBoglanadi: true,
  },
  SOLIQ: {
    label: 'Soliq', izoh: "Soliq va yig'imlar",
    badge: 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400',
    xodimgaBoglanadi: false,
  },
  TAMIRLASH: {
    label: "Ta'mirlash", izoh: 'Jihoz, ehtiyot qism, usta',
    badge: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400',
    xodimgaBoglanadi: false,
  },
  REKLAMA: {
    label: 'Reklama', izoh: "E'lon, banner, targ'ibot",
    badge: 'bg-pink-50 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400',
    xodimgaBoglanadi: false,
  },
  BOSHQA: {
    label: 'Boshqa', izoh: "Ro'yxatga kirmagan xarajat",
    badge: 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400',
    xodimgaBoglanadi: true,
  },
}

export function xarajatMalumoti(kategoriya: string): KategoriyaMalumoti {
  return XARAJAT_MALUMOTI[kategoriya as XarajatKategoriya] ?? {
    label: kategoriya, izoh: '',
    badge: 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400',
    xodimgaBoglanadi: false,
  }
}

export type XarajatTekshir =
  | {
      ok: true
      kategoriya: XarajatKategoriya
      summa: number
      izoh: string | null
      kimUchun: string | null
      tolovUsuli: string
      sana: Date
    }
  | { ok: false; xato: string }

const MAX_SUMMA = 10_000_000_000
const KANALLAR = ['NAQD', 'KARTA', 'CLICK', 'BANK']

/** Xarajat kiritmasini tekshiradi va normallashtiradi. */
export function xarajatniTekshir(kiritma: {
  kategoriya?: unknown; summa?: unknown; izoh?: unknown
  kimUchun?: unknown; tolovUsuli?: unknown; sana?: unknown
}): XarajatTekshir {
  const kategoriya = String(kiritma.kategoriya ?? '') as XarajatKategoriya
  if (!XARAJAT_KATEGORIYALARI.includes(kategoriya)) {
    return { ok: false, xato: "Xarajat turi noto'g'ri" }
  }

  const summa = Number(kiritma.summa)
  if (!Number.isFinite(summa) || summa <= 0) {
    return { ok: false, xato: "Summa noldan katta bo'lishi kerak" }
  }
  if (summa > MAX_SUMMA) return { ok: false, xato: 'Summa juda katta' }

  // Kanal majburiy: xarajat — do'kondan chiqqan pul, u To'lovlar
  // hisobotida kanal bo'yicha ko'rinishi kerak.
  const usul = String(kiritma.tolovUsuli ?? 'NAQD')
  if (!KANALLAR.includes(usul)) return { ok: false, xato: "To'lov usuli noto'g'ri" }

  let sana = new Date()
  if (kiritma.sana) {
    const d = new Date(String(kiritma.sana))
    if (Number.isNaN(d.getTime())) return { ok: false, xato: "Sana noto'g'ri" }
    sana = d
  }

  return {
    ok: true,
    kategoriya,
    summa: Math.round(summa),
    izoh: String(kiritma.izoh ?? '').trim().slice(0, 500) || null,
    kimUchun: String(kiritma.kimUchun ?? '').trim().slice(0, 200) || null,
    tolovUsuli: usul,
    sana,
  }
}
