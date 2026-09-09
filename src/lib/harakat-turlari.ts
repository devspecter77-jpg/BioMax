// Ombor harakati turlari uchun yagona manba — yorliq, rang va ishora (+/−).
//
// Bu ma'lumot avval `ombor/page.tsx` ichida qattiq yozilgan edi; yangi tur
// qo'shilganda (masalan filiallararo o'tkazma) boshqa joylarda "KIRIM"
// deb noto'g'ri ko'rsatilib qolardi. `tolov-usullari.ts` bilan bir xil naqsh.
//
// Bu fayl serverga bog'liq emas (prisma import qilmaydi) — client
// komponentlarda ham, server marshrutlarida ham ishlatiladi.

export const HARAKAT_TURLARI = [
  'KIRIM', 'CHIQIM', 'QAYTARISH', 'YOQOTISH',
  'OTKAZMA', 'OTKAZMA_KIRIM', 'OTKAZMA_CHIQIM',
] as const

export type HarakatTuri = (typeof HARAKAT_TURLARI)[number]

export interface HarakatMalumoti {
  label: string
  /** Qisqa izoh — nima uchun bu harakat bo'lgani. */
  izoh: string
  badge: string
  /** Qoldiqqa ta'siri: +1 ko'paytiradi, −1 kamaytiradi. */
  ishora: 1 | -1
}

export const HARAKAT_MALUMOTI: Record<HarakatTuri, HarakatMalumoti> = {
  KIRIM: {
    label: 'Kirim',
    izoh: "Ta'minotchidan qabul qilindi",
    badge: 'bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400',
    ishora: 1,
  },
  CHIQIM: {
    label: 'Chiqim',
    izoh: 'Sotildi yoki chiqarildi',
    badge: 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400',
    ishora: -1,
  },
  QAYTARISH: {
    label: 'Qaytarish',
    izoh: 'Mijoz qaytarib berdi',
    badge: 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400',
    ishora: 1,
  },
  YOQOTISH: {
    label: "Yo'qotish",
    izoh: 'Buzildi, yo\'qoldi yoki muddati o\'tdi',
    badge: 'bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400',
    ishora: -1,
  },
  OTKAZMA: {
    label: "Ombordan do'konga",
    izoh: 'Shu filial ichida ko\'chirildi',
    badge: 'bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400',
    ishora: 1,
  },
  OTKAZMA_KIRIM: {
    label: 'Boshqa filialdan',
    izoh: 'Boshqa filial omboridan keldi',
    badge: 'bg-teal-50 dark:bg-teal-950/30 text-teal-600 dark:text-teal-400',
    ishora: 1,
  },
  OTKAZMA_CHIQIM: {
    label: 'Boshqa filialga',
    izoh: 'Boshqa filial omboriga yuborildi',
    badge: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400',
    ishora: -1,
  },
}

const NOMALUM: HarakatMalumoti = {
  label: "Noma'lum",
  izoh: '',
  badge: 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400',
  ishora: 1,
}

export function harakatMalumoti(turi: string): HarakatMalumoti {
  return HARAKAT_MALUMOTI[turi as HarakatTuri] ?? { ...NOMALUM, label: turi }
}

// ─── Joylashuv ───────────────────────────────────────────────────────────────

export const JOY_LABEL: Record<string, string> = {
  OMBOR: 'Ombor',
  DOKON: "Do'kon",
}

export function joyLabel(joy: string): string {
  return JOY_LABEL[joy] ?? joy
}
