import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { amalRuxsatiBormi } from '@/lib/ruxsat-server'
import { getStockMap } from '@/lib/stock'
import { egaFilialWhere } from '@/lib/filial-scope'
import { foydalanuvchiYashirilganMaydonlari, maydonlarniYashir } from '@/lib/maydon-yashirish'
import { tovarYozishRuxsatlari } from '@/lib/tovar-ruxsat'

// Bitta ombor "ichi": kategoriyalari va ulardagi mahsulotlar qoldig'i bilan.
// Ombor sahifasi shu bitta so'rov bilan to'liq ishlaydi.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    const { id } = await params
    const doira = egaFilialWhere(session)

    const ombor = await prisma.ombor.findFirst({
      where: { id, ...doira },
      include: {
        kategoriyalar: {
          select: { id: true, nomi: true, _count: { select: { tovarlar: true } } },
          orderBy: { nomi: 'asc' },
        },
      },
    })
    if (!ombor) return NextResponse.json({ xato: 'Ombor topilmadi' }, { status: 404 })

    const kategoriyaIdlar = ombor.kategoriyalar.map(k => k.id)

    // Arxivlangan tovarlar ko'rsatilmaydi — ular katalogdan chiqarilgan.
    const tovarlar = kategoriyaIdlar.length === 0 ? [] : await prisma.tovar.findMany({
      where: { holati: 'FAOL', kategoriyaId: { in: kategoriyaIdlar }, ...doira },
      include: { kategoriya: { select: { id: true, nomi: true } } },
      orderBy: { nomi: 'asc' },
    })

    const foydalanuvchiId = (session.user as { id?: string }).id ?? ''
    const [stockMap, yashirilgan, ruxsatlar] = await Promise.all([
      getStockMap(tovarlar.map(t => t.id)),
      foydalanuvchiYashirilganMaydonlari(foydalanuvchiId),
      tovarYozishRuxsatlari(session),
    ])

    const qoldiqYashirilgan = yashirilgan.has('qoldiq')
    const royxat = tovarlar.map(t => {
      const s = stockMap.get(t.id) ?? { omborQoldiq: 0, dokonQoldiq: 0 }
      const jami = s.omborQoldiq + s.dokonQoldiq
      return maydonlarniYashir({
        id: t.id,
        nomi: t.nomi,
        kategoriya: t.kategoriya,
        kategoriyaId: t.kategoriyaId,
        shtrixKod: t.shtrixKod,
        birlik: t.birlik,
        valyuta: t.valyuta,
        kelishNarxi: t.kelishNarxi,
        sotishNarxi: t.sotishNarxi,
        minimalQoldiq: t.minimalQoldiq,
        qulflangan: t.qulflangan,
        rasmlar: t.rasmlar,
        omborQoldiq: qoldiqYashirilgan ? null : s.omborQoldiq,
        dokonQoldiq: qoldiqYashirilgan ? null : s.dokonQoldiq,
        qoldiq: Math.max(0, jami),
        kamQolgan: jami <= t.minimalQoldiq,
      }, yashirilgan)
    })

    // Kategoriya kartasidagi son SHU ombordagi faol tovarlar bo'yicha
    // bo'lishi kerak — `_count` esa arxivlanganlarni ham sanaydi.
    const sonlar = new Map<string, number>()
    for (const t of tovarlar) sonlar.set(t.kategoriyaId, (sonlar.get(t.kategoriyaId) ?? 0) + 1)

    return NextResponse.json({
      ombor: {
        id: ombor.id, nomi: ombor.nomi, izoh: ombor.izoh, faol: ombor.faol,
      },
      kategoriyalar: ombor.kategoriyalar.map(k => ({
        id: k.id, nomi: k.nomi, tovarSoni: sonlar.get(k.id) ?? 0,
      })),
      tovarlar: royxat,
      // UI qaysi tugmalarni ko'rsatishini shu belgilar hal qiladi; server
      // baribir har bir yozishda qaytadan tekshiradi.
      boshqaraOladi: await amalRuxsatiBormi(session, 'omborlar.boshqarish'),
      tahrirlashMumkin: ruxsatlar.tahrirlashMumkin,
      ochirishMumkin: ruxsatlar.ochirishMumkin,
    })
  } catch (e) {
    console.error('[ombor tafsilot]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
