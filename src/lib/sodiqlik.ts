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
// Umumiy qoidaga QO'SHIMCHA qoidalar ham bor (SodiqlikQoidasi): chek summasi
// ("1 000 000 so'mlik xaridga 5 ball"), mahsulot yoki kategoriya ("shu
// mahsulotdan 5 dona olsa — har donasiga 2 ball va 3% keshbek").
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

// ─── Qo'shimcha qoidalar ─────────────────────────────────────────────────────

export type QoidaTuri = 'CHEK' | 'MAHSULOT' | 'KATEGORIYA'

export interface SodiqlikQoida {
  id: string
  turi: QoidaTuri
  tovarId: string | null
  kategoriyaId: string | null
  /** CHEK: to'langan summa kamida shuncha bo'lsa */
  minSumma: number
  /** MAHSULOT/KATEGORIYA: kamida shuncha dona (kg, litr…) olinsa */
  minMiqdor: number
  /** CHEK: bir martalik ball; MAHSULOT/KATEGORIYA: har bir dona uchun ball */
  ball: number
  /** CHEK: to'langan summadan %; MAHSULOT/KATEGORIYA: shu mahsulotlar summasidan % */
  keshbekFoiz: number
  faol: boolean
}

/** Sotuvning bitta qatori (to'plash hisobi uchun). */
export interface ToplashQatori {
  tovarId: string
  kategoriyaId: string | null
  miqdor: number
  /** Qator summasi (qator chegirmasidan keyin). 0 — sovg'a (bonus) qatori: sanalmaydi */
  jami: number
}

/** Bitta hisob (ball yoki keshbek) bo'yicha to'plangan miqdor qayerdan kelgani. */
export interface ToplashTafsiloti {
  /** Umumiy qoida ("har N so'mga M ball", "X% keshbek") */
  umumiy: number
  /** Chek summasi qoidasi */
  chek: number
  /** Mahsulot va kategoriya qoidalaridan — mahsulot bo'yicha */
  tovarlar: Record<string, number>
}

export interface QollanganQoida {
  qoidaId: string
  turi: QoidaTuri
  /** tovarId yoki kategoriyaId; CHEK uchun null */
  maqsadId: string | null
  /** Shart uchun sanalgan dona (CHEK uchun 0) */
  miqdor: number
  ball: number
  keshbek: number
}

export interface ToplashNatija {
  ball: number
  keshbek: number
  /** To'plash bazasi — mijoz haqiqatda to'lagan summa */
  baza: number
  tafsilot: { ball: ToplashTafsiloti; keshbek: ToplashTafsiloti }
  /** Qaysi qo'shimcha qoidalar ishladi (kassada va jurnalda ko'rsatish uchun) */
  qollanilgan: QollanganQoida[]
}

const bosTafsilot = (): ToplashTafsiloti => ({ umumiy: 0, chek: 0, tovarlar: {} })
/** Ball yig'indisi: 0.1 + 0.2 kabi kasr xatolari to'planmasin */
const ball2 = (n: number) => Math.round(n * 100) / 100

/** Sharti bajarilgan qoidalardan eng kattasi (shart bo'yicha, teng bo'lsa — mukofoti katta). */
function engKatta(qoidalar: SodiqlikQoida[], shart: (q: SodiqlikQoida) => number): SodiqlikQoida | null {
  let eng: SodiqlikQoida | null = null
  for (const q of qoidalar) {
    if (!eng || shart(q) > shart(eng)
      || (shart(q) === shart(eng) && (q.ball > eng.ball || (q.ball === eng.ball && q.keshbekFoiz > eng.keshbekFoiz)))) {
      eng = q
    }
  }
  return eng
}

