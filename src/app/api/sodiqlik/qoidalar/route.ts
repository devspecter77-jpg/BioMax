import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { egaFilialWhere } from '@/lib/filial-scope'
import { amalRuxsatiBormi } from '@/lib/ruxsat-server'
import { qoidaniTasdiqla } from '@/lib/sodiqlik'
import { QOIDA_SELECT, qoidaMaqsadiniTekshir, qoidaJavobi } from '@/lib/sodiqlik-qoida-server'

// Sodiqlikning QO'SHIMCHA qoidalari (chek summasi, mahsulot, kategoriya) —
// shu katalogniki. O'qish: Ballar bo'limi va kassa (to'planadigan ballni
// oldindan ko'rsatish uchun). O'zgartirish: «Sodiqlik dasturi sozlamalari».

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    const qoidalar = await prisma.sodiqlikQoidasi.findMany({
      where: egaFilialWhere(session),
      select: QOIDA_SELECT,
      orderBy: [{ turi: 'asc' }, { minSumma: 'asc' }, { minMiqdor: 'asc' }, { yaratilgan: 'asc' }],
    })
    return NextResponse.json(qoidalar.map(qoidaJavobi))
  } catch (e) {
    console.error('[sodiqlik/qoidalar GET]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    if (!(await amalRuxsatiBormi(session, 'ballar.sozlama'))) {
      return NextResponse.json({ xato: 'Bu amalga ruxsatingiz yo‘q: «Sodiqlik dasturi sozlamalari»', kod: 'ruxsat_yoq' }, { status: 403 })
    }
    const t = qoidaniTasdiqla(await req.json())
    if (!t.ok) return NextResponse.json({ xato: t.xato }, { status: 400 })

    const doira = egaFilialWhere(session)
    const maqsadXato = await qoidaMaqsadiniTekshir(t.qoida, doira)
    if (maqsadXato) return NextResponse.json({ xato: maqsadXato }, { status: 400 })

    const yangi = await prisma.sodiqlikQoidasi.create({
      data: { ...t.qoida, ...doira },
      select: QOIDA_SELECT,
    })
    return NextResponse.json(qoidaJavobi(yangi), { status: 201 })
  } catch (e) {
    console.error('[sodiqlik/qoidalar POST]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
