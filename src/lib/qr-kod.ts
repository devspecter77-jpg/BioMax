// Mahsulot QR kodi — sof mantiq (brauzer/server ikkalasida ham ishlaydi).
//
// QR ichida MANZIL saqlanadi: `{origin}/qr/{shtrixKod}`.
// Nega shunday:
//   • oddiy telefon kamerasi QR'ni o'qib sahifani ochadi va mijoz
//     mahsulot nomi bilan narxini ko'radi;
//   • POS skaneri esa o'sha manzildan kodni ajratib oladi va odatdagi
//     shtrix-kod qidiruvini bajaradi.
// Ya'ni bitta QR ikkala holatda ham ishlaydi.

/** QR ichiga yoziladigan matn. */
export function qrManzili(origin: string, shtrixKod: string): string {
  const toza = String(shtrixKod ?? '').trim()
  const asos = String(origin ?? '').replace(/\/+$/, '')
  return `${asos}/qr/${encodeURIComponent(toza)}`
}

/**
 * Skanerdan kelgan matndan mahsulot kodini ajratadi.
 *
 * Skaner QR ham, oddiy shtrix-kod ham o'qiydi — shuning uchun kirish
 * to'liq manzil ham, yalang'och kod ham bo'lishi mumkin. Ikkalasi ham
 * bir xil natija berishi kerak, aks holda QR bilan skanerlangan mahsulot
 * "topilmadi" bo'lib qolardi.
 */
export function kodniAjrat(skanerMatni: string): string {
  const xom = String(skanerMatni ?? '').trim()
  if (!xom) return ''

  // Manzil ko'rinishida bo'lsa — oxirgi yo'l bo'lagini olamiz
  const manzilKorinishi = /^(https?:\/\/|\/)/i.test(xom)
  if (!manzilKorinishi) return xom

  // Query va hash qismini tashlaymiz
  const yolQismi = xom.split(/[?#]/)[0].replace(/\/+$/, '')
  const boshqalar = yolQismi.split('/')
  const oxirgi = boshqalar[boshqalar.length - 1] ?? ''

  // `/qr/<kod>` naqshi kutiladi; boshqa manzil bo'lsa ham oxirgi bo'lak
  // eng mantiqiy nomzod bo'ladi.
  try {
    return decodeURIComponent(oxirgi)
  } catch {
    return oxirgi
  }
}

/** Yorliqda ko'rsatiladigan mahsulot ma'lumoti. */
export interface QrYorliq {
  id: string
  nomi: string
  shtrixKod: string
  /** Formatlangan narx matni — chaqiruvchi valyutasi bilan tayyorlaydi. */
  narx: string
  /** QR rasmi — data URL. */
  qrRasm: string
}

export interface YorliqSozlama {
  /** Bir qatorda nechta yorliq (A4 uchun 2–5 mantiqiy). */
  ustunlar: number
  /** Har bir mahsulotdan nechta nusxa chiqarilsin. */
  nusxa: number
  dokonNomi: string
}

export const STANDART_YORLIQ: YorliqSozlama = {
  ustunlar: 4,
  nusxa: 1,
  dokonNomi: '',
}

function html(matn: string): string {
  return String(matn ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * A4 ga chiqariladigan yorliqlar varag'i.
 *
 * Har bir yorliqda: QR, mahsulot nomi, narxi va kod. Yorliq chegarasi
 * ko'rinib turadi — qaychi bilan qirqish uchun.
 */
export function yorliqlarHtml(yorliqlar: QrYorliq[], sozlama: YorliqSozlama): string {
  const ustunlar = Math.min(6, Math.max(1, sozlama.ustunlar))
  const nusxa = Math.min(50, Math.max(1, sozlama.nusxa))

  const barchasi: QrYorliq[] = []
  for (const y of yorliqlar) {
    for (let i = 0; i < nusxa; i++) barchasi.push(y)
  }

  const katakcha = barchasi.map(y => `
    <div class="yorliq">
      <img src="${y.qrRasm}" alt="" />
      <div class="nomi">${html(y.nomi)}</div>
      <div class="narx">${html(y.narx)}</div>
      <div class="kod">${html(y.shtrixKod)}</div>
    </div>`).join('')

  return `<!DOCTYPE html>
<html lang="uz"><head><meta charset="utf-8" />
<title>QR yorliqlar${sozlama.dokonNomi ? ' — ' + html(sozlama.dokonNomi) : ''}</title>
<style>
  @page { size: A4; margin: 8mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 0;
    font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    color: #000; background: #fff;
  }
  .sarlavha { font-size: 11px; color: #555; margin: 0 0 6px; }
  .setka {
    display: grid;
    grid-template-columns: repeat(${ustunlar}, 1fr);
    gap: 4mm;
  }
  .yorliq {
    border: 1px dashed #bbb;
    border-radius: 3mm;
    padding: 3mm 2mm;
    text-align: center;
    /* Yorliq sahifa o'rtasidan bo'linib ketmasin */
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .yorliq img { width: 100%; max-width: 32mm; height: auto; display: block; margin: 0 auto 1.5mm; }
  .nomi {
    font-size: 9px; font-weight: 600; line-height: 1.2;
    /* Uzun nom yorliqni cho'zib yubormasin — ikki qatorda kesiladi */
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    overflow: hidden; min-height: 2.2em;
  }
  .narx { font-size: 11px; font-weight: 700; margin-top: 0.8mm; }
  .kod { font-size: 8px; color: #666; font-family: "Courier New", monospace; margin-top: 0.5mm; }
  @media print { .sarlavha { display: none; } .yorliq { border-color: #ddd; } }
</style></head>
<body>
  <p class="sarlavha">${html(sozlama.dokonNomi || 'QR yorliqlar')} — ${barchasi.length} ta yorliq</p>
  <div class="setka">${katakcha}</div>
</body></html>`
}
