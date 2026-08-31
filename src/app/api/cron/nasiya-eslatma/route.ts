import { NextRequest, NextResponse } from 'next/server'
import { nasiyaEslatmalarYuborish } from '@/lib/telegram'

// Vercel Cron tomonidan har kuni chaqiriladi (vercel.json'dagi schedule bo'yicha).
// Vercel bu so'rovga avtomatik "Authorization: Bearer $CRON_SECRET" qo'shadi —
// shu orqali faqat Vercel'ning o'zi chaqira olishini tekshiramiz.
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
  }

  try {
    await nasiyaEslatmalarYuborish()
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[Cron] Nasiya eslatma xatosi:', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
