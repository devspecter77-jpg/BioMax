// Mahsulot qaysi omborda — sof mantiq (brauzer va server bir xil ishlatadi).
//
// Iyerarxiya: Ombor → Kategoriya → Tovar. Mahsulotning ombori uning
// KATEGORIYASI orqali belgilanadi. Bir katalogda kategoriya nomi
// takrorlanmaydi va har kategoriya bitta omborda turadi, shuning uchun
// "Fenlar" boshqa omborda band bo'lsa, tanlangan omborda "Fenlar (Sklad 2)"
// ochiladi — o'tkazmalardagi qoida bilan bir xil (lib/otkazma-server.ts).
// Omborga biriktirilmagan qism — "Markaziy ombor".

import { nomKaliti } from './utils'

/** Omborsiz qismning nomi (kategoriya qo'shimchasida: "Fenlar (Markaziy)") */
export const MARKAZIY = 'Markaziy'

const MARKAZIY_KALITLARI = new Set([nomKaliti(MARKAZIY), nomKaliti(`${MARKAZIY} ombor`)])

/** "Markaziy" / "Markaziy ombor" (har qanday yozuvda) — bu omborsiz qism, yangi ombor nomi emas. */
export function markaziyNomimi(nomi: string): boolean {
  return MARKAZIY_KALITLARI.has(nomKaliti(nomi))
}

export interface KategoriyaQisqa {
  id: string
  nomi: string
  omborId: string | null
}

/** Maqsad ombor: `id: null` — Markaziy ombor (omborsiz). */
export interface MaqsadOmbor {
  id: string | null
  nomi: string | null
}

/** Nomlarni solishtirish: bazadagi `mode: 'insensitive'` kabi, bo'shliqlar tekislanadi */
const kichik = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()

/**
 * Qavsdagi ombor qo'shimchasini olib tashlaydi: "Fenlar (Markaziy)" →
 * "Fenlar", "Fenlar (Sklad 3)" → "Fenlar" (Sklad omborining 3-nusxasi).
 * Qavsdagi qism ombor nomi bo'lmasa ("Kabel (USB)") nom o'zgarmaydi.
 */
export function asosiyNom(nomi: string, omborNomlari: string[]): string {
  const toza = nomi.trim().replace(/\s+/g, ' ')
  const m = /^(.+) \(([^()]+)\)$/.exec(toza)
  if (!m) return toza
  const omborlar = new Set([kichik(MARKAZIY), ...omborNomlari.map(kichik)])
  const ichki = kichik(m[2])
  return omborlar.has(ichki) || omborlar.has(ichki.replace(/ \d$/, '')) ? m[1] : toza
}

/**
 * Kategoriya nomini maqsad omborga moslaydi.
 *
 * Nomzodlar: "Fenlar", "Fenlar (Sklad)", "Fenlar (Sklad 2)" … — birinchisi
 * shu omborda bo'lsa o'sha qaytadi, boshqa omborda band bo'lsa keyingisi,
 * hech qayerda yo'q bo'lsa — shu nom bilan YANGI kategoriya ochiladi.
 * `null` — 10 ta nomzodning hammasi boshqa omborlarda band (amalda bo'lmaydi).
 */
export function omborKategoriyasi(
  nomi: string,
  ombor: MaqsadOmbor,
  kategoriyalar: KategoriyaQisqa[],
  omborNomlari: string[],
): { mavjud: KategoriyaQisqa } | { yangi: string } | null {
  const asosiy = asosiyNom(nomi, omborNomlari)
  if (!asosiy) return null
  const qoshimcha = ombor.nomi?.trim() || MARKAZIY
  const nomzodlar = [asosiy, `${asosiy} (${qoshimcha})`]
  for (let i = 2; i <= 9; i++) nomzodlar.push(`${asosiy} (${qoshimcha} ${i})`)
  for (const n of nomzodlar) {
    const band = kategoriyalar.find(k => kichik(k.nomi) === kichik(n))
    if (!band) return { yangi: n }
    if (band.omborId === ombor.id) return { mavjud: band }
  }
  return null
}
