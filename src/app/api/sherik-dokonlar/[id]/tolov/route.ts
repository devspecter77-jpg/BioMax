import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    const { id } = await params
    const { summa, izoh, tovarQaytarish } = await req.json()

    // Tovar qaytarish rejimi
    if (tovarQaytarish && Array.isArray(tovarQaytarish) && tovarQaytarish.length > 0) {
      const userId = session.user.id
      let jamiSumma = 0

      for (const item of tovarQaytarish as { tovarId: string; miqdor: number; narx: number }[]) {
        const s = item.miqdor * item.narx
        jamiSumma += s

        // Omborga KIRIM qo'shish
        await prisma.omborHarakati.create({
          data: {
            tovarId: item.tovarId,
            turi: 'KIRIM',
            miqdor: item.miqdor,
            narx: item.narx,
            izoh: `Sherik do'kondan qaytarildi`,
            foydalanuvchiId: userId,
          },
        })
      }

      // Tolov sifatida qayd etish (qarzni kamaytirish)
      const tolov = await prisma.sherikDokonTolov.create({
        data: {
          sherikDokonId: id,
          summa: jamiSumma,
          izoh: izoh || 'Tovar qaytarildi',
        },
      })

      return NextResponse.json(tolov, { status: 201 })
    }

    // Oddiy pul to'lov
    if (!summa || parseFloat(summa) === 0) return NextResponse.json({ xato: "Summa noto'g'ri" }, { status: 400 })

    const tolov = await prisma.sherikDokonTolov.create({
      data: { sherikDokonId: id, summa: parseFloat(summa), izoh: izoh || null },
    })

    return NextResponse.json(tolov, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
