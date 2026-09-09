// Sodiqlik dasturi — BALLAR va KESHBEKLAR uchun yagona manba.
//
// Ikkita MUSTAQIL hisob yuritiladi:
//   • BALL    — ochko. "Har N so'm xaridga M ball" qoidasi bo'yicha to'planadi.
//   • KESHBEK — so'm. "Xarid summasining X foizi" qoidasi bo'yicha to'planadi.
//
// Ikkalasi ham kassada chegirma sifatida sarflanadi. Keshbek to'g'ridan-to'g'ri
// so'm (1:1), ball esa admin belgilagan kurs bo'yicha ("1 ball = shuncha so'm").
// Ball kursi 0 bo'lsa — ball sarflanmaydi, faqat to'planadi (reyting uchun).
//
// Bu fayl serverga bog'liq emas (prisma import qilmaydi) — client va route'lar
// AYNAN shu funksiyalarni chaqiradi, shuning uchun kassada ko'ringan summa
// bilan bazaga yozilgani hech qachon farq qilmaydi.

export type SodiqlikHisobKalit = 'BALL' | 'KESHBEK'

export interface SodiqlikSozlama {
  /** Dastur umuman ishlayaptimi. O'chirilsa hech narsa to'planmaydi va
   *  sarflanmaydi (mavjud balanslar joyida qoladi). */
  faol: boolean

  // ── Ball to'plash qoidasi ──
  /** Har shuncha so'm xaridga... (0 bo'lsa ball to'planmaydi) */
  ballHarSumma: number
  /** ...shuncha ball beriladi. */
  ballMiqdori: number
  /** Sarflashda 1 ball necha so'mga teng. 0 = ball sarflanmaydi. */
  ballSomQiymati: number

  // ── Keshbek to'plash qoidasi ──
  /** Xarid summasining foizi (0 bo'lsa keshbek to'planmaydi). */
  keshbekFoiz: number

  /** Bitta sotuvda ball+keshbek bilan qoplash mumkin bo'lgan eng katta
   *  ulush (%). 100 = butun chekni ballar bilan yopish mumkin. Do'kon
   *  "kamida yarmi pul bilan to'lansin" desa — 50 qo'yadi. */
  maksQoplashFoiz: number

  /** Nasiya sotuvda ham to'planadimi. Standart: yo'q — pul hali kelmagan. */
  nasiyagaHam: boolean
}

export const SODIQLIK_STANDART: SodiqlikSozlama = {
  faol: false,
  ballHarSumma: 1_000_000,
  ballMiqdori: 0.5,
  ballSomQiymati: 0,
  keshbekFoiz: 0,
  maksQoplashFoiz: 100,
  nasiyagaHam: false,
}

/** Sozlama jadvalidagi kalitlar — bitta joyda, chalkashmasin. */
export const SODIQLIK_KALITLARI = {
  faol: 'sodiqlik_faol',
  ballHarSumma: 'sodiqlik_ball_har_summa',
  ballMiqdori: 'sodiqlik_ball_miqdori',
  ballSomQiymati: 'sodiqlik_ball_som_qiymati',
  keshbekFoiz: 'sodiqlik_keshbek_foiz',
  maksQoplashFoiz: 'sodiqlik_maks_qoplash_foiz',
  nasiyagaHam: 'sodiqlik_nasiyaga_ham',
} as const satisfies Record<keyof SodiqlikSozlama, string>

function son(qiymat: unknown, standart: number, min = 0): number {
  const n = typeof qiymat === 'number' ? qiymat : parseFloat(String(qiymat ?? '').replace(/\s/g, ''))
  if (!Number.isFinite(n) || n < min) return standart
  return n
}

/** Sozlama jadvalidan (kalit → qiymat) o'qilgan xom matnlarni tipli
 *  obyektga aylantiradi. Yo'q yoki buzuq qiymat standartga qaytadi. */
export function sozlamaniOqi(xom: Record<string, string | undefined>): SodiqlikSozlama {
  return {
    faol: xom[SODIQLIK_KALITLARI.faol] === 'true',
    ballHarSumma: son(xom[SODIQLIK_KALITLARI.ballHarSumma], SODIQLIK_STANDART.ballHarSumma),
    ballMiqdori: son(xom[SODIQLIK_KALITLARI.ballMiqdori], SODIQLIK_STANDART.ballMiqdori),
    ballSomQiymati: son(xom[SODIQLIK_KALITLARI.ballSomQiymati], SODIQLIK_STANDART.ballSomQiymati),
    keshbekFoiz: son(xom[SODIQLIK_KALITLARI.keshbekFoiz], SODIQLIK_STANDART.keshbekFoiz),
    maksQoplashFoiz: Math.min(100, son(xom[SODIQLIK_KALITLARI.maksQoplashFoiz], SODIQLIK_STANDART.maksQoplashFoiz)),
    nasiyagaHam: xom[SODIQLIK_KALITLARI.nasiyagaHam] === 'true',
  }
}

