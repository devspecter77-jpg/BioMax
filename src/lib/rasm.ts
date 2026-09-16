import sharp from 'sharp'

/** Bir mahsulotga eng ko'p rasm. Onlayn vitrina galereyasi uchun 10 ta. */
export const MAX_RASM = 10
const MAX_OLCHAM = 1080 // eng katta tomon (piksel)

/**
 * Base64 data URL rasmlarni siqib, cheklangan o'lchamda qayta saqlashga tayyor
 * data URL qatorlariga aylantiradi. Bazani shishirmaslik uchun eng katta
 * tomonini 1080px ga tushiradi, sifatini esa yuqori (JPEG ~90%) saqlaydi.
 *
 * Allaqachon siqilgan rasm (JPEG, 1080px dan oshmaydi) QAYTA siqilmaydi:
 * mahsulot har saqlanganda rasm qayta kodlansa, sifati har safar biroz
 * yomonlashib boradi.
 */
export async function rasmlarniSiqish(dataUrls: unknown): Promise<string[]> {
  if (!Array.isArray(dataUrls)) return []

  const natija: string[] = []
  for (const raw of dataUrls.slice(0, MAX_RASM)) {
    if (typeof raw !== 'string' || !raw.startsWith('data:image/')) continue
    try {
      const base64 = raw.split(',')[1]
      if (!base64) continue
      const buffer = Buffer.from(base64, 'base64')
      const meta = await sharp(buffer).metadata()
      const tayyor = meta.format === 'jpeg'
        && (meta.width ?? Infinity) <= MAX_OLCHAM
        && (meta.height ?? Infinity) <= MAX_OLCHAM
        && (!meta.orientation || meta.orientation === 1)
      if (tayyor && raw.startsWith('data:image/jpeg;base64,')) {
        natija.push(raw)
        continue
      }
      const siqilgan = await sharp(buffer)
        .rotate() // EXIF orientatsiyasini to'g'irlash
        .resize(MAX_OLCHAM, MAX_OLCHAM, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 90, mozjpeg: true })
        .toBuffer()
      natija.push(`data:image/jpeg;base64,${siqilgan.toString('base64')}`)
    } catch {
      // Noto'g'ri/buzilgan rasm — o'tkazib yuboriladi
    }
  }
  return natija
}
