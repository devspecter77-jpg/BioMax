// Mahsulot QR kodi — skanerdan kelgan matnni tushunish (brauzer/server).
//
// Avval yorliqlarda QR chiqarilgan, uning ichida MANZIL bor edi:
// `{origin}/qr/{shtrixKod}` (telefon kamerasi sahifani ochadi). Endi yorliqlar
// oddiy shtrix-kod (lib/yorliq.ts), lekin do'konda yopishtirilgan eski QR
// yorliqlar ishlashda davom etadi: skaner manzilni yuborsa ham kod ajratiladi.

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
