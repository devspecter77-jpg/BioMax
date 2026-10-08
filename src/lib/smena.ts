// Ish smenasi va ovoz yozuvi — brauzer ham, server ham ishlatadigan sof qism
// (bazaga va brauzer API'lariga bog'liq emas).

/** Smena (ish boshlash/tugallash) qaysi rollarga tegishli. */
export const SMENA_ROLLARI = ['DOSTAVCHIK'] as const

export function smenaRolimi(rol: string | null | undefined): boolean {
  return !!rol && (SMENA_ROLLARI as readonly string[]).includes(rol)
}

/**
 * Bitta bo'lak — mustaqil o'ynaladigan alohida fayl. 3 daqiqa: ilova
 * yopilib qolsa ham ko'pi bilan oxirgi bir necha soniya yo'qoladi (bo'lak
 * ichida har 10 soniyada qurilmaga saqlanadi), fayl esa serverning yuklash
 * chegarasiga (4,5 MB) yuqori sifatli kodekda ham sig'adi.
 */
export const BOLAK_MS = 3 * 60_000
/** Bo'lak ichidagi qurilmaga saqlash oralig'i (MediaRecorder timeslice). */
export const QISM_MS = 10_000
/** Bitta bo'lakning eng katta hajmi — oshsa muddatidan oldin yopiladi. */
export const BOLAK_MAX_BAYT = 3_000_000
/** Server qabul qiladigan eng katta fayl. */
export const YUKLASH_MAX_BAYT = 4_400_000
/**
 * Nutq uchun 16 kbit/s (Opus) yetarli va aniq: soatiga ~7 MB. Brauzer
 * buni qo'llamasa (Safari AAC) o'zining standartini ishlatadi.
 */
export const BITREYT = 16_000
/** Ilova serverga "tirikman" belgisini shu oraliqda yuboradi. */
export const PULS_MS = 60_000
/** Shundan uzoq puls kelmasa — "aloqa yo'q" (ilova yopilgan yoki internet yo'q). */
export const ALOQA_YOQ_MS = 3 * 60_000
/** Smena shuncha vaqt puls bermasa avtomatik yopiladi (unutib qo'yilgan). */
export const UNUTILGAN_SMENA_MS = 12 * 3_600_000
/** Qurilmada yuborilmagan yozuvlar shu hajmdan oshsa yangisi yozilmaydi. */
export const NAVBAT_MAX_BAYT = 400 * 1024 * 1024

/** Yozuvlarni saqlash muddati tanlovlari (kun). */
export const SAQLASH_VARIANTLARI = [7, 14, 30, 60, 90] as const
export const SAQLASH_STANDART = 30

/** Ilova serverga xabar qiladigan yozuv holati. */
export type YozuvHolati =
  | 'yozilmoqda'
  | 'uzilgan'      // mikrofon to'xtadi (qo'ng'iroq, boshqa ilova, ekran qulflandi)
  | 'ruxsat_yoq'   // foydalanuvchi mikrofonga ruxsat bermadi
  | 'qollanmaydi'  // brauzer ovoz yozishni bilmaydi
  | 'joy_yoq'      // qurilmada yuborilmagan yozuvlar juda ko'p
  | 'ombor_yoq'    // serverda ovoz ombori sozlanmagan

export const YOZUV_HOLATLARI: readonly YozuvHolati[] = [
  'yozilmoqda', 'uzilgan', 'ruxsat_yoq', 'qollanmaydi', 'joy_yoq', 'ombor_yoq',
]

export function yozuvHolatimi(q: unknown): q is YozuvHolati {
  return typeof q === 'string' && (YOZUV_HOLATLARI as readonly string[]).includes(q)
}

export const YOZUV_HOLATI_MATNI: Record<YozuvHolati, string> = {
  yozilmoqda: 'Ovoz yozilmoqda',
  uzilgan: 'Yozuv uzilgan',
  ruxsat_yoq: 'Mikrofonga ruxsat yo‘q',
  qollanmaydi: 'Brauzer ovoz yozolmaydi',
  joy_yoq: 'Telefonda joy tugadi',
  ombor_yoq: 'Ovoz ombori sozlanmagan',
}

// ─── Vaqt (Toshkent, UTC+5, yozgi vaqt yo'q) ─────────────────────────────────

const TZ_MS = 5 * 3_600_000

/** Toshkent bo'yicha kun: "2026-10-06". */
export function toshkentKuni(sana: Date | string | number): string {
  const d = new Date(new Date(sana).getTime() + TZ_MS)
  return d.toISOString().slice(0, 10)
}

