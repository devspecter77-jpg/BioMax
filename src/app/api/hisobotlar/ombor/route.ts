import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { sessionFilialId } from '@/lib/filial-scope'

export async function GET(_req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    const rol = (session.user as { rol?: string })?.rol
    if (rol === 'KASSIR') {
      return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })
    }
    const filialId = sessionFilialId(session)

    // date params accepted but ombor snapshot is current (not date-filtered)

    const tovarlar = await prisma.tovar.findMany({
      where: { holati: 'FAOL', ...(filialId ? { filialId } : {}) },
      select: {
        id: true,
        nomi: true,
        birlik: true,
        kelishNarxi: true,
        sotishNarxi: true,
        minimalQoldiq: true,
        omborHarakati: {
          select: {
            turi: true,
            miqdor: true,
          },
        },
      },
    })

    const result = []
    let jamiQiymat = 0
    let kritikCount = 0

    for (const t of tovarlar) {
      // Qoldiq: KIRIM + QAYTARISH - CHIQIM - YOQOTISH
      let qoldiq = 0
      for (const h of t.omborHarakati) {
        const m = Number(h.miqdor)
        if (h.turi === 'KIRIM' || h.turi === 'QAYTARISH') {
          qoldiq += m
        } else if (h.turi === 'CHIQIM' || h.turi === 'YOQOTISH') {
          qoldiq -= m
        }
        // OTKAZMA - e'tiborga olinmaydi
      }

      const kelishNarxi = Number(t.kelishNarxi)
      const jami_qiymat = qoldiq * kelishNarxi
      const kritik = qoldiq <= t.minimalQoldiq

      jamiQiymat += jami_qiymat
      if (kritik) kritikCount++

      result.push({
        tovarId: t.id,
        nomi: t.nomi,
        birlik: t.birlik,
        qoldiq: Math.round(qoldiq * 1000) / 1000,
        kelishNarxi,
        jami_qiymat: Math.round(jami_qiymat),
        minQoldiq: t.minimalQoldiq,
        kritik,
      })
    }

    // jami_qiymat bo'yicha descending
    result.sort((a, b) => b.jami_qiymat - a.jami_qiymat)

    return NextResponse.json({
      tovarlar: result,
      jamiQiymat: Math.round(jamiQiymat),
      kritikCount,
      tovarCount: result.length,
    })
  } catch (e) {
    console.error('[hisobotlar/ombor]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
