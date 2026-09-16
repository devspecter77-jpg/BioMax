import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { imzoniTekshir } from '@/lib/marketplace-imzo'
import { rasmniOch, rasmVersiyasi } from '@/lib/vitrina-server'

// MARKETPLACE SHARTNOMASI — mahsulot rasmi (baytlar).
//
// Faqat saytga chiqarilgan mahsulotning rasmi beriladi. Marketplace uni
// versiya bo'yicha uzoq keshlaydi: rasm almashsa katalogdagi versiya o'zgaradi.

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ tovarId: string; tartib: string }> }) {
  const t = imzoniTekshir(req, '')
  if (!t.ok) return NextResponse.json({ kod: t.sabab, xato: 'Ruxsat yo‘q' }, { status: t.holat })

  const { tovarId, tartib } = await params
  const i = Number(tartib)
  if (!Number.isInteger(i) || i < 0 || i > 20 || !/^[a-z0-9]{10,40}$/i.test(tovarId)) {
    return NextResponse.json({ kod: 'topilmadi', xato: 'Rasm topilmadi' }, { status: 404 })
  }

  const tovar = await prisma.tovar.findFirst({
    where: { id: tovarId, holati: 'FAOL', kartochka: { saytda: true } },
    select: { rasmlar: true },
  })
  const xom = tovar?.rasmlar[i]
  const rasm = xom ? rasmniOch(xom) : null
  if (!xom || !rasm) return NextResponse.json({ kod: 'topilmadi', xato: 'Rasm topilmadi' }, { status: 404 })

  return new NextResponse(new Uint8Array(rasm.baytlar), {
    headers: {
      'Content-Type': rasm.turi,
      'Content-Length': String(rasm.baytlar.length),
      'X-Rasm-Versiya': rasmVersiyasi(xom),
      'Cache-Control': 'private, max-age=60',
    },
  })
}
