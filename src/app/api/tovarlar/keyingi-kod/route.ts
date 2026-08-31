import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { sessionFilialId } from '@/lib/filial-scope'

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    const filialId = sessionFilialId(session)

    const barchasi = await prisma.tovar.findMany({
      where: { shtrixKod: { not: null }, filialId },
      select: { shtrixKod: true }
    })
    const raqamlar = new Set(
      barchasi.map(t => parseInt(t.shtrixKod!)).filter(n => Number.isInteger(n) && n > 0)
    )
    let keyingi = 1
    while (raqamlar.has(keyingi)) keyingi++

    return NextResponse.json({ kod: String(keyingi) })
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