/** Tipli sozlamani jadvalga yozish uchun matnlarga aylantiradi. */
export function sozlamaniYoz(s: SodiqlikSozlama): Record<string, string> {
  return {
    [SODIQLIK_KALITLARI.faol]: String(s.faol),
    [SODIQLIK_KALITLARI.ballHarSumma]: String(s.ballHarSumma),
    [SODIQLIK_KALITLARI.ballMiqdori]: String(s.ballMiqdori),
    [SODIQLIK_KALITLARI.ballSomQiymati]: String(s.ballSomQiymati),
    [SODIQLIK_KALITLARI.keshbekFoiz]: String(s.keshbekFoiz),
    [SODIQLIK_KALITLARI.maksQoplashFoiz]: String(s.maksQoplashFoiz),
    [SODIQLIK_KALITLARI.nasiyagaHam]: String(s.nasiyagaHam),
  }
}

/** Kelgan xom obyektni (masalan so'rov tanasi) tekshirib sozlamaga aylantiradi. */
export function sozlamaniTasdiqla(xom: unknown): SodiqlikSozlama {
  const o = (xom ?? {}) as Record<string, unknown>
  return {
    faol: o.faol === true || o.faol === 'true',
    ballHarSumma: son(o.ballHarSumma, SODIQLIK_STANDART.ballHarSumma),
    ballMiqdori: son(o.ballMiqdori, SODIQLIK_STANDART.ballMiqdori),
    ballSomQiymati: son(o.ballSomQiymati, SODIQLIK_STANDART.ballSomQiymati),
    keshbekFoiz: Math.min(100, son(o.keshbekFoiz, SODIQLIK_STANDART.keshbekFoiz)),
    maksQoplashFoiz: Math.min(100, son(o.maksQoplashFoiz, SODIQLIK_STANDART.maksQoplashFoiz)),
    nasiyagaHam: o.nasiyagaHam === true || o.nasiyagaHam === 'true',
  }
}

// ─── Hisoblash ───────────────────────────────────────────────────────────────

/** Ballni 2 xonagacha yaxlitlash — 0.5 ball kabi kasr qiymatlar aniq
 *  saqlanishi, lekin cheksiz kasr to'planib ketmasligi uchun. */
function ballYaxlit(n: number): number {
  return Math.floor(n * 100) / 100
}

/**
 * Xarid summasidan qancha ball to'planishini hisoblaydi.
 *
 * PROPORSIONAL: "har 1 000 000 so'mga 0.5 ball" qoidasida 1 500 000 so'mlik
 * xarid 0.75 ball beradi. Blok-blok sanash (1.9 mln ham 0.5 ball) mijoz
 * uchun adolatsiz ko'rinardi.
 */
export function hisoblaBall(summa: number, s: SodiqlikSozlama): number {
  if (!s.faol) return 0
  if (!(summa > 0) || !(s.ballHarSumma > 0) || !(s.ballMiqdori > 0)) return 0
  return ballYaxlit((summa / s.ballHarSumma) * s.ballMiqdori)
}

/** Xarid summasidan qancha keshbek (so'm) to'planishini hisoblaydi. */
export function hisoblaKeshbek(summa: number, s: SodiqlikSozlama): number {
  if (!s.faol) return 0
  if (!(summa > 0) || !(s.keshbekFoiz > 0)) return 0
  return Math.floor((summa * s.keshbekFoiz) / 100)
}

/** Ball balansining so'mdagi qiymati. Kurs 0 bo'lsa — 0 (sarflanmaydi). */
export function ballSomda(ball: number, s: SodiqlikSozlama): number {
  if (!(s.ballSomQiymati > 0) || !(ball > 0)) return 0
  return Math.floor(ball * s.ballSomQiymati)
}

/** Ball sarflanishi mumkinmi (kurs belgilanganmi). */
export function ballSarflanadimi(s: SodiqlikSozlama): boolean {
  return s.faol && s.ballSomQiymati > 0
}

/**
 * Bitta sotuvda ball+keshbek bilan qoplash mumkin bo'lgan eng katta summa.
 * `maksQoplashFoiz` chekning shundan ortig'ini ballar bilan yopishga
 * yo'l qo'ymaydi (do'kon "kamida yarmi pul bo'lsin" deya olsin).
 */
export function maksQoplash(chekSummasi: number, s: SodiqlikSozlama): number {
  if (!s.faol || !(chekSummasi > 0)) return 0
  return Math.floor((chekSummasi * s.maksQoplashFoiz) / 100)
}

export interface SarflashKiritma {
  /** Sarflanadigan ball miqdori (ochko). */
  ball?: number
  /** Sarflanadigan keshbek (so'm). */
  keshbek?: number
}

export interface SarflashNatija {
  /** Haqiqatda sarflanadigan ball (balans va chegaralarga moslangan). */
  ball: number
  /** Haqiqatda sarflanadigan keshbek so'mi. */
  keshbek: number
  /** Chekdan ayiriladigan umumiy summa (ball so'mda + keshbek). */
  jamiChegirma: number
  /** Chegara tufayli so'ralgandan kam berilgan bo'lsa — sabab. */
  ogohlantirish: string | null
}