/**
 * Sotuvdan to'planadigan ball va keshbek: umumiy qoida + qo'shimcha qoidalar.
 *
 * `tolangan` — mijoz HAQIQATDA to'lagan summa: chek chegirmasi va ball/keshbek
 * bilan qoplangan qism allaqachon chiqarilgan (keshbek o'z ustiga keshbek
 * bermasin). Mahsulot qoidasining keshbek foizi qator summasining shu
 * to'langan ulushiga hisoblanadi. Ball "har donasiga" — pul ulushiga bog'liq emas.
 *
 * Bir maqsadga bir nechta qoida bo'lsa (5 dona → 3%, 10 dona → 5%) — sharti
 * bajarilganlarning eng kattasi qo'llanadi. Mahsulotning o'z qoidasi ishlasa,
 * kategoriya qoidasi unga qo'llanmaydi (ikki marta berilmaydi).
 */
export function sotuvdanToplanadi(params: {
  tolangan: number
  tolovUsuli: string
  sozlama: SodiqlikSozlama
  qatorlar?: ToplashQatori[]
  qoidalar?: SodiqlikQoida[]
}): ToplashNatija {
  const { tolovUsuli, sozlama: s } = params
  const bosh: ToplashNatija = {
    ball: 0, keshbek: 0, baza: 0,
    tafsilot: { ball: bosTafsilot(), keshbek: bosTafsilot() },
    qollanilgan: [],
  }

  if (!s.faol) return bosh
  // Sherik do'konga jo'natish sotuv emas — hisobotlarda ham chiqarilgan.
  if (tolovUsuli === 'SHERIK') return bosh
  // Nasiyada pul hali kelmagan — admin ataylab yoqmasa, to'planmaydi.
  if (tolovUsuli === 'NASIYA' && !s.nasiyagaHam) return bosh

  const baza = Math.max(0, Number(params.tolangan) || 0)
  if (baza <= 0) return bosh

  const tb: ToplashTafsiloti = { umumiy: hisoblaBall(baza, s), chek: 0, tovarlar: {} }
  const tk: ToplashTafsiloti = { umumiy: hisoblaKeshbek(baza, s), chek: 0, tovarlar: {} }
  const qollanilgan: QollanganQoida[] = []
  const faollar = (params.qoidalar ?? []).filter(q => q.faol && (q.ball > 0 || q.keshbekFoiz > 0))

  // ── Chek summasi ──
  const chek = engKatta(faollar.filter(q => q.turi === 'CHEK' && q.minSumma <= baza), q => q.minSumma)
  if (chek) {
    tb.chek = ballYaxlit(chek.ball)
    tk.chek = Math.floor((baza * chek.keshbekFoiz) / 100)
    qollanilgan.push({ qoidaId: chek.id, turi: 'CHEK', maqsadId: null, miqdor: 0, ball: tb.chek, keshbek: tk.chek })
  }

  // ── Mahsulot va kategoriya — faqat pullik qatorlar ──
  const qatorlar = (params.qatorlar ?? []).filter(q => q.miqdor > 0 && q.jami > 0)
  const jamiQator = qatorlar.reduce((y, q) => y + q.jami, 0)
  // Chek chegirmasi va ball bilan to'langan qism mutanosib chiqariladi
  const ulush = jamiQator > 0 ? Math.min(1, baza / jamiQator) : 0

  const tovarlar = new Map<string, { kategoriyaId: string | null; miqdor: number; jami: number }>()
  for (const q of qatorlar) {
    const t = tovarlar.get(q.tovarId) ?? { kategoriyaId: q.kategoriyaId, miqdor: 0, jami: 0 }
    t.miqdor += q.miqdor
    t.jami += q.jami
    tovarlar.set(q.tovarId, t)
  }
  const qosh = (tovarId: string, b: number, k: number) => {
    if (b > 0) tb.tovarlar[tovarId] = ball2((tb.tovarlar[tovarId] ?? 0) + b)
    if (k > 0) tk.tovarlar[tovarId] = (tk.tovarlar[tovarId] ?? 0) + k
  }

  const ozQoidasi = new Set<string>()
  for (const [tovarId, t] of tovarlar) {
    const q = engKatta(
      faollar.filter(x => x.turi === 'MAHSULOT' && x.tovarId === tovarId && x.minMiqdor <= t.miqdor),
      x => x.minMiqdor,
    )
    if (!q) continue
    ozQoidasi.add(tovarId)
    const b = ballYaxlit(q.ball * t.miqdor)
    const k = Math.floor((t.jami * ulush * q.keshbekFoiz) / 100)
    qosh(tovarId, b, k)
    qollanilgan.push({ qoidaId: q.id, turi: 'MAHSULOT', maqsadId: tovarId, miqdor: t.miqdor, ball: b, keshbek: k })
  }

  const kategoriyalar = new Map<string, { miqdor: number; tovarlar: [string, { miqdor: number; jami: number }][] }>()
  for (const [tovarId, t] of tovarlar) {
    if (ozQoidasi.has(tovarId) || !t.kategoriyaId) continue
    const g = kategoriyalar.get(t.kategoriyaId) ?? { miqdor: 0, tovarlar: [] }
    g.miqdor += t.miqdor
    g.tovarlar.push([tovarId, t])
    kategoriyalar.set(t.kategoriyaId, g)
  }
  for (const [kategoriyaId, g] of kategoriyalar) {
    const q = engKatta(
      faollar.filter(x => x.turi === 'KATEGORIYA' && x.kategoriyaId === kategoriyaId && x.minMiqdor <= g.miqdor),
      x => x.minMiqdor,
    )
    if (!q) continue
    let jb = 0
    let jk = 0
    for (const [tovarId, t] of g.tovarlar) {
      const b = ballYaxlit(q.ball * t.miqdor)
      const k = Math.floor((t.jami * ulush * q.keshbekFoiz) / 100)
      qosh(tovarId, b, k)
      jb += b
      jk += k
    }
    qollanilgan.push({ qoidaId: q.id, turi: 'KATEGORIYA', maqsadId: kategoriyaId, miqdor: g.miqdor, ball: ball2(jb), keshbek: jk })
  }

  const yigindi = (t: ToplashTafsiloti) => t.umumiy + t.chek + Object.values(t.tovarlar).reduce((y, x) => y + x, 0)
  return {
    ball: ball2(yigindi(tb)),
    keshbek: yigindi(tk),
    baza,
    tafsilot: { ball: tb, keshbek: tk },
    qollanilgan,
  }
}

