// Shtrix-kod (1D) — EAN-13 va Code 128, SVG ko'rinishida.
//
// Tashqi kutubxonasiz: yorliqda vektor chiziqlar aniq chiqadi, sahifa
// og'irlashmaydi, server kerak emas. Jadvallar standartdan:
// ISO/IEC 15420 (EAN-13) va ISO/IEC 15417 (Code 128).
//
// Qaysi turi: to'g'ri nazorat raqamli 13 xonali kod — EAN-13 (do'kon
// mahsulotlaridagi odatiy shtrix-kod); qolgani (ichki "1", "25", harfli
// kodlar) — Code 128. Ikkalasini ham kassa skaneri o'qiydi va kodning
// o'zini yuboradi, ya'ni qidiruv avvalgidek ishlaydi.

// ─── Code 128 ────────────────────────────────────────────────────────────────

/** Belgi naqshlari: chiziq/bo'shliq kengliklari (modullarda), chiziqdan boshlanadi. */
const CODE128 = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232',
]
const STOP = '2331112'
const START_B = 104
const START_C = 105
const CODE_B = 100
const CODE_C = 99

/**
 * Code 128 belgilar qiymatlari (start va nazorat belgisi bilan); null —
 * kodlab bo'lmaydi (bo'sh, juda uzun yoki ASCII bo'lmagan belgi).
 * Raqamlar ketma-ketligi C to'plamida (ikki raqam — bitta belgi), qolgani B.
 */
export function code128Qiymatlar(matn: string): number[] | null {
  if (!matn || matn.length > 48) return null
  for (let i = 0; i < matn.length; i++) {
    const c = matn.charCodeAt(i)
    if (c < 32 || c > 126) return null
  }
  const raqammi = (i: number) => i < matn.length && matn.charCodeAt(i) >= 48 && matn.charCodeAt(i) <= 57
  const raqamlar = (i: number) => { let n = 0; while (raqammi(i + n)) n++; return n }

  const q: number[] = []
  const bosh = raqamlar(0)
  // Boshida kamida 4 raqam yoki butun matn juft sonli raqam — C bilan boshlanadi
  let toplam: 'B' | 'C' = bosh >= 4 || (bosh === matn.length && bosh % 2 === 0) ? 'C' : 'B'
  q.push(toplam === 'C' ? START_C : START_B)
  let i = 0
  while (i < matn.length) {
    if (toplam === 'C') {
      if (raqamlar(i) >= 2) {
        q.push(Number(matn.slice(i, i + 2)))
        i += 2
      } else {
        q.push(CODE_B)
        toplam = 'B'
      }
      continue
    }
    const n = raqamlar(i)
    if (n >= 4) {
      // Toq bo'lsa birinchisi B da qoladi, qolgan juftlar C da
      if (n % 2 === 1) { q.push(matn.charCodeAt(i) - 32); i++ }
      q.push(CODE_C)
      toplam = 'C'
      continue
    }
    q.push(matn.charCodeAt(i) - 32)
    i++
  }
  let summa = q[0]
  for (let k = 1; k < q.length; k++) summa += q[k] * k
  q.push(summa % 103)
  return q
}

/** Kengliklar naqshi → modullar qatori ("1" — chiziq, "0" — bo'shliq). */
function naqsh(p: string): string {
  let r = ''
  for (let i = 0; i < p.length; i++) r += (i % 2 === 0 ? '1' : '0').repeat(Number(p[i]))
  return r
}

export function code128Modullar(qiymatlar: number[]): string {
  return qiymatlar.map(v => naqsh(CODE128[v])).join('') + naqsh(STOP)
}

// ─── EAN-13 ──────────────────────────────────────────────────────────────────

const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011']
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111']
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100']
/** Birinchi raqamga qarab chap yarim qismdagi L/G tartibi */
const PARITET = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL']

/** 13 raqam va to'g'ri nazorat raqami. */
export function ean13Togri(kod: string): boolean {
  if (!/^\d{13}$/.test(kod)) return false
  let s = 0
  for (let i = 0; i < 12; i++) s += Number(kod[i]) * (i % 2 === 0 ? 1 : 3)
  return (10 - (s % 10)) % 10 === Number(kod[12])
}

export function ean13Modullar(kod: string): string {
  const p = PARITET[Number(kod[0])]
  let s = '101'
  for (let i = 1; i <= 6; i++) s += (p[i - 1] === 'L' ? L : G)[Number(kod[i])]
  s += '01010'
  for (let i = 7; i <= 12; i++) s += R[Number(kod[i])]
  return s + '101'
}

// ─── Umumiy ──────────────────────────────────────────────────────────────────

export interface ShtrixKod {
  turi: 'EAN13' | 'CODE128'
  /** "1" — chiziq, "0" — bo'shliq (bitta modul) */
  modullar: string
  /** Chiziqlar ostida yoziladigan matn */
  matn: string
}

/** Kodni shtrix-kodga aylantiradi; null — bu kodni chiziqlarga solib bo'lmaydi. */
export function shtrixKodla(kod: string | null | undefined): ShtrixKod | null {
  const k = String(kod ?? '').trim()
  if (!k) return null
  if (ean13Togri(k)) return { turi: 'EAN13', modullar: ean13Modullar(k), matn: `${k[0]} ${k.slice(1, 7)} ${k.slice(7)}` }
  const q = code128Qiymatlar(k)
  return q ? { turi: 'CODE128', modullar: code128Modullar(q), matn: k } : null
}

/** Chet bo'shliqlari (modullarda): chap va o'ng — skaner kod boshini shundan taniydi. */
function tinchJoy(sk: ShtrixKod): [number, number] {
  return sk.turi === 'EAN13' ? [11, 7] : [10, 10]
}

/** Kodning to'liq kengligi modullarda — chet bo'shliqlari bilan. */
export function shtrixKenglik(sk: ShtrixKod): number {
  const [chap, ong] = tinchJoy(sk)
  return chap + sk.modullar.length + ong
}

function xavfsiz(matn: string): string {
  return matn.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * SVG — o'lcham modullarda, chet bo'shliqlari (skaner uchun shart) bilan.
 * `preserveAspectRatio="none"`: CSS bilan istalgan kenglik/balandlik
 * beriladi — barcha chiziqlar bir xil nisbatda cho'ziladi, kod buzilmaydi.
 */
export function shtrixKodSvg(sk: ShtrixKod, balandlik = 40): string {
  const [chap] = tinchJoy(sk)
  const kenglik = shtrixKenglik(sk)
  let chiziqlar = ''
  for (let i = 0; i < sk.modullar.length;) {
    if (sk.modullar[i] !== '1') { i++; continue }
    let j = i
    while (j < sk.modullar.length && sk.modullar[j] === '1') j++
    chiziqlar += `<rect x="${chap + i}" y="0" width="${j - i}" height="${balandlik}"/>`
    i = j
  }
  // Code 128 matnida istalgan belgi (", <, &) bo'lishi mumkin — atributga xavfsiz qo'yiladi
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${kenglik} ${balandlik}" preserveAspectRatio="none" shape-rendering="crispEdges" role="img" aria-label="Shtrix-kod ${xavfsiz(sk.matn)}"><rect width="${kenglik}" height="${balandlik}" fill="#fff"/><g fill="#000">${chiziqlar}</g></svg>`
}
