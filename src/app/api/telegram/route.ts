import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import {
  telegramConnect,
  telegramVerify,
  telegramStatus,
  telegramDisconnect,
  testXabarYuborish,
} from '@/lib/telegram'
import { sessionFilialId } from '@/lib/filial-scope'

// Telegram — butun kompaniya uchun umumiy ulanish. Faqat bosh egasi (Ega,
// filialId yo'q) boshqarishi kerak — filial egasi bu umumiy hisobni
// o'zgartira olmasligi/uza olmasligi kerak.
function faqatEga(session: any) {
  const rol = session?.user?.rol
  return !!session && rol === 'ADMIN' && !sessionFilialId(session)
}

// GET — Telegram holati va so'nggi loglar
export async function GET() {
  try {
    const session = await auth()
    if (!faqatEga(session)) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })

    const status = await telegramStatus()

    const bildirishnomaSozlama = await prisma.sozlama.findUnique({
      where: { kalit: 'telegram_bildirishnoma' },
    })

    // Ulangan mijozlar soni (telefon raqami bor)
    const ulanganMijozlar = await prisma.mijoz.count({
      where: { telefon: { not: null } },
    })

    // So'nggi bildirishnomalar
    const songgiBildirishnomlar = await prisma.bildirishnomLog.findMany({
      include: { mijoz: { select: { ism: true } } },
      orderBy: { sana: 'desc' },
      take: 10,
    })

    return NextResponse.json({
      ...status,
      bildirishnoma: bildirishnomaSozlama?.qiymat !== 'false',
      ulanganMijozlar,
      songgiBildirishnomlar,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

// PUT — Bildirishnoma toggle
export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    if (!faqatEga(session)) {
      return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })
    }

    const data = await req.json()

    if (data.telegram_bildirishnoma !== undefined) {
      await prisma.sozlama.upsert({
        where: { kalit: 'telegram_bildirishnoma' },
        update: { qiymat: String(data.telegram_bildirishnoma) },
        create: { kalit: 'telegram_bildirishnoma', qiymat: String(data.telegram_bildirishnoma) },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

// POST — Connect / Verify / Test / Disconnect
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!faqatEga(session)) {
      return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })
    }

    const body = await req.json()
    const { action } = body

    // ── Ulanish — kod yuborish ──────────────────────────────────────────
    if (action === 'connect') {
      const { apiId, apiHash, phone } = body
      if (!apiId || !apiHash || !phone) {
        return NextResponse.json({ xato: 'API ID, API Hash va telefon raqam kerak' }, { status: 400 })
      }
      const natija = await telegramConnect(parseInt(apiId), apiHash, phone)
      return NextResponse.json(natija)
    }

    // ── Kodni tasdiqlash ────────────────────────────────────────────────
    if (action === 'verify') {
      const { apiId, apiHash, phone, code, phoneCodeHash, password } = body
      if (!apiId || !apiHash || !phone || !code || !phoneCodeHash) {
        return NextResponse.json({ xato: "Ma'lumotlar to'liq emas" }, { status: 400 })
      }
      const natija = await telegramVerify(
        parseInt(apiId),
        apiHash,
        phone,
        code,
        phoneCodeHash,
        password
      )
      return NextResponse.json(natija)
    }

    // ── Test xabar ──────────────────────────────────────────────────────
    if (action === 'test') {
      const { telefon } = body
      if (!telefon) return NextResponse.json({ xato: 'Telefon raqam kerak' }, { status: 400 })
      const natija = await testXabarYuborish(telefon)
      return NextResponse.json(natija)
    }

    // ── Uzish ───────────────────────────────────────────────────────────
    if (action === 'disconnect') {
      const natija = await telegramDisconnect()
      return NextResponse.json(natija)
    }

    return NextResponse.json({ xato: "Noma'lum action" }, { status: 400 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
