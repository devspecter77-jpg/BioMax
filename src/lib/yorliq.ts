// Mahsulot yorlig'i (etiketka) — sof mantiq, brauzerda ham serverda ham ishlaydi.
//
// Tartib yuqoridan pastga: tartib raqami (№) va nomi → shtrix-kod (ostida
// kodning o'zi) → narx. Termal yorliq printeri (58×40, 40×30 mm — har bir
// yorliq alohida "sahifa") yoki oddiy printer uchun A4 varaq (qirqish
// chiziqlari bilan setka).
//
// O'lchamlar millimetrda: yorliq qog'ozga aynan shu o'lchamda tushadi.
// Chiziq (modul) kengligi termal printer nuqtasiga (203 dpi ≈ 0,125 mm)
// karrali tanlanadi — aks holda chiziqlar har xil yo'g'onlikda chiqib,
// skaner kodni qiyin o'qiydi.

import { shtrixKodla, shtrixKodSvg, shtrixKenglik, type ShtrixKod } from './shtrix-kod'

export interface Yorliq {
  nomi: string
  shtrixKod: string | null
  /** Formatlangan narx ("125 000 UZS", "$12.50") — valyutasi bilan chaqiruvchi tayyorlaydi. */
  narx: string
  tartibRaqami: number | null
}

export type YorliqOlchami = '58x40' | '40x30' | 'a4'

export interface YorliqSozlama {
  olcham: YorliqOlchami
  /** Faqat A4: bir qatorda nechta yorliq */
  ustunlar: number
  /** Har bir mahsulotdan nechta nusxa */
  nusxa: number
}

export const YORLIQ_OLCHAMLARI: { qiymat: YorliqOlchami; nomi: string; izoh: string }[] = [
  { qiymat: '58x40', nomi: '58 × 40 mm', izoh: 'Termal yorliq' },
  { qiymat: '40x30', nomi: '40 × 30 mm', izoh: 'Kichik termal' },
  { qiymat: 'a4', nomi: 'A4 varaq', izoh: 'Qirqib olinadi' },
]
export const A4_USTUNLAR = [3, 4, 5] as const
export const NUSXA_CHEGARA = 100

export const STANDART_YORLIQ: YorliqSozlama = { olcham: '58x40', ustunlar: 4, nusxa: 1 }

/** localStorage'dan kelgan (ishonchsiz) qiymatlarni tekshiradi. */
export function yorliqSozlamasi(olcham: unknown, ustunlar: unknown, nusxa: unknown = 1): YorliqSozlama {
  const o = YORLIQ_OLCHAMLARI.some(x => x.qiymat === olcham) ? olcham as YorliqOlchami : STANDART_YORLIQ.olcham
  const u = Number(ustunlar)
  const n = Math.floor(Number(nusxa))
  return {
    olcham: o,
    ustunlar: (A4_USTUNLAR as readonly number[]).includes(u) ? u : STANDART_YORLIQ.ustunlar,
    nusxa: Number.isFinite(n) ? Math.min(NUSXA_CHEGARA, Math.max(1, n)) : 1,
  }
}

// ─── O'lchamlar ──────────────────────────────────────────────────────────────

/** A4 ning chop etiladigan qismi: 210×297 mm, har tomondan 8 mm chet. */
const A4_CHET = 8
const A4_KENGLIK = 210 - 2 * A4_CHET
const A4_BALANDLIK = 297 - 2 * A4_CHET

interface Geometriya {
  /** mm */
  kenglik: number
  balandlik: number
  chet: number
  /** shrift o'lchamlari, pt */
  nomi: number
  narx: number
  kod: number
  raqam: number
}

const TERMAL: Record<Exclude<YorliqOlchami, 'a4'>, Geometriya> = {
  '58x40': { kenglik: 58, balandlik: 40, chet: 2, nomi: 8.5, narx: 13, kod: 7, raqam: 7.5 },
  '40x30': { kenglik: 40, balandlik: 30, chet: 1.5, nomi: 7, narx: 10.5, kod: 6, raqam: 6.5 },
}

// Balandlik varaqqa butun qator sig'adigan qilib tanlangan: 7×40, 8×35, 9×31 ≤ 281 mm
const A4_SETKA: Record<number, Omit<Geometriya, 'kenglik'>> = {
  3: { balandlik: 40, chet: 2.5, nomi: 9, narx: 14, kod: 7, raqam: 8 },
  4: { balandlik: 35, chet: 2, nomi: 8, narx: 12, kod: 6.5, raqam: 7 },
  5: { balandlik: 31, chet: 1.6, nomi: 7, narx: 10.5, kod: 6, raqam: 6.5 },
}

function geometriya(s: YorliqSozlama): Geometriya {
  if (s.olcham !== 'a4') return TERMAL[s.olcham]
  const g = A4_SETKA[s.ustunlar] ?? A4_SETKA[STANDART_YORLIQ.ustunlar]
  return { ...g, kenglik: A4_KENGLIK / s.ustunlar }
}

