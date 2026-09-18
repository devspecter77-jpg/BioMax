// Onlayn do'kon ilovasining QR kodi — sof mantiq (bazasiz, tarmoqsiz).
//
// QR kod ilovani O'ZI o'rnata olmaydi: u faqat havolani ochadi. Shuning
// uchun kod do'konning `/ilova` sahifasiga olib boradi — mijoz u yerda
// bitta tugma bosadi, telefon esa o'rnatishga ruxsat so'raydi.
//
// Bu yerda faqat chizish va tekshirish; QR matritsasi serverda
// (`ilova-qr-server.ts`) hisoblanadi.

export interface QrMatritsa {
  /** Bir tomondagi modul (katakcha) soni */
  olcham: number
  /** Qora katakchalar: uzunligi olcham × olcham */
  data: boolean[]
}

/** Manzilning oxiriga qo'shiladigan yo'l — tahlilda QR'dan kelganlar ajralib tursin. */
export const QR_YOLI = '/ilova?manba=qr'

export const BRAND = {
  qizil: '#C62828',
  siyoh: '#1A1413',
  qogoz: '#FBF9F8',
  xira: '#8A817D',
} as const

/** Ekranda ko'rsatiladigan qisqa manzil: `https://`, `www.` va so'rov qismisiz. */
export function qisqaManzil(manzil: string): string {
  try {
    const u = new URL(manzil)
    return `${u.host.replace(/^www\./, '')}${u.pathname}`.replace(/\/$/, '')
  } catch {
    return manzil
  }
}

export function qrManzilTekshir(xom: unknown): { xato: string } | { manzil: string } {
  const matn = String(xom ?? '').trim()
  if (!matn) return { xato: 'Manzilni kiriting' }
  if (matn.length > 300) return { xato: 'Manzil juda uzun' }
  let u: URL
  try {
    u = new URL(matn)
  } catch {
    return { xato: 'Manzil to‘liq bo‘lsin: https://… bilan boshlansin' }
  }
  if (u.protocol !== 'https:' && u.hostname !== 'localhost') {
    // Ilova faqat HTTPS da o'rnatiladi — http manzil bosilgan QR foydasiz bo'lardi
    return { xato: 'Manzil «https://» bilan boshlanishi kerak — ilova faqat HTTPS da o‘rnatiladi' }
  }
  return { manzil: u.toString() }
}

// ─── Chizish ────────────────────────────────────────────────────────────────

/** Matritsadan bitta `path` yo'li — har modul kichik kvadrat. */
function qrYoli(m: QrMatritsa): string {
  const qismlar: string[] = []
  for (let y = 0; y < m.olcham; y++) {
    for (let x = 0; x < m.olcham; x++) {
      if (m.data[y * m.olcham + x]) qismlar.push(`M${x} ${y}h1v1h-1z`)
    }
  }
  return qismlar.join('')
}

const xavfsiz = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Do'kon belgisi (savat + barg) — QR markaziga va plakatga qo'yiladi. */
function belgiSvg(tomon: number, x: number, y: number): string {
  const k = tomon / 512
  return `<g transform="translate(${x} ${y}) scale(${k})">
    <rect width="512" height="512" rx="112" fill="${BRAND.qizil}"/>
    <path d="M188 204v-24a68 68 0 0 1 136 0v24" fill="none" stroke="#FFFFFF" stroke-width="26" stroke-linecap="round"/>
    <path d="M120 200h272a26 26 0 0 1 25.9 28.7l-17.6 168A48 48 0 0 1 352.6 440H159.4a48 48 0 0 1-47.7-43.3l-17.6-168A26 26 0 0 1 120 200z" fill="#FFFFFF"/>
    <path d="M256 262c44 38 44 98 0 136-44-38-44-98 0-136z" fill="${BRAND.qizil}"/>
    <path d="M256 276v108" fill="none" stroke="#FFFFFF" stroke-width="10" stroke-linecap="round"/>
  </g>`
}

/**
 * QR kodning o'zi. `viewBox` bilan chiziladi — SVG istalgan o'lchamga
 * cho'ziladi, ya'ni telefonda ham, katta ekranda ham, bosmada ham bir xil
 * aniq chiqadi (shuning uchun rasm emas, vektor).
 */
