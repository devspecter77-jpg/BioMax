import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { joriyUsdKursi, usdKursiniYangilash } from '@/lib/kurs'

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    const { kursi, sana } = await joriyUsdKursi()
    return NextResponse.json({ kursi, sana })
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

// Majburiy qayta yuklash — Markaziy bankdan yangi kursni darhol oladi
export async function PUT() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    const { kursi, sana } = await usdKursiniYangilash()
    return NextResponse.json({ kursi, sana })
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