/** Bazadagi (JSON) tafsilotni tekshirib o'qiydi; buzuq yoki yo'q bo'lsa — null. */
export function tafsilotniOqi(x: unknown): ToplashTafsiloti | null {
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  const son = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  const tovarlar: Record<string, number> = {}
  if (o.tovarlar && typeof o.tovarlar === 'object') {
    for (const [k, v] of Object.entries(o.tovarlar as Record<string, unknown>)) {
      const n = son(v)
      if (n > 0) tovarlar[k] = n
    }
  }
  return { umumiy: son(o.umumiy), chek: son(o.chek), tovarlar }
}

/**
 * Qaytarishda bekor qilinadigan miqdor (bitta hisob uchun).
 *
 * Tafsilot bor bo'lsa: umumiy va chek qoidasidan kelgan qism — qaytarilgan
 * SUMMA ulushida; mahsulot qoidasidan kelgani — o'sha MAHSULOTNING qaytarilgan
 * miqdori ulushida. Ya'ni ball bermagan mahsulot qaytarilsa, boshqa mahsulot
 * uchun berilgan ball tegilmaydi. Tafsilotsiz (eski) yozuvda — butun miqdor
 * summa ulushida, avvalgidek.
 */
export function qaytarishdaBekor(params: {
  hisob: SodiqlikHisobKalit
  toplangan: number
  tafsilot: ToplashTafsiloti | null
  /** Qaytarilgan summa / sotuv summasi */
  summaUlushi: number
  /** tovarId → shu qaytarishda qaytarilgan miqdor */
  qaytarilgan: Map<string, number>
  /** tovarId → sotuvdagi pullik miqdor */
  sotilgan: Map<string, number>
}): number {
  const ulush = Math.min(1, Math.max(0, params.summaUlushi))
  let n: number
  if (params.tafsilot) {
    const t = params.tafsilot
    n = (t.umumiy + t.chek) * ulush
    for (const [tovarId, qiymat] of Object.entries(t.tovarlar)) {
      const sotildi = params.sotilgan.get(tovarId) ?? 0
      const qaytdi = params.qaytarilgan.get(tovarId) ?? 0
      if (sotildi > 0 && qaytdi > 0) n += qiymat * Math.min(1, qaytdi / sotildi)
    }
    // Hech qachon to'planganidan ko'p emas
    n = Math.min(n, Math.max(0, params.toplangan))
  } else {
    n = Math.max(0, params.toplangan) * ulush
  }
  return params.hisob === 'BALL' ? Math.floor(n * 100 + 1e-6) / 100 : Math.floor(n + 1e-6)
}

