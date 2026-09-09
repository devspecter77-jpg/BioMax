import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { sessionIsRealEga } from '@/lib/filial-scope'

// Xarita bo'limi ma'lumotlari: filiallar va xodimlarning joylashuvi.
// Faqat bosh Ega ko'radi — /api/filiallar dagi bilan bir xil tekshiruv.
function faqatEga(session: unknown): boolean {
  const s = session as { user?: { rol?: string } } | null
  return !!s && s.user?.rol === 'ADMIN' && sessionIsRealEga(s as never)
}

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    if (!faqatEga(session)) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })

    const [filiallar, xodimlar] = await Promise.all([
      prisma.filial.findMany({
        select: {
          id: true, nomi: true, manzil: true, telefon: true, faol: true,
          lokatsiyaLat: true, lokatsiyaLng: true,
          _count: { select: { xodimlar: true } },
        },
        orderBy: { yaratilgan: 'asc' },
      }),
      prisma.foydalanuvchi.findMany({
        // Joylashuvi umuman yozilmagan xodimni xaritaga chiqarib bo'lmaydi
        where: { lokatsiyaLat: { not: null }, lokatsiyaLng: { not: null } },
        select: {
          id: true, ism: true, rol: true, telefon: true, faol: true,
          lokatsiyaLat: true, lokatsiyaLng: true, lokatsiyaYangilangan: true,
          filial: { select: { id: true, nomi: true } },
        },
        orderBy: { lokatsiyaYangilangan: 'desc' },
      }),
    ])

    return NextResponse.json({
      filiallar,
      xodimlar,
      // Server vaqti — "necha daqiqa oldin" hisobini brauzer soatiga
      // emas, serverga nisbatan qilamiz (soatlar farq qilishi mumkin).
      hozir: new Date().toISOString(),
    })
  } catch (e) {
    console.error('[xarita GET]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
