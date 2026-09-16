import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { prisma } from '@/lib/prisma'
import { vitrinaRuxsat } from '@/lib/vitrina-ruxsat'
import { rasmniOch } from '@/lib/vitrina-server'

export const dynamic = 'force-dynamic'

/**
 * Vitrina ro'yxati uchun kichik rasm (96 px). Ro'yxatga 13 ta mahsulotning
 * to'liq base64 rasmini (~3 MB) yuborish o'rniga har biri ~4 KB.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; tartib: string }> }) {
  const r = await vitrinaRuxsat()
  if (!r.ok) return r.javob
  const { id, tartib } = await params
  const i = Number(tartib)
  if (!Number.isInteger(i) || i < 0 || i > 20) return new NextResponse(null, { status: 404 })

  const t = await prisma.tovar.findFirst({ where: { id, ...r.doira }, select: { rasmlar: true } })
  const rasm = t?.rasmlar[i] ? rasmniOch(t.rasmlar[i]!) : null
  if (!rasm) return new NextResponse(null, { status: 404 })

  const kichik = await sharp(rasm.baytlar).resize(192, 192, { fit: 'cover' }).webp({ quality: 72 }).toBuffer()
  return new NextResponse(new Uint8Array(kichik), {
    headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'private, max-age=300' },
  })
}
