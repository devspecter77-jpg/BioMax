// Filiallararo ombor o'tkazmasi — sof mantiq (bazaga bog'liq emas).
//
// Bir bosqichli: hujjat yaratilishi bilan manba omborda tovar kamayadi,
// qabul omborda ko'payadi. "Yo'lda" holati yo'q.
//
// Client ham, server ham AYNAN shu tekshiruvlardan o'tadi — brauzerda
// ko'ringan xato bilan serverdagi xato bir xil bo'lsin.

export type OmborJoy = 'OMBOR' | 'DOKON'

export const JOY_LABEL: Record<OmborJoy, string> = {
  OMBOR: 'Ombor',
  DOKON: "Do'kon",
}

/** Filial tanlovi. `null` — Ega markaziy ombori (filialsiz katalog). */
export type FilialTanlov = string | null

export interface OtkazmaQator {
  tovarId: string
  /** Manbadagi mavjud qoldiq — tekshiruv shunga tayanadi. */
  mavjud: number
  miqdor: number
}

export interface OtkazmaKiritma {
  manbaFilialId: FilialTanlov
  qabulFilialId: FilialTanlov
  manbaJoy: OmborJoy
  qabulJoy: OmborJoy
  qatorlar: OtkazmaQator[]
}

export function joyMi(qiymat: unknown): qiymat is OmborJoy {
  return qiymat === 'OMBOR' || qiymat === 'DOKON'
}

/** Manba va qabul bir xil joymi (filial + ombor/do'kon juftligi). */
export function birXilManzil(k: {
  manbaFilialId: FilialTanlov
  qabulFilialId: FilialTanlov
  manbaJoy: OmborJoy
  qabulJoy: OmborJoy
}): boolean {
  return (k.manbaFilialId ?? null) === (k.qabulFilialId ?? null) && k.manbaJoy === k.qabulJoy
}

export interface TekshiruvNatija {
  ok: boolean
  /** Foydalanuvchiga ko'rsatiladigan birinchi xato. */
  xato: string | null
  /** Qaysi qatorlar muammoli — UI ularni belgilaydi. */
  xatoTovarlar: string[]
}

/**
 * O'tkazmani yakunlash mumkinmi.
 *
 * Tekshiriladi: manzil boshqacha, kamida bitta qator, miqdor > 0 va
 * manbadagi qoldiqdan oshmasligi. Qoldiqdan oshsa jimgina kamaytirilmaydi —
 * ombor hisobi kassirning e'tiborsizligini yashirmasligi kerak.
 */
export function otkazmaniTekshir(k: OtkazmaKiritma): TekshiruvNatija {
  if (birXilManzil(k)) {
    return { ok: false, xato: "Manba va qabul bir xil — boshqa ombor tanlang", xatoTovarlar: [] }
  }

  const qatorlar = k.qatorlar.filter(q => q.miqdor > 0)
  if (qatorlar.length === 0) {
    return { ok: false, xato: 'Kamida bitta mahsulot va miqdor kiriting', xatoTovarlar: [] }
  }

  // Bitta mahsulot ikki marta kiritilgan bo'lsa yig'indi qoldiqdan oshishi mumkin
  const jamiTalab = new Map<string, number>()
  for (const q of qatorlar) {
    jamiTalab.set(q.tovarId, (jamiTalab.get(q.tovarId) ?? 0) + q.miqdor)
  }

  const xatoTovarlar: string[] = []
  for (const q of qatorlar) {
    const talab = jamiTalab.get(q.tovarId) ?? 0
    // 0.0001 — kasrli miqdorlarda (kg, litr) yaxlitlash farqi uchun
    if (talab > q.mavjud + 0.0001) xatoTovarlar.push(q.tovarId)
  }

  if (xatoTovarlar.length > 0) {
    return {
      ok: false,
      xato: `Manbada yetarli emas — ${xatoTovarlar.length} ta mahsulotda miqdor qoldiqdan oshib ketgan`,
      xatoTovarlar: Array.from(new Set(xatoTovarlar)),
    }
  }

  return { ok: true, xato: null, xatoTovarlar: [] }
}

/** Manba/qabul nomini o'qiladigan qilib yozish: "Markaziy ombor · Ombor". */
export function manzilNomi(filialNomi: string | null | undefined, joy: OmborJoy): string {
  return `${filialNomi || 'Markaziy ombor'} · ${JOY_LABEL[joy]}`
}

/** Tanlangan joydagi qoldiqni qaytaradi (ombor/qoldiq maydonlaridan). */
export function joydagiQoldiq(
  tovar: { omborQoldiq?: number | null; dokonQoldiq?: number | null },
  joy: OmborJoy,
): number {
  const q = joy === 'OMBOR' ? tovar.omborQoldiq : tovar.dokonQoldiq
  const n = Number(q ?? 0)
  return Number.isFinite(n) && n > 0 ? n : 0
}
