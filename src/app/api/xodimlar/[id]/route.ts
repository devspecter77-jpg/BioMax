import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import type { Session } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { sessionFilialId } from '@/lib/filial-scope'
import { amalRuxsatiBormi, bolimRuxsatiBormi, ruxsatKeshiniTozala } from '@/lib/ruxsat-server'
import { davrKaliti, tolovlarniYigindi } from '@/lib/xodim-oylik'
import { sotuvDavriOraligi } from '@/lib/xodim-mulk'

function doira(session: Session | null) {
  const filialId = sessionFilialId(session)
  return filialId ? { filialId } : {}
}

// Bitta xodim: ma'lumoti va to'lovlar tarixi
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    if (!bolimRuxsatiBormi(session, 'xodimlar')) {
      return NextResponse.json({ xato: "Bu bo'limga ruxsatingiz yo'q" }, { status: 403 })
    }

    const { id } = await params
    const xodim = await prisma.foydalanuvchi.findFirst({
      where: { id, ...doira(session) },
      select: {
        id: true, ism: true, login: true, rol: true, faol: true, telefon: true,
        oylikMaosh: true, yaratilgan: true, filialId: true,
        filial: { select: { id: true, nomi: true } },
        // Oynadagi "Umumiy" varag'i uchun — ro'yxatdagi qiymat eskirgan bo'lishi mumkin
        lokatsiyaLat: true, lokatsiyaLng: true, lokatsiyaYangilangan: true,
      },
    })
    if (!xodim) return NextResponse.json({ xato: 'Topilmadi' }, { status: 404 })

    // ── Umumiy ko'rinish: sotuvlar (bugun / davr / butun davr) va qo'lidagi mulk ──
    const davr = new URL(req.url).searchParams.get('davr') || davrKaliti()
    const sotuvlarKoraOladi = await amalRuxsatiBormi(session, 'xodimlar.sotuvlar')
    const yigindi = async (oraliq: { dan: Date | null; gacha: Date | null }) => {
      const a = await prisma.sotuv.aggregate({
        where: {
          kassirId: id, holati: 'YAKUNLANGAN',
          ...(oraliq.dan || oraliq.gacha ? { sana: { gte: oraliq.dan ?? undefined, lt: oraliq.gacha ?? undefined } } : {}),
        },
        _sum: { yakuniySumma: true }, _count: { _all: true }, _max: { sana: true },
      })
      return { soni: a._count._all, summa: Number(a._sum.yakuniySumma ?? 0), oxirgi: a._max.sana?.toISOString() ?? null }
    }
    const [sotuvXulosa, qolidagiMulk] = await Promise.all([
      sotuvlarKoraOladi
        ? Promise.all([yigindi(sotuvDavriOraligi('bugun')), yigindi(sotuvDavriOraligi(davr)), yigindi(sotuvDavriOraligi('hammasi'))])
            .then(([bugun, davrda, jami]) => ({ davr, bugun, davrda, jami }))
        : Promise.resolve(null),
      prisma.xodimMulki.findMany({
        where: { xodimId: id, holati: 'BERILGAN' },
        select: { id: true, turi: true, nomi: true, raqami: true, qiymati: true, berilganSana: true },
        orderBy: { berilganSana: 'desc' },
      }),
    ])

    const tolovlar = await prisma.xodimTolov.findMany({
      where: { xodimId: id },
      orderBy: { sana: 'desc' },
      take: 100,
      select: {
        id: true, turi: true, summa: true, davr: true, izoh: true, sana: true,
        yaratgan: { select: { ism: true } },
      },
    })

    const tozalangan = tolovlar.map(t => ({ ...t, summa: Number(t.summa) }))

    return NextResponse.json({
      xodim: { ...xodim, oylikMaosh: xodim.oylikMaosh === null ? null : Number(xodim.oylikMaosh) },
      tolovlar: tozalangan,
      // Umumiy yig'indi (barcha davrlar bo'yicha)
      jami: tolovlarniYigindi(tozalangan),
      boshqaraOladi: (session.user as unknown as { rol?: string }).rol === 'ADMIN',
      sotuvXulosa,
      qolidagiMulk: qolidagiMulk.map(m => ({ ...m, qiymati: m.qiymati === null ? null : Number(m.qiymati) })),
    })
  } catch (e) {
    console.error('[xodim]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

// Xodim ma'lumotini yangilash — oylik, rol, telefon, faollik, parol.
// Payloadda YO'Q maydonga tegilmaydi (tovar PUT'idagi bilan bir xil qoida).
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    const admin = (session.user as unknown as { rol?: string }).rol === 'ADMIN'
    const [qoshish, oylik] = await Promise.all([
      amalRuxsatiBormi(session, 'xodimlar.qoshish'),
      amalRuxsatiBormi(session, 'xodimlar.oylik'),
    ])

    const { id } = await params
    const mavjud = await prisma.foydalanuvchi.findFirst({
      where: { id, ...doira(session) },
      select: { id: true, rol: true },
    })
    if (!mavjud) return NextResponse.json({ xato: 'Topilmadi' }, { status: 404 })

    const data = await req.json()
    const bor = (k: string) => Object.prototype.hasOwnProperty.call(data, k)

    // Qaysi maydonga qaysi ruxsat kerak: oylik — `xodimlar.oylik`, qolgani — `xodimlar.qoshish`
    const maydonlar = Object.keys(data).filter(k => ['ism', 'telefon', 'rol', 'faol', 'oylikMaosh', 'parol'].includes(k))
    if (maydonlar.some(k => k !== 'oylikMaosh') && !qoshish) {
      return NextResponse.json({ xato: 'Xodimni tahrirlashga ruxsatingiz yo‘q', kod: 'ruxsat_yoq' }, { status: 403 })
    }
    if (maydonlar.includes('oylikMaosh') && !oylik) {
      return NextResponse.json({ xato: 'Oylik belgilashga ruxsatingiz yo‘q', kod: 'ruxsat_yoq' }, { status: 403 })
    }
    if (!admin) {
      // Huquqni oshirishning oldini olish: administrator hisobiga, o'z hisobiga
      // (rol/faollik/parol/oylik) va ADMIN rolini berishga tegilmaydi
      if (mavjud.rol === 'ADMIN') {
        return NextResponse.json({ xato: 'Administrator hisobini faqat administrator o‘zgartiradi', kod: 'ruxsat_yoq' }, { status: 403 })
      }
      if (id === (session.user as unknown as { id: string }).id) {
        return NextResponse.json({ xato: 'O‘z hisobingizni bu yerdan o‘zgartira olmaysiz', kod: 'ruxsat_yoq' }, { status: 403 })
      }
      if (bor('rol') && String(data.rol) === 'ADMIN') {
        return NextResponse.json({ xato: 'Administrator rolini faqat administrator beradi', kod: 'ruxsat_yoq' }, { status: 403 })
      }
    }
    const yangi: Record<string, unknown> = {}

    if (bor('ism')) {
      const ism = String(data.ism ?? '').trim()
      if (!ism) return NextResponse.json({ xato: 'Ism majburiy' }, { status: 400 })
      yangi.ism = ism
    }
    if (bor('telefon')) {
      yangi.telefon = String(data.telefon ?? '').replace(/\D/g, '') || null
    }
    if (bor('rol')) {
      const rol = String(data.rol)
      if (!['ADMIN', 'KASSIR', 'OMBORCHI', 'SOTUVCHI'].includes(rol)) {
        return NextResponse.json({ xato: 'Rol noto‘g‘ri' }, { status: 400 })
      }
      yangi.rol = rol
    }
    if (bor('faol')) yangi.faol = !!data.faol
    if (bor('oylikMaosh')) {
      const m = Number(data.oylikMaosh)
      if (data.oylikMaosh === null || data.oylikMaosh === '') yangi.oylikMaosh = null
      else if (!Number.isFinite(m) || m < 0) {
        return NextResponse.json({ xato: 'Oylik noto‘g‘ri' }, { status: 400 })
      } else yangi.oylikMaosh = Math.round(m)
    }
    if (bor('parol') && String(data.parol)) {
      const parol = String(data.parol)
      if (parol.length < 6) return NextResponse.json({ xato: 'Parol kamida 6 belgi' }, { status: 400 })
      yangi.parolHash = await bcrypt.hash(parol, 10)
    }

    // O'z hisobini nofaol qilib qo'yib, tizimdan chiqib qolmasin
    if (yangi.faol === false && id === (session.user as unknown as { id: string }).id) {
      return NextResponse.json({ xato: 'O‘z hisobingizni nofaol qila olmaysiz' }, { status: 400 })
    }

    const xodim = await prisma.foydalanuvchi.update({
      where: { id },
      data: yangi,
      select: {
        id: true, ism: true, login: true, rol: true, faol: true, telefon: true,
        oylikMaosh: true, filialId: true, filial: { select: { id: true, nomi: true } },
      },
    })

    // Rol yoki faollik o'zgarsa — sessiya keyingi tekshiruvda yangisini olsin
    ruxsatKeshiniTozala(id)

    return NextResponse.json({
      ...xodim,
      oylikMaosh: xodim.oylikMaosh === null ? null : Number(xodim.oylikMaosh),
    })
  } catch (e) {
    console.error('[xodim PUT]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
