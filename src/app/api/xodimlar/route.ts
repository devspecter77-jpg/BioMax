import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import type { Session } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { sessionFilialId, sessionEgaId } from '@/lib/filial-scope'
import { amalRuxsatiBormi, bolimRuxsatiBormi } from '@/lib/ruxsat-server'
import { davrKaliti, tolovlarniYigindi } from '@/lib/xodim-oylik'
import { sotuvDavriOraligi } from '@/lib/xodim-mulk'

// Xodimlar bo'limi — oylik, bonus va yangi xodim yaratish.
//
// Ko'rish doirasi: filialga bog'langan xodim faqat o'z filialidagilarni,
// filialsiz Ega esa hammasini ko'radi (`/api/foydalanuvchilar` bilan
// bir xil qoida).

function doira(session: Session | null) {
  const filialId = sessionFilialId(session)
  return filialId ? { filialId } : {}
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    if (!bolimRuxsatiBormi(session, 'xodimlar')) {
      return NextResponse.json({ xato: "Bu bo'limga ruxsatingiz yo'q" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const davr = searchParams.get('davr') || davrKaliti()

    const xodimlar = await prisma.foydalanuvchi.findMany({
      where: doira(session),
      select: {
        id: true, ism: true, login: true, rol: true, faol: true, telefon: true,
        oylikMaosh: true, yaratilgan: true, filialId: true,
        // Kartadagi "Xaritada" tugmasi shu koordinataga tayanadi —
        // alohida so'rov yubormaslik uchun shu yerda qaytariladi.
        lokatsiyaLat: true, lokatsiyaLng: true, lokatsiyaYangilangan: true,
        filial: { select: { id: true, nomi: true } },
      },
      orderBy: [{ faol: 'desc' }, { yaratilgan: 'asc' }],
    })

    // Shu davrdagi to'lovlar — har bir xodim uchun yig'indi
    const tolovlar = await prisma.xodimTolov.findMany({
      where: { xodimId: { in: xodimlar.map(x => x.id) }, davr },
      select: { xodimId: true, turi: true, summa: true },
    })

    const boyicha = new Map<string, typeof tolovlar>()
    for (const t of tolovlar) {
      const r = boyicha.get(t.xodimId) ?? []
      r.push(t)
      boyicha.set(t.xodimId, r)
    }

    const filiallar = await prisma.filial.findMany({
      select: { id: true, nomi: true },
      orderBy: { yaratilgan: 'asc' },
    })

    const [boshqaraOladi, oylikBeraOladi, mulkBoshqaraOladi, sotuvlarKoraOladi] = await Promise.all([
      amalRuxsatiBormi(session, 'xodimlar.qoshish'),
      amalRuxsatiBormi(session, 'xodimlar.oylik'),
      amalRuxsatiBormi(session, 'xodimlar.mulk'),
      amalRuxsatiBormi(session, 'xodimlar.sotuvlar'),
    ])

    // Qo'lidagi mulk va shu davrdagi sotuvlar — ro'yxatda bir qarashda ko'rinsin
    const idlar = xodimlar.map(x => x.id)
    const { dan, gacha } = sotuvDavriOraligi(davr)
    const [mulkGuruh, sotuvGuruh] = await Promise.all([
      prisma.xodimMulki.groupBy({
        by: ['xodimId'], where: { xodimId: { in: idlar }, holati: 'BERILGAN' },
        _count: { _all: true }, _sum: { qiymati: true },
      }),
      sotuvlarKoraOladi
        ? prisma.sotuv.groupBy({
            by: ['kassirId'],
            where: { kassirId: { in: idlar }, holati: 'YAKUNLANGAN', sana: { gte: dan ?? undefined, lt: gacha ?? undefined } },
            _count: { _all: true }, _sum: { yakuniySumma: true },
          })
        : Promise.resolve([]),
    ])
    const mulkMap = new Map(mulkGuruh.map(g => [g.xodimId, { soni: g._count._all, qiymati: Number(g._sum.qiymati ?? 0) }]))
    const sotuvMap = new Map(sotuvGuruh.map(g => [g.kassirId, { soni: g._count._all, summa: Number(g._sum.yakuniySumma ?? 0) }]))

    return NextResponse.json({
      davr,
      // Ruxsatlar bo'limidan beriladi (ADMIN'da doim bor)
      boshqaraOladi,
      oylikBeraOladi,
      mulkBoshqaraOladi,
      sotuvlarKoraOladi,
      meId: (session.user as { id?: string }).id ?? null,
      adminmi: (session.user as unknown as { rol?: string }).rol === 'ADMIN',
      filiallar,
      xodimlar: xodimlar.map(x => ({
        ...x,
        oylikMaosh: x.oylikMaosh === null ? null : Number(x.oylikMaosh),
        davrYigindisi: tolovlarniYigindi(
          (boyicha.get(x.id) ?? []).map(t => ({ turi: t.turi, summa: Number(t.summa) })),
        ),
        mulk: mulkMap.get(x.id) ?? { soni: 0, qiymati: 0 },
        davrSotuv: sotuvlarKoraOladi ? sotuvMap.get(x.id) ?? { soni: 0, summa: 0 } : null,
      })),
    })
  } catch (e) {
    console.error('[xodimlar]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

// Yangi xodim yaratish
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    const admin = (session.user as unknown as { rol?: string }).rol === 'ADMIN'
    if (!(await amalRuxsatiBormi(session, 'xodimlar.qoshish'))) {
      return NextResponse.json({ xato: 'Xodim qo‘shishga ruxsatingiz yo‘q', kod: 'ruxsat_yoq' }, { status: 403 })
    }

    const ownFilialId = sessionFilialId(session)
    const data = await req.json()

    const ism = String(data.ism ?? '').trim()
    const login = String(data.login ?? '').trim()
    const parol = String(data.parol ?? '')
    const rol = String(data.rol ?? 'KASSIR')

    if (!ism) return NextResponse.json({ xato: 'Ism majburiy' }, { status: 400 })
    if (login.length < 3) return NextResponse.json({ xato: 'Login kamida 3 belgi' }, { status: 400 })
    if (parol.length < 6) return NextResponse.json({ xato: 'Parol kamida 6 belgi' }, { status: 400 })
    if (!['ADMIN', 'KASSIR', 'OMBORCHI', 'SOTUVCHI', 'DOSTAVCHIK'].includes(rol)) {
      return NextResponse.json({ xato: 'Rol noto‘g‘ri' }, { status: 400 })
    }
    // Ruxsat berilgan xodim ham administrator hisobini yarata olmaydi —
    // aks holda o'ziga to'liq huquqli ikkinchi hisob ochib olardi
    if (rol === 'ADMIN' && !admin) {
      return NextResponse.json({ xato: 'Administrator hisobini faqat administrator yaratadi', kod: 'ruxsat_yoq' }, { status: 403 })
    }

    // Filial egasi faqat o'z filialiga xodim qo'sha oladi
    const filialId = ownFilialId || data.filialId || null

    // Filialsiz xodim — do'konda hali filial ochilmagan holat (eng keng
    // tarqalgan). Bunday xodim Eganing katalogini ko'rishi uchun
    // `ulashilganEgaId` o'rnatiladi: `sessionEgaId` aynan shu maydonga
    // qarab qaysi katalog ko'rinishini hal qiladi. Busiz yangi kassir
    // POS'da bo'sh ro'yxat ko'rardi.
    const ulashilganEgaId = filialId ? null : sessionEgaId(session)

    const mavjud = await prisma.foydalanuvchi.findUnique({ where: { login }, select: { id: true } })
    if (mavjud) return NextResponse.json({ xato: 'Bu login band' }, { status: 400 })

    // Oylik belgilash — alohida ruxsat
    const maosh = (await amalRuxsatiBormi(session, 'xodimlar.oylik')) ? Number(data.oylikMaosh) : NaN
    const parolHash = await bcrypt.hash(parol, 10)

    const xodim = await prisma.foydalanuvchi.create({
      data: {
        ism, login, parolHash, rol: rol as 'ADMIN' | 'KASSIR' | 'OMBORCHI' | 'SOTUVCHI' | 'DOSTAVCHIK',
        telefon: String(data.telefon ?? '').replace(/\D/g, '') || null,
        filialId,
        ulashilganEgaId,
        oylikMaosh: Number.isFinite(maosh) && maosh > 0 ? maosh : null,
      },
      select: {
        id: true, ism: true, login: true, rol: true, faol: true, telefon: true,
        oylikMaosh: true, filialId: true, filial: { select: { id: true, nomi: true } },
      },
    })

    return NextResponse.json({
      ...xodim,
      oylikMaosh: xodim.oylikMaosh === null ? null : Number(xodim.oylikMaosh),
    }, { status: 201 })
  } catch (e) {
    console.error('[xodimlar POST]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
