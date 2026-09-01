import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { sessionFilialId } from '@/lib/filial-scope'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    const ownFilialId = sessionFilialId(session)

    const { searchParams } = new URL(req.url)
    // Filial egasi faqat o'z filialini ko'rishi mumkin — query param'ga qaramay majburlanadi.
    const filialId = ownFilialId || searchParams.get('filialId') || undefined

    const foydalanuvchilar = await prisma.foydalanuvchi.findMany({
      where: filialId ? { filialId } : {},
      select: {
        id: true, ism: true, login: true, rol: true, faol: true, telefon: true, yaratilgan: true,
        filialId: true, filial: { select: { id: true, nomi: true } },
        ulashilganEgaId: true, tovarTahrirlashMumkin: true, tovarOchirishMumkin: true,
        lokatsiyaLat: true, lokatsiyaLng: true, lokatsiyaYangilangan: true,
      },
      orderBy: { yaratilgan: 'asc' },
    })
    return NextResponse.json(foydalanuvchilar)
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session || (session.user as any)?.rol !== 'ADMIN') {
      return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })
    }
    const ownFilialId = sessionFilialId(session)

    const { ism, login, parol, rol, telefon, filialId: reqFilialId, ulashilganEgaId: reqUlashilganEgaId } = await req.json()

    // Filial egasi faqat o'z filialiga xodim qo'sha oladi — boshqa filial yoki
    // global (Ega darajasidagi) hisob yarata olmaydi.
    const filialId = ownFilialId || reqFilialId

    if (rol !== 'ADMIN' && !filialId) {
      return NextResponse.json({ xato: "Filial tanlang" }, { status: 400 })
    }
    // Ega o'z mahsulotlar katalogini yangi Admin bilan ulashishi — faqat
    // filialsiz Admin uchun ma'noli, va faqat SO'ROVCHINING o'z id'siga
    // (boshqa Eganing nomidan ulasha olmaydi).
    const ulashilganEgaId = rol === 'ADMIN' && !filialId && reqUlashilganEgaId ? (session.user as any).id : null

    const mavjud = await prisma.foydalanuvchi.findUnique({ where: { login } })
    if (mavjud) return NextResponse.json({ xato: 'Bu login band' }, { status: 400 })
    const parolHash = await bcrypt.hash(parol, 10)
    const user = await prisma.foydalanuvchi.create({
      data: { ism, login, parolHash, rol, telefon: telefon || null, filialId: rol === 'ADMIN' ? (filialId || null) : filialId, ulashilganEgaId },
      select: { id: true, ism: true, login: true, rol: true, faol: true, telefon: true, filialId: true, ulashilganEgaId: true },
    })
    return NextResponse.json(user)
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
