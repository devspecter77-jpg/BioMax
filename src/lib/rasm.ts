import sharp from 'sharp'

const MAX_RASM = 3
const MAX_OLCHAM = 1080 // eng katta tomon (piksel)

/**
 * Base64 data URL rasmlarni siqib, cheklangan o'lchamda qayta saqlashga tayyor
 * data URL qatorlariga aylantiradi. Bazani shishirmaslik uchun eng katta
 * tomonini 1080px ga tushiradi, sifatini esa yuqori (JPEG ~90%) saqlaydi.
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
