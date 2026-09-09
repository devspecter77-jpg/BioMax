import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { auth } from '@/lib/auth'
import { qrManzili } from '@/lib/qr-kod'

// QR rasmlarini SERVERDA yaratadi va data URL ko'rinishida qaytaradi.
//
// Nega mijozda emas: `qrcode` paketining brauzer qurilmasi Next bundle'ida
// ishonchli yuklanmadi (chunk 404). Serverda esa u oddiy Node kutubxonasi —
// hech qanday moslashtirish kerak emas, mijoz bundle'i ham shishmaydi.
// Data URL qaytariladi, chunki yorliqlar `blob:` sahifada chop etiladi —
// u yerdan nisbiy manzillar yuklanmaydi.

const MAX_KOD = 300

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    const { kodlar, origin } = await req.json()
    if (!Array.isArray(kodlar) || kodlar.length === 0) {
      return NextResponse.json({ xato: 'Kodlar yuborilmadi' }, { status: 400 })
    }
    if (kodlar.length > MAX_KOD) {
      return NextResponse.json({ xato: `Bir vaqtda ko'pi bilan ${MAX_KOD} ta` }, { status: 400 })
    }

    // Manzil mijozdan keladi (localhost / domen bir xil bo'lishi uchun),
    // lekin faqat sxema+host qismi ishlatiladi — ochiq yo'naltirishning
    // oldini olish uchun boshqa hech narsa qabul qilinmaydi.
    let asos = ''
    try {
      const u = new URL(String(origin || req.nextUrl.origin))
      asos = `${u.protocol}//${u.host}`
    } catch {
      asos = req.nextUrl.origin
    }

    const natija: Record<string, string> = {}
    for (const xom of kodlar) {
      const kod = String(xom ?? '').trim()
      if (!kod || natija[kod]) continue
      natija[kod] = await QRCode.toDataURL(qrManzili(asos, kod), {
        width: 320,
        margin: 1,
        errorCorrectionLevel: 'M',
      })
    }

    return NextResponse.json({ rasmlar: natija })
  } catch (e) {
    console.error('[tovar qr]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
