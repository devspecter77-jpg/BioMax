// To'lov usullari uchun YAGONA MANBA (single source of truth).
//
// Oldin yorliqlar va ranglar oltita joyda alohida takrorlangan edi
// (POS, chek printi, PDF, ommaviy chek sahifasi, xaridlar sahifasi,
// Telegram xabari) va ularning ko'pchiligi `usul === 'KARTA' ? 'Karta'
// : 'Naqd pul'` ko'rinishida yozilgan — ya'ni yangi usul qo'shilganda
// u jimgina "Naqd pul" bo'lib chiqardi. Endi barcha joy shu fayldan
// o'qiydi, yangi usul faqat shu yerga qo'shiladi.
//
// Bu fayl serverga bog'liq emas (prisma import qilmaydi) — client
// komponentlarda ham, route'larda ham xavfsiz ishlatiladi.

export const TOLOV_USULI_KALITLARI = [
  'NAQD',
  'KARTA',
  'CLICK',
  'BANK',
  'ARALASH',
  'NASIYA',
  'SHERIK',
] as const

export type TolovUsuliKalit = (typeof TOLOV_USULI_KALITLARI)[number]

/** Pul sotuv paytining o'zida tushadigan kanallar — har biri Sotuv'da
 *  o'z summa ustuniga ega. ARALASH bularni birlashtiradi, NASIYA/SHERIK
 *  esa qarz — sotuv payti pul tushmaydi. */
export const KANAL_USULLARI = ['NAQD', 'KARTA', 'CLICK', 'BANK'] as const
export type KanalUsuli = (typeof KANAL_USULLARI)[number]

/** Kanal → Sotuv modelidagi summa ustuni. */
export const KANAL_MAYDONI = {
  NAQD: 'naqdTolangan',
  KARTA: 'kartaTolangan',
  CLICK: 'clickTolangan',
  BANK: 'bankTolangan',
} as const satisfies Record<KanalUsuli, string>

export type KanalMaydoni = (typeof KANAL_MAYDONI)[KanalUsuli]

interface TolovUsuliMalumoti {
  /** To'liq yorliq — POS tugmasi, chek, tafsilot oynasi uchun. */
  label: string
  /** Kirill chekda ishlatiladi. Brend nomlari (Click) o'zgarmaydi —
   *  avtomatik transliteratsiya "Cлиcк" kabi buzuq natija berardi. */
  labelKirill: string
  /** Qisqa yorliq — jadval/badge uchun. */
  qisqa: string
  qisqaKirill: string
  /** Badge uchun Tailwind klasslari (och/qorong'i rejim uchun ham). */
  badge: string
}

export const TOLOV_MALUMOTI: Record<TolovUsuliKalit, TolovUsuliMalumoti> = {
  NAQD: {
    label: 'Naqd pul',
    labelKirill: 'Нақд пул',
    qisqa: 'Naqd',
    qisqaKirill: 'Нақд',
    badge: 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400',
  },
  KARTA: {
    label: 'Bank kartasi',
    labelKirill: 'Банк картаси',
    qisqa: 'Karta',
    qisqaKirill: 'Карта',
    badge: 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400',
  },
  CLICK: {
    label: 'Click',
    labelKirill: 'Click',
    qisqa: 'Click',
    qisqaKirill: 'Click',
    badge: 'bg-cyan-50 dark:bg-cyan-950/30 text-cyan-600 dark:text-cyan-400',
  },
  BANK: {
    label: "Bank o'tkazmasi",
    labelKirill: 'Банк ўтказмаси',
    qisqa: "O'tkazma",
    qisqaKirill: 'Ўтказма',
    badge: 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400',
  },
  ARALASH: {
    label: 'Aralash',
    labelKirill: 'Аралаш',
    qisqa: 'Aralash',
    qisqaKirill: 'Аралаш',
    badge: 'bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400',
  },
  NASIYA: {
    label: 'Nasiya',
    labelKirill: 'Насия',
    qisqa: 'Nasiya',
    qisqaKirill: 'Насия',
    badge: 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 font-semibold',
  },
  SHERIK: {
    label: "Sherik do'kon",
    labelKirill: 'Шерик дўкон',
    qisqa: 'Sherik',
    qisqaKirill: 'Шерик',
    badge: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400',
  },
}

/** POS'da kassir tanlay oladigan usullar. SHERIK bu yerda yo'q — u
 *  alohida oqim (sherik do'konga jo'natish) orqali belgilanadi. */
export const POS_TOLOV_USULLARI: TolovUsuliKalit[] = [
  'NAQD',
  'KARTA',
  'CLICK',
  'BANK',
  'ARALASH',
  'NASIYA',
]

/** Qarz (nasiya/xarid) to'lovini qabul qilishda tanlanadigan usullar —
 *  bu yerda faqat haqiqiy pul kanallari bo'lishi kerak. */
export const QARZ_TOLOV_USULLARI: KanalUsuli[] = [...KANAL_USULLARI]

export function tolovUsuliMi(qiymat: unknown): qiymat is TolovUsuliKalit {
  return typeof qiymat === 'string' && (TOLOV_USULI_KALITLARI as readonly string[]).includes(qiymat)
}

export function kanalUsuliMi(qiymat: unknown): qiymat is KanalUsuli {
  return typeof qiymat === 'string' && (KANAL_USULLARI as readonly string[]).includes(qiymat)
}

/** To'liq yorliq. Noma'lum qiymat kelsa — xom qiymatning o'zi
 *  (eski ma'lumot yoki qo'lda kiritilgan qiymat yo'qolib qolmasin). */
