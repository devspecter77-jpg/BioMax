import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { sodiqlikSozlamasi, sodiqlikSozlamasiniSaqla } from '@/lib/sodiqlik-server'
import { sozlamaniTasdiqla } from '@/lib/sodiqlik'

// Sodiqlik qoidalari butun do'kon uchun umumiy. O'qishni har bir xodim
// qila oladi (POS'da balans va sarflashni ko'rsatish uchun kerak), lekin
// O'ZGARTIRISHNI faqat ADMIN qiladi — qoida to'g'ridan-to'g'ri pulga taalluqli.

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    return NextResponse.json(await sodiqlikSozlamasi())
  } catch (e) {
    console.error('[sodiqlik/sozlamalar GET]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    if (!session || (session.user as { rol?: string }).rol !== 'ADMIN') {
      return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })
    }
    const sozlama = sozlamaniTasdiqla(await req.json())
    await sodiqlikSozlamasiniSaqla(sozlama)
    return NextResponse.json(sozlama)
  } catch (e) {
    console.error('[sodiqlik/sozlamalar PUT]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
