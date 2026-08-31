import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { egaFilialWhere } from '@/lib/filial-scope'

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

  const rol = (session.user as { rol?: string })?.rol
  if (rol === 'KASSIR') return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })

  const xaridlar = await prisma.xarid.findMany({
    where: { taminotchi: egaFilialWhere(session) },
    include: {
      taminotchi: {
        select: { id: true, nomi: true, kontaktShaxs: true, telefon: true },
      },
    },
  })

  const bugun = new Date()
  bugun.setHours(0, 0, 0, 0)

  const umumiy = {
    jamiXarid: 0,
    jamiTolangan: 0,
    jamiQarz: 0,
    xaridSoni: xaridlar.length,
  }

  const aging = {
    kechikmagan: { count: 0, summa: 0 },
    b_0_30: { count: 0, summa: 0 },
    b_31_60: { count: 0, summa: 0 },
    b_61_90: { count: 0, summa: 0 },
    b_90_plus: { count: 0, summa: 0 },
  }

  const taminotchiMap = new Map<
    string,
    {
      taminotchiId: string
      nomi: string
      kontaktShaxs: string | null
      telefon: string | null
      xaridSoni: number
      jamiQarz: number
      eskiQarzKunlar: number
    }
  >()

  for (const x of xaridlar) {
    const jamiSumma = Number(x.jamiSumma)
    const tolangan = Number(x.tolangan)
    const qarz = Number(x.qoldiqQarz)
    umumiy.jamiXarid += jamiSumma
    umumiy.jamiTolangan += tolangan

    if (qarz <= 0) continue // to'langan
    umumiy.jamiQarz += qarz

    const kun = Math.floor(
      (bugun.getTime() - new Date(x.sana).getTime()) / (1000 * 60 * 60 * 24),
    )

    let bucket: keyof typeof aging = 'kechikmagan'
    if (kun < 0) bucket = 'kechikmagan'
    else if (kun <= 30) bucket = 'b_0_30'
    else if (kun <= 60) bucket = 'b_31_60'
    else if (kun <= 90) bucket = 'b_61_90'
    else bucket = 'b_90_plus'

    aging[bucket].count++
    aging[bucket].summa += qarz

    if (x.taminotchi) {
      const key = x.taminotchi.id
      const bor = taminotchiMap.get(key) ?? {
        taminotchiId: key,
        nomi: x.taminotchi.nomi,
        kontaktShaxs: x.taminotchi.kontaktShaxs,
        telefon: x.taminotchi.telefon,
        xaridSoni: 0,
        jamiQarz: 0,
        eskiQarzKunlar: 0,
      }
      bor.xaridSoni++
      bor.jamiQarz += qarz
      bor.eskiQarzKunlar = Math.max(bor.eskiQarzKunlar, kun)
      taminotchiMap.set(key, bor)
    }
  }

  const topTaminotchilar = Array.from(taminotchiMap.values())
    .sort((a, b) => b.jamiQarz - a.jamiQarz)
    .slice(0, 20)

  return NextResponse.json({ umumiy, aging, topTaminotchilar })
}
