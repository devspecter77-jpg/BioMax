import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { mijozDoirasi } from '@/lib/mijoz-doirasi'

// Mijoz avval qaysi mahsulotlarni sotib olganini tez tekshirish uchun
// yengil endpoint — POS'da savatga mahsulot qo'shilganda "bu mijoz
// avval shuni olgan edi" eslatmasi uchun ishlatiladi. Har bir mahsulot
// bo'yicha faqat ENG SO'NGGI xaridni qaytaradi.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    const { id } = await params
    const mijoz = await prisma.mijoz.findFirst({
      where: { AND: [{ id }, await mijozDoirasi(session)] },
      select: { id: true },
    })
    if (!mijoz) return NextResponse.json({ xato: 'Mijoz topilmadi' }, { status: 404 })

    const tarkiblar = await prisma.sotuvTarkibi.findMany({
      where: { sotuv: { mijozId: id, holati: 'YAKUNLANGAN' } },
      select: { tovarId: true, birlikNarxi: true, sotuv: { select: { sana: true } } },
      orderBy: { sotuv: { sana: 'desc' } },
    })

    const tarix: Record<string, { narx: number; sana: string }> = {}
    for (const t of tarkiblar) {
      if (tarix[t.tovarId]) continue // eng so'nggisi allaqachon olingan
      tarix[t.tovarId] = { narx: Number(t.birlikNarxi), sana: t.sotuv.sana.toISOString() }
    }

    return NextResponse.json(tarix)
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
