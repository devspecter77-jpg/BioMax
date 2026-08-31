import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { Prisma } from '@prisma/client'
import { egaFilialWhere } from '@/lib/filial-scope'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })

    const nasiya = await prisma.nasiya.findFirst({ where: { id, mijoz: egaFilialWhere(session) } })
    if (!nasiya) return NextResponse.json({ xato: 'Nasiya topilmadi' }, { status: 404 })

    const { ism, manzil, telefon, muddat, qarz, sana } = await req.json()

    // Telefon raqamni tozalash
    const cleanPhone = telefon !== undefined
      ? (telefon ? (telefon.replace(/\D/g, '').length >= 9 ? `+${telefon.replace(/\D/g, '')}` : null) : null)
      : undefined

    await prisma.mijoz.update({
      where: { id: nasiya.mijozId },
      data: {
        ...(ism !== undefined && { ism }),
        ...(manzil !== undefined && { manzil: manzil || null }),
        ...(cleanPhone !== undefined && { telefon: cleanPhone }),
      },
    })

    const nasiyaData: Record<string, unknown> = {
      muddat: muddat ? new Date(muddat) : null,
    }
    if (sana) nasiyaData.sana = new Date(sana)

    if (qarz !== undefined && qarz !== '') {
      const yangiQarz = new Prisma.Decimal(qarz)
      const farq = yangiQarz.sub(nasiya.jamiQarz)
      const yangiQoldiq = nasiya.qoldiq.add(farq)

      nasiyaData.jamiQarz = yangiQarz
      nasiyaData.qoldiq = yangiQoldiq.lte(0) ? new Prisma.Decimal(0) : yangiQoldiq

      if (yangiQoldiq.lte(0)) nasiyaData.holati = 'YOPILGAN'
      else if (nasiya.holati === 'YOPILGAN') nasiyaData.holati = 'OCHIQ'
    }

    const yangilangan = await prisma.nasiya.update({
      where: { id },
      data: nasiyaData,
    })

    return NextResponse.json(yangilangan)
  } catch (e) {
    console.error('[Nasiya PATCH]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })

    const nasiya = await prisma.nasiya.findFirst({ where: { id, mijoz: egaFilialWhere(session) } })
    if (!nasiya) return NextResponse.json({ xato: 'Nasiya topilmadi' }, { status: 404 })

    // Soft delete — ma'lumotlar saqlanadi, faqat yashiriladi
    await prisma.nasiya.update({
      where: { id },
      data: { ochirilgan: true },
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[Nasiya DELETE]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
