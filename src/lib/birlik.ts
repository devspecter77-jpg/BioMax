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
// Har bir birlikning O'Z narxi bor: 1 dona — 1 300, 1 blok — 75 000,
// 1 karobka — 1 150 000 (chakana, optom, bo'lish). Bazadagi narx ustunlari
// (Tovar.sotishNarxi…) — bitta ASOSIY birlik narxi: qoldiq, hisobot, vitrina
// shunga tayanadi. O'ram narxi o'ramning o'zida (Oram.narx); kiritilmagan
// bo'lsa — eng kichik narxli o'ramdan yoki asosiy birlikdan hisoblanadi.
// Kassa qatori qaysi birlikda sotilsa, o'sha birlik narxi olinadi; qoldiq va
// foyda baribir asosiy birlikda (1 blok sotilsa — 60 dona kamayadi).

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

/** O'ram uchun kiritilgan narxlar (o'z valyutasida). Kelish — faqat kelish narxi shu o'ramda kiritilgan bo'lsa (yashirilgan hisobga null). */
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
  /** Shu o'ramni sotish narxlari (kiritilganlari); kiritilmagani hisoblanadi */
  narx?: OramNarxi
}

/** Kassadagi narx turlari */
export type SotishNarxTuri = 'sotish' | 'optom' | 'bolish'
const SOTISH_TURLARI: SotishNarxTuri[] = ['sotish', 'optom', 'bolish']

/** Sotiladigan birlik va uning narxlari (o'z valyutasida) */
export type SotuvBirligi = {
  /** '' — asosiy birlik; aks holda o'ram nomi */
  nomi: string
  /** Ichida nechta asosiy birlik (asosiy birlik — 1) */
  miqdor: number
  sotish: number | null
  optom: number | null
  bolish: number | null
}

const yaxlit3 = (n: number) => Math.round(n * 1000) / 1000
const yaxlit2 = (n: number) => Math.round(n * 100) / 100

/** Formadan kelgan narx: musbat son yoki null (bo'sh, 0, noto'g'ri) */
export function musbatYokiNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(String(v).replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : null
}

function oramNarxiniOqi(x: unknown): OramNarxi | undefined {
  if (!x || typeof x !== 'object') return undefined
  const o = x as Record<string, unknown>
  const narx = { kelish: musbatYokiNull(o.kelish), sotish: musbatYokiNull(o.sotish), optom: musbatYokiNull(o.optom), bolish: musbatYokiNull(o.bolish) }
  return narx.kelish === null && narx.sotish === null && narx.optom === null && narx.bolish === null ? undefined : narx
}

/** Bazadagi JSON → ro'yxat; buzuq yozuvlar tashlab yuboriladi. Kelish narxi faqat bitta o'ramda. */
export function oramlarniOqi(x: unknown): Oram[] {
  if (!Array.isArray(x)) return []
  const r: Oram[] = []
  for (const o of x) {
    if (!o || typeof o !== 'object') continue
    const nomi = String((o as Record<string, unknown>).nomi ?? '').trim()
    const miqdor = Number((o as Record<string, unknown>).miqdor)
    if (!nomi || !Number.isFinite(miqdor) || miqdor <= 0) continue
    let narx = oramNarxiniOqi((o as Record<string, unknown>).narx)
    if (narx && narx.kelish !== null && r.some(q => (q.narx?.kelish ?? null) !== null)) {
      narx = oramNarxiniOqi({ ...narx, kelish: null })
    }
    r.push(narx ? { nomi, miqdor, narx } : { nomi, miqdor })
  }
  return r
}

/** O'ramlar narxsiz (faqat nomi va hajmi) */
export function oramNarxsiz(oramlar: Oram[]): Oram[] {
  return oramlar.map(({ nomi, miqdor }) => ({ nomi, miqdor }))
}

/** Kelish narxi kiritilgan o'ram (kelish "1 blok — 60 000" deb yozilgan); yo'q bo'lsa — asosiy birlikda */
export function kelishOrami(oramlar: Oram[]): Oram | null {
  return oramlar.find(o => (o.narx?.kelish ?? null) !== null) ?? null
}

/** O'ramdagi kelish narxi olib tashlanadi — kelish narxi asosiy birlikda o'zgartirilganda (ombor formasi, Excel) */
export function oramKelishsiz(oramlar: Oram[]): Oram[] {
  return oramlar.map(o => {
    if (!o.narx || o.narx.kelish === null) return o
    const narx = { ...o.narx, kelish: null }
    return narx.sotish === null && narx.optom === null && narx.bolish === null ? { nomi: o.nomi, miqdor: o.miqdor } : { ...o, narx }
  })
}

/**
 * Yangi o'ramlar ro'yxatiga (Excel, faqat nomi va hajmi kelgan) eskisidagi
 * narxlar ko'chiriladi — nomi va hajmi bir xil bo'lsa.
 */
