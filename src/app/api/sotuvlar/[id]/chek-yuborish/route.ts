import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { egaFilialWhere } from '@/lib/filial-scope'
import { sotuvChekiXabar, nasiyaYaratildiXabarToliq } from '@/lib/telegram'

// Sotuv chekini mijozga Telegram orqali yuborish.
//
// Xabar ATAYLAB avtomatik ketmaydi — kassir chek oynasidagi tugma bilan
// o'zi qaror qiladi. Shu yerdan xohlagancha marta qayta jo'natish mumkin.
// Har yuborish `bildirishnom_loglar` ga yoziladi, ya'ni "kimga, qachon,
// nima yuborildi" tarixi saqlanadi.
//
// Nasiyali sotuvda oddiy chek emas, QARZ xabari yuboriladi (muddat va
// qoldiq bilan) — mijoz uchun muhimi shu.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    const { id } = await params

    // Sotuv shu foydalanuvchining ko'rish doirasidami — boshqa Eganing
    // mijoziga xabar yuborib bo'lmasin.
    const sotuv = await prisma.sotuv.findFirst({
      where: { id, ...egaFilialWhere(session) },
      select: {
        id: true, chekRaqami: true, yakuniySumma: true, jamiSumma: true,
        chegirma: true, tolovUsuli: true, holati: true,
        mijoz: { select: { id: true, ism: true, telefon: true, telegramYoq: true } },
        nasiya: { select: { id: true, qoldiq: true, muddat: true } },
      },
    })
    if (!sotuv) return NextResponse.json({ xato: 'Sotuv topilmadi' }, { status: 404 })

    if (sotuv.holati === 'BEKOR_QILINGAN') {
      return NextResponse.json({ xato: 'Bekor qilingan sotuv cheki yuborilmaydi' }, { status: 400 })
    }
    if (!sotuv.mijoz) {
      return NextResponse.json({ xato: 'Bu sotuv mijozga bog\'lanmagan' }, { status: 400 })
    }
    if (!sotuv.mijoz.telefon) {
      return NextResponse.json({ xato: 'Mijozda telefon raqam yo\'q' }, { status: 400 })
    }
    // Avval "Telegramda topilmadi" deb belgilangan bo'lsa, qayta urinish
    // bekorga vaqt sarflaydi va PEER_FLOOD xavfini oshiradi.
    if (sotuv.mijoz.telegramYoq) {
      return NextResponse.json(
        { xato: "Mijoz Telegramda topilmagan (avval belgilangan). Raqamni tekshirib, Mijozlar bo'limidan yangilang." },
        { status: 400 },
      )
    }

    const natija = sotuv.nasiya
      ? await nasiyaYaratildiXabarToliq(sotuv.nasiya.id, sotuv.mijoz.id, {
          chekRaqami: sotuv.chekRaqami,
          summasi: Number(sotuv.yakuniySumma),
          qoldiqQarz: Number(sotuv.nasiya.qoldiq),
          muddat: sotuv.nasiya.muddat,
          mijozIsm: sotuv.mijoz.ism,
          sotuvId: sotuv.id,
          chegirma: Number(sotuv.chegirma),
          jamiSumma: Number(sotuv.jamiSumma),
        })
      : await sotuvChekiXabar(sotuv.id, sotuv.mijoz.id, {
          chekRaqami: sotuv.chekRaqami,
          summasi: Number(sotuv.yakuniySumma),
          tolovUsuli: sotuv.tolovUsuli,
          mijozIsm: sotuv.mijoz.ism,
          chegirma: Number(sotuv.chegirma),
          jamiSumma: Number(sotuv.jamiSumma),
        })

    // Telegram o'chirilgan bo'lsa funksiya hech narsa qaytarmaydi
    if (!natija) {
      return NextResponse.json(
        { xato: "Telegram ulanmagan yoki bildirishnomalar o'chirilgan" },
        { status: 400 },
      )
    }
    if (!natija.ok) {
      return NextResponse.json({ xato: natija.xato || 'Yuborilmadi' }, { status: 400 })
    }

    return NextResponse.json({ ok: true, mijoz: sotuv.mijoz.ism, nasiyami: !!sotuv.nasiya })
  } catch (e) {
    console.error('[chek-yuborish]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
