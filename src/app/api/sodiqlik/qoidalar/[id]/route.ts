import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { egaFilialWhere } from '@/lib/filial-scope'
import { amalRuxsatiBormi } from '@/lib/ruxsat-server'
import { qoidaniTasdiqla } from '@/lib/sodiqlik'
import { QOIDA_SELECT, qoidaMaqsadiniTekshir, qoidaJavobi } from '@/lib/sodiqlik-qoida-server'

type Params = { params: Promise<{ id: string }> }

async function ruxsat() {
  const session = await auth()
  if (!session) return { javob: NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 }) } as const
  if (!(await amalRuxsatiBormi(session, 'ballar.sozlama'))) {
    return { javob: NextResponse.json({ xato: 'Bu amalga ruxsatingiz yo‘q: «Sodiqlik dasturi sozlamalari»', kod: 'ruxsat_yoq' }, { status: 403 }) } as const
  }
  return { session } as const
}

/** Tahrirlash: to'liq qoida (tur, maqsad, shart, mukofot) yoki faqat `faol` (yoqish/o'chirish). */
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const r = await ruxsat()
    if ('javob' in r) return r.javob
    const { id } = await params
    const doira = egaFilialWhere(r.session)
    const mavjud = await prisma.sodiqlikQoidasi.findFirst({ where: { id, ...doira }, select: { id: true } })
    if (!mavjud) return NextResponse.json({ xato: 'Qoida topilmadi' }, { status: 404 })

    const tana = await req.json()
    // Faqat yoqish/o'chirish
    if (tana && typeof tana === 'object' && Object.keys(tana).length === 1 && 'faol' in tana) {
      const yangi = await prisma.sodiqlikQoidasi.update({ where: { id }, data: { faol: tana.faol === true }, select: QOIDA_SELECT })
      return NextResponse.json(qoidaJavobi(yangi))
    }

    const t = qoidaniTasdiqla(tana)
    if (!t.ok) return NextResponse.json({ xato: t.xato }, { status: 400 })
    const maqsadXato = await qoidaMaqsadiniTekshir(t.qoida, doira)
    if (maqsadXato) return NextResponse.json({ xato: maqsadXato }, { status: 400 })

    const yangi = await prisma.sodiqlikQoidasi.update({ where: { id }, data: t.qoida, select: QOIDA_SELECT })
    return NextResponse.json(qoidaJavobi(yangi))
  } catch (e) {
    console.error('[sodiqlik/qoidalar PUT]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: Params) {
  try {
    const r = await ruxsat()
    if ('javob' in r) return r.javob
    const { id } = await params
    const { count } = await prisma.sodiqlikQoidasi.deleteMany({ where: { id, ...egaFilialWhere(r.session) } })
    if (count === 0) return NextResponse.json({ xato: 'Qoida topilmadi' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[sodiqlik/qoidalar DELETE]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
