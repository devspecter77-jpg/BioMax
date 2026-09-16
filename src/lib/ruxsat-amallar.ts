// So'rov MAZMUNIGA bog'liq ruxsatlar — proxy yo'l va usulni ko'radi, lekin
// "chegirma bormi" yoki "qaysi harakat turi" kabi narsalarni faqat so'rov
// tanasidan bilish mumkin. Route o'zi shu funksiyalar bilan tekshiradi.
//
// Sof mantiq: prisma import qilmaydi, sinovlarda to'g'ridan-to'g'ri ishlaydi.

import { HARAKAT_MALUMOTI, type HarakatTuri } from './harakat-turlari'

export interface SotuvTanasi {
  chegirma?: unknown
  tolovUsuli?: unknown
  tarkiblar?: unknown
}

/** Mahsulotning eng past ruxsat etilgan narxi, so'mda (chakana/optom/bo'lish'dan eng kichigi). */
export interface MinNarx {
  somda: number
  /** USD'da narxlangan — kurs kassada biroz boshqacha bo'lishi mumkin */
  usd: boolean
}

function son(q: unknown): number {
  const n = typeof q === 'number' ? q : parseFloat(String(q ?? '').replace(/\s/g, ''))
  return Number.isFinite(n) ? n : 0
}

/**
 * Mahsulotning eng past narxi so'mda. `null` narxlar hisobga olinmaydi.
 * Kassa sahifasidagi `narxTuriBoyicha` bilan bir xil yaxlitlash.
 */
export function minNarxSomda(
  t: { sotishNarxi: unknown; optomNarxi?: unknown; bolishNarxi?: unknown; valyuta?: string | null },
  kursi: number,
): MinNarx {
  const narxlar = [t.sotishNarxi, t.optomNarxi, t.bolishNarxi]
    .filter(n => n !== null && n !== undefined)
    .map(son)
    .filter(n => n > 0)
  const eng = narxlar.length ? Math.min(...narxlar) : 0
  const usd = t.valyuta === 'USD'
  return { somda: usd ? Math.round(eng * kursi) : eng, usd }
}

/**
 * Sotuv uchun qo'shimcha kerak bo'ladigan amal ruxsatlari.
 *
 * `sotuv.chegirma` — chekka chegirma, qatorga chegirma, bonus (0 narx) yoki
 * narxni ro'yxatdagi eng past narxdan past qilish. Narx tekshiruvi kassir
 * brauzeriga ishonmaslik uchun: aks holda chegirma ruxsati yopiq xodim
 * shunchaki narxni tahrirlab o'sha chegirmani berardi.
 *
 * `sotuv.nasiya` — pul hozir tushmaydigan sotuv (NASIYA, SHERIK).
 */
export function sotuvUchunKerak(tana: SotuvTanasi, minNarxlar: Map<string, MinNarx>): string[] {
  const kerak: string[] = []
  const tarkiblar = Array.isArray(tana.tarkiblar) ? tana.tarkiblar as Record<string, unknown>[] : []

  let chegirma = son(tana.chegirma) > 0.5
  if (!chegirma) {
    for (const q of tarkiblar) {
      if (son(q.chegirma) > 0.5) { chegirma = true; break }
      const min = minNarxlar.get(String(q.tovarId ?? ''))
      if (!min || min.somda <= 0) continue
      // USD mahsulotda kurs kun davomida yangilanishi mumkin — 2% bardosh
      const chegara = min.usd ? min.somda * 0.98 : min.somda - 1
      if (son(q.birlikNarxi) < chegara) { chegirma = true; break }
    }
  }
  if (chegirma) kerak.push('sotuv.chegirma')

  if (tana.tolovUsuli === 'NASIYA' || tana.tolovUsuli === 'SHERIK') kerak.push('sotuv.nasiya')
  return kerak
}

/** Qo'lda ombor harakati: qoldiqni ko'paytiradigani kirim, kamaytiradigani chiqim. */
export function harakatUchunKerak(turi: HarakatTuri): 'ombor.kirim' | 'ombor.chiqim' {
  return HARAKAT_MALUMOTI[turi].ishora > 0 ? 'ombor.kirim' : 'ombor.chiqim'
}

/** Onlayn buyurtma holati: bekor qilish alohida, qolgan o'tishlar — boshqarish. */
export function onlaynHolatUchunKerak(yangiHolat: string): string {
  return yangiHolat === 'BEKOR' ? 'onlayn-buyurtmalar.bekor' : 'onlayn-buyurtmalar.boshqarish'
}

/** Ruxsat yo'q javobi matni — proxy bilan bir xil ko'rinishda. */
export function ruxsatYoqXabari(kalit: string, nomi: string): { xato: string; kod: 'ruxsat_yoq'; kalit: string } {
  return { xato: `Bu amalga ruxsatingiz yo‘q: «${nomi}». Administratorga murojaat qiling.`, kod: 'ruxsat_yoq', kalit }
}
