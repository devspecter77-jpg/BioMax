// O'lchov birliklari — sof mantiq (brauzer va server bir xil ishlatadi).
//
// Asosiy birlik (Tovar.birlik) — qoldiq va sotuv shu birlikda sanaladi:
// tayyorlari (DONA, KG, LITR, METR, PACHKA, QUTI) yoki foydalanuvchi o'zi
// yozgan nom ("juft", "rulon"). KG/LITR/METR — kasrli (0.5 kg), qolganlari —
// butun son.
//
// Qo'shimcha birlik (o'ram, Tovar.oramlar): "1 karobka = 24 dona". Miqdor
// bazada har doim ASOSIY birlikda saqlanadi — o'ram faqat kiritish
// ("5 karobka 3 dona" → 123 dona) va ko'rsatish uchun.
//
// Narx o'ram uchun kiritilishi mumkin ("1 blok — 75 000"): bazadagi narx
// ustunlari baribir BITTA asosiy birlik uchun (75 000 / 60 = 1 250 — qoldiq,
// hisobot, vitrina shunga tayanadi), o'ramning o'zida esa aniq narx turadi —
// kassa butun o'ramni aynan shu narxda sotadi (70 000 / 60 = 1 166,67 ni
// 60 ga ko'paytirib 70 000,20 chiqmasin).

import { nomKaliti } from './utils'

export const TAYYOR_BIRLIKLAR = ['DONA', 'KG', 'LITR', 'METR', 'PACHKA', 'QUTI'] as const
const KASRLI = new Set(['KG', 'LITR', 'METR'])
/** Birlik va o'ram nomining eng katta uzunligi */
export const NOM_CHEGARA = 20
/** Bitta mahsulotda ko'pi bilan nechta qo'shimcha birlik */
export const ORAM_CHEGARA = 5
/** Yangi o'ram yozishda taklif qilinadiganlar */
export const ORAM_TAKLIFLARI = ['karobka', 'qop', 'blok', 'yashik', 'pachka', 'quti', 'to‘plam', 'rulon']

// Tayyor birlikning boshqacha yozilishi ("ta", "шт", "кг", "литр")
const SINONIMLAR: Record<string, (typeof TAYYOR_BIRLIKLAR)[number]> = {
  dona: 'DONA', ta: 'DONA', sht: 'DONA', shtuk: 'DONA', shtuka: 'DONA',
  kg: 'KG', kilogramm: 'KG', kilogram: 'KG', kilo: 'KG',
  litr: 'LITR', l: 'LITR',
  metr: 'METR', m: 'METR',
  pachka: 'PACHKA',
  quti: 'QUTI',
}

/** Ko'rsatish uchun: "DONA" → "dona", o'zi yozgani — o'zi. */
export function birlikMatni(b: string | null | undefined): string {
  const s = String(b ?? '').trim()
  if (!s) return 'dona'
  return (TAYYOR_BIRLIKLAR as readonly string[]).includes(s.toUpperCase()) ? s.toLowerCase() : s
}

/** Kasr bilan sanaladimi (0.5 kg) — aks holda faqat butun son. */
export function birlikKasrlimi(b: string | null | undefined): boolean {
  return KASRLI.has(String(b ?? '').toUpperCase())
}

/**
 * Foydalanuvchi yozgan birlik → saqlanadigan qiymat. Tayyor birlik (har qanday
 * registr yoki kirillda: "Kg", "кг", "шт") — uning kodi; boshqasi — kichik
 * harfli tozalangan nom. null — bo'sh, juda uzun yoki ruxsatsiz belgi.
 */
