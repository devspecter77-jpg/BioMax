// Ta'minotchi qarzi — sof mantiq (bazasiz, testlanadigan).
//
// Umumiy qarz ikkita manbadan yig'iladi:
//   1) XARIDLAR — har bir xaridning to'lanmagan qoldig'i (`Xarid.qoldiqQarz`)
//   2) QO'LDA yozilgan daftar — tizimdan tashqarida paydo bo'lgan qarz
//      (eski qoldiq, og'zaki kelishuv, tuzatish) va unga qilingan to'lovlar
//
// Ikkalasi ataylab alohida saqlanadi: xarid qarzi hujjatga bog'langan va
// avtomatik kamayadi, qo'lda yozilgani esa faqat shu daftarda yashaydi.

export const QARZ_TURLARI = ['QARZ', 'TOLOV'] as const
export type QarzTuri = (typeof QARZ_TURLARI)[number]

export interface QarzTuriMalumoti {
  label: string
  izoh: string
  badge: string
  /** Qarzga ta'siri: +1 oshiradi, −1 kamaytiradi. */
  ishora: 1 | -1
}

export const QARZ_MALUMOTI: Record<QarzTuri, QarzTuriMalumoti> = {
  QARZ: {
    label: 'Qarz',
    izoh: 'Ta’minotchiga qarzdor bo‘ldik',
    badge: 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400',
    ishora: 1,
  },
  TOLOV: {
    label: "To'lov",
    izoh: 'Qarzning bir qismi to‘landi',
    badge: 'bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400',
    ishora: -1,
  },
}

export function qarzMalumoti(turi: string): QarzTuriMalumoti {
  return QARZ_MALUMOTI[turi as QarzTuri] ?? {
    label: turi, izoh: '', badge: 'bg-gray-100 text-gray-600', ishora: 1,
  }
}

export interface QarzXulosa {
  /** Xaridlardan kelgan to'lanmagan qoldiq. */
  xariddan: number
  /** Qo'lda yozilgan qarzlar yig'indisi. */
  qolda: number
  /** Qo'lda yozilgan to'lovlar yig'indisi. */
  tolangan: number
  /** Umumiy qarz: xariddan + qolda − tolangan. Manfiy bo'lishi mumkin
   *  (ortiqcha to'lov) — shuning uchun nolga qisilmaydi. */
  jami: number
}

export function qarzXulosasi(params: {
  xaridQoldigi: number
  yozuvlar: { turi: string; summa: number }[]
}): QarzXulosa {
  let qolda = 0
  let tolangan = 0
  for (const y of params.yozuvlar) {
    const summa = Number(y.summa)
    if (!Number.isFinite(summa) || summa <= 0) continue
    if (y.turi === 'QARZ') qolda += summa
    else if (y.turi === 'TOLOV') tolangan += summa
  }
  const xariddan = Number(params.xaridQoldigi) || 0
  return {
    xariddan,
    qolda,
    tolangan,
    jami: xariddan + qolda - tolangan,
  }
}

export type QarzTekshir =
  | { ok: true; turi: QarzTuri; summa: number; izoh: string | null; tolovUsuli: string | null }
  | { ok: false; xato: string }

const MAX_SUMMA = 10_000_000_000
const KANALLAR = ['NAQD', 'KARTA', 'CLICK', 'BANK']

/** Kiritmani tekshiradi va normallashtiradi. */
export function qarzniTekshir(kiritma: {
  turi?: unknown; summa?: unknown; izoh?: unknown; tolovUsuli?: unknown
}): QarzTekshir {
  const turi = String(kiritma.turi ?? '') as QarzTuri
  if (!QARZ_TURLARI.includes(turi)) {
    return { ok: false, xato: "Yozuv turi noto'g'ri" }
  }

  const summa = Number(kiritma.summa)
  if (!Number.isFinite(summa) || summa <= 0) {
    return { ok: false, xato: "Summa noldan katta bo'lishi kerak" }
  }
  if (summa > MAX_SUMMA) {
    return { ok: false, xato: 'Summa juda katta' }
  }

  // To'lov kanali faqat TO'LOV uchun ma'noli va MAJBURIY —
  // To'lovlar bo'limi chiqimni kanal bo'yicha guruhlaydi, kanalsiz
  // to'lov o'sha hisobotdan tushib qolardi.
  let tolovUsuli: string | null = null
  if (turi === 'TOLOV') {
    const u = String(kiritma.tolovUsuli ?? 'NAQD')
    if (!KANALLAR.includes(u)) return { ok: false, xato: "To'lov usuli noto'g'ri" }
    tolovUsuli = u
  }

  return {
    ok: true,
    turi,
    summa: Math.round(summa),
    izoh: String(kiritma.izoh ?? '').trim().slice(0, 500) || null,
    tolovUsuli,
  }
}