export function tolovLabel(usul: string, til: 'lotin' | 'kirill' = 'lotin'): string {
  const m = TOLOV_MALUMOTI[usul as TolovUsuliKalit]
  if (!m) return usul
  return til === 'kirill' ? m.labelKirill : m.label
}

/** Qisqa yorliq — badge va jadval ustunlari uchun. */
export function tolovQisqa(usul: string, til: 'lotin' | 'kirill' = 'lotin'): string {
  const m = TOLOV_MALUMOTI[usul as TolovUsuliKalit]
  if (!m) return usul
  return til === 'kirill' ? m.qisqaKirill : m.qisqa
}

export function tolovBadge(usul: string): string {
  return TOLOV_MALUMOTI[usul as TolovUsuliKalit]?.badge
    ?? 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400'
}

/** Sotuvdagi to'lov kanallari — faqat summasi 0 dan katta bo'lganlari.
 *  Chek/PDF/tafsilot oynalari aralash to'lovni shu ro'yxat bo'yicha
 *  chiqaradi, ya'ni "Naqd + Click" ham to'g'ri ko'rinadi. */
export function tolovKanallari(sotuv: {
  naqdTolangan?: number | string | null
  kartaTolangan?: number | string | null
  clickTolangan?: number | string | null
  bankTolangan?: number | string | null
}): Array<{ usul: KanalUsuli; summa: number }> {
  const natija: Array<{ usul: KanalUsuli; summa: number }> = []
  for (const usul of KANAL_USULLARI) {
    const summa = Number(sotuv[KANAL_MAYDONI[usul]] ?? 0)
    if (Number.isFinite(summa) && summa > 0) natija.push({ usul, summa })
  }
  return natija
}

/** ARALASH to'lovda kassir har bir kanalga alohida summa kiritadi.
 *  Bo'sh/noto'g'ri qiymatlar 0 deb qabul qilinadi. */
export type AralashKiritma = Partial<Record<KanalUsuli, number | string | null | undefined>>

/** Bitta kanal qiymatini xavfsiz songa aylantirish (bo'sh matn, probel,
 *  "12 000" ko'rinishidagi ajratgich, NaN va manfiy — hammasi 0). */
export function kanalSummasi(qiymat: number | string | null | undefined): number {
  if (qiymat == null || qiymat === '') return 0
  const son = typeof qiymat === 'number' ? qiymat : parseFloat(String(qiymat).replace(/\s/g, ''))
  return Number.isFinite(son) && son > 0 ? son : 0
}

/** Aralash to'lovda kiritilgan summalar yig'indisi. */
export function aralashJami(kiritma: AralashKiritma | undefined): number {
  if (!kiritma) return 0
  return KANAL_USULLARI.reduce((s, usul) => s + kanalSummasi(kiritma[usul]), 0)
}

/** Sotuvni yakunlash mumkinmi — kiritilgan kanal summalari yakuniy
 *  summaga tengmi. Kassir xato kiritsa, jimgina "to'g'rilab" qo'yish
 *  o'rniga aniq xabar berish uchun sabab ham qaytariladi.
 *
 *  Butun tizim so'mda ishlaydi, shuning uchun 1 so'mdan kichik farq
 *  (float yaxlitlash) e'tiborga olinmaydi. */
export function aralashTekshir(
  kiritma: AralashKiritma | undefined,
  yakuniySumma: number,
): { ok: true } | { ok: false; farq: number; xato: string } {
  const jami = aralashJami(kiritma)
  const farq = yakuniySumma - jami
  if (Math.abs(farq) < 1) return { ok: true }
  return {
    ok: false,
    farq,
    xato: farq > 0
      ? `To'lov to'liq taqsimlanmadi — yana ${Math.round(farq).toLocaleString('uz-UZ')} so'm kiritilishi kerak`
      : `Kiritilgan summa ${Math.round(-farq).toLocaleString('uz-UZ')} so'mga ortiqcha`,
  }
}

/** To'lov usuli va yakuniy summadan kanal summalarini hisoblaydi.
 *  Client ham, server ham AYNAN shu funksiyani chaqiradi — shuning
 *  uchun bazaga har doim izchil taqsimot yoziladi.
 *
 *  - ARALASH: `aralash` dagi har bir kanal qiymati o'z ustuniga tushadi.
 *    Yig'indi yakuniy summaga teng bo'lishi shart (`aralashTekshir` bilan
 *    oldindan tekshiriladi) — bu yerda faqat tozalash qilinadi.
 *  - Bitta kanalli usul (NAQD/KARTA/CLICK/BANK): butun summa o'sha kanalga.
 *  - NASIYA/SHERIK: barcha kanallar 0 — pul sotuv paytida tushmaydi. */
export function tolovTaqsimoti(params: {
  tolovUsuli: string
  yakuniySumma: number
  aralash?: AralashKiritma
}): Record<KanalMaydoni, number> {
  const natija: Record<KanalMaydoni, number> = {
    naqdTolangan: 0,
    kartaTolangan: 0,
    clickTolangan: 0,
    bankTolangan: 0,
  }

  const jami = Number.isFinite(params.yakuniySumma) ? Math.max(0, params.yakuniySumma) : 0
  if (jami === 0) return natija

  if (params.tolovUsuli === 'ARALASH') {
    for (const usul of KANAL_USULLARI) {
      natija[KANAL_MAYDONI[usul]] = kanalSummasi(params.aralash?.[usul])
    }
    return natija
  }

  if (kanalUsuliMi(params.tolovUsuli)) {
    natija[KANAL_MAYDONI[params.tolovUsuli]] = jami
  }

  return natija
}
