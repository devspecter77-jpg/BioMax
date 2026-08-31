import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { getStockMap } from '@/lib/stock'
import { sessionFilialId } from '@/lib/filial-scope'

// Shtrix-kod bo'yicha bitta tovarni topish — skaner uchun.
// Bir nechta variantni sinaydi: aynan, trim, leading-zero olib/qo'yib.
export async function GET(_: NextRequest, { params }: { params: Promise<{ kod: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })

    const { kod } = await params
    const n = decodeURIComponent(kod || '').trim()
    if (!n) return NextResponse.json({ xato: 'Shtrix-kod bo\'sh' }, { status: 400 })

    const filialId = sessionFilialId(session)
    const nNoZero = n.replace(/^0+/, '')
    const variantlar = Array.from(new Set([n, nNoZero, '0' + n, '00' + n]))

    let tovar = await prisma.tovar.findFirst({
      where: { holati: 'FAOL', shtrixKod: { in: variantlar }, ...(filialId ? { filialId } : {}) },
      include: { kategoriya: true },
    })

    // Trim qilingan kod bilan ham qidirish (DB'da bo'sh joy bilan saqlangan bo'lsa)
    if (!tovar) {
      tovar = await prisma.tovar.findFirst({
        where: {
          holati: 'FAOL',
          OR: variantlar.map(v => ({ shtrixKod: { contains: v } })),
          ...(filialId ? { filialId } : {}),
        },
        include: { kategoriya: true },
      })
    }

    if (!tovar) return NextResponse.json({ xato: 'Tovar topilmadi' }, { status: 404 })

    const stockMap = await getStockMap([tovar.id])
    const stock = stockMap.get(tovar.id)
    return NextResponse.json({ ...tovar, qoldiq: stock?.dokonQoldiq ?? 0 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
