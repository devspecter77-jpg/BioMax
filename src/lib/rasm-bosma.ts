// Bosma uchun rasmni kichraytirish — brauzerda (canvas).
//
// Bazadagi rasm 1080px gacha, bitta rasm ~200–400 KB. Katalogda 200 ta
// mahsulot bo'lsa hujjat 50 MB ga chiqib, bosma oynasi qotib qolardi.
// Katalogdagi katak eni ~60 mm: 480px shu o'lchamda ~200 DPI beradi —
// bosmada ko'z ilg'amaydigan farq, hajmi esa o'nlab marta kichik.

/** Katalog katagi uchun yetarli eng katta tomon (piksel). */
export const BOSMA_OLCHAMI = 480

/**
 * `data:` URL rasmni kichraytiradi va JPEG qilib qaytaradi.
 * Xato bo'lsa — asl rasm qaytadi (katalog rasmsiz qolmasin).
 */
export async function bosmaRasmi(dataUrl: string, maksTomon = BOSMA_OLCHAMI): Promise<string> {
  if (typeof document === 'undefined' || !dataUrl.startsWith('data:image/')) return dataUrl
  try {
    const rasm = new Image()
    rasm.src = dataUrl
    await rasm.decode()
    const eng = Math.max(rasm.naturalWidth, rasm.naturalHeight)
    if (!eng) return dataUrl
    if (eng <= maksTomon) return dataUrl

    const k = maksTomon / eng
    const en = Math.max(1, Math.round(rasm.naturalWidth * k))
    const boy = Math.max(1, Math.round(rasm.naturalHeight * k))
    const kanvas = document.createElement('canvas')
    kanvas.width = en
    kanvas.height = boy
    const ctx = kanvas.getContext('2d')
    if (!ctx) return dataUrl
    // Oq fon: shaffof PNG JPEG'da qora bo'lib chiqmasin
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, en, boy)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(rasm, 0, 0, en, boy)
    const natija = kanvas.toDataURL('image/jpeg', 0.82)
    // Kichraytirish foyda bermasa (kichik rasm) — aslini qoldiramiz
    return natija.length < dataUrl.length ? natija : dataUrl
  } catch {
    return dataUrl
  }
}

/**
 * Bir nechta rasmni kichraytiradi. Brauzer qotib qolmasligi uchun kichik
 * to'plamlarda ishlanadi va har to'plamdan keyin `oqim` xabar beradi.
 */
export async function bosmaRasmlari(
  rasmlar: (string | null)[],
  { maksTomon = BOSMA_OLCHAMI, oqim }: { maksTomon?: number; oqim?: (tayyor: number) => void } = {},
): Promise<(string | null)[]> {
  const natija: (string | null)[] = new Array(rasmlar.length).fill(null)
  const BIRYOLA = 4
  for (let i = 0; i < rasmlar.length; i += BIRYOLA) {
    const bolak = rasmlar.slice(i, i + BIRYOLA)
    const tayyor = await Promise.all(bolak.map(r => (r ? bosmaRasmi(r, maksTomon) : Promise.resolve(null))))
    for (let j = 0; j < tayyor.length; j++) natija[i + j] = tayyor[j]
    oqim?.(Math.min(i + BIRYOLA, rasmlar.length))
  }
  return natija
}