/** Qoida maydonlarini tekshiradi (API va forma bir xil). */
export function qoidaniTasdiqla(xom: unknown):
  | { ok: true; qoida: Omit<SodiqlikQoida, 'id'> & { izoh: string | null } }
  | { ok: false; xato: string } {
  const o = (xom ?? {}) as Record<string, unknown>
  const turi = o.turi
  if (turi !== 'CHEK' && turi !== 'MAHSULOT' && turi !== 'KATEGORIYA') return { ok: false, xato: 'Qoida turini tanlang' }
  const raqam = (v: unknown) => {
    const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.'))
    return Number.isFinite(n) ? n : NaN
  }
  const minSumma = turi === 'CHEK' ? raqam(o.minSumma) : 0
  const minMiqdor = turi === 'CHEK' ? 0 : raqam(o.minMiqdor)
  const ball = raqam(o.ball || 0)
  const keshbekFoiz = raqam(o.keshbekFoiz || 0)
  if (turi === 'CHEK' && !(minSumma >= 0)) return { ok: false, xato: 'Chek summasini kiriting' }
  if (turi !== 'CHEK' && !(minMiqdor >= 0)) return { ok: false, xato: 'Necha donadan boshlab — sonini kiriting' }
  if (!(ball >= 0) || ball > 1_000_000) return { ok: false, xato: "Ball noto'g'ri" }
  if (!(keshbekFoiz >= 0) || keshbekFoiz > 100) return { ok: false, xato: "Keshbek 0 dan 100 % gacha bo'ladi" }
  if (ball === 0 && keshbekFoiz === 0) return { ok: false, xato: 'Ball yoki keshbekdan kamida bittasini kiriting' }
  const tovarId = turi === 'MAHSULOT' && typeof o.tovarId === 'string' && o.tovarId ? o.tovarId : null
  const kategoriyaId = turi === 'KATEGORIYA' && typeof o.kategoriyaId === 'string' && o.kategoriyaId ? o.kategoriyaId : null
  if (turi === 'MAHSULOT' && !tovarId) return { ok: false, xato: 'Mahsulotni tanlang' }
  if (turi === 'KATEGORIYA' && !kategoriyaId) return { ok: false, xato: 'Kategoriyani tanlang' }
  const izoh = typeof o.izoh === 'string' && o.izoh.trim() ? o.izoh.trim().slice(0, 200) : null
  return {
    ok: true,
    qoida: {
      turi, tovarId, kategoriyaId,
      minSumma: Math.round(minSumma * 100) / 100,
      minMiqdor: Math.round(minMiqdor * 1000) / 1000,
      ball: ball2(ball),
      keshbekFoiz: Math.round(keshbekFoiz * 100) / 100,
      faol: o.faol === undefined ? true : o.faol === true || o.faol === 'true',
      izoh,
    },
  }
}

/** Ballni ko'rsatish uchun formatlash — 2.00 emas, 2; 0.50 emas, 0.5 */
export function formatBall(ball: number | string): string {
  const n = typeof ball === 'number' ? ball : parseFloat(String(ball))
  if (!Number.isFinite(n)) return '0'
  return String(Math.round(n * 100) / 100)
}