/** Toshkent bo'yicha kun boshlanishi (UTC vaqtda). */
export function kunBoshi(kun: string): Date {
  return new Date(new Date(`${kun}T00:00:00.000Z`).getTime() - TZ_MS)
}

/** "09:12" — Toshkent vaqti. */
export function soatMatni(sana: Date | string | number): string {
  const d = new Date(new Date(sana).getTime() + TZ_MS)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

/** "3 soat 24 daqiqa" / "12 daqiqa" / "40 soniya". */
export function davomiylikMatni(ms: number, qisqa = false): string {
  const s = Math.max(0, Math.round(ms / 1000))
  const soat = Math.floor(s / 3600)
  const daq = Math.floor((s % 3600) / 60)
  if (soat > 0) return qisqa ? `${soat} s ${daq} daq` : `${soat} soat ${daq} daqiqa`
  if (daq > 0) return qisqa ? `${daq} daq` : `${daq} daqiqa`
  return qisqa ? `${s} son` : `${s} soniya`
}

/** "03:24:10" — taymer. */
export function taymerMatni(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`
}

export function hajmMatni(bayt: number): string {
  if (bayt < 1024 * 1024) return `${Math.max(1, Math.round(bayt / 1024))} KB`
  if (bayt < 1024 * 1024 * 1024) return `${(bayt / 1024 / 1024).toFixed(1)} MB`
  return `${(bayt / 1024 / 1024 / 1024).toFixed(2)} GB`
}

// ─── Qamrov: smena davomida qancha vaqt yozilgan ─────────────────────────────

export interface Oraliq { dan: number; gacha: number }

/** Shundan qisqa uzilish bo'shliq hisoblanmaydi (bo'laklar orasidagi lahza). */
export const BOSHLIQ_MIN_MS = 30_000

/**
 * Smena davomida yozilgan vaqt, foizi va yozilmagan bo'shliqlar.
 * Bo'laklar bir-birini qoplashi ham mumkin (qayta ulanishda) — ular
 * birlashtirib hisoblanadi, ikki marta sanalmaydi.
 */
export function qamrovniHisobla(
  smena: { boshlandi: number; tugadi: number },
  bolaklar: Oraliq[],
): { yozilganMs: number; smenaMs: number; foiz: number; boshliqlar: Oraliq[] } {
  const smenaMs = Math.max(0, smena.tugadi - smena.boshlandi)
  const tartibli = bolaklar
    .map(b => ({ dan: Math.max(b.dan, smena.boshlandi), gacha: Math.min(b.gacha, smena.tugadi) }))
    .filter(b => b.gacha > b.dan)
    .sort((a, b) => a.dan - b.dan)

  const birlashgan: Oraliq[] = []
  for (const b of tartibli) {
    const oxirgi = birlashgan[birlashgan.length - 1]
    // Bo'laklar orasidagi qisqa lahza (yangi bo'lak ochilishi) — uzilish emas
    if (oxirgi && b.dan <= oxirgi.gacha + 2_000) oxirgi.gacha = Math.max(oxirgi.gacha, b.gacha)
    else birlashgan.push({ ...b })
  }

  const yozilganMs = birlashgan.reduce((s, b) => s + (b.gacha - b.dan), 0)
  const boshliqlar: Oraliq[] = []
  let kursor = smena.boshlandi
  for (const b of birlashgan) {
    if (b.dan - kursor >= BOSHLIQ_MIN_MS) boshliqlar.push({ dan: kursor, gacha: b.dan })
    kursor = Math.max(kursor, b.gacha)
  }
  if (smena.tugadi - kursor >= BOSHLIQ_MIN_MS) boshliqlar.push({ dan: kursor, gacha: smena.tugadi })

  const foiz = smenaMs > 0 ? Math.min(100, Math.round((yozilganMs / smenaMs) * 100)) : 0
  return { yozilganMs, smenaMs, foiz, boshliqlar }
}

/** Fayl kengaytmasi — MIME turidan (parametrlarsiz). */
export function kengaytma(mimeType: string): string {
  const t = mimeType.split(';')[0].trim().toLowerCase()
  if (t === 'audio/webm') return 'webm'
  if (t === 'audio/ogg') return 'ogg'
  if (t === 'audio/mp4' || t === 'audio/aac' || t === 'audio/x-m4a') return 'm4a'
  if (t === 'audio/mpeg') return 'mp3'
  if (t === 'audio/wav' || t === 'audio/wave') return 'wav'
  return 'bin'
}