/**
 * So'ralgan sarflashni balans va qoidalarga moslashtiradi.
 *
 * Client ham, server ham AYNAN shuni chaqiradi — brauzer yuborgan qiymat
 * buzilgan bo'lsa ham bazaga har doim mumkin bo'lgan miqdor yoziladi va
 * balans hech qachon manfiyga ketmaydi.
 *
 * Tartib: avval KESHBEK (so'm, tabiiy ravishda 1:1), keyin qolganiga BALL.
 * Sababi — keshbekning "muddati" tugashi ehtimoli ko'proq, avval u ishlatilsin.
 */
export function sarflashniHisobla(params: {
  chekSummasi: number
  ballBalans: number
  keshbekBalans: number
  soralgan: SarflashKiritma
  sozlama: SodiqlikSozlama
}): SarflashNatija {
  const { chekSummasi, ballBalans, keshbekBalans, soralgan, sozlama: s } = params
  const bosh: SarflashNatija = { ball: 0, keshbek: 0, jamiChegirma: 0, ogohlantirish: null }

  if (!s.faol || !(chekSummasi > 0)) return bosh

  const shift = maksQoplash(chekSummasi, s)
  if (shift <= 0) return bosh

  let qolganShift = shift
  let cheklandi = false

  // 1) Keshbek — so'mda, 1:1
  const soralganKeshbek = Math.max(0, Math.floor(Number(soralgan.keshbek) || 0))
  let keshbek = Math.min(soralganKeshbek, Math.floor(Math.max(0, keshbekBalans)), qolganShift)
  if (keshbek < soralganKeshbek) cheklandi = true
  qolganShift -= keshbek

  // 2) Ball — kurs bo'yicha so'mga o'giriladi
  let ball = 0
  let ballSom = 0
  if (ballSarflanadimi(s) && qolganShift > 0) {
    const soralganBall = Math.max(0, Number(soralgan.ball) || 0)
    const mumkinBall = Math.min(soralganBall, Math.max(0, ballBalans))
    // Shiftdan oshmasligi uchun ball miqdorini ham cheklaymiz
    const shiftBall = qolganShift / s.ballSomQiymati
    ball = ballYaxlit(Math.min(mumkinBall, shiftBall))
    ballSom = ballSomda(ball, s)
    if (ball < soralganBall) cheklandi = true
  } else if ((Number(soralgan.ball) || 0) > 0) {
    cheklandi = true
  }

  const jami = keshbek + ballSom
  // Yaxlitlash tufayli 1 so'mga oshib ketmasin
  if (jami > shift) {
    keshbek = Math.max(0, keshbek - (jami - shift))
  }

  return {
    ball,
    keshbek,
    jamiChegirma: keshbek + ballSom,
    ogohlantirish: cheklandi
      ? `Sarflash cheklandi — balans yoki chekning ${s.maksQoplashFoiz}% chegarasi`
      : null,
  }
}

/**
 * Sotuvdan keyin to'planadigan ball va keshbek.
 *
 * MUHIM: to'plash bazasi — mijoz HAQIQATDA to'lagan summa, ya'ni ballar
 * bilan qoplangan qism CHIQARIB tashlanadi. Aks holda keshbek o'z ustiga
 * keshbek berib, cheksiz aylanma hosil qilardi.
 */
export function sotuvdanToplanadi(params: {
  yakuniySumma: number
  sarflanganKeshbek?: number
  sarflanganBallSomda?: number
  tolovUsuli: string
  sozlama: SodiqlikSozlama
}): { ball: number; keshbek: number; baza: number } {
  const { yakuniySumma, tolovUsuli, sozlama: s } = params
  const bosh = { ball: 0, keshbek: 0, baza: 0 }

  if (!s.faol) return bosh
  // Sherik do'konga jo'natish sotuv emas — hisobotlarda ham chiqarilgan.
  if (tolovUsuli === 'SHERIK') return bosh
  // Nasiyada pul hali kelmagan — admin ataylab yoqmasa, to'planmaydi.
  if (tolovUsuli === 'NASIYA' && !s.nasiyagaHam) return bosh

  const qoplangan = (Number(params.sarflanganKeshbek) || 0) + (Number(params.sarflanganBallSomda) || 0)
  const baza = Math.max(0, (Number(yakuniySumma) || 0) - qoplangan)
  if (baza <= 0) return bosh

  return { ball: hisoblaBall(baza, s), keshbek: hisoblaKeshbek(baza, s), baza }
}

/** Ballni ko'rsatish uchun formatlash — 2.00 emas, 2; 0.50 emas, 0.5 */
export function formatBall(ball: number | string): string {
  const n = typeof ball === 'number' ? ball : parseFloat(String(ball))
  if (!Number.isFinite(n)) return '0'
  return String(Math.round(n * 100) / 100)
}
