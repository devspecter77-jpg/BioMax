// Ruxsatlar bo'limi — xodim ruxsatlarining holati va o'zgartirish rejasi.
//
// Sof mantiq (prisma import qilmaydi): API marshruti bazadan o'qiydi, shu
// yerda hisoblaydi va natijani yozadi. Shuning uchun "nima saqlanadi, nima
// jurnalga tushadi" qoidalari sinovlarda bazasiz tekshiriladi.
//
// Saqlash qoidasi: `Ruxsat` jadvalida faqat rol standartidan FARQ qiladigan
// qiymatlar turadi. Ega qiymatni standartga qaytarsa, qator o'chiriladi —
// shunda keyinchalik rol standarti o'zgarsa, xodim ham unga ergashadi, "Standart"
// belgisi esa ekranda haqiqatni ko'rsatadi.

import { katalogBoyicha, rolStandartRuxsat, samaraliRuxsatlar, tekisKatalog } from './ruxsat-katalogi'

export interface KalitHolati {
  /** Ega belgilagan (yoki standart) qiymat */
  qiymat: boolean
  /** Rol bo'yicha standart */
  standart: boolean
  /** Standartdan farq qiladi (bazada alohida yozuv bor) */
  ozgartirilgan: boolean
  /** Haqiqatda ishlaydimi — ota bo'lim yopiq bo'lsa `false` */
  samarali: boolean
}

export type XodimHolati = Record<string, KalitHolati>

/**
 * Xodimning barcha kalitlari bo'yicha holati.
 * @param alohida  `Ruxsat` jadvalidagi yozuvlar (kalit → korinadi)
 * @param yashirinMaydonlar  `MaydonYashirish` dagi maydonlar (masalan `kelishNarxi`)
 */
export function xodimHolati(rol: string, alohida: Map<string, boolean>, yashirinMaydonlar: Set<string>): XodimHolati {
  const samarali = new Set(samaraliRuxsatlar(rol, alohida))
  const natija: XodimHolati = {}
  for (const r of tekisKatalog) {
    if (r.turi === 'maydon') {
      const ochiq = !yashirinMaydonlar.has(r.maydon!)
      natija[r.kalit] = { qiymat: ochiq, standart: true, ozgartirilgan: !ochiq, samarali: ochiq }
      continue
    }
    const standart = r.doimOchiq ? true : rolStandartRuxsat(rol, r.kalit)
    const qiymat = r.doimOchiq || rol === 'ADMIN' ? true : (alohida.has(r.kalit) ? alohida.get(r.kalit)! : standart)
    natija[r.kalit] = {
      qiymat,
      standart,
      ozgartirilgan: rol !== 'ADMIN' && !r.doimOchiq && qiymat !== standart,
      samarali: rol === 'ADMIN' || samarali.has(r.kalit),
    }
  }
  return natija
}

export interface JurnalQatori {
  kalit: string
  eski: boolean
  yangi: boolean
}

export interface OzgarishRejasi {
  /** `Ruxsat` ga yoziladigan (standartdan farqli) qiymatlar */
  yozish: { kalit: string; korinadi: boolean }[]
  /** Standartga qaytgani uchun o'chiriladigan `Ruxsat` yozuvlari */
  ochirish: string[]
  /** `MaydonYashirish` ga qo'shiladigan / olib tashlanadigan maydonlar */
  maydonYashir: string[]
  maydonKorsat: string[]
  jurnal: JurnalQatori[]
  /** Katalogda yo'q yoki o'zgartirib bo'lmaydigan kalitlar (e'tiborsiz qoldirildi) */
  rad: string[]
}

/**
 * So'ralgan qiymatlardan o'zgarish rejasi.
 *
 * @param soralgan  faqat o'zgartirilishi kerak bo'lgan kalitlar (kalit → yangi qiymat)
 * @param faqatMaydon  administrator hisobi: bo'lim/amal cheklanmaydi, faqat maydonlar
 */
export function ozgarishRejasi(
  rol: string,
  alohida: Map<string, boolean>,
  yashirinMaydonlar: Set<string>,
  soralgan: Record<string, unknown>,
  faqatMaydon = false,
): OzgarishRejasi {
  const joriy = xodimHolati(rol, alohida, yashirinMaydonlar)
  const reja: OzgarishRejasi = { yozish: [], ochirish: [], maydonYashir: [], maydonKorsat: [], jurnal: [], rad: [] }

  for (const [kalit, xom] of Object.entries(soralgan)) {
    const r = katalogBoyicha.get(kalit)
    if (!r || typeof xom !== 'boolean' || r.doimOchiq || (faqatMaydon && r.turi !== 'maydon')) {
      reja.rad.push(kalit)
      continue
    }
    const h = joriy[kalit]!
    if (h.qiymat === xom) continue

    if (r.turi === 'maydon') {
      if (xom) reja.maydonKorsat.push(r.maydon!)
      else reja.maydonYashir.push(r.maydon!)
    } else if (xom === h.standart) {
      reja.ochirish.push(kalit)
    } else {
      reja.yozish.push({ kalit, korinadi: xom })
    }
    reja.jurnal.push({ kalit, eski: h.qiymat, yangi: xom })
  }
  return reja
}

/** Boshqa xodimdan nusxa: manbaning har bir qiymati nishonga so'raladi (maydonlar ham). */
export function nusxaSorovi(manba: XodimHolati): Record<string, boolean> {
  const soralgan: Record<string, boolean> = {}
  for (const r of tekisKatalog) {
    if (r.doimOchiq) continue
    soralgan[r.kalit] = manba[r.kalit]!.qiymat
  }
  return soralgan
}

/** Rol standartiga qaytarish so'rovi — barcha kalit standart qiymatga, maydonlar ochiq. */
export function standartSorovi(rol: string): Record<string, boolean> {
  const soralgan: Record<string, boolean> = {}
  for (const r of tekisKatalog) {
    if (r.doimOchiq) continue
    soralgan[r.kalit] = r.turi === 'maydon' ? true : rolStandartRuxsat(rol, r.kalit)
  }
  return soralgan
}

/** Ro'yxat uchun qisqa xulosa: nechta bo'lim ochiq, nechta standartdan farq. */
export function holatXulosasi(h: XodimHolati): { bolimlar: number; jamiBolim: number; amallar: number; jamiAmal: number; ozgartirilgan: number } {
  let bolimlar = 0, jamiBolim = 0, amallar = 0, jamiAmal = 0, ozgartirilgan = 0
  for (const r of tekisKatalog) {
    const k = h[r.kalit]!
    if (k.ozgartirilgan) ozgartirilgan++
    if (r.doimOchiq) continue
    if (!r.ota) {
      jamiBolim++
      if (k.samarali) bolimlar++
    } else if (r.turi === 'amal') {
      jamiAmal++
      if (k.samarali) amallar++
    }
  }
  return { bolimlar, jamiBolim, amallar, jamiAmal, ozgartirilgan }
}