export function birlikTozala(x: unknown): string | null {
  const s = String(x ?? '').trim().replace(/\s+/g, ' ')
  if (!s || s.length > NOM_CHEGARA || /[<>"`{}=;]/.test(s)) return null
  const kalit = nomKaliti(s)
  const tayyor = SINONIMLAR[kalit] ?? SINONIMLAR[kalit.replace(/\.$/, '')]
  if (tayyor) return tayyor
  return s.toLowerCase()
}

/** O'ram uchun kiritilgan narxlar (o'z valyutasida). Kelish narxi yashirilgan hisobga null bo'lib boradi. */
export type OramNarxi = {
  kelish: number | null
  sotish: number | null
  optom: number | null
  bolish: number | null
}

// `type` (interface emas) — Prisma JSON ustuniga to'g'ridan-to'g'ri yoziladi
export type Oram = {
  /** "karobka", "qop" */
  nomi: string
  /** Ichida nechta asosiy birlik */
  miqdor: number
  /** Narxlar shu o'ram uchun kiritilgan bo'lsa ("1 blok — 75 000") — faqat bittasida */
  narx?: OramNarxi
}

/** Kassadagi narx turlari */
export type SotishNarxTuri = 'sotish' | 'optom' | 'bolish'

/** O'ram va uning aniq narxi: 60 dona — 75 000 */
export type Paket = { narx: number; miqdor: number }

const yaxlit3 = (n: number) => Math.round(n * 1000) / 1000
const yaxlit2 = (n: number) => Math.round(n * 100) / 100

/** Formadan kelgan narx: musbat son yoki null (bo'sh, 0, noto'g'ri) */
export function musbatYokiNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

function oramNarxiniOqi(x: unknown): OramNarxi | undefined {
  if (!x || typeof x !== 'object') return undefined
  const o = x as Record<string, unknown>
  const narx = { kelish: musbatYokiNull(o.kelish), sotish: musbatYokiNull(o.sotish), optom: musbatYokiNull(o.optom), bolish: musbatYokiNull(o.bolish) }
  return narx.kelish === null && narx.sotish === null && narx.optom === null && narx.bolish === null ? undefined : narx
}

/** Bazadagi JSON → ro'yxat; buzuq yozuvlar tashlab yuboriladi. */
export function oramlarniOqi(x: unknown): Oram[] {
  if (!Array.isArray(x)) return []
  const r: Oram[] = []
  for (const o of x) {
    if (!o || typeof o !== 'object') continue
    const nomi = String((o as Record<string, unknown>).nomi ?? '').trim()
    const miqdor = Number((o as Record<string, unknown>).miqdor)
    if (!nomi || !Number.isFinite(miqdor) || miqdor <= 0) continue
    // Narx faqat bitta o'ramda bo'ladi — ikkinchisi (buzuq yozuv) e'tiborsiz
    const narx = r.some(q => q.narx) ? undefined : oramNarxiniOqi((o as Record<string, unknown>).narx)
    r.push(narx ? { nomi, miqdor, narx } : { nomi, miqdor })
  }
  return r
}

/** Narxlari shu o'ram uchun kiritilgan o'ram; yo'q bo'lsa — narxlar asosiy birlikda. */
export function narxOrami(oramlar: Oram[]): (Oram & { narx: OramNarxi }) | null {
  return (oramlar.find(o => o.narx) as (Oram & { narx: OramNarxi }) | undefined) ?? null
}

/** O'ramlar narxsiz — narxlar to'g'ridan-to'g'ri asosiy birlikda o'zgartirilganda (Excel, ombor formasi) */
export function oramNarxsiz(oramlar: Oram[]): Oram[] {
  return oramlar.map(({ nomi, miqdor }) => ({ nomi, miqdor }))
}

/** O'ram narxi → bitta asosiy birlik narxi (bazadagi narx ustunlari, 2 xona) */
export function birlikNarxiga(paketNarx: number, miqdor: number): number {
  return yaxlit2(paketNarx / miqdor)
}

/** Shu narx turi o'ram uchun kiritilgan bo'lsa — aniq o'ram narxi (o'z valyutasida). */
export function paketNarxi(oramlar: Oram[], turi: SotishNarxTuri): Paket | null {
  const o = narxOrami(oramlar)
  const narx = o?.narx[turi] ?? null
  return o && narx !== null && narx > 0 ? { narx, miqdor: o.miqdor } : null
}

/**
 * Savat qatori summasi. O'ram narxi bo'lsa — aniq: 60 dona × 75 000 / 60 =
 * 75 000 (dona narxini yaxlitlab ko'paytirsa 70 000 / 60 = 1 166,67 → 60 ta
 * 70 000,20 bo'lib ketardi). Aks holda — miqdor × narx, avvalgidek.
 */
export function qatorSummasi(miqdor: number, birlikNarxi: number, paket?: Paket | null): number {
  if (paket && paket.miqdor > 0) return yaxlit2(miqdor * paket.narx / paket.miqdor)
  return miqdor * birlikNarxi
}

/**
 * Formadagi narxlar tanlangan birlik uchun ("1 blok — 75 000"). Bazadagi narx
 * ustunlari BITTA asosiy birlik uchun — shuning uchun bo'linadi; o'ramning
 * o'ziga aniq narxlar yoziladi. `birlik` — o'ram nomi; bo'sh yoki ro'yxatda
 * yo'q bo'lsa — narxlar asosiy birlikda (o'zgarishsiz).
 */
export function narxlarniJoyla(
  oramlar: Oram[],
  birlik: unknown,
  narxlar: OramNarxi,
): { oramlar: Oram[]; asosiy: OramNarxi } {
  const toza = oramNarxsiz(oramlar)
  const kalit = nomKaliti(String(birlik ?? '').trim())
  const i = kalit ? toza.findIndex(o => nomKaliti(o.nomi) === kalit) : -1
  if (i < 0) return { oramlar: toza, asosiy: narxlar }
  const n = toza[i].miqdor
  const bol = (v: number | null) => (v === null ? null : birlikNarxiga(v, n))
  toza[i] = { ...toza[i], narx: { ...narxlar } }
  return {
    oramlar: toza,
    asosiy: { kelish: bol(narxlar.kelish), sotish: bol(narxlar.sotish), optom: bol(narxlar.optom), bolish: bol(narxlar.bolish) },
  }
}

/**
 * Formadan kelgan o'ramlarni tekshiradi (API va forma bir xil). Butunlay bo'sh
 * qatorlar e'tiborsiz; nomi bor-u soni yo'q (yoki aksincha) — xato.
 */
export function oramlarniTekshir(x: unknown, asosiy: string):
  | { ok: true; oramlar: Oram[] }
  | { ok: false; xato: string } {
  if (x === undefined || x === null || x === '') return { ok: true, oramlar: [] }
  if (!Array.isArray(x)) return { ok: false, xato: "Qo'shimcha birliklar noto'g'ri" }
  const asosiyMatn = birlikMatni(asosiy)
  const kasrli = birlikKasrlimi(asosiy)
  const oramlar: Oram[] = []
  const kalitlar = new Set([nomKaliti(asosiyMatn)])
  for (const xom of x) {
    const o = (xom ?? {}) as Record<string, unknown>
    const nomi = String(o.nomi ?? '').trim().replace(/\s+/g, ' ')
    const miqdorMatn = String(o.miqdor ?? '').trim().replace(/\s/g, '').replace(',', '.')
    if (!nomi && !miqdorMatn) continue
    if (!nomi) return { ok: false, xato: `${miqdorMatn} ${asosiyMatn} — qo'shimcha birlik nomini yozing (masalan, karobka)` }
    if (nomi.length > NOM_CHEGARA || /[<>"`{}=;]/.test(nomi)) return { ok: false, xato: `«${nomi.slice(0, 30)}» — birlik nomi ${NOM_CHEGARA} belgigacha bo'lsin` }
    const miqdor = Number(miqdorMatn)
    if (!miqdorMatn || !Number.isFinite(miqdor) || miqdor <= 0) return { ok: false, xato: `1 ${nomi} ichida nechta ${asosiyMatn} — sonini yozing` }
    if (!kasrli && !Number.isInteger(miqdor)) return { ok: false, xato: `1 ${nomi} = ${miqdorMatn} ${asosiyMatn}: butun son bo'lishi kerak` }
    if (!kasrli && miqdor < 2) return { ok: false, xato: `1 ${nomi} kamida 2 ${asosiyMatn} bo'lishi kerak` }
    if (miqdor > 1_000_000) return { ok: false, xato: `1 ${nomi} ichidagi miqdor juda katta` }
    const kalit = nomKaliti(nomi)
    if (kalit === nomKaliti(asosiyMatn)) return { ok: false, xato: `«${nomi}» — asosiy birlik; qo'shimchasiga boshqa nom yozing` }
    if (kalitlar.has(kalit)) return { ok: false, xato: `«${nomi}» ikki marta yozilgan` }
    kalitlar.add(kalit)
    oramlar.push({ nomi: nomi.toLowerCase(), miqdor: yaxlit3(miqdor) })
  }
  if (oramlar.length > ORAM_CHEGARA) return { ok: false, xato: `Ko'pi bilan ${ORAM_CHEGARA} ta qo'shimcha birlik` }
  return { ok: true, oramlar }
}

/** Kattasidan kichigiga — yoyish va kiritish shu tartibda */
export function oramlarTartibda(oramlar: Oram[]): Oram[] {
  return [...oramlar].sort((a, b) => b.miqdor - a.miqdor)
}

/**
 * Asosiy birlikdagi miqdorni o'ramlar bo'yicha yoyadi (kattasidan):
 * 123 dona, karobka = 24 → [5 karobka, 3 dona]. O'ram bo'lmasa — o'zi.
 */
export function miqdorniYoy(miqdor: number, asosiy: string, oramlar: Oram[]): { nomi: string; soni: number }[] {
  const asosiyMatn = birlikMatni(asosiy)
  if (!Number.isFinite(miqdor)) return []
  if (miqdor <= 0 || oramlar.length === 0) return [{ nomi: asosiyMatn, soni: yaxlit3(miqdor) }]
  const r: { nomi: string; soni: number }[] = []
  let qoldi = miqdor
  for (const o of oramlarTartibda(oramlar)) {
    const n = Math.floor(qoldi / o.miqdor + 1e-9)
    if (n > 0) {
      r.push({ nomi: o.nomi, soni: n })
      qoldi = yaxlit3(qoldi - n * o.miqdor)
    }
  }
  if (qoldi > 0 || r.length === 0) r.push({ nomi: asosiyMatn, soni: yaxlit3(qoldi) })
  return r
}

/** "5 karobka 3 dona"; o'ram bo'lmasa — "123 dona" */
export function miqdorMatni(miqdor: number, asosiy: string, oramlar: Oram[]): string {
  return miqdorniYoy(miqdor, asosiy, oramlar).map(q => `${q.soni} ${q.nomi}`).join(' ')
}

/**
 * Kiritilgan qismlar → asosiy birlikdagi jami. Kalit — o'ram nomi, '' —
 * asosiy birlik: { karobka: '5', '': '3' } → 5 × 24 + 3 = 123. Ro'yxatda
 * bo'lmagan (o'chirilgan) o'ram qismi hisobga olinmaydi.
 */
export function qismlardanJami(qismlar: Record<string, string>, oramlar: Oram[]): number {
  const son = (v: string | undefined) => {
    const n = parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.'))
    return Number.isFinite(n) && n > 0 ? n : 0
  }
  let jami = son(qismlar[''])
  for (const o of oramlar) jami += son(qismlar[o.nomi]) * o.miqdor
  return yaxlit3(jami)
}

/** Excel uchun: "karobka=24; qop=240" */
export function oramlarMatni(oramlar: Oram[]): string {
  return oramlar.map(o => `${o.nomi}=${o.miqdor}`).join('; ')
}

/** Excel'dagi "karobka=24; qop=240" → tekshirishga tayyor xom ro'yxat */
export function oramlarniMatndan(s: unknown): { nomi: string; miqdor: string }[] {
  return String(s ?? '')
    .split(/[;\n]/)
    .map(q => q.trim())
    .filter(Boolean)
    .map(q => {
      const [nomi, miqdor] = q.split('=')
      return { nomi: (nomi ?? '').trim(), miqdor: (miqdor ?? '').trim() }
    })
}
