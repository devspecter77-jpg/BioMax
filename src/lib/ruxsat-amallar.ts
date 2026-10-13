// So'rov MAZMUNIGA bog'liq ruxsatlar — proxy yo'l va usulni ko'radi, lekin
// "chegirma bormi" yoki "qaysi harakat turi" kabi narsalarni faqat so'rov
// tanasidan bilish mumkin. Route o'zi shu funksiyalar bilan tekshiradi.
//
// Sof mantiq: prisma import qilmaydi, sinovlarda to'g'ridan-to'g'ri ishlaydi.

import { HARAKAT_MALUMOTI, type HarakatTuri } from './harakat-turlari'
import { sotuvBirliklari } from './birlik'
import { nomKaliti } from './utils'

export interface SotuvTanasi {
  chegirma?: unknown
  tolovUsuli?: unknown
  tarkiblar?: unknown
}

/** Mahsulotning eng past ruxsat etilgan narxi, so'mda (chakana/optom/bo'lish'dan eng kichigi). */
export interface MinNarx {
  /** Bir asosiy birlik (dona) uchun */
  somda: number
  /** USD'da narxlangan — kurs kassada biroz boshqacha bo'lishi mumkin */
  usd: boolean
  /** O'ramlar (blok, karobka): nomKaliti → 1 o'ramning eng past narxi va hajmi */
  oramlar?: Map<string, { somda: number; miqdor: number }>
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
  t: { sotishNarxi: unknown; optomNarxi?: unknown; bolishNarxi?: unknown; valyuta?: string | null; oramlar?: unknown },
  kursi: number,
): MinNarx {
  const usd = t.valyuta === 'USD'
  const somga = (n: number) => (usd ? Math.round(n * kursi) : n)
  const eng = (b: { sotish: number | null; optom: number | null; bolish: number | null }) => {
    const narxlar = [b.sotish, b.optom, b.bolish].filter((n): n is number => n !== null && n > 0)
    return narxlar.length ? Math.min(...narxlar) : 0
  }
  // Har bir birlikning o'z narxi: 1 dona — 1 300, 1 blok — 75 000 (lib/birlik.ts)
  const [asosiy, ...oramlar] = sotuvBirliklari(t)
  return {
    somda: somga(eng(asosiy)),
    usd,
    oramlar: new Map(oramlar.map(b => [nomKaliti(b.nomi), { somda: somga(eng(b)), miqdor: b.miqdor }])),
  }
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
      if (!min) continue
      // O'ramda sotilgan qator ("2 blok"): 1 o'ram narxi = qator summasi /
      // o'ramlar soni; hajmi bazadagi o'ramdan (brauzer yuborganidan emas).
      // Faqat BUTUN o'ram — "0,5 blok" dona sifatida tekshiriladi.
      const oram = q.oramNomi ? min.oramlar?.get(nomKaliti(String(q.oramNomi))) : undefined
      const soni = oram ? son(q.miqdor) / oram.miqdor : 0
      if (oram && soni > 0 && Math.abs(soni - Math.round(soni)) < 1e-6) {
        if (oram.somda > 0) {
          const chegara = min.usd ? oram.somda * 0.98 : oram.somda - 1
          if (son(q.jami) / soni < chegara) { chegirma = true; break }
        }
        continue
      }
      if (min.somda <= 0) continue
      // USD mahsulotda kurs kun davomida yangilanishi mumkin — 2% bardosh
      const chegara = min.usd ? min.somda * 0.98 : min.somda - 1
      // O'ram qatori butun bo'lmasa — bir dona narxi summadan olinadi
      const birlikNarxi = oram && son(q.miqdor) > 0 ? son(q.jami) / son(q.miqdor) : son(q.birlikNarxi)
      if (birlikNarxi < chegara) { chegirma = true; break }
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
