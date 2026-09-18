import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    const sherikdanOlishlar = await prisma.sherikdanOlish.findMany({
      include: {
        sherik: { select: { id: true, ism: true, telefon: true } },
        taminotchi: { select: { id: true, nomi: true, telefon: true } },
        tovar: { select: { id: true, nomi: true, birlik: true } },
        sotuv: { select: { id: true, chekRaqami: true, sana: true } },
        tolovlar: true,
      },
      orderBy: { yaratilgan: 'desc' },
    })

    // Kontragent (sherik yoki ta'minotchi) bo'yicha guruhlash
    const guruhMap: Record<string, {
      kontragent: { id: string; ism: string; telefon: string | null; turi: 'SHERIK' | 'TAMINOTCHI' }
      olishlar: typeof sherikdanOlishlar
      jamiQarz: number
      tolangan: number
      qoldiq: number
    }> = {}

    for (const item of sherikdanOlishlar) {
      let key: string
      let kontragent: { id: string; ism: string; telefon: string | null; turi: 'SHERIK' | 'TAMINOTCHI' }

      if (item.sherikId && item.sherik) {
        key = `S:${item.sherikId}`
        kontragent = { id: item.sherik.id, ism: item.sherik.ism, telefon: item.sherik.telefon, turi: 'SHERIK' }
      } else if (item.taminotchiId && item.taminotchi) {
        key = `T:${item.taminotchiId}`
        kontragent = { id: item.taminotchi.id, ism: item.taminotchi.nomi, telefon: item.taminotchi.telefon, turi: 'TAMINOTCHI' }
      } else {
        continue
      }

      if (!guruhMap[key]) {
        guruhMap[key] = { kontragent, olishlar: [], jamiQarz: 0, tolangan: 0, qoldiq: 0 }
      }
      guruhMap[key].olishlar.push(item)
      guruhMap[key].jamiQarz += Number(item.jami)
      const itemTolangan = item.tolovlar.reduce((s, t) => s + Number(t.summa), 0)
      guruhMap[key].tolangan += itemTolangan
    }

    for (const k in guruhMap) {
      guruhMap[k].qoldiq = guruhMap[k].jamiQarz - guruhMap[k].tolangan
    }

    // Backward-compat: `sherik` keyini ham bersin (UI hozircha shu nom bilan ishlaydi)
    const result = Object.values(guruhMap).map(g => ({ ...g, sherik: g.kontragent }))

    return NextResponse.json(result)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    const data = await req.json()
    const { turi } = data

    // Qarz qo'shish (sherikdan, tovarsiz)
    if (turi === 'QARZ') {
      const { sherikId, summa, izoh } = data
      if (!sherikId) return NextResponse.json({ xato: 'Sherik tanlanmagan' }, { status: 400 })
      if (!summa || parseFloat(summa) <= 0) return NextResponse.json({ xato: 'Summani kiriting' }, { status: 400 })
      const s = parseFloat(summa)

      const olish = await prisma.sherikdanOlish.create({
        data: {
          sherik: { connect: { id: sherikId } },
          miqdor: 0,
          narx: 0,
          jami: s,
          izoh: izoh || 'Qarz',
        },
        include: {
          sherik: { select: { ism: true } },
        },
      })
      return NextResponse.json(olish, { status: 201 })
    }

    // Tovar olib kelish (sherikdan)
    const { sherikId, tovarId, miqdor, narx, izoh } = data
    if (!sherikId) return NextResponse.json({ xato: 'Sherik tanlanmagan' }, { status: 400 })
    if (!tovarId) return NextResponse.json({ xato: 'Tovar tanlanmagan' }, { status: 400 })
    if (!miqdor || parseFloat(miqdor) <= 0) return NextResponse.json({ xato: 'Miqdor noto\'g\'ri' }, { status: 400 })
    if (!narx || parseFloat(narx) <= 0) return NextResponse.json({ xato: 'Narx noto\'g\'ri' }, { status: 400 })

    const m = parseFloat(miqdor)
    const n = parseFloat(narx)

    const olish = await prisma.sherikdanOlish.create({
      data: {
        sherik: { connect: { id: sherikId } },
        tovar: { connect: { id: tovarId } },
        miqdor: m,
        narx: n,
        jami: m * n,
        izoh: izoh || null,
      },
      include: {
        sherik: { select: { ism: true } },
        tovar: { select: { nomi: true } },
      },
    })

    return NextResponse.json(olish, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    const data = await req.json()
    const { id, sherikId, miqdor } = data

    if (!id) return NextResponse.json({ xato: 'ID kerak' }, { status: 400 })

    const updateData: Prisma.SherikdanOlishUncheckedUpdateInput = {}
    if (sherikId) updateData.sherikId = sherikId
    if (miqdor !== undefined) {
      updateData.miqdor = parseFloat(miqdor)
      const existing = await prisma.sherikdanOlish.findUnique({ where: { id } })
      if (existing) {
        updateData.jami = parseFloat(miqdor) * Number(existing.narx)
      }
    }

    const updated = await prisma.sherikdanOlish.update({
      where: { id },
      data: updateData,
      include: {
        sherik: { select: { ism: true } },
        tovar: { select: { nomi: true } },
      },
    })

    return NextResponse.json(updated)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
