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
 * Nutq uchun 12 kbit/s (Opus) — aniq eshitiladi va yengil. Chrome'da
 * o'lchangan (2026-10-11): jimlikda ~7, nutqda ~10 kbit/s, ya'ni 8 soatlik
 * smena ≈ 24–35 MB (16 kbit/s da 28–56 MB edi). Yozuvlar endi bazada
 * saqlanadi — har megabayt muhim. Brauzer buni qo'llamasa (Safari AAC)
 * o'zining standartini ishlatadi.
 */
export const BITREYT = 12_000
/** Ilova serverga "tirikman" belgisini shu oraliqda yuboradi. */
export const PULS_MS = 60_000

// ─── Deyarli jonli eshitish ─────────────────────────────────────────────────
//
// Haqiqiy jonli (WebRTC) uchun doimiy ulanish kerak — Vercel serverless uni
// ushlab turmaydi. Shuning uchun boshqa yo'l: administrator tinglayotganda
// kuryer ilovasi ovozni UZUN (3 daqiqa) emas, QISQA bo'laklarga bo'lib
// darhol yuboradi; admin sahifasi yangi bo'lakni kelishi bilan o'ynatadi.
// Natijada ovoz ~15-20 soniya kechikish bilan eshitiladi va o'sha bo'laklar
// odatdagidek bazada saqlanib qoladi — alohida nusxa yaratilmaydi.

/** Jonli tinglash paytidagi bo'lak uzunligi. */
export const JONLI_BOLAK_MS = 12_000
/**
 * Admin shu vaqt ichida qayta bildirmasa — tinglash tugadi deb hisoblanadi.
 * So'rov oralig'idan (4 s) ancha katta: sekin internetda bir-ikki so'rov
 * kechiksa belgi eskirib, kuryer ilovasi qisqa/uzun rejim orasida tebranib
 * ketardi (bo'lak o'rtasida uzilish).
 */
export const JONLI_KUZATUV_MS = 45_000
/** Admin sahifasi yangi bo'laklarni shu oraliqda so'raydi. */
export const JONLI_SOROV_MS = 4_000
/**
 * Kuryer ilovasi "meni tinglashyaptimi?" deb shu oraliqda so'raydi — smena
 * ochiq bo'lsa. So'rov juda yengil (bitta ustun), lekin admin tugmani
 * bosgandan keyin ovoz tez boshlanishi uchun shart: odatdagi puls (60 s)
 * bilan birinchi ovozni bir daqiqagacha kutishga to'g'ri kelardi.
 */
export const JONLI_TEKSHIR_MS = 15_000
/**
 * Jonli pleer shundan ko'p orqada qolsa oxirgi bo'lakka o'tadi: eshituvchi
 * "hozir"dan uzoqlashib ketmasin (masalan ilova fonda turib qolgan bo'lsa).
 */
export const JONLI_ORQADA_MS = 90_000
/** Shundan uzoq puls kelmasa — "aloqa yo'q" (ilova yopilgan yoki internet yo'q). */
export const ALOQA_YOQ_MS = 3 * 60_000
/** Smena shuncha vaqt puls bermasa avtomatik yopiladi (unutib qo'yilgan). */
export const UNUTILGAN_SMENA_MS = 12 * 3_600_000
/** Qurilmada yuborilmagan yozuvlar shu hajmdan oshsa eng eskilari o'chadi. */
export const NAVBAT_MAX_BAYT = 400 * 1024 * 1024

/** Yozuvlarni saqlash muddati tanlovlari (kun). */
export const SAQLASH_VARIANTLARI = [7, 14, 30, 60, 90] as const
export const SAQLASH_STANDART = 30

/**
 * Bazadagi ovozlar uchun hajm chegarasi (MB). To'lsa eng eski yozuvlar
 * o'chadi — ovoz hech qachon bazani to'ldirib, kassani to'xtatib qo'ymasin.
 * Standart 250 MB: Neon bepul tarifi ~0,5 GB, ERP'ning o'ziga va o'chirilgan
 * ma'lumotning tarix (tiklash) nusxasiga joy qolsin.
 */
export const BAZA_CHEGARA_VARIANTLARI = [100, 250, 500, 1000, 2000, 5000] as const
export const BAZA_CHEGARA_STANDART = 250

/** Ilova serverga xabar qiladigan yozuv holati. */
export type YozuvHolati =
  | 'yozilmoqda'
  | 'uzilgan'      // mikrofon to'xtadi (qo'ng'iroq, boshqa ilova, ekran qulflandi)
  | 'ruxsat_yoq'   // foydalanuvchi mikrofonga ruxsat bermadi
  | 'qollanmaydi'  // brauzer ovoz yozishni bilmaydi
  | 'joy_yoq'      // qurilmada yuborilmagan yozuvlar juda ko'p
  | 'ombor_yoq'    // serverda ovoz ombori sozlanmagan
  | 'ovoz_yoq'     // yozuv ketyapti, lekin mikrofondan ovoz kelmayapti (o'chirilgan/noto'g'ri qurilma)

export const YOZUV_HOLATLARI: readonly YozuvHolati[] = [
  'yozilmoqda', 'uzilgan', 'ruxsat_yoq', 'qollanmaydi', 'joy_yoq', 'ombor_yoq', 'ovoz_yoq',
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
  ovoz_yoq: 'Mikrofon ovoz bermayapti',
}

/**
 * Bo'lakdagi eng baland lahza (`darajaMax`, 0..1) shundan past bo'lsa —
 * butun bo'lakda eshitiladigan hech narsa yo'q. O'rtacha daraja bunga
 * yaramaydi: 3 daqiqalik jimlik ichidagi 10 soniyalik suhbat o'rtachani
 * pastga tortadi va bo'lak "jim" deb o'tkazib yuborilardi.
 */
export const JIM_MAX_CHEGARA = 0.06
/** Shundan past — mikrofon umuman signal bermagan (o'chirilgan, noto'g'ri qurilma). */
export const OVOZSIZ_CHEGARA = 0.002

export type BolakOvozi = 'ovozli' | 'jim' | 'ovozsiz' | 'nomalum'

/**
 * Bo'lakda ovoz bormi. Yangi bo'laklar `darajaMax` bo'yicha, eskilari
 * (faqat o'rtacha saqlangan) — o'rtacha bo'yicha, ehtiyotkor chegarada.
 */
export function bolakOvozi(daraja: number | null, darajaMax: number | null): BolakOvozi {
  if (darajaMax !== null) {
    if (darajaMax < OVOZSIZ_CHEGARA) return 'ovozsiz'
    return darajaMax < JIM_MAX_CHEGARA ? 'jim' : 'ovozli'
  }
  if (daraja === null) return 'nomalum'
  if (daraja < OVOZSIZ_CHEGARA) return 'ovozsiz'
  return daraja < 0.03 ? 'jim' : 'ovozli'
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
