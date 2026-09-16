import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { amalRuxsatiBormi } from '@/lib/ruxsat-server'
import { bolimRuxsatiBormi } from '@/lib/ruxsat-server'
import { sessionFilialId } from '@/lib/filial-scope'
import { hisobotSozlamalari, kunlikHisobotYig, hisobotOluvchilar } from '@/lib/kunlik-hisobot-server'
import { HISOBOT_SOZLAMA, sozlamalarniOqi, kunKaliti } from '@/lib/kunlik-hisobot'

// Kunlik hisobot bo'limi — kam qolgan mahsulotlar va top mahsulotlar.
// Xuddi shu ma'lumot har kuni Telegram orqali adminga ham yuboriladi
// (`kunlik-hisobot-server.ts`), shuning uchun sahifadagi ro'yxat va
// xabardagi ro'yxat har doim bir xil bo'ladi.

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    if (!bolimRuxsatiBormi(session, 'kunlik-hisobot')) {
      return NextResponse.json({ xato: "Bu bo'limga ruxsatingiz yo'q" }, { status: 403 })
    }

    const u = session.user as unknown as {
      id: string; rol?: string; filialNomi?: string | null; ulashilganEgaId?: string | null
    }
    const oluvchi = {
      id: u.id,
      filialId: sessionFilialId(session),
      ulashilganEgaId: u.ulashilganEgaId ?? null,
      filialNomi: u.filialNomi ?? null,
    }

    const sozlama = await hisobotSozlamalari()

    // Sahifada davrni o'zgartirib ko'rish mumkin — sozlamadagi standart
    // qiymat faqat Telegram xabari uchun ishlatiladi.
    const kunParam = Number.parseInt(new URL(req.url).searchParams.get('topKun') ?? '', 10)
    const korinishSozlama = {
      ...sozlama,
      topKun: Number.isFinite(kunParam) ? Math.min(365, Math.max(1, kunParam)) : sozlama.topKun,
      // Sahifada ro'yxat qisqartirilmaydi — jadval o'zi skroll qiladi
      kamSoni: 500,
      topSoni: 20,
    }

    const boshqaraOladi = await amalRuxsatiBormi(session, 'kunlik-hisobot.sozlama')

    const [hisobot, tarix, oluvchilar] = await Promise.all([
      kunlikHisobotYig(oluvchi, korinishSozlama),
      prisma.kunlikHisobotLog.findMany({
        where: { qabulQiluvchiId: u.id },
        orderBy: { sana: 'desc' },
        take: 14,
        select: {
          id: true, kunKaliti: true, status: true, xato: true,
          kamQolganSoni: true, tugaganSoni: true, yuborilganSana: true, sana: true,
        },
      }),
      // Kimga ketishi ochiq ko'rinsin — avtomatik xabar real odamlarga boradi
      boshqaraOladi ? hisobotOluvchilar() : Promise.resolve([]),
    ])

    return NextResponse.json({
      hisobot,
      sozlama,
      tarix,
      bugun: kunKaliti(),
      // Kirgan adminning o'z raqami — sozlamalar formasi uchun
      ozTelefon: oluvchilar.find(o => o.id === u.id)?.telefon ?? null,
      oluvchilar: oluvchilar.map(o => ({
        id: o.id,
        ism: o.ism,
        telefon: o.telefon,
        filialNomi: o.filialNomi,
        // Telefonsiz admin xabar ololmaydi — buni sahifada aytamiz
        oladi: !!o.telefon,
      })),
      // Sozlamani faqat ADMIN o'zgartira oladi va faqat u qo'lda yubora oladi
      boshqaraOladi,
    })
  } catch (e) {
    console.error('[kunlik-hisobot]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

// ─── Sozlamalarni saqlash ────────────────────────────────────────────────────

export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    if (!(await amalRuxsatiBormi(session, 'kunlik-hisobot.sozlama'))) {
      return NextResponse.json({ xato: 'Bu amalga ruxsatingiz yo‘q: «Kunlik hisobot sozlamalari»', kod: 'ruxsat_yoq' }, { status: 403 })
    }

    const tana = await req.json()

    // O'Z telefon raqami — hisobot shu raqamga boradi.
    // Faqat chaqiruvchining o'zinikini o'zgartiradi: boshqa xodimning
    // raqamiga tegish huquqi bu marshrutda yo'q.
    if (tana.telefon !== undefined) {
      const xom = String(tana.telefon ?? '').replace(/[^\d]/g, '')
      if (xom && !(xom.length >= 9 && xom.length <= 12)) {
        return NextResponse.json({ xato: "Telefon raqam noto'g'ri (9–12 raqam)" }, { status: 400 })
      }
      await prisma.foydalanuvchi.update({
        where: { id: (session.user as unknown as { id: string }).id },
        data: { telefon: xom || null },
      })
    }

    // Kiritmani sozlamalar o'qigichi orqali normallashtiramiz — shunda
    // saqlangan qiymat har doim ruxsat etilgan oraliqda bo'ladi.
    const tozalangan = sozlamalarniOqi({
      [HISOBOT_SOZLAMA.yoqilgan]: tana.yoqilgan ? '1' : '0',
      [HISOBOT_SOZLAMA.soat]: String(tana.soat),
      [HISOBOT_SOZLAMA.topKun]: String(tana.topKun),
      [HISOBOT_SOZLAMA.topSoni]: String(tana.topSoni),
      [HISOBOT_SOZLAMA.kamSoni]: String(tana.kamSoni),
    })

    const yozuvlar: Record<string, string> = {
      [HISOBOT_SOZLAMA.yoqilgan]: tozalangan.yoqilgan ? '1' : '0',
      [HISOBOT_SOZLAMA.soat]: String(tozalangan.soat),
      [HISOBOT_SOZLAMA.topKun]: String(tozalangan.topKun),
      [HISOBOT_SOZLAMA.topSoni]: String(tozalangan.topSoni),
      [HISOBOT_SOZLAMA.kamSoni]: String(tozalangan.kamSoni),
    }

    await prisma.$transaction(
      Object.entries(yozuvlar).map(([kalit, qiymat]) =>
        prisma.sozlama.upsert({ where: { kalit }, update: { qiymat }, create: { kalit, qiymat } })
      )
    )

    return NextResponse.json({ ok: true, sozlama: tozalangan })
  } catch (e) {
    console.error('[kunlik-hisobot PUT]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
