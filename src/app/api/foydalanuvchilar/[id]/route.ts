import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { sessionFilialId } from '@/lib/filial-scope'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session || (session.user as any)?.rol !== 'ADMIN') {
      return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })
    }
    const ownFilialId = sessionFilialId(session)

    if (ownFilialId) {
      const nishon = await prisma.foydalanuvchi.findUnique({ where: { id }, select: { filialId: true } })
      if (!nishon || nishon.filialId !== ownFilialId) {
        return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })
      }
    }

    const { ism, rol, parol, faol, telefon, login, filialId: reqFilialId } = await req.json()
    const filialId = ownFilialId || reqFilialId
    if (rol !== 'ADMIN' && !filialId) {
      return NextResponse.json({ xato: "Filial tanlang" }, { status: 400 })
    }
    const updateData: any = { ism, rol, faol, telefon: telefon || null, filialId: rol === 'ADMIN' ? (filialId || null) : filialId }
    if (login) {
      const bandmi = await prisma.foydalanuvchi.findFirst({ where: { login, NOT: { id } } })
      if (bandmi) return NextResponse.json({ xato: 'Bu login band' }, { status: 400 })
      updateData.login = login
    }
    if (parol) updateData.parolHash = await bcrypt.hash(parol, 10)
    const user = await prisma.foydalanuvchi.update({
      where: { id },
      data: updateData,
      select: { id: true, ism: true, login: true, rol: true, faol: true, telefon: true, filialId: true },
    })
    return NextResponse.json(user)
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session || (session.user as any)?.rol !== 'ADMIN') {
      return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })
    }
    const ownFilialId = sessionFilialId(session)

    if (ownFilialId) {
      const nishon = await prisma.foydalanuvchi.findUnique({ where: { id }, select: { filialId: true } })
      if (!nishon || nishon.filialId !== ownFilialId) {
        return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })
      }
    }

    await prisma.foydalanuvchi.update({ where: { id }, data: { faol: false } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
