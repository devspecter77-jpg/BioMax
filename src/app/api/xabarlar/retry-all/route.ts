import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { queueWorkerTick } from '@/lib/telegram'

// POST — Barcha xato/queued xabarlarni queue'ga qaytarib qo'yish
// (worker har 5s'da birma-bir yuboradi — rate limit'ga rioya qilinadi)
export async function POST(_req: NextRequest) {
  try {
    const session = await auth()
    if (!session || session.user?.rol !== 'ADMIN') {
      return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })
    }

    const result = await prisma.bildirishnomLog.updateMany({
      where: {
        status: { in: ['failed', 'queued'] },
        xabarMatni: { not: null },
      },
      data: {
        status: 'pending',
        xato: null,
        urinishSoni: 0,
        keyingiUrinish: new Date(),
      },
    })

    // Darhol bitta tick chaqiramiz — worker keyingi 5s ichida olib yuboradi
    queueWorkerTick().catch(() => {})

    return NextResponse.json({
      ok: true,
      qayta_navbatga: result.count,
      izoh: 'Xabarlar queue\'ga qaytarildi. Worker har 5 soniyada birma-bir yuboradi.',
    })
  } catch (e) {
    console.error('[Xabar retry-all]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
