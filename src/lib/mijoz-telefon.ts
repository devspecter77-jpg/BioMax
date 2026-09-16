// Mijoz telefon raqamlari — sof mantiq (bazasiz, client va serverda ishlaydi).
//
// Saqlash: `telefon` (asosiy), `telefon2` (qo'shimcha) va `qoshimchaTelefonlar`
// (3-raqamdan boshlab). Hammasi 9 raqam ko'rinishida — PhoneInput shunday beradi.

/** Bitta mijozga jami nechta raqam kiritish mumkin */
export const MAX_TELEFON = 10

/** Oxirgi 9 raqam — "+998 90 123-45-67", "998901234567", "901234567" bir xil hisoblanadi */
export function toqqizRaqam(t: string | null | undefined): string {
  return String(t ?? '').replace(/\D/g, '').slice(-9)
}

export interface TozaTelefonlar {
  telefon: string | null
  telefon2: string | null
  qoshimcha: string[]
  /** Barcha raqamlar (9 raqam) — dublikat tekshiruvi uchun */
  hammasi: string[]
}

/**
 * Formadan kelgan raqamlarni tozalash: bo'shlari tashlanadi, bir xil raqam
 * ikki marta yozilmaydi, chala raqam xato beradi. Asosiy bo'sh bo'lsa,
 * keyingi raqam asosiyga ko'tariladi — mijoz "telefonsiz" bo'lib qolmasin.
 */
export function telefonlarniTozala(asosiy: unknown, ikkinchi: unknown, qoshimcha: unknown): { xato: string } | TozaTelefonlar {
  const xom = [asosiy, ikkinchi, ...(Array.isArray(qoshimcha) ? qoshimcha : [])]
  const hammasi: string[] = []
  for (const q of xom) {
    const r = String(q ?? '').replace(/\D/g, '')
    if (!r) continue
    const t = r.length === 12 && r.startsWith('998') ? r.slice(3) : r
    if (t.length !== 9) return { xato: `Telefon raqami to‘liq emas: ${String(q)}` }
    if (!hammasi.includes(t)) hammasi.push(t)
  }
  if (hammasi.length > MAX_TELEFON) return { xato: `Bitta mijozga ${MAX_TELEFON} tadan ko‘p raqam kiritib bo‘lmaydi` }
  return { telefon: hammasi[0] ?? null, telefon2: hammasi[1] ?? null, qoshimcha: hammasi.slice(2), hammasi }
}

/** Mijozning barcha raqamlari (ko'rsatish va qidirish uchun) */
export function mijozTelefonlari(m: { telefon?: string | null; telefon2?: string | null; qoshimchaTelefonlar?: string[] | null }): string[] {
  return [m.telefon, m.telefon2, ...(m.qoshimchaTelefonlar ?? [])].filter((t): t is string => !!t && !!t.trim())
}
