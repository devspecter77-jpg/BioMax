import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import bcrypt from 'bcryptjs'

export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })

    const { yangiParol } = await req.json()
    if (!yangiParol || yangiParol.length < 6) {
      return NextResponse.json({ xato: 'Parol kamida 6 ta belgi bo\'lsin' }, { status: 400 })
    }

    const parolHash = await bcrypt.hash(yangiParol, 10)
    await prisma.foydalanuvchi.update({
      where: { id: session.user.id },
      data: { parolHash },
    })

    return NextResponse.json({ muvaffaqiyat: true })
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
