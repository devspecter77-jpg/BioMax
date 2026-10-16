// A4 chek uchun mahsulot rasmlari — server tomoni.
//
// Rasmlar bazada 1080px gacha (~200–400 KB). A4 jadvalidagi rasm katagi
// ~22 mm — 320px shu o'lchamda ~370 DPI, bitta rasm esa ~15–25 KB.
// Kichraytirish SERVERDA: kassa telefoni va sekin internet og'ir rasmlarni
// tortmaydi. Galereyada 10 tagacha rasm bo'lishi mumkin — faqat birinchisi o'qiladi.

import sharp from 'sharp'
import { prisma } from './prisma'

const RASM_OLCHAMI = 320

async function kichrayt(dataUrl: string): Promise<string | null> {
  try {
    const base64 = dataUrl.split(',')[1]
    if (!base64) return null
    const bufer = await sharp(Buffer.from(base64, 'base64'))
      .rotate()
      .resize(RASM_OLCHAMI, RASM_OLCHAMI, { fit: 'inside', withoutEnlargement: true })
      // Shaffof PNG JPEG'da qora fon bo'lib chiqmasin
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer()
    return `data:image/jpeg;base64,${bufer.toString('base64')}`
  } catch {
    return null
  }
}

/**
 * Tovarlarning birinchi rasmi, A4 chek uchun kichraytirilgan (tovar id → `data:` URL).
 * `doira` berilsa — faqat shu Ega/filial katalogidagi tovarlar (boshqasiniki
 * ochilmasin). Rasmi yo'q tovar natijada bo'lmaydi.
 */
export async function chekRasmlari(
  idlar: string[],
  doira?: { filialId: string } | { filialId: null; egaId: string | null },
): Promise<Map<string, string>> {
  const takrorsiz = [...new Set(idlar)].filter(Boolean)
  if (takrorsiz.length === 0) return new Map()
  // Butun galereya bazadan tortilmasin — faqat birinchi rasm
  const qatorlar = !doira
    ? await prisma.$queryRaw<{ id: string; rasm: string | null }[]>`
        SELECT id, rasmlar[1] AS rasm FROM public.tovarlar WHERE id = ANY(${takrorsiz})`
    : doira.filialId
      ? await prisma.$queryRaw<{ id: string; rasm: string | null }[]>`
          SELECT id, rasmlar[1] AS rasm FROM public.tovarlar WHERE id = ANY(${takrorsiz}) AND "filialId" = ${doira.filialId}`
      : await prisma.$queryRaw<{ id: string; rasm: string | null }[]>`
          SELECT id, rasmlar[1] AS rasm FROM public.tovarlar
          WHERE id = ANY(${takrorsiz}) AND "filialId" IS NULL AND "egaId" IS NOT DISTINCT FROM ${(doira as { egaId: string | null }).egaId}`
  const natija = new Map<string, string>()
  await Promise.all(qatorlar.map(async r => {
    if (!r.rasm?.startsWith('data:image/')) return
    const k = await kichrayt(r.rasm)
    if (k) natija.set(r.id, k)
  }))
  return natija
}