export function qrSvg(m: QrMatritsa, o: { manzil?: string; belgiBilan?: boolean } = {}): string {
  const chet = 2 // sokin zona — QR atrofidagi bo'sh joy (modul hisobida)
  const jami = m.olcham + chet * 2
  const belgi = m.olcham * 0.2
  const belgiO = (jami - belgi) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${jami} ${jami}" width="100%" height="100%" role="img" aria-label="Ilovani o‘rnatish uchun QR kod">
  <rect width="${jami}" height="${jami}" fill="#FFFFFF"/>
  <g transform="translate(${chet} ${chet})" fill="${BRAND.siyoh}" shape-rendering="crispEdges"><path d="${qrYoli(m)}"/></g>
  ${o.belgiBilan === false ? '' : `<rect x="${belgiO - belgi * 0.1}" y="${belgiO - belgi * 0.1}" width="${belgi * 1.2}" height="${belgi * 1.2}" rx="${belgi * 0.26}" fill="#FFFFFF"/>
  ${belgiSvg(belgi, belgiO, belgiO)}`}
  ${o.manzil ? `<desc>${xavfsiz(o.manzil)}</desc>` : ''}
</svg>`
}

/**
 * A5 plakat (148×210 mm) — do'konga osish yoki mijozga berish uchun.
 * Bosmaga tayyor: matn va QR vektor, shrift tizimniki (har kompyuterda ochiladi).
 */
export function plakatSvg(m: QrMatritsa, o: { dokon: string; manzil: string }): string {
  const W = 1748
  const H = 2480
  const qrTomon = 900
  const qrX = (W - qrTomon) / 2
  const qrY = 700
  const qadamlar = [
    'Telefon kamerasini QR kodga tuting',
    'Chiqqan havolani oching',
    '«Ilovani o‘rnatish» tugmasini bosing',
  ]
  const chet = 2
  const jami = m.olcham + chet * 2
  const k = qrTomon / jami
  const belgi = m.olcham * 0.2 * k
  const belgiO = qrX + (qrTomon - belgi) / 2

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${xavfsiz(o.dokon)} ilovasi — plakat">
  <style>
    text { font-family: 'Segoe UI', system-ui, -apple-system, Arial, sans-serif; fill: ${BRAND.siyoh} }
    .katta { font-size: 104px; font-weight: 800; letter-spacing: -3px }
    .orta { font-size: 72px; font-weight: 800; letter-spacing: -2px }
    .ost { font-size: 44px; font-weight: 600; fill: #5B5350 }
    .qadam { font-size: 40px; font-weight: 600 }
    .raqam { font-size: 36px; font-weight: 800; fill: #FFFFFF }
    .manzil { font-size: 44px; font-weight: 800; fill: ${BRAND.qizil}; letter-spacing: 1px }
    .izoh { font-size: 30px; font-weight: 600; fill: ${BRAND.xira} }
  </style>
  <rect width="${W}" height="${H}" fill="${BRAND.qogoz}"/>
  <rect width="${W}" height="26" fill="${BRAND.qizil}"/>
  <rect y="${H - 26}" width="${W}" height="26" fill="${BRAND.qizil}"/>

  <g transform="translate(${W / 2} 270)" text-anchor="middle">
    <text class="katta">${xavfsiz(o.dokon)}</text>
    <text class="ost" y="82">onlayn do‘kon</text>
  </g>
  <g transform="translate(${W / 2} 500)" text-anchor="middle">
    <text class="orta">Ilovani telefoningizga</text>
    <text class="orta" y="90">o‘rnatib oling</text>
  </g>

  <rect x="${qrX - 28}" y="${qrY - 28}" width="${qrTomon + 56}" height="${qrTomon + 56}" rx="48" fill="#FFFFFF" stroke="#E7E1DE" stroke-width="4"/>
  <g transform="translate(${qrX} ${qrY}) scale(${k})">
    <g transform="translate(${chet} ${chet})" fill="${BRAND.siyoh}" shape-rendering="crispEdges"><path d="${qrYoli(m)}"/></g>
  </g>
  <rect x="${belgiO - belgi * 0.1}" y="${qrY + (qrTomon - belgi) / 2 - belgi * 0.1}" width="${belgi * 1.2}" height="${belgi * 1.2}" rx="${belgi * 0.26}" fill="#FFFFFF"/>
  ${belgiSvg(belgi, belgiO, qrY + (qrTomon - belgi) / 2)}

  <g transform="translate(${W / 2} ${qrY + qrTomon + 120})" text-anchor="middle">
    <text class="manzil">${xavfsiz(qisqaManzil(o.manzil))}</text>
  </g>

  <g transform="translate(240 ${qrY + qrTomon + 230})">
    ${qadamlar.map((matn, i) => `<g transform="translate(0 ${i * 116})">
      <circle cx="34" cy="26" r="34" fill="${BRAND.qizil}"/>
      <text class="raqam" x="34" y="39" text-anchor="middle">${i + 1}</text>
      <text class="qadam" x="96" y="39">${xavfsiz(matn)}</text>
    </g>`).join('')}
  </g>

  <g transform="translate(${W / 2} ${H - 110})" text-anchor="middle">
    <text class="izoh">Play Market yoki App Store kerak emas — bir necha soniya vaqt oladi</text>
  </g>
</svg>`
}
