import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { normalizeUzbek, toKirill, toLotin } from '@/lib/utils'
import { getStockMap } from '@/lib/stock'
import { sessionFilialId } from '@/lib/filial-scope'
import { rasmlarniSiqish } from '@/lib/rasm'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const qidiruv = searchParams.get('q') || ''
    const kategoriyaId = searchParams.get('kategoriya') || ''
    const holati = searchParams.get('holati') || 'FAOL'
    const page = parseInt(searchParams.get('page') || '1')
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam) : 0

    const filialId = sessionFilialId(session)
    const where: any = {}
    if (filialId) where.filialId = filialId
    if (holati !== 'BARCHASI') where.holati = holati
    if (kategoriyaId) where.kategoriyaId = kategoriyaId
    if (qidiruv) {
      const normalized = normalizeUzbek(qidiruv)
      const apostroflar = ["'", '`', 'ʻ', 'ʼ', '\u2018', '\u2019']
      // Lotin va kirill variantlarini qidirish — foydalanuvchi qaysi yozuvda yozgani muhim emas
      const kirill = toKirill(normalized)
      // Uzbek kirill э vs Rus kirill е — ikkalasida ham tekshirish
      const kirillRu = kirill.replace(/э/g, 'е').replace(/Э/g, 'Е')
      const kirillUz = kirill.replace(/е/g, 'э').replace(/Е/g, 'Э')
      const skriptlar = Array.from(new Set([normalized, kirill, kirillRu, kirillUz, toLotin(normalized)]))
      const variantlar = skriptlar.flatMap(s => apostroflar.map(a => s.replace(/'/g, a)))
      where.OR = [
        ...variantlar.map(v => ({ nomi: { contains: v, mode: 'insensitive' as const } })),
        { shtrixKod: { contains: normalized } },
      ]
    }

    const [tovarlar, jami] = await Promise.all([
      prisma.tovar.findMany({
        where,
        include: { kategoriya: true },
        orderBy: { nomi: 'asc' },
        ...(limit > 0 ? { skip: (page - 1) * limit, take: limit } : {}),
      }),
      prisma.tovar.count({ where }),
    ])

    // SQL aggregatsiya — omborHarakati yuklanmaydi
    const stockMap = await getStockMap(tovarlar.map(t => t.id))

    const tovarlarQoldiq = tovarlar.map((t) => {
      const stock = stockMap.get(t.id)
      return { ...t, qoldiq: stock?.dokonQoldiq ?? 0 }
    })

    return NextResponse.json({ tovarlar: tovarlarQoldiq, jami, page, limit })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

async function keyingiShtrixKod(filialId: string | null): Promise<string> {
  const barchasi = await prisma.tovar.findMany({
    where: { shtrixKod: { not: null }, filialId },
    select: { shtrixKod: true }
  })
  const raqamlar = new Set(
    barchasi.map(t => parseInt(t.shtrixKod!)).filter(n => Number.isInteger(n) && n > 0)
  )
  let keyingi = 1
  while (raqamlar.has(keyingi)) keyingi++
  return String(keyingi)
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })

    const data = await req.json()
    const filialId = sessionFilialId(session)

    // Shtrix kod yo'q bo'lsa ketma-ketlikdagi bo'sh raqamni topib berish
    const autoShtrixKod = data.shtrixKod?.trim() || await keyingiShtrixKod(filialId)
    const rasmlar = await rasmlarniSiqish(data.rasmlar)

    const tovar = await prisma.tovar.create({
      data: {
        nomi: data.nomi,
        kategoriyaId: data.kategoriyaId,
        shtrixKod: autoShtrixKod,
        filialId,
        kelishNarxi: parseFloat(data.kelishNarxi),
        sotishNarxi: parseFloat(data.sotishNarxi),
        birlik: data.birlik || 'DONA',
        minimalQoldiq: parseInt(data.minimalQoldiq) || 5,
        rasmlar,
        yaroqlilikMuddati: data.yaroqlilikMuddati ? new Date(data.yaroqlilikMuddati) : null,
      },
      include: { kategoriya: true },
    })

    // Boshlang'ich qoldiq kiritilsa — to'g'ridan-to'g'ri do'konga (sotuvga tayyor)
    if (data.boshlangichQoldiq && parseFloat(data.boshlangichQoldiq) > 0) {
      await prisma.omborHarakati.create({
        data: {
          tovarId: tovar.id,
          turi: 'KIRIM',
          joy: 'DOKON',
          miqdor: parseFloat(data.boshlangichQoldiq),
          narx: parseFloat(data.kelishNarxi),
          izoh: 'Boshlang\'ich qoldiq',
          foydalanuvchiId: (session.user as any).id,
        },
      })
    }

    return NextResponse.json(tovar, { status: 201 })
  } catch (e: any) {
    if (e.code === 'P2002') {
      return NextResponse.json({ xato: 'Bu shtrix-kod allaqachon mavjud' }, { status: 400 })
    }
    console.error(e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