/** Yorliqning qog'ozdagi o'lchami (mm) — oldindan ko'rish uchun. */
export function yorliqOlchami(s: YorliqSozlama): { kenglik: number; balandlik: number } {
  const g = geometriya(s)
  return { kenglik: g.kenglik, balandlik: g.balandlik }
}

/** A4 varag'iga nechta yorliq sig'adi (termal — har biri alohida). */
export function varaqdagiYorliqlar(s: YorliqSozlama): number {
  if (s.olcham !== 'a4') return 1
  return s.ustunlar * Math.floor(A4_BALANDLIK / geometriya(s).balandlik)
}

/** 203 dpi termal printerning bitta nuqtasi, mm */
const NUQTA = 0.125

/**
 * Bitta modul (eng ingichka chiziq) kengligi, mm. Nuqtaga karrali, 0,25–0,375 mm
 * oralig'ida (EAN standartidagi 0,33 mm atrofida — qisqa kod ham haddan
 * tashqari yo'g'on chiqmaydi); joy juda tor bo'lsa — boriga sig'diriladi.
 */
function modulKengligi(joy: number, modullar: number): number {
  const ideal = joy / modullar
  const butun = Math.floor(ideal / NUQTA) * NUQTA
  return butun >= 2 * NUQTA ? Math.min(butun, 3 * NUQTA) : ideal
}

// ─── HTML ────────────────────────────────────────────────────────────────────

