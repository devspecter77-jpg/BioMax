import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { sessionFilialId } from '@/lib/filial-scope'

// Faqat bosh egasi (Ega, filialId yo'q) filiallarni boshqara oladi —
// filial egasi o'z filialidan tashqarida hech narsani ko'rmasligi/o'zgartirmasligi kerak.
function faqatEga(session: any) {
  const rol = session?.user?.rol
  return !!session && rol === 'ADMIN' && !sessionFilialId(session)
}

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    if (!faqatEga(session)) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })

    const filiallar = await prisma.filial.findMany({
      include: { _count: { select: { xodimlar: true } } },
      orderBy: { yaratilgan: 'asc' },
    })

    return NextResponse.json(filiallar)
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!faqatEga(session)) {
      return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })
    }

    const { nomi, manzil, telefon } = await req.json()
    if (!nomi?.trim()) return NextResponse.json({ xato: 'Filial nomini kiriting' }, { status: 400 })

    const filial = await prisma.filial.create({
      data: { nomi: nomi.trim(), manzil: manzil || null, telefon: telefon || null },
    })

    return NextResponse.json(filial, { status: 201 })
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
