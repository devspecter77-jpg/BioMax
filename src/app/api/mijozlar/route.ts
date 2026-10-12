import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { telefonlarniTozala } from '@/lib/mijoz-telefon'
import { qoshimchaTelefonBoyichaIdlar } from '@/lib/mijoz-telefon-server'
import { toKirill, toLotin } from '@/lib/utils'
import { sessionFilialId, sessionEgaId } from '@/lib/filial-scope'
import {
  KIRITGAN_SELECT, kategoriyaniTekshir, kiritganMalumoti, masulniTekshir, mijozDoirasi, mijozKorinadimi, yangiMijozEgaligi,
} from '@/lib/mijoz-doirasi'

async function generateUniqueKod(): Promise<string> {
  while (true) {
    const n = Math.floor(100000000 + Math.random() * 900000000).toString()
    const kod = `${n.slice(0, 3)}-${n.slice(3, 6)}-${n.slice(6, 9)}`
    const exists = await prisma.mijoz.findUnique({ where: { maxsus_kod: kod } })
    if (!exists) return kod
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const qidiruv = searchParams.get('q') || ''

    const kirillVariant = toKirill(qidiruv)
    const lotinVariant = toLotin(qidiruv)
    const qoshimchaIdlar = qidiruv ? await qoshimchaTelefonBoyichaIdlar(qidiruv) : []
    // `?kategoriya=<id>` yoki `?kategoriya=yoq` (kategoriyasizlar)
    const kategoriya = searchParams.get('kategoriya')

    const mijozlar = await prisma.mijoz.findMany({
      where: {
        AND: [
          // Do'kon doirasi + xodim ko'radigan mijozlar (o'ziniki va ochilgan kategoriyalar)
          await mijozDoirasi(session),
          ...(kategoriya === 'yoq' ? [{ kategoriyaId: null }] : kategoriya ? [{ kategoriyaId: kategoriya }] : []),
          ...(qidiruv ? [{
            OR: [
              { ism: { contains: qidiruv, mode: 'insensitive' as const } },
              ...(kirillVariant !== qidiruv ? [{ ism: { contains: kirillVariant, mode: 'insensitive' as const } }] : []),
              ...(lotinVariant !== qidiruv ? [{ ism: { contains: lotinVariant, mode: 'insensitive' as const } }] : []),
              { telefon: { contains: qidiruv } },
              { telefon2: { contains: qidiruv } },
              ...(qoshimchaIdlar.length ? [{ id: { in: qoshimchaIdlar } }] : []),
              { maxsus_kod: { contains: qidiruv } },
              { viloyat: { contains: qidiruv, mode: 'insensitive' as const } },
              { tuman: { contains: qidiruv, mode: 'insensitive' as const } },
              { manzil: { contains: qidiruv, mode: 'insensitive' as const } },
              ...(kirillVariant !== qidiruv ? [{ manzil: { contains: kirillVariant, mode: 'insensitive' as const } }] : []),
              ...(lotinVariant !== qidiruv ? [{ manzil: { contains: lotinVariant, mode: 'insensitive' as const } }] : []),
            ],
          }] : []),
        ],
      },
      include: {
        kategoriya: { select: { id: true, nomi: true, rang: true } },
        masul: { select: { id: true, ism: true } },
        yaratgan: { select: KIRITGAN_SELECT },
        _count: { select: { sotuvlar: true, nasiyalar: true } },
        nasiyalar: {
          where: { holati: { in: ['OCHIQ', 'MUDDATI_OTGAN'] } },
          select: { qoldiq: true },
        },
      },
      orderBy: { ism: 'asc' },
    })

    const natija = mijozlar.map((m) => ({
      ...m,
      // Kim qo'shgan — kartada ko'rinadi (login emas, ism va lavozim)
      yaratgan: kiritganMalumoti(m.yaratgan),
      jami_qarz: m.nasiyalar.reduce((s, n) => s + Number(n.qoldiq), 0),
    }))

    return NextResponse.json(natija)
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })

    const data = await req.json()
    const filialId = sessionFilialId(session)
    const egaId = filialId ? null : sessionEgaId(session)

    const kat = await kategoriyaniTekshir(session, data.kategoriyaId)
    if (!kat.ok) return NextResponse.json({ xato: kat.xato }, { status: 400 })
    // Kim kiritdi va kimga biriktiriladi: xodim kiritsa — o'ziga; administrator
    // — tanlagan xodimga yoki hech kimga (faqat administratorlar ko'radi)
    const egalik = yangiMijozEgaligi(session)
    let masulId = egalik.masulId
    if ((session.user as { rol?: string }).rol === 'ADMIN' && data.masulId !== undefined) {
      const m = await masulniTekshir(session, data.masulId)
      if (!m.ok) return NextResponse.json({ xato: m.xato }, { status: m.holat })
      masulId = m.masulId ?? null
    }

    // Telefon raqam bo'yicha — bir xil mijoz qayta-qayta yaratilmasin.
    // Serverda tekshiriladi (client'dagi eskirgan ro'yxatga tayanmaydi).
    // Dublikat tekshiruvi ikkala raqam bo'yicha: bir mijoz avval asosiy
    // raqami bilan, keyin Telegram raqami bilan kiritilib, ikki marta
    // yaratilib qolmasin.
    const tel = telefonlarniTozala(data.telefon, data.telefon2, data.qoshimchaTelefonlar)
    if ('xato' in tel) return NextResponse.json({ xato: tel.xato }, { status: 400 })
    const raqamlar = tel.hammasi
    if (raqamlar.length > 0) {
      const mavjudMijoz = await prisma.mijoz.findFirst({
        where: {
          OR: [
            ...raqamlar.flatMap(r => [
              { telefon: { endsWith: r } },
              { telefon2: { endsWith: r } },
            ]),
            // Qo'shimcha raqamlar 9 raqam ko'rinishida saqlanadi — aniq moslik
            { qoshimchaTelefonlar: { hasSome: raqamlar } },
          ],
          ...(filialId ? { filialId } : { egaId }),
        },
      })
      if (mavjudMijoz) {
        // Boshqa xodimning mijozi — ma'lumoti ochilmaydi (aks holda raqamni
        // kiritib, istalgan mijozni "o'ziniki qilib" olish mumkin bo'lardi)
        if (!(await mijozKorinadimi(session, mavjudMijoz.id))) {
          return NextResponse.json({
            xato: 'Bu telefon raqamli mijoz bazada bor, lekin boshqa xodimga biriktirilgan. Administratorga murojaat qiling',
            kod: 'boshqa_xodimniki',
          }, { status: 409 })
        }
        return NextResponse.json({ ...mavjudMijoz, mavjud: true }, { status: 200 })
      }
    }

    const maxsus_kod = await generateUniqueKod()
    const mijoz = await prisma.mijoz.create({
      data: {
        ism: data.ism,
        telefon: tel.telefon,
        telefon2: tel.telefon2,
        qoshimchaTelefonlar: tel.qoshimcha,
        viloyat: data.viloyat?.trim() || null,
        tuman: data.tuman?.trim() || null,
        manzil: data.manzil,
        izoh: data.izoh,
        maxsus_kod, filialId, egaId,
        yaratganId: egalik.yaratganId,
        // Qayerdan: kassa o'zi "kassa" deb yuboradi, aks holda Mijozlar bo'limi
        manba: data.manba === 'kassa' ? 'kassa' : 'mijozlar',
        masulId,
        kategoriyaId: kat.kategoriyaId ?? null,
        lokatsiyaLat: typeof data.lokatsiyaLat === 'number' ? data.lokatsiyaLat : null,
        lokatsiyaLng: typeof data.lokatsiyaLng === 'number' ? data.lokatsiyaLng : null,
      },
    })
    return NextResponse.json(mijoz, { status: 201 })
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
