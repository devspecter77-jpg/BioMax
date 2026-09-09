import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { sessionIsRealEga, sessionEgaId } from '@/lib/filial-scope'
import { getStockMap } from '@/lib/stock'
import { joyMi, otkazmaniTekshir, type OmborJoy, type OtkazmaQator } from '@/lib/otkazma'
import { otkazmaniBajar, MANBA_TOVAR_SELECT } from '@/lib/otkazma-server'

// Filiallararo o'tkazmani faqat bosh Ega boshqaradi — filial admini
// boshqa filialning omboriga tega olmasligi kerak. /api/filiallar dagi
// bilan bir xil tekshiruv.
function faqatEga(session: unknown): boolean {
  const s = session as { user?: { rol?: string } } | null
  return !!s && s.user?.rol === 'ADMIN' && sessionIsRealEga(s as never)
}

// ─── Ro'yxat ────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    if (!faqatEga(session)) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50')))

    const otkazmalar = await prisma.otkazma.findMany({
      where: { egaId: sessionEgaId(session) },
      include: {
        manbaFilial: { select: { id: true, nomi: true } },
        qabulFilial: { select: { id: true, nomi: true } },
        foydalanuvchi: { select: { ism: true } },
        tarkiblar: {
          include: {
            manbaTovar: { select: { nomi: true, birlik: true } },
            qabulTovar: { select: { id: true } },
          },
        },
      },
      orderBy: { sana: 'desc' },
      take: limit,
    })

    return NextResponse.json(otkazmalar)
  } catch (e) {
    console.error('[otkazmalar GET]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

// ─── Yangi o'tkazma ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    if (!faqatEga(session)) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })

    const egaId = sessionEgaId(session)
    const foydalanuvchiId = (session.user as { id: string }).id
    const data = await req.json()

    const manbaFilialId: string | null = data.manbaFilialId || null
    const qabulFilialId: string | null = data.qabulFilialId || null
    const manbaJoy: OmborJoy = joyMi(data.manbaJoy) ? data.manbaJoy : 'OMBOR'
    const qabulJoy: OmborJoy = joyMi(data.qabulJoy) ? data.qabulJoy : 'OMBOR'

    const xomQatorlar = Array.isArray(data.tarkiblar) ? data.tarkiblar : []
    if (xomQatorlar.length === 0) {
      return NextResponse.json({ xato: 'Kamida bitta mahsulot kiriting' }, { status: 400 })
    }

    // Filiallar haqiqatdan mavjudmi (null = markaziy ombor, tekshirilmaydi)
    for (const fid of [manbaFilialId, qabulFilialId]) {
      if (!fid) continue
      const bor = await prisma.filial.findUnique({ where: { id: fid }, select: { id: true } })
      if (!bor) return NextResponse.json({ xato: 'Filial topilmadi' }, { status: 404 })
    }

    // Manba mahsulotlar — SHU manba doirasidan ekanini tekshiramiz, aks holda
    // boshqa filialning tovarini "o'tkazib" yuborish mumkin bo'lardi.
    const tovarIdlar: string[] = Array.from(
      new Set(xomQatorlar.map((t: { tovarId?: string }) => String(t.tovarId || '')).filter(Boolean)),
    )
    const manbaDoira = manbaFilialId ? { filialId: manbaFilialId } : { filialId: null, egaId }
    const manbaTovarlar = await prisma.tovar.findMany({
      where: { id: { in: tovarIdlar }, ...manbaDoira },
      select: MANBA_TOVAR_SELECT,
    })
    if (manbaTovarlar.length !== tovarIdlar.length) {
      return NextResponse.json(
        { xato: "Ba'zi mahsulotlar manba omborda topilmadi" },
        { status: 400 },
      )
    }
    const tovarMap = new Map(manbaTovarlar.map(t => [t.id, t]))

    // Haqiqiy qoldiq — brauzer yuborgan "mavjud" qiymatga ishonilmaydi
    const stockMap = await getStockMap(tovarIdlar)
    const qatorlar: OtkazmaQator[] = xomQatorlar.map((t: { tovarId: string; miqdor: unknown }) => {
      const stock = stockMap.get(String(t.tovarId)) || { omborQoldiq: 0, dokonQoldiq: 0 }
      return {
        tovarId: String(t.tovarId),
        miqdor: Number(t.miqdor) || 0,
        mavjud: manbaJoy === 'OMBOR' ? stock.omborQoldiq : stock.dokonQoldiq,
      }
    })

    const tekshiruv = otkazmaniTekshir({ manbaFilialId, qabulFilialId, manbaJoy, qabulJoy, qatorlar })
    if (!tekshiruv.ok) {
      return NextResponse.json(
        { xato: tekshiruv.xato, xatoTovarlar: tekshiruv.xatoTovarlar },
        { status: 400 },
      )
    }

    // Hujjat + qatorlar + zaxira harakatlari — bitta tranzaksiyada.
    // Mantiq otkazma-server.ts da: testlar AYNAN shu funksiyani chaqiradi.
    const natija = await prisma.$transaction(
      (tx) => otkazmaniBajar(tx, {
        manbaFilialId, qabulFilialId, manbaJoy, qabulJoy,
        izoh: typeof data.izoh === 'string' && data.izoh.trim() ? data.izoh.trim() : null,
        egaId,
        foydalanuvchiId,
        tovarMap,
        qatorlar,
      }),
      { maxWait: 15000, timeout: 60000 },
    )

    return NextResponse.json({
      ok: true,
      id: natija.otkazmaId,
      qatorlar: natija.qatorSoni,
      yangiTovarSoni: natija.yangiTovarSoni,
    }, { status: 201 })
  } catch (e) {
    console.error('[otkazmalar POST]', e)
    return NextResponse.json({ xato: "O'tkazma amalga oshmadi" }, { status: 500 })
  }
}
