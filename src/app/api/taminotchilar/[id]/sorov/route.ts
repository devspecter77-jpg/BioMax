import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { egaFilialWhere } from '@/lib/filial-scope'
import { ichkiXabarYubor } from '@/lib/telegram'
import { sorovniTekshir, sorovMatni } from '@/lib/taminotchi-sorov'

// Ta'minotchiga mahsulot so'rovi yaratadi va Telegram orqali yuboradi.
//
// Yuborish MUVAFFAQIYATSIZ bo'lsa ham hujjat saqlanadi (status='failed') —
// shunda kassir nima so'raganini yo'qotmaydi va keyin qayta yubora oladi.
// Chek yuborish naqshi bilan bir xil: xabar avtomatik emas, xodim o'zi bosadi.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    const { id } = await params
    const doira = egaFilialWhere(session)

    const taminotchi = await prisma.taminotchi.findFirst({
      where: { id, ...doira },
      select: { id: true, nomi: true, telefon: true, kontaktShaxs: true },
    })
    if (!taminotchi) return NextResponse.json({ xato: 'Topilmadi' }, { status: 404 })
    if (!taminotchi.telefon) {
      return NextResponse.json(
        { xato: "Ta'minotchida telefon raqam yo'q — avval uni tahrirlab raqam kiriting" },
        { status: 400 },
      )
    }

    const tana = await req.json()
    const tekshiruv = sorovniTekshir(tana)
    if (!tekshiruv.ok) return NextResponse.json({ xato: tekshiruv.xato }, { status: 400 })

    // Katalogdan tanlangan tovarlar SHU doiraga tegishli bo'lishi kerak —
    // boshqa Eganing mahsuloti so'rovga tushib qolmasin.
    const tovarIdlar = tekshiruv.qatorlar
      .map(q => q.tovarId)
      .filter((v): v is string => !!v)
    if (tovarIdlar.length > 0) {
      const topilgan = await prisma.tovar.count({
        where: { id: { in: tovarIdlar }, ...doira },
      })
      if (topilgan !== new Set(tovarIdlar).size) {
        return NextResponse.json({ xato: 'Tanlangan mahsulotlardan biri topilmadi' }, { status: 400 })
      }
    }

    const u = session.user as unknown as { id: string; name?: string | null }
    const [dokonSozlama, xodim] = await Promise.all([
      prisma.sozlama.findUnique({ where: { kalit: 'dokon_nomi' } }),
      prisma.foydalanuvchi.findUnique({ where: { id: u.id }, select: { telefon: true } }),
    ])

    const matn = sorovMatni({
      dokonNomi: dokonSozlama?.qiymat || "Do'kon",
      taminotchiNomi: taminotchi.nomi,
      kontaktShaxs: taminotchi.kontaktShaxs,
      qatorlar: tekshiruv.qatorlar,
      qoshimchaIzoh: tekshiruv.qoshimchaIzoh,
      aloqaTelefoni: xodim?.telefon ?? null,
    })

    // Avval hujjatni yozamiz — Telegram javobi qanday bo'lishidan qat'i nazar
    // so'rov tarixda qolishi kerak.
    const sorov = await prisma.taminotchiSorov.create({
      data: {
        taminotchiId: taminotchi.id,
        matn,
        qoshimchaIzoh: tekshiruv.qoshimchaIzoh,
        telefon: taminotchi.telefon,
        foydalanuvchiId: u.id,
        ...doira,
        tarkiblar: {
          create: tekshiruv.qatorlar.map(q => ({
            tovarId: q.tovarId,
            nomi: q.nomi,
            miqdor: q.miqdor,
            birlik: q.birlik,
            izoh: q.izoh,
          })),
        },
      },
      select: { id: true },
    })

    const natija = await ichkiXabarYubor(taminotchi.telefon, matn)

    const yangilangan = await prisma.taminotchiSorov.update({
      where: { id: sorov.id },
      data: {
        status: natija.ok ? 'sent' : 'failed',
        xato: natija.ok ? null : (natija.xato ?? "Noma'lum xato"),
        urinishSoni: 1,
        yuborilganSana: natija.ok ? new Date() : null,
      },
      select: { id: true, status: true, xato: true, matn: true, sana: true, yuborilganSana: true },
    })

    if (!natija.ok) {
      // 502: so'rov saqlandi, lekin yetkazilmadi — UI qayta yuborishni taklif qiladi
      return NextResponse.json(
        { xato: yangilangan.xato, sorov: yangilangan, saqlandi: true },
        { status: 502 },
      )
    }
    return NextResponse.json({ ok: true, sorov: yangilangan }, { status: 201 })
  } catch (e) {
    console.error('[taminotchi sorov]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
