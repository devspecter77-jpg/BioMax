import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { sessionFilialId } from '@/lib/filial-scope'
import { ruxsatKeshiniTozala } from '@/lib/ruxsat-server'
import { xodimniOchir } from '@/lib/xodim-hisob'
import { loginTozala, loginXatosi } from '@/lib/login'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session || session.user?.rol !== 'ADMIN') {
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
    const updateData: Prisma.FoydalanuvchiUncheckedUpdateInput = { ism, rol, faol, telefon: telefon || null, filialId: rol === 'ADMIN' ? (filialId || null) : filialId }
    if (login) {
      const yangiLogin = loginTozala(String(login))
      const loginXato = loginXatosi(yangiLogin)
      if (loginXato) return NextResponse.json({ xato: loginXato }, { status: 400 })
      const bandmi = await prisma.foydalanuvchi.findFirst({ where: { login: { equals: yangiLogin, mode: 'insensitive' }, NOT: { id } }, select: { id: true } })
      if (bandmi) return NextResponse.json({ xato: 'Bu login band' }, { status: 400 })
      updateData.login = yangiLogin
    }
    if (parol) updateData.parolHash = await bcrypt.hash(parol, 10)
    const user = await prisma.foydalanuvchi.update({
      where: { id },
      data: updateData,
      select: { id: true, ism: true, login: true, rol: true, faol: true, telefon: true, filialId: true },
    })
    // Rol, filial yoki faollik o'zgargan bo'lishi mumkin — sessiya yangisini olsin
    ruxsatKeshiniTozala(id)
    return NextResponse.json(user)
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session || session.user?.rol !== 'ADMIN') {
      return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })
    }
    const ownFilialId = sessionFilialId(session)

    if (ownFilialId) {
      const nishon = await prisma.foydalanuvchi.findUnique({ where: { id }, select: { filialId: true } })
      if (!nishon || nishon.filialId !== ownFilialId) {
        return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })
      }
    }

    const nishon = await prisma.foydalanuvchi.findUnique({ where: { id }, select: { faol: true, login: true } })
    if (!nishon) return NextResponse.json({ xato: 'Topilmadi' }, { status: 404 })

    if (nishon.faol) {
      await prisma.foydalanuvchi.update({ where: { id }, data: { faol: false } })
      ruxsatKeshiniTozala(id)
      return NextResponse.json({ ok: true, holat: 'nofaol' })
    }

    // Ikkinchi bosqich. To'g'ridan-to'g'ri `delete` EMAS: oylik to'lovlari
    // va biriktirilgan mulk `onDelete: Cascade` bilan bog'langan — butunlay
    // o'chirish ularni jimgina yo'q qilardi. Tarixi bor hisob yopiladi.
    const natija = await xodimniOchir(id)
    if (natija.holat === 'rad') return NextResponse.json({ xato: natija.xato }, { status: 409 })
    return NextResponse.json({ ok: true, holat: natija.holat === 'ochirildi' ? 'ochirildi' : 'anonimlashtirildi' })
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
