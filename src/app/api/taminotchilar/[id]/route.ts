import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { egaFilialWhere } from '@/lib/filial-scope'
import { koordinataTogrimi } from '@/lib/xarita-havola'
import { getStockMap } from '@/lib/stock'

// Ta'minotchi kartasi: aloqa ma'lumoti, unga bog'langan mahsulotlar
// (joriy qoldig'i bilan), so'nggi xaridlar va yuborilgan so'rovlar tarixi.
//
// Mahsulot ro'yxati "nima buyurtma qilish kerak" degan savolga javob berishi
// uchun qoldiq va minimal chegara bilan birga qaytariladi — kam qolganlar
// UI'da oldinga chiqadi va avtomatik belgilanadi.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    const { id } = await params
    const doira = egaFilialWhere(session)

    const taminotchi = await prisma.taminotchi.findFirst({
      where: { id, ...doira },
      include: {
        filial: { select: { id: true, nomi: true } },
        _count: { select: { xaridlar: true, tovarlar: true } },
      },
    })
    // Doiradan tashqaridagi ta'minotchi ham "topilmadi"
    if (!taminotchi) return NextResponse.json({ xato: 'Topilmadi' }, { status: 404 })

    const u = session.user as unknown as { id: string }
    const [tovarlar, xaridlar, sorovlar, qarz, dokonSozlama, xodim] = await Promise.all([
      prisma.tovar.findMany({
        where: { taminotchiId: id, holati: 'FAOL' },
        select: { id: true, nomi: true, birlik: true, minimalQoldiq: true, shtrixKod: true },
        orderBy: { nomi: 'asc' },
      }),
      prisma.xarid.findMany({
        where: { taminotchiId: id },
        select: { id: true, sana: true, jamiSumma: true, qoldiqQarz: true, izoh: true },
        orderBy: { sana: 'desc' },
        take: 10,
      }),
      prisma.taminotchiSorov.findMany({
        where: { taminotchiId: id },
        orderBy: { sana: 'desc' },
        take: 20,
        include: {
          foydalanuvchi: { select: { ism: true } },
          tarkiblar: { select: { id: true, nomi: true, miqdor: true, birlik: true, izoh: true } },
        },
      }),
      prisma.xarid.aggregate({ where: { taminotchiId: id }, _sum: { qoldiqQarz: true } }),
      prisma.sozlama.findUnique({ where: { kalit: 'dokon_nomi' } }),
      prisma.foydalanuvchi.findUnique({ where: { id: u.id }, select: { telefon: true } }),
    ])

    const stockMap = await getStockMap(tovarlar.map(t => t.id))
    const tovarRoyxati = tovarlar.map(t => {
      const s = stockMap.get(t.id) ?? { omborQoldiq: 0, dokonQoldiq: 0 }
      const qoldiq = s.omborQoldiq + s.dokonQoldiq
      return {
        id: t.id,
        nomi: t.nomi,
        birlik: t.birlik,
        shtrixKod: t.shtrixKod,
        minimalQoldiq: t.minimalQoldiq,
        qoldiq,
        kamQolgan: qoldiq <= t.minimalQoldiq,
        // Chegaraga yetkazish uchun taklif qilinadigan miqdor — kassir
        // o'zgartira oladi, lekin har safar noldan yozib o'tirmaydi.
        taklif: Math.max(1, Math.ceil(t.minimalQoldiq * 2 - qoldiq)),
      }
    })
    // Kam qolganlar oldinda, keyin alifbo tartibida
    tovarRoyxati.sort((a, b) =>
      a.kamQolgan === b.kamQolgan ? a.nomi.localeCompare(b.nomi) : (a.kamQolgan ? -1 : 1))

    return NextResponse.json({
      taminotchi: {
        id: taminotchi.id,
        nomi: taminotchi.nomi,
        kontaktShaxs: taminotchi.kontaktShaxs,
        telefon: taminotchi.telefon,
        manzil: taminotchi.manzil,
        izoh: taminotchi.izoh,
        filial: taminotchi.filial,
        yaratilgan: taminotchi.yaratilgan,
        xaridSoni: taminotchi._count.xaridlar,
        tovarSoni: taminotchi._count.tovarlar,
        jamiQarz: Number(qarz._sum.qoldiqQarz ?? 0),
      },
      // Xabar ko'rinishi (preview) mijoz tomonda AYNAN shu qiymatlar bilan
      // quriladi — server bilan bir xil `sorovMatni` funksiyasi ishlatiladi,
      // shuning uchun ko'rinish yuboriladigan matndan farq qilmaydi.
      xabarKonteksti: {
        dokonNomi: dokonSozlama?.qiymat || "Do'kon",
        aloqaTelefoni: xodim?.telefon ?? null,
      },
      tovarlar: tovarRoyxati,
      xaridlar,
      sorovlar: sorovlar.map(s => ({
        id: s.id,
        sana: s.sana,
        status: s.status,
        xato: s.xato,
        matn: s.matn,
        qoshimchaIzoh: s.qoshimchaIzoh,
        yuborilganSana: s.yuborilganSana,
        xodim: s.foydalanuvchi?.ism ?? null,
        tarkiblar: s.tarkiblar.map(t => ({ ...t, miqdor: Number(t.miqdor) })),
      })),
    })
  } catch (e) {
    console.error("[taminotchi tafsilot]", e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    const { id } = await params
    const mavjud = await prisma.taminotchi.findFirst({ where: { id, ...egaFilialWhere(session) }, select: { id: true } })
    if (!mavjud) return NextResponse.json({ xato: 'Topilmadi' }, { status: 404 })

    // Bog'liq xaridlar borligini tekshirish
    const xaridSoni = await prisma.xarid.count({ where: { taminotchiId: id } })
    if (xaridSoni > 0) {
      return NextResponse.json(
        { xato: `Bu ta'minotchiga ${xaridSoni} ta xarid bog'liq. Avval xaridlarni o'chiring.` },
        { status: 400 }
      )
    }

    await prisma.taminotchi.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    const { id } = await params
    // Doiradan tashqaridagi ta'minotchini tahrirlab bo'lmasin
    const mavjud = await prisma.taminotchi.findFirst({
      where: { id, ...egaFilialWhere(session) },
      select: { id: true },
    })
    if (!mavjud) return NextResponse.json({ xato: 'Topilmadi' }, { status: 404 })

    const tana = await req.json()
    const { nomi, kontaktShaxs, telefon, manzil, izoh } = tana
    if (!nomi?.trim()) return NextResponse.json({ xato: 'Nomi majburiy' }, { status: 400 })

    const tam = await prisma.taminotchi.update({
      where: { id },
      data: {
        nomi: nomi.trim(),
        kontaktShaxs: kontaktShaxs?.trim() || null,
        telefon: telefon?.trim() || null,
        manzil: manzil?.trim() || null,
        izoh: izoh?.trim() || null,
        // Joylashuv faqat SO'ROVDA BO'LSA tegiladi: nomni o'zgartirish
        // uchun yuborilgan so'rov koordinatani o'chirib yubormasin.
        ...(Object.prototype.hasOwnProperty.call(tana, 'lokatsiyaLat')
          || Object.prototype.hasOwnProperty.call(tana, 'lokatsiyaLng')
          ? koordinataTogrimi(tana.lokatsiyaLat, tana.lokatsiyaLng)
            ? { lokatsiyaLat: Number(tana.lokatsiyaLat), lokatsiyaLng: Number(tana.lokatsiyaLng) }
            : { lokatsiyaLat: null, lokatsiyaLng: null }
          : {}),
      },
    })
    return NextResponse.json(tam)
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
