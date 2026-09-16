import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { telefonlarniTozala } from '@/lib/mijoz-telefon'
import { sessionFilialId, sessionEgaId } from '@/lib/filial-scope'
import { foydalanuvchiYashirilganMaydonlari } from '@/lib/maydon-yashirish'
import { joriyUsdKursi } from '@/lib/kurs'
import { sotuvFoydasi, foydalarniYig, type FoydaQatori } from '@/lib/foyda'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    const filialId = sessionFilialId(session)

    const { id } = await params
    // Chekni qayta chop etish uchun sotuv yozuvi TO'LIQ kerak — summa
    // taqsimoti, chegirma, to'lov kanallari, birlik va kassir telefoni.
    // Oldin faqat mahsulot nomi qaytarilar edi, shuning uchun mijoz
    // kartasidan chek chiqarib bo'lmasdi.
    const mijoz = await prisma.mijoz.findFirst({
      where: { id, ...(filialId ? { filialId } : { egaId: sessionEgaId(session) }) },
      include: {
        sotuvlar: {
          orderBy: { sana: 'desc' },
          include: {
            tarkiblar: {
              include: { tovar: { select: { nomi: true, birlik: true, kelishNarxi: true, valyuta: true } } },
            },
            kassir: { select: { ism: true, telefon: true } },
            qaytarishlar: {
              include: {
                tarkiblar: { include: { tovar: { select: { nomi: true, birlik: true, kelishNarxi: true, valyuta: true } } } },
                kassir: { select: { ism: true } },
              },
              orderBy: { yaratilgan: 'desc' },
            },
          },
        },
      },
    })
    if (!mijoz) return NextResponse.json({ xato: 'Mijoz topilmadi' }, { status: 404 })

    // Do'kon ma'lumotlari chek sarlavhasi uchun. Ataylab shu yerdan
    // beriladi — /api/sozlamalar BARCHA sozlamalarni (Telegram sessiyasi
    // ham) qaytaradi, uni yana bitta sahifaga ochish shart emas.
    const sozlamalar = await prisma.sozlama.findMany({
      where: { kalit: { in: ['dokon_nomi', 'manzil', 'telefon', 'chek_matn'] } },
    })
    const soz: Record<string, string> = {}
    for (const x of sozlamalar) soz[x.kalit] = x.qiymat

    // ── Mijoz keltirgan foyda ──
    //
    // Kelish narxi bu hisobdan YASHIRILGAN bo'lsa, foyda ham berilmaydi:
    // foyda = sotuv narxi − tannarx, ya'ni foydani ko'rsatish tannarxni
    // oshkor qilish bilan barobar.
    const yashirilgan = await foydalanuvchiYashirilganMaydonlari((session.user as { id: string }).id)
    const foydaKorinadi = !yashirilgan.has('kelishNarxi')

    // USD'da narxlangan mahsulotning tannarxini so'mga o'tkazish uchun.
    // Kurs olinmasa foyda hisoblanmaydi — noto'g'ri raqam ko'rsatgandan
    // ko'ra hech narsa ko'rsatmagan yaxshiroq.
    const kursi = foydaKorinadi
      ? await joriyUsdKursi().then(k => k.kursi).catch(() => 0)
      : 0

    const qator = (t: {
      miqdor: unknown; jami: unknown
      tovar: { kelishNarxi: unknown; valyuta: string } | null
    }): FoydaQatori => ({
      miqdor: Number(t.miqdor),
      jami: Number(t.jami),
      kelishNarxi: t.tovar?.kelishNarxi == null ? null : Number(t.tovar.kelishNarxi),
      valyuta: t.tovar?.valyuta ?? 'UZS',
    })

    const sotuvFoydalari = new Map<string, ReturnType<typeof sotuvFoydasi>>()
    if (foydaKorinadi && kursi > 0) {
      for (const s of mijoz.sotuvlar) {
        if (s.holati !== 'YAKUNLANGAN') continue
        sotuvFoydalari.set(s.id, sotuvFoydasi({
          qatorlar: s.tarkiblar.map(qator),
          chegirma: Number(s.chegirma ?? 0),
          qaytarilgan: s.qaytarishlar.flatMap(q => q.tarkiblar.map(qator)),
          usdKursi: kursi,
        }))
      }
    }

    const jamiFoyda = foydaKorinadi && kursi > 0
      ? foydalarniYig([...sotuvFoydalari.values()])
      : null

    return NextResponse.json({
      ...mijoz,
      // Har bir chek yonida o'z foydasi ko'rsatiladi
      sotuvlar: mijoz.sotuvlar.map(s => ({
        ...s,
        foyda: sotuvFoydalari.get(s.id) ?? null,
      })),
      foydaXulosa: jamiFoyda,
      // Nega foyda yo'qligini UI aniq aytishi uchun
      foydaKorinadi,
      dokon: {
        dokon_nomi: soz.dokon_nomi || "Do'kon",
        manzil: soz.manzil || '',
        telefon: soz.telefon || '',
        chek_matn: soz.chek_matn || '',
      },
    })
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    const filialId = sessionFilialId(session)

    const { id } = await params

    const mijoz = await prisma.mijoz.findFirst({ where: { id, ...(filialId ? { filialId } : { egaId: sessionEgaId(session) }) }, select: { id: true } })
    if (!mijoz) return NextResponse.json({ xato: 'Mijoz topilmadi' }, { status: 404 })

    const nasiyalar = await prisma.nasiya.findMany({ where: { mijozId: id }, select: { id: true } })
    const nasiyaIds = nasiyalar.map(n => n.id)

    await prisma.$transaction([
      // Sotuvlar tarixi saqlanib qoladi — faqat mijoz bog'lanishi uziladi.
      prisma.sotuv.updateMany({ where: { mijozId: id }, data: { mijozId: null } }),
      prisma.buyurtma.updateMany({ where: { mijozId: id }, data: { mijozId: null } }),
      prisma.bildirishnomLog.deleteMany({ where: { mijozId: id } }),
      prisma.nasiyaTolov.deleteMany({ where: { nasiyaId: { in: nasiyaIds } } }),
      prisma.nasiyaQarzTarixi.deleteMany({ where: { nasiyaId: { in: nasiyaIds } } }),
      prisma.nasiya.deleteMany({ where: { mijozId: id } }),
      prisma.mijoz.delete({ where: { id } }),
    ])

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    const filialId = sessionFilialId(session)

    const { id } = await params
    const mavjud = await prisma.mijoz.findFirst({ where: { id, ...(filialId ? { filialId } : { egaId: sessionEgaId(session) }) }, select: { id: true } })
    if (!mavjud) return NextResponse.json({ xato: 'Mijoz topilmadi' }, { status: 404 })

    const data = await req.json()
    const tel = telefonlarniTozala(data.telefon, data.telefon2, data.qoshimchaTelefonlar)
    if ('xato' in tel) return NextResponse.json({ xato: tel.xato }, { status: 400 })

    const mijoz = await prisma.mijoz.update({
      where: { id },
      data: {
        ism: data.ism,
        telefon: tel.telefon,
        telefon2: tel.telefon2,
        qoshimchaTelefonlar: tel.qoshimcha,
        viloyat: data.viloyat?.trim() || null,
        tuman: data.tuman?.trim() || null,
        manzil: data.manzil || null,
        izoh: data.izoh || null,
        lokatsiyaLat: typeof data.lokatsiyaLat === 'number' ? data.lokatsiyaLat : null,
        lokatsiyaLng: typeof data.lokatsiyaLng === 'number' ? data.lokatsiyaLng : null,
      },
    })
    return NextResponse.json(mijoz)
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
