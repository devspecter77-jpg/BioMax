import { NextRequest, NextResponse } from 'next/server'
import type { NasiyaHolati, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { egaFilialWhere } from '@/lib/filial-scope'
import { mijozDoirasi, yangiMijozEgaligi } from '@/lib/mijoz-doirasi'
import { telefonBoyichaSharti } from '@/lib/mijoz-telefon-server'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const holati = searchParams.get('holati') || ''
    const mijozId = searchParams.get('mijozId') || ''

    // Faqat xodim ko'radigan mijozlarning nasiyalari
    const where: Prisma.NasiyaWhereInput = { ochirilgan: false, mijoz: await mijozDoirasi(session) }
    if (holati) where.holati = holati as NasiyaHolati
    if (mijozId) where.mijozId = mijozId

    const nasiyalar = await prisma.nasiya.findMany({
      where,
      include: {
        mijoz: true,
        sotuv: { select: { chekRaqami: true, sana: true } },
        tolovlar: { orderBy: { sana: 'desc' } },
        qarzTarixi: { orderBy: { sana: 'desc' } },
      },
      orderBy: { sana: 'desc' },
    })

    return NextResponse.json(nasiyalar)
  } catch (e) {
    console.error('[Nasiyalar GET]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })

    const body = await req.json()
    const { ism, manzil, telefon, qarz, muddat, sana, mijozId } = body

    if (!qarz) {
      return NextResponse.json({ xato: 'Qarz summasi majburiy' }, { status: 400 })
    }
    // `mijozId` berilsa ism talab qilinmaydi — mavjud mijoz tanlangan
    if (!mijozId && !ism) {
      return NextResponse.json({ xato: 'Mijozni tanlang yoki ism kiriting' }, { status: 400 })
    }

    const summa = Number(qarz)
    if (!Number.isFinite(summa) || summa <= 0) {
      return NextResponse.json({ xato: "Qarz noldan katta bo'lishi kerak" }, { status: 400 })
    }

    // Telefon raqamdan faqat raqamlarni olish
    const cleanPhone = telefon ? telefon.replace(/\D/g, '') : null
    const finalPhone = cleanPhone && cleanPhone.length >= 9 ? `+${cleanPhone}` : null

    // Mijozni topish — ism bo'yicha qidirib, manzilni ham solishtirish (kichik harfda, probelsiz)
    const normalizeManzil = (m: string) => m.trim().toLowerCase().replace(/\s+/g, ' ')

    let mijoz = null
    // Mijoz faqat xodim ko'radiganlar orasidan topiladi — boshqa xodimning
    // mijoziga nasiya yozilmaydi
    const doira = await mijozDoirasi(session)

    // Ro'yxatdan tanlangan mijoz — ism bo'yicha qidirish shart emas.
    // Bu takroriy mijoz yaratilishining oldini oladi: ilgari faqat ism
    // bilan qidirilardi va bir xil ismli ikkinchi mijoz paydo bo'lardi.
    if (mijozId) {
      mijoz = await prisma.mijoz.findFirst({
        where: { AND: [{ id: String(mijozId) }, doira] },
      })
      if (!mijoz) return NextResponse.json({ xato: 'Mijoz topilmadi' }, { status: 404 })
    }

    if (!mijoz && manzil) {
      const candidates = await prisma.mijoz.findMany({
        where: { AND: [{ ism: { equals: ism, mode: 'insensitive' } }, doira] },
      })
      mijoz = candidates.find(c =>
        c.manzil && normalizeManzil(c.manzil) === normalizeManzil(manzil)
      ) || null
    }

    if (!mijoz && !mijozId) {
      // Agar telefon bor bo'lsa, telefon bo'yicha ham tekshirish
      const tel = telefonBoyichaSharti(finalPhone)
      if (tel) {
        mijoz = await prisma.mijoz.findFirst({
          where: { AND: [tel, doira] },
        })
        // Raqam boshqa xodimning mijozida — ikkinchi nusxa yaratilmaydi
        if (!mijoz && await prisma.mijoz.count({ where: { AND: [tel, egaFilialWhere(session)] } })) {
          return NextResponse.json({
            xato: 'Bu telefon raqamli mijoz bazada bor, lekin boshqa xodimga biriktirilgan. Administratorga murojaat qiling',
            kod: 'boshqa_xodimniki',
          }, { status: 409 })
        }
      }
    }

    if (!mijoz) {
      mijoz = await prisma.mijoz.create({
        data: {
          ism,
          manzil: manzil || null,
          telefon: finalPhone,
          ...egaFilialWhere(session),
          ...yangiMijozEgaligi(session),
        },
      })
    } else {
      // Mavjud mijozni yangilash (telefon yoki manzil o'zgarganda)
      const updateData: Prisma.MijozUpdateInput = {}
      if (finalPhone && mijoz.telefon !== finalPhone) updateData.telefon = finalPhone
      if (manzil && mijoz.manzil !== manzil) updateData.manzil = manzil
      if (Object.keys(updateData).length > 0) {
        mijoz = await prisma.mijoz.update({
          where: { id: mijoz.id },
          data: updateData,
        })
      }
    }

    const nasiyaSana = sana ? new Date(sana) : new Date()

    const nasiya = await prisma.$transaction(async (tx) => {
      const yangi = await tx.nasiya.create({
        data: {
          mijozId: mijoz.id,
          jamiQarz: qarz,
          qoldiq: qarz,
          muddat: muddat ? new Date(muddat) : null,
          sana: nasiyaSana,
        },
      })

      // Boshlang'ich qarz tarixiga yozish
      await tx.nasiyaQarzTarixi.create({
        data: {
          nasiyaId: yangi.id,
          summa: qarz,
          izoh: 'Boshlang\'ich nasiya',
          sana: nasiyaSana,
        },
      })

      return yangi
    })

    return NextResponse.json(nasiya, { status: 201 })
  } catch (e) {
    console.error('[Nasiyalar POST]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
