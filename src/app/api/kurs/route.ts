import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { joriyUsdKursi, usdKursiniOrnat } from '@/lib/kurs'

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    const kursi = await joriyUsdKursi()
    return NextResponse.json({ kursi })
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    const data = await req.json()
    const kursi = parseFloat(data.kursi)
    if (!Number.isFinite(kursi) || kursi <= 0) {
      return NextResponse.json({ xato: "Kurs noto'g'ri" }, { status: 400 })
    }
    await usdKursiniOrnat(kursi)
    return NextResponse.json({ kursi })
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
