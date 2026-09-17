import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { onlaynRuxsat } from '@/lib/onlayn-buyurtma-server'
import { buyurtmaDostavchiklari } from '@/lib/dostavchik-server'

export const dynamic = 'force-dynamic'

/**
 * Dostavchik mijoz manziliga yetib keldi.
 *
 * Buyurtmaning saytdagi holati o'zgarmaydi ("yo'lda" qoladi) — bu faqat
 * do'kon uchun: dostavchik hozir qaysi mijozning oldida turganini ko'rish.
 * "Yo'lga chiqdim" va "Topshirdim" esa oddiy holat o'zgarishi (`/holat`).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ raqam: string }> }) {
  const r = await onlaynRuxsat('onlayn-buyurtmalar.yetkazish')
  if (!r.ok) return r.javob

  const raqam = decodeURIComponent((await params).raqam)
  if (!/^MP-\d{4}-\d{5,}$/.test(raqam)) return NextResponse.json({ xato: 'Buyurtma topilmadi' }, { status: 404 })

  try {
    const tana = await req.json().catch(() => null)
    if (tana?.amal !== 'YETIB_KELDI') return NextResponse.json({ xato: "So'rov noto'g'ri" }, { status: 400 })

    const meId = (r.session.user as unknown as { id: string }).id
    const y = await prisma.onlaynYetkazish.findFirst({
      where: { buyurtmaRaqami: raqam, dostavchikId: meId },
      select: { holati: true },
    })
    if (!y) return NextResponse.json({ xato: 'Bu buyurtma sizga biriktirilmagan' }, { status: 403 })
    if (y.holati === 'TAYINLANGAN') return NextResponse.json({ xato: 'Avval «Yo‘lga chiqdim» ni bosing' }, { status: 409 })
    if (y.holati !== 'YOLDA') return NextResponse.json({ xato: 'Bu yetkazish allaqachon yakunlangan' }, { status: 409 })

    // Shart bilan — ikki marta bosilsa vaqt birinchisidan qoladi
    await prisma.onlaynYetkazish.updateMany({
      where: { buyurtmaRaqami: raqam, dostavchikId: meId, holati: 'YOLDA' },
      data: { holati: 'YETIB_KELDI', yetibKeldi: new Date() },
    })
    return NextResponse.json({ dostavchik: (await buyurtmaDostavchiklari([raqam])).get(raqam) ?? null })
  } catch (e) {
    console.error('[onlayn-buyurtmalar/yetkazish]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
