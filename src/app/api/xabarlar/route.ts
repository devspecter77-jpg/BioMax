import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { qolbolaXabarYuborish } from '@/lib/telegram'

// GET — Xabarlar ro'yxati
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30')))
    const status = searchParams.get('status') || ''
    const xabarTuri = searchParams.get('xabarTuri') || ''
    const mijozIsm = searchParams.get('mijozIsm') || ''

    const where: Prisma.BildirishnomLogWhereInput = {}
    if (status) where.status = status
    if (xabarTuri) where.xabarTuri = xabarTuri
    if (mijozIsm) where.mijoz = { ism: { contains: mijozIsm, mode: 'insensitive' } }

    const [jami, xabarlar] = await Promise.all([
      prisma.bildirishnomLog.count({ where }),
      prisma.bildirishnomLog.findMany({
        where,
        include: {
          mijoz: { select: { id: true, ism: true, telefon: true } },
          nasiya: { select: { id: true, jamiQarz: true, qoldiq: true, holati: true } },
        },
        orderBy: { sana: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    const statistika = await prisma.bildirishnomLog.groupBy({
      by: ['status'],
      _count: true,
    })

    const stats = { sent: 0, failed: 0, pending: 0, queued: 0, jami: 0 }
    for (const s of statistika) {
      if (s.status === 'sent') stats.sent = s._count
      else if (s.status === 'failed') stats.failed = s._count
      else if (s.status === 'pending') stats.pending = s._count
      else if (s.status === 'queued') stats.queued = s._count
      stats.jami += s._count
    }

    return NextResponse.json({
      xabarlar,
      stats,
      pagination: {
        page,
        limit,
        jami,
        sahifalar: Math.ceil(jami / limit),
      },
    })
  } catch (e) {
    console.error('[Xabarlar GET]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

// POST — Qo'lbola xabar yuborish
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session || session.user?.rol !== 'ADMIN') {
      return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })
    }

    const { mijozId, matn } = await req.json()
    if (!mijozId || !matn?.trim()) {
      return NextResponse.json({ xato: 'Mijoz va xabar matni kerak' }, { status: 400 })
    }

    const natija = await qolbolaXabarYuborish(mijozId, matn.trim())
    return NextResponse.json(natija || { ok: false, xato: 'Yuborilmadi' })
  } catch (e) {
    console.error('[Xabar POST]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

// DELETE — Eski xabarlarni o'chirish
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session || session.user?.rol !== 'ADMIN') {
      return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const kunlar = parseInt(searchParams.get('kunlar') || '30')
    const statusFilter = searchParams.get('status') || ''

    const chegara = new Date()
    chegara.setDate(chegara.getDate() - kunlar)

    const where: Prisma.BildirishnomLogWhereInput = { sana: { lt: chegara } }
    if (statusFilter) where.status = statusFilter

    const result = await prisma.bildirishnomLog.deleteMany({ where })

    return NextResponse.json({ ok: true, ochirildi: result.count })
  } catch (e) {
    console.error('[Xabar DELETE]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
