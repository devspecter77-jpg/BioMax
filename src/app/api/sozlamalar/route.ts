import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

// Telegram akkaunt sirlari HECH QACHON mijozga yuborilmaydi.
// `telegram_session` — GramJS StringSession, ya'ni Ega Telegram hisobiga
// TO'LIQ kirish. Ilgari bu marshrut barcha sozlamalarni qaytarardi va
// istalgan kassir uni o'qib, hisobni egallashi mumkin edi.
// `telegram_temp_session` — ulanish paytidagi (kod kutilayotgan) vaqtinchalik sessiya.
const MAXFIY_PREFIKSLAR = ['telegram_session', 'telegram_temp_session', 'telegram_api_', 'telegram_entity_cache']

function MAXFIY_KALIT(kalit: string): boolean {
  return MAXFIY_PREFIKSLAR.some(p => kalit.startsWith(p))
}

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    const sozlamalar = await prisma.sozlama.findMany()
    const result: Record<string, string> = {}
    for (const s of sozlamalar) {
      if (MAXFIY_KALIT(s.kalit)) continue
      result[s.kalit] = s.qiymat
    }
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    const data: Record<string, string> = await req.json()
    // Telegram hisobi faqat /api/telegram orqali (faqat bosh Ega) boshqariladi —
    // bu umumiy marshrut orqali filial yoki ulashilgan administrator sessiyani
    // almashtirib, mijozlarga boshqa raqamdan xabar yubora olmasin
    if (Object.keys(data).some(k => k.startsWith('telegram_'))) {
      return NextResponse.json({ xato: 'Telegram sozlamalari faqat Telegram bo‘limidan o‘zgartiriladi' }, { status: 403 })
    }
    for (const [kalit, qiymat] of Object.entries(data)) {
      await prisma.sozlama.upsert({
        where: { kalit },
        update: { qiymat },
        create: { kalit, qiymat },
      })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
