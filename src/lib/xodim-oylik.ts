// Xodim oyligi — sof mantiq (bazasiz, testlanadigan).

export const TOLOV_TURLARI = ['OYLIK', 'BONUS', 'AVANS', 'JARIMA'] as const
export type TolovTuri = (typeof TOLOV_TURLARI)[number]

export interface TolovMalumoti {
  label: string
  izoh: string
  badge: string
  /** Xodim hisobiga ta'siri: +1 qo'shiladi, −1 ushlab qolinadi. */
  ishora: 1 | -1
  /** Do'kondan pul chiqadimi — shunda MAOSH xarajati yoziladi. */
  xarajatYaratadi: boolean
}

export const TOLOV_MALUMOTI: Record<TolovTuri, TolovMalumoti> = {
  OYLIK: {
    label: 'Oylik',
    izoh: 'Kelishilgan oylik maosh to‘lovi',
    badge: 'bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400',
    ishora: 1,
    xarajatYaratadi: true,
  },
  BONUS: {
    label: 'Bonus',
    izoh: 'Mukofot — oylikdan tashqari',
    badge: 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400',
    ishora: 1,
    xarajatYaratadi: true,
  },
  AVANS: {
    label: 'Avans',
    izoh: 'Oylikdan oldindan berilgan pul',
    badge: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400',
    ishora: 1,
    xarajatYaratadi: true,
  },
  JARIMA: {
    label: 'Jarima',
    izoh: 'Ushlab qolingan summa — pul chiqimi emas',
    badge: 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400',
    ishora: -1,
    xarajatYaratadi: false,
  },
}

export function tolovMalumoti(turi: string): TolovMalumoti {
  return TOLOV_MALUMOTI[turi as TolovTuri] ?? {
    label: turi, izoh: '', badge: 'bg-gray-100 text-gray-600', ishora: 1, xarajatYaratadi: false,
  }
}

/** "2026-09" — Toshkent vaqti bo'yicha joriy davr kaliti. */
export function davrKaliti(d: Date = new Date()): string {
  const uz = new Date(d.getTime() + 5 * 60 * 60 * 1000)
  return `${uz.getUTCFullYear()}-${String(uz.getUTCMonth() + 1).padStart(2, '0')}`
}

export interface DavrYigindisi {
  OYLIK: number
  BONUS: number
  AVANS: number
  JARIMA: number
  /** Qo'lga tekkan sof summa: oylik + bonus + avans − jarima. */
  sof: number
}

export function tolovlarniYigindi(
  tolovlar: { turi: string; summa: number }[],
): DavrYigindisi {
  const y: DavrYigindisi = { OYLIK: 0, BONUS: 0, AVANS: 0, JARIMA: 0, sof: 0 }
  for (const t of tolovlar) {
    const turi = t.turi as TolovTuri
    if (!(turi in TOLOV_MALUMOTI)) continue
    const summa = Number(t.summa)
    if (!Number.isFinite(summa) || summa <= 0) continue
    y[turi] += summa
    y.sof += summa * TOLOV_MALUMOTI[turi].ishora
  }
  return y
}

export type TolovTekshir =
  | { ok: true; turi: TolovTuri; summa: number; davr: string; izoh: string | null }
  | { ok: false; xato: string }

const MAX_SUMMA = 1_000_000_000

/** To'lov kiritmasini tekshiradi va normallashtiradi. */
export function tolovniTekshir(kiritma: {
  turi?: unknown; summa?: unknown; davr?: unknown; izoh?: unknown
}): TolovTekshir {
  const turi = String(kiritma.turi ?? '') as TolovTuri
  if (!TOLOV_TURLARI.includes(turi)) {
    return { ok: false, xato: "To'lov turi noto'g'ri" }
  }

  const summa = Number(kiritma.summa)
  if (!Number.isFinite(summa) || summa <= 0) {
    return { ok: false, xato: "Summa noldan katta bo'lishi kerak" }
  }
  if (summa > MAX_SUMMA) {
    return { ok: false, xato: 'Summa juda katta' }
  }

  // Davr "YYYY-MM" ko'rinishida bo'lishi shart — hisobot shu bo'yicha yig'iladi
  const davrXom = String(kiritma.davr ?? '').trim()
  const davr = davrXom || davrKaliti()
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(davr)) {
    return { ok: false, xato: "Davr noto'g'ri (YYYY-MM kutilgan)" }
  }

  return {
    ok: true,
    turi,
    // Tiyinsiz — so'mda butun songa yaxlitlanadi
    summa: Math.round(summa),
    davr,
    izoh: String(kiritma.izoh ?? '').trim().slice(0, 500) || null,
  }
}