export function oramNarxlariniKoch(eski: Oram[], yangi: Oram[]): Oram[] {
  return yangi.map(o => {
    const e = eski.find(x => nomKaliti(x.nomi) === nomKaliti(o.nomi) && x.miqdor === o.miqdor)
    return e?.narx ? { ...o, narx: e.narx } : o
  })
}

/** O'ram narxi → bitta asosiy birlik narxi (bazadagi narx ustunlari, 2 xona) */
export function birlikNarxiga(paketNarx: number, miqdor: number): number {
  return yaxlit2(paketNarx / miqdor)
}

/**
 * Mahsulotni qaysi birliklarda va necha puldan sotish mumkin: asosiy birlik
 * (bazadagi ustunlar), keyin o'ramlar — kichigidan. O'ram narxi kiritilmagan
 * bo'lsa — eng kichik narxli o'ramdan (1 blok 75 000 → 1 karobka 1 200 000),
 * u ham bo'lmasa asosiy birlikdan (1 250 × 60) hisoblanadi.
 */
export function sotuvBirliklari(t: { sotishNarxi: unknown; optomNarxi?: unknown; bolishNarxi?: unknown; oramlar?: unknown }): SotuvBirligi[] {
  const tartib = [...oramlarniOqi(t.oramlar)].sort((a, b) => a.miqdor - b.miqdor)
  const ustun = { sotish: musbatYokiNull(t.sotishNarxi), optom: musbatYokiNull(t.optomNarxi), bolish: musbatYokiNull(t.bolishNarxi) }
  const narx = (o: Oram, tur: SotishNarxTuri): number | null => {
    const aniq = o.narx?.[tur] ?? null
    if (aniq !== null) return aniq
    const manba = tartib.find(x => (x.narx?.[tur] ?? null) !== null)
    if (manba) return yaxlit2(manba.narx![tur]! * o.miqdor / manba.miqdor)
    const u = ustun[tur]
    return u === null ? null : yaxlit2(u * o.miqdor)
  }
  return [
    { nomi: '', miqdor: 1, ...ustun },
    ...tartib.map(o => ({ nomi: o.nomi, miqdor: o.miqdor, sotish: narx(o, 'sotish'), optom: narx(o, 'optom'), bolish: narx(o, 'bolish') })),
  ]
}

/** Bitta sotuv birligi: '' yoki topilmagan nom — asosiy birlik */
export function sotuvBirligi(t: { sotishNarxi: unknown; optomNarxi?: unknown; bolishNarxi?: unknown; oramlar?: unknown }, nomi: string | null | undefined): SotuvBirligi {
  const birliklar = sotuvBirliklari(t)
  const kalit = nomKaliti(String(nomi ?? '').trim())
  return (kalit ? birliklar.find(b => b.nomi && nomKaliti(b.nomi) === kalit) : undefined) ?? birliklar[0]
}

/** Formadan kelgan bitta birlik narxlari ('' — asosiy birlik) */
export type BirlikNarxKiritma = { birlik: string; sotish: number | null; optom: number | null; bolish: number | null }

/**
 * Formadagi har bir birlik narxi → bazaga. O'ramlarga kiritilgan narxlari
 * yoziladi; bazadagi (asosiy birlik) narx — kiritilgan bo'lsa o'zi, aks holda
 * eng kichik narxli o'ramdan bo'linadi (75 000 / 60 = 1 250). Kelish narxi
 * bitta: qaysi birlikda yozilsa, o'sha o'ramda aniq saqlanadi, bazaga — bir
 * asosiy birlik narxi.
 */
export function birlikNarxlariniJoyla(
  oramlar: Oram[],
  kiritma: BirlikNarxKiritma[],
  kelish: { birlik: string; narx: number | null },
): { oramlar: Oram[]; asosiy: OramNarxi } {
  const toza: Oram[] = oramNarxsiz(oramlar)
  const indeks = (b: string) => {
    const k = nomKaliti(String(b ?? '').trim())
    return k ? toza.findIndex(o => nomKaliti(o.nomi) === k) : -1
  }
  const bosh: OramNarxi = { kelish: null, sotish: null, optom: null, bolish: null }
  for (const k of kiritma) {
    const i = indeks(k.birlik)
    if (i >= 0) toza[i] = { ...toza[i], narx: { ...(toza[i].narx ?? bosh), sotish: k.sotish, optom: k.optom, bolish: k.bolish } }
  }
  let asosiyKelish = kelish.narx
  const ki = indeks(kelish.birlik)
  if (ki >= 0 && kelish.narx !== null) {
    toza[ki] = { ...toza[ki], narx: { ...(toza[ki].narx ?? bosh), kelish: kelish.narx } }
    asosiyKelish = birlikNarxiga(kelish.narx, toza[ki].miqdor)
  }
  const asosiyKiritma = kiritma.find(k => !String(k.birlik ?? '').trim())
  const tartib = [...toza].sort((a, b) => a.miqdor - b.miqdor)
  const asosiy = (tur: SotishNarxTuri): number | null => {
    const v = asosiyKiritma?.[tur] ?? null
    if (v !== null) return v
    const manba = tartib.find(o => (o.narx?.[tur] ?? null) !== null)
    return manba ? birlikNarxiga(manba.narx![tur]!, manba.miqdor) : null
  }
  return {
    oramlar: toza.map(o => (o.narx && Object.values(o.narx).every(v => v === null) ? { nomi: o.nomi, miqdor: o.miqdor } : o)),
    asosiy: { kelish: asosiyKelish, sotish: asosiy('sotish'), optom: asosiy('optom'), bolish: asosiy('bolish') },
  }
}

