// Mijoz KIM tomonidan va QAYERDAN qo'shilgani — kartada ko'rsatish uchun
// (brauzer va server uchun umumiy).

import { ROL_NOMI } from './rollar'

export const MIJOZ_MANBALARI = ['mijozlar', 'kassa', 'nasiya', 'import', 'nasiya_import', 'onlayn'] as const
export type MijozManbasi = (typeof MIJOZ_MANBALARI)[number]

const MANBA_NOMI: Record<MijozManbasi, string> = {
  mijozlar: 'Mijozlar bo‘limida',
  kassa: 'Kassada, sotuv paytida',
  nasiya: 'Nasiya yozishda',
  import: 'Excel’dan import',
  nasiya_import: 'Nasiyalar importida',
  onlayn: 'Onlayn do‘kon (sayt) orqali',
}

// Rollar nomi — `lib/rollar.ts` da (bu yerdan ham olinadi)
export { ROL_NOMI }

/** API qaytaradigan "kim qo'shgan" — login oshkor qilinmaydi. */
export interface MijozKiritgan {
  id: string
  ism: string
  rol: string
  /** Xodim hisobi o'chirilgan (arxivda) */
  arxiv: boolean
}

export interface KiritishMalumoti {
  /** Qo'shgan odam ismi; null — tizim (onlayn do'kon) yoki noma'lum */
  kim: string | null
  /** "Kassir", "Administrator"… */
  rol: string | null
  /** Qayerdan qo'shilgani, masalan "Kassada, sotuv paytida" */
  qayerda: string | null
  arxiv: boolean
  /** Kim qo'shgani yozilmagan — bu ma'lumot yuritilishidan oldingi mijoz */
  nomalum: boolean
}

export function kiritishMalumoti(m: { yaratgan?: MijozKiritgan | null; manba?: string | null; izoh?: string | null }): KiritishMalumoti {
  // Onlayn do'kondan ochilgan eski kartalar izohidan taniladi
  const onlayn = m.manba === 'onlayn' || (!m.manba && /^Onlayn do[‘'’`]kondan/.test(m.izoh ?? ''))
  const manba = onlayn ? 'onlayn' : m.manba
  const qayerda = manba && (MIJOZ_MANBALARI as readonly string[]).includes(manba) ? MANBA_NOMI[manba as MijozManbasi] : null
  if (m.yaratgan) {
    return { kim: m.yaratgan.ism, rol: ROL_NOMI[m.yaratgan.rol] ?? m.yaratgan.rol, qayerda, arxiv: m.yaratgan.arxiv, nomalum: false }
  }
  return { kim: null, rol: null, qayerda, arxiv: false, nomalum: !onlayn }
}

/** Qisqa matn: "Ali Valiyev · Kassir", "Onlayn do'kon" yoki "Noma'lum". */
export function kiritganQisqa(k: KiritishMalumoti): string {
  if (k.kim) return `${k.kim}${k.rol ? ` · ${k.rol}` : ''}${k.arxiv ? ' (o‘chirilgan)' : ''}`
  return k.nomalum ? 'Noma’lum' : 'Onlayn do‘kon'
}
