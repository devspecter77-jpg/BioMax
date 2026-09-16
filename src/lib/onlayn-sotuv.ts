// Onlayn buyurtma → ERP zaxira va sotuv: sof hisob-kitob (bazasiz).
//
// Bazaga tegadigan qism `onlayn-sotuv-server.ts` da. Bu yerdagi qoidalar
// alohida, chunki ular pul va qoldiqqa bevosita ta'sir qiladi — sinovsiz
// o'zgarmasligi kerak.

/** Rezerv shu muddatdan keyin o'z-o'zidan bo'shaydi (har bosqichda uzaytiriladi). */
export const REZERV_SOAT = 48

export interface ZaxiraQatori {
  tovarId: string
  nomi: string
  miqdor: number
}

export interface Qoldiq {
  omborQoldiq: number
  dokonQoldiq: number
}

/**
 * Band qilish mumkinmi. Mavjud = ombor + do'kon − boshqa buyurtmalar band qilgani.
 *
 * Qaytadi: yetmayotgan qatorlar (bo'sh massiv — hammasi yetadi). Xodimga
 * aniq son ko'rsatiladi: bu ERP ichidagi ma'lumot, saytga chiqmaydi.
 */
export function yetmayotganlar(
  qatorlar: ZaxiraQatori[],
  qoldiq: Map<string, Qoldiq>,
  band: Map<string, number>,
): { nomi: string; kerak: number; bor: number }[] {
  // Bir mahsulot ikki qatorda kelsa ham yig'indisi tekshiriladi
  const kerak = new Map<string, { nomi: string; miqdor: number }>()
  for (const q of qatorlar) {
    const bor = kerak.get(q.tovarId)
    kerak.set(q.tovarId, { nomi: q.nomi, miqdor: (bor?.miqdor ?? 0) + q.miqdor })
  }
  const natija: { nomi: string; kerak: number; bor: number }[] = []
  for (const [tovarId, k] of kerak) {
    const q = qoldiq.get(tovarId) ?? { omborQoldiq: 0, dokonQoldiq: 0 }
    const mavjud = Math.max(0, q.omborQoldiq + q.dokonQoldiq - (band.get(tovarId) ?? 0))
    if (k.miqdor > mavjud + 1e-9) natija.push({ nomi: k.nomi, kerak: k.miqdor, bor: yumaloq(mavjud) })
  }
  return natija
}

/**
 * Topshirilgan buyurtma qaysi joydan chiqariladi.
 *
 * Kassa kabi sotuv DO'KONdan yoziladi. Do'konda yetmasa farq avval
 * ombordan do'konga O'TKAZILADI (bu haqiqatda ham shunday: xodim tovarni
 * ombordan olib chiqadi) — shunda ombor va do'kon qoldig'i alohida-alohida
 * to'g'ri qoladi. Omborda ham yetmasa, qolgani do'kondan yoziladi (kassa
 * ham manfiy sotuvga ruxsat beradi; tovar qo'lda topshirilgan — hisob
 * xatosi keyin inventarizatsiyada tuzatiladi).
 */
export function chiqimRejasi(miqdor: number, q: Qoldiq): { ombordanOtkazma: number; dokondanChiqim: number } {
  const dokonda = Math.max(0, q.dokonQoldiq)
  const yetmaydi = Math.max(0, miqdor - dokonda)
  const ombordanOtkazma = yumaloq(Math.min(yetmaydi, Math.max(0, q.omborQoldiq)))
  return { ombordanOtkazma, dokondanChiqim: yumaloq(miqdor) }
}

/** Uzaytirilgan amal qilish muddati. */
export function rezervMuddati(hozir: number = Date.now()): Date {
  return new Date(hozir + REZERV_SOAT * 3_600_000)
}

/**
 * Bazadagi mijoz telefoni turli formatda: "+998901234567", "998901234567",
 * "901234567". Onlayn xaridor (+998...) shu uchalasining istalganida topilsin —
 * aks holda bitta odam uchun ikkinchi mijoz kartasi ochilib, ballari bo'linib ketardi.
 */
export function telefonVariantlari(telefon: string): string[] {
  const r = telefon.replace(/\D/g, '')
  const toqqiz = r.slice(-9)
  if (toqqiz.length !== 9) return [telefon]
  return [`+998${toqqiz}`, `998${toqqiz}`, toqqiz, `+998 ${toqqiz.slice(0, 2)} ${toqqiz.slice(2, 5)} ${toqqiz.slice(5, 7)} ${toqqiz.slice(7)}`]
}

function yumaloq(n: number): number {
  return Math.round(n * 1000) / 1000
}
