import { NextRequest, NextResponse } from 'next/server'
import { kunlikHisobotlarniYubor } from '@/lib/kunlik-hisobot-server'

// Har kuni bir marta chaqiriladi (vercel.json'dagi schedule bo'yicha).
// Vercel so'rovga avtomatik "Authorization: Bearer $CRON_SECRET" qo'shadi —
// nasiya-eslatma bilan bir xil naqsh.
//
// Localhostda Vercel cron ishlamaydi; u yerda `instrumentation.ts` ichidagi
// rejalashtiruvchi xuddi shu funksiyani chaqiradi. Ikkalasi ham
// `KunlikHisobotLog` unique indeksi tufayli takroriy xabar yubormaydi.
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
  }

  try {
    const natija = await kunlikHisobotlarniYubor()
    return NextResponse.json({ ok: true, ...natija })
  } catch (e) {
    console.error('[Cron] Kunlik hisobot xatosi:', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