function html(matn: string): string {
  return String(matn ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const mm = (n: number) => `${Math.round(n * 1000) / 1000}mm`

/** "125 000 UZS" → raqami katta, valyutasi kichikroq. "$12.50" o'zgarmaydi. */
function narxHtml(narx: string): string {
  const m = /^(.*\d)\s+([^\d\s]+)$/.exec(narx.trim())
  return m ? `${html(m[1])}<small>${html(m[2])}</small>` : html(narx)
}

interface Tayyor {
  y: Yorliq
  sk: ShtrixKod
}

function yorliqHtml({ y, sk }: Tayyor, g: Geometriya): string {
  const joy = g.kenglik - 2 * g.chet
  const modul = modulKengligi(joy, shtrixKenglik(sk))
  // Uzun nom ikki qatorga sig'ishi uchun shrift kichrayadi (ko'pi bilan 25%).
  // Qalin harfning o'rtacha kengligi ~0,25 mm/pt (so'z bo'yicha ko'chish bilan).
  const sigadi = (2 * (joy - (y.tartibRaqami ? 9 : 0))) / (g.nomi * 0.25)
  const nomiPt = y.nomi.length > sigadi ? Math.max(g.nomi * 0.75, g.nomi * sigadi / y.nomi.length) : g.nomi
  return `<div class="yorliq">
  <div class="bosh">${y.tartibRaqami ? `<span class="raqam">№&#8239;${y.tartibRaqami}</span>` : ''}<span class="nomi" style="font-size:${nomiPt.toFixed(2)}pt">${html(y.nomi)}</span></div>
  <div class="chiziq"><div style="width:${mm(modul * shtrixKenglik(sk))}">${shtrixKodSvg(sk)}</div></div>
  <div class="kod">${html(sk.matn)}</div>
  <div class="narx">${narxHtml(y.narx)}</div>
</div>`
}

function uslub(s: YorliqSozlama, g: Geometriya, namuna: { masshtab: number; fon: string } | null): string {
  const termal = s.olcham !== 'a4'
  const sahifa = namuna
    ? ''
    : termal
      ? `@page{size:${mm(g.kenglik)} ${mm(g.balandlik)};margin:0}`
      : `@page{size:A4;margin:${A4_CHET}mm}`
  // Yorliq balandligi sahifadan sal kichik — yaxlitlashda ortiqcha bo'sh sahifa chiqmasin
  const balandlik = termal && !namuna ? g.balandlik - 0.3 : g.balandlik
  return `<style>
${sahifa}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#fff;color:#000}
body{font-family:"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.yorliq{width:${mm(g.kenglik)};height:${mm(balandlik)};padding:${mm(g.chet)};display:flex;flex-direction:column;gap:${mm(g.chet * 0.35)};overflow:hidden;background:#fff;break-inside:avoid;page-break-inside:avoid}
.bosh{display:flex;align-items:flex-start;gap:${mm(g.chet * 0.6)}}
.raqam{flex:none;font-weight:800;font-size:${g.raqam}pt;line-height:1;padding:0.45mm 0.9mm;border:0.25mm solid #000;border-radius:0.9mm;font-variant-numeric:tabular-nums;white-space:nowrap}
.nomi{flex:1;min-width:0;font-weight:700;line-height:1.15;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.chiziq{flex:1 1 0;min-height:6mm;position:relative}
.chiziq>div{position:absolute;top:0;bottom:0;left:0;right:0;margin:0 auto}
.chiziq svg{display:block;width:100%;height:100%}
.kod{text-align:center;font-family:Consolas,"Cascadia Mono","Courier New",monospace;font-size:${g.kod}pt;line-height:1;letter-spacing:0.08em;white-space:nowrap;overflow:hidden}
.narx{text-align:center;font-weight:800;font-size:${g.narx}pt;line-height:1.05;white-space:nowrap;overflow:hidden;font-variant-numeric:tabular-nums}
.narx small{font-size:0.6em;font-weight:700;margin-left:0.3em}
${namuna
    ? `html,body{background:${namuna.fon};height:100%}
body{display:grid;place-items:center;overflow:hidden}
.yorliq{zoom:${namuna.masshtab};box-shadow:0 0.3mm 1.2mm rgba(0,0,0,.25)}`
    : termal
      ? `.yorliq{break-after:page;page-break-after:always}
.yorliq:last-child{break-after:auto;page-break-after:auto}
@media screen{body{background:#e7e7ea;padding:6mm;display:flex;flex-wrap:wrap;gap:4mm;align-content:flex-start}.yorliq{box-shadow:0 0.3mm 1.2mm rgba(0,0,0,.25)}}`
      : `.varaq{display:grid;grid-template-columns:repeat(${s.ustunlar},${mm(g.kenglik)});grid-auto-rows:${mm(g.balandlik)};break-after:page;page-break-after:always}
.varaq:last-child{break-after:auto;page-break-after:auto}
.yorliq{outline:0.2mm dashed #9a9a9a;outline-offset:-0.1mm}
@media screen{body{background:#e7e7ea;padding:6mm}.varaq{width:210mm;min-height:297mm;padding:${A4_CHET}mm;margin:0 auto 6mm;background:#fff;box-shadow:0 0.5mm 2mm rgba(0,0,0,.2)}}`}
</style>`
}

function tayyorla(yorliqlar: Yorliq[]): { tayyor: Tayyor[]; otkazildi: Yorliq[] } {
  const tayyor: Tayyor[] = []
  const otkazildi: Yorliq[] = []
  for (const y of yorliqlar) {
    const sk = shtrixKodla(y.shtrixKod)
    if (sk) tayyor.push({ y, sk })
    else otkazildi.push(y)
  }
  return { tayyor, otkazildi }
}

/** Shtrix-kod chizib bo'ladimi (kod bor va lotin harf/raqamlardan iborat). */
export function yorliqqaChiqadimi(shtrixKod: string | null | undefined): boolean {
  return shtrixKodla(shtrixKod) !== null
}

/**
 * Chop etish uchun to'liq hujjat. Kodi yo'q yoki chiziqqa solinmaydigan
 * mahsulotlar `otkazildi`da qaytadi — chaqiruvchi foydalanuvchiga aytadi.
 */
export function yorliqlarHtml(yorliqlar: Yorliq[], sozlama: YorliqSozlama): { html: string; soni: number; otkazildi: Yorliq[] } {
  const s = yorliqSozlamasi(sozlama.olcham, sozlama.ustunlar, sozlama.nusxa)
  const g = geometriya(s)
  const { tayyor, otkazildi } = tayyorla(yorliqlar)

  const barchasi: string[] = []
  for (const t of tayyor) {
    const bir = yorliqHtml(t, g)
    for (let i = 0; i < s.nusxa; i++) barchasi.push(bir)
  }

  let tana: string
  if (s.olcham === 'a4') {
    const sigim = varaqdagiYorliqlar(s)
    const varaqlar: string[] = []
    for (let i = 0; i < barchasi.length; i += sigim) {
      varaqlar.push(`<section class="varaq">${barchasi.slice(i, i + sigim).join('')}</section>`)
    }
    tana = varaqlar.join('\n')
  } else {
    tana = barchasi.join('\n')
  }

  const hujjat = `<!DOCTYPE html>
<html lang="uz"><head><meta charset="utf-8" />
<title>Yorliqlar — ${barchasi.length} ta</title>
${uslub(s, g, null)}
</head>
<body>
${tana}
</body></html>`
  return { html: hujjat, soni: barchasi.length, otkazildi }
}

/**
 * Bitta yorliqning oldindan ko'rinishi (iframe uchun): qog'ozdagi bilan bir
 * xil belgilash, `masshtab` marta kattalashtirilgan. Kodi chizilmasa — null.
 */
export function yorliqNamunaHtml(yorliq: Yorliq, sozlama: YorliqSozlama, masshtab = 1, fon = '#e7e7ea'): string | null {
  const s = yorliqSozlamasi(sozlama.olcham, sozlama.ustunlar)
  const g = geometriya(s)
  const sk = shtrixKodla(yorliq.shtrixKod)
  if (!sk) return null
  return `<!DOCTYPE html>
<html lang="uz"><head><meta charset="utf-8" />
${uslub(s, g, { masshtab: Math.round(masshtab * 1000) / 1000, fon })}
</head>
<body>
${yorliqHtml({ y: yorliq, sk }, g)}
</body></html>`
}

/** CSS millimetri ekranda (96 dpi) necha piksel */
export const MM_PX = 96 / 25.4
