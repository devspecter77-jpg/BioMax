import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { egaFilialWhere } from '@/lib/filial-scope'
import { balansOzgartir } from '@/lib/sodiqlik-server'

// Admin qo'lda tuzatishi — masalan aksiya uchun ball berish yoki xato
// yozilganini qaytarib olish. Har bir tuzatish jurnalga kim tomonidan
// qilingani bilan yoziladi, ya'ni izsiz o'zgartirib bo'lmaydi.
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session || (session.user as { rol?: string }).rol !== 'ADMIN') {
      return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })
    }

    const { mijozId, hisob, miqdor, izoh } = await req.json()
    if (!mijozId) return NextResponse.json({ xato: 'Mijoz tanlanmagan' }, { status: 400 })
    if (hisob !== 'BALL' && hisob !== 'KESHBEK') {
      return NextResponse.json({ xato: "Hisob turi noto'g'ri" }, { status: 400 })
    }
    const son = Number(miqdor)
    if (!Number.isFinite(son) || son === 0) {
      return NextResponse.json({ xato: "Miqdor 0 dan farqli bo'lishi kerak" }, { status: 400 })
    }

    // Mijoz shu foydalanuvchining ko'rish doirasidami
    const mijoz = await prisma.mijoz.findFirst({
      where: { id: mijozId, ...egaFilialWhere(session) },
      select: { id: true },
    })
    if (!mijoz) return NextResponse.json({ xato: 'Mijoz topilmadi' }, { status: 404 })

    const natija = await prisma.$transaction(tx =>
      balansOzgartir(tx, {
        mijozId,
        hisob,
        miqdor: son,
        sabab: 'QOLDA',
        izoh: typeof izoh === 'string' && izoh.trim() ? izoh.trim() : null,
        foydalanuvchiId: (session.user as { id: string }).id,
      }),
    )

    if (!natija) return NextResponse.json({ xato: 'Amalga oshmadi' }, { status: 400 })
    return NextResponse.json(natija)
  } catch (e) {
    console.error('[sodiqlik/qolda]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