/**
 * API'ga kelgan narxlar → kiritma. Uch ko'rinish: yangi forma (`narxlar` —
 * har bir birlik o'z narxi bilan), kechagi forma (`narxBirligi` — barcha
 * narxlar shu o'ram uchun) va oddiy (bir asosiy birlik narxlari).
 */
export function narxKiritmasiniOqi(data: Record<string, unknown>): {
  kelish: { birlik: string; narx: number | null }
  birliklar: BirlikNarxKiritma[]
} {
  const n = data.narxlar as { kelish?: { birlik?: unknown; narx?: unknown }; birliklar?: unknown } | undefined
  if (n && typeof n === 'object') {
    const birliklar = (Array.isArray(n.birliklar) ? n.birliklar : []).map((b: Record<string, unknown> | null) => ({
      birlik: String(b?.birlik ?? '').trim(),
      sotish: musbatYokiNull(b?.sotish),
      optom: musbatYokiNull(b?.optom),
      bolish: musbatYokiNull(b?.bolish),
    }))
    return { kelish: { birlik: String(n.kelish?.birlik ?? '').trim(), narx: musbatYokiNull(n.kelish?.narx) }, birliklar }
  }
  const birlik = String(data.narxBirligi ?? '').trim()
  return {
    kelish: { birlik, narx: musbatYokiNull(data.kelishNarxi) },
    birliklar: [{ birlik, sotish: musbatYokiNull(data.sotishNarxi), optom: musbatYokiNull(data.optomNarxi), bolish: musbatYokiNull(data.bolishNarxi) }],
  }
}

/**
 * Tahrirlash formasi uchun: kelish narxi (qaysi birlikda kiritilgan) va har
 * bir birlikning KIRITILGAN narxlari. Asosiy birlik narxi o'ramdan
 * hisoblangan bo'lsa (75 000 / 60) — bo'sh (formada "avtomatik" bo'lib turadi).
 */
export function formaNarxlari(t: { kelishNarxi?: unknown; sotishNarxi: unknown; optomNarxi?: unknown; bolishNarxi?: unknown; oramlar?: unknown }): {
  kelish: { birlik: string; narx: number | null }
  birliklar: Record<string, Record<SotishNarxTuri, number | null>>
} {
  const oramlar = oramlarniOqi(t.oramlar)
  const tartib = [...oramlar].sort((a, b) => a.miqdor - b.miqdor)
  const ko = kelishOrami(oramlar)
  const kelish = ko ? { birlik: ko.nomi, narx: ko.narx!.kelish } : { birlik: '', narx: musbatYokiNull(t.kelishNarxi) }
  const ustun: Record<SotishNarxTuri, unknown> = { sotish: t.sotishNarxi, optom: t.optomNarxi, bolish: t.bolishNarxi }
  const asosiy = {} as Record<SotishNarxTuri, number | null>
  for (const tur of SOTISH_TURLARI) {
    const c = musbatYokiNull(ustun[tur])
    const manba = tartib.find(o => (o.narx?.[tur] ?? null) !== null)
    asosiy[tur] = c !== null && manba && c === birlikNarxiga(manba.narx![tur]!, manba.miqdor) ? null : c
  }
  const birliklar: Record<string, Record<SotishNarxTuri, number | null>> = { '': asosiy }
  for (const o of oramlar) birliklar[o.nomi] = { sotish: o.narx?.sotish ?? null, optom: o.narx?.optom ?? null, bolish: o.narx?.bolish ?? null }
  return { kelish, birliklar }
}

/**
 * Chek qatori: o'ramda sotilgan bo'lsa "2 blok × 75 000" (miqdor bazada
 * asosiy birlikda — 120 dona), aks holda "3 × 1 250".
 */
export function chekQatori(q: { miqdor: unknown; birlikNarxi: unknown; jami: unknown; oramNomi?: string | null; oramMiqdori?: unknown }): {
  soni: number
  /** O'ram nomi ("blok"); null — asosiy birlikda sotilgan */
  oram: string | null
  narx: number
} {
  const miqdor = Number(q.miqdor) || 0
  const n = Number(q.oramMiqdori)
  if (q.oramNomi && Number.isFinite(n) && n > 0) {
    const soni = yaxlit3(miqdor / n)
    return { soni, oram: q.oramNomi, narx: soni > 0 ? yaxlit2((Number(q.jami) || 0) / soni) : 0 }
  }
  return { soni: miqdor, oram: null, narx: Number(q.birlikNarxi) || 0 }
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
