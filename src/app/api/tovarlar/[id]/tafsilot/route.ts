import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { sessionFilialId, sessionEgaId } from '@/lib/filial-scope'
import { getStockMap } from '@/lib/stock'
import { foydalanuvchiYashirilganMaydonlari } from '@/lib/maydon-yashirish'
import { harakatMalumoti } from '@/lib/harakat-turlari'
import { joriyUsdKursi } from '@/lib/kurs'

// Bitta mahsulotning TO'LIQ tafsiloti: qaysi omborda turgani, qachon va
// kimdan kelgani, butun harakatlar tarixi.
//
// Nega alohida marshrut: `/api/tovarlar/[id]` GET tahrirlash formasi uchun
// ishlatiladi va yengil bo'lishi kerak. Bu yerdagi og'ir jamlashlar
// (qoldiq SQL, agregatlar, sotuv tarixi) har bir tahrir oynasini
// sekinlashtirmasligi uchun ajratildi.

const HARAKAT_LIMITI = 100

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    const filialId = sessionFilialId(session)
    const foydalanuvchiId = (session.user as unknown as { id: string }).id
    const doira = filialId ? { filialId } : { egaId: sessionEgaId(session) }

    const tovar = await prisma.tovar.findFirst({
      where: { id, ...doira },
      include: {
        kategoriya: { select: { id: true, nomi: true } },
        taminotchi: { select: { id: true, nomi: true, telefon: true } },
        filial: { select: { id: true, nomi: true } },
      },
    })
    // Doiradan tashqaridagi mahsulot ham "topilmadi" — mavjudligini
    // oshkor qilmaymiz.
    if (!tovar) return NextResponse.json({ xato: 'Topilmadi' }, { status: 404 })

    // So'rovlar ikki guruhga bo'lingan: bittada 9 tasini birdan yuborish
    // Neon pooler'ida ulanishni uzib yuborardi ("Connection terminated
    // unexpectedly"). Ikki guruh sezilarli sekinlashtirmaydi, lekin
    // ishonchli ishlaydi.
    const [stockMap, yashirilgan, harakatlar, harakatJami] =
      await Promise.all([
        getStockMap([id]),
        foydalanuvchiYashirilganMaydonlari(foydalanuvchiId),
        prisma.omborHarakati.findMany({
          where: { tovarId: id },
          orderBy: { sana: 'desc' },
          take: HARAKAT_LIMITI,
          select: {
            id: true, turi: true, joy: true, miqdor: true, narx: true, sana: true, izoh: true,
            taminotchi: { select: { nomi: true } },
            foydalanuvchi: { select: { ism: true } },
            sotuv: { select: { chekRaqami: true } },
            otkazma: {
              select: {
                id: true,
                manbaFilial: { select: { nomi: true } },
                qabulFilial: { select: { nomi: true } },
              },
            },
          },
        }),
        prisma.omborHarakati.count({ where: { tovarId: id } }),
      ])

    const [kirimJami, chiqimJami, sotuvJami, oxirgiSotuv] =
      await Promise.all([
        prisma.omborHarakati.aggregate({
          where: { tovarId: id, turi: 'KIRIM' },
          _sum: { miqdor: true },
          _count: true,
          _min: { sana: true },
          _max: { sana: true },
        }),
        prisma.omborHarakati.aggregate({
          where: { tovarId: id, turi: { in: ['CHIQIM', 'YOQOTISH'] } },
          _sum: { miqdor: true },
        }),
        prisma.sotuvTarkibi.aggregate({
          where: { tovarId: id, sotuv: { holati: 'YAKUNLANGAN' } },
          _sum: { miqdor: true, jami: true },
          _count: true,
        }),
        prisma.sotuvTarkibi.findFirst({
          where: { tovarId: id, sotuv: { holati: 'YAKUNLANGAN' } },
          orderBy: { sotuv: { sana: 'desc' } },
          select: { sotuv: { select: { sana: true, chekRaqami: true } } },
        }),
      ])

    const stock = stockMap.get(id) ?? { omborQoldiq: 0, dokonQoldiq: 0 }
    const jamiQoldiq = stock.omborQoldiq + stock.dokonQoldiq

    // Kelish narxi yashirilgan bo'lsa — harakatlardagi `narx` ham
    // yashirilishi kerak, aks holda kirim narxi shu ro'yxat orqali sizadi.
    const narxYashirin = yashirilgan.has('kelishNarxi')

    // Kirim summasi = har bir kirim harakatining miqdor × narx.
    // Agregat ikki ustunni ko'paytira olmaydi, shuning uchun alohida SQL.
    let kirimSumma: number | null = null
    if (!narxYashirin) {
      const [qator] = await prisma.$queryRaw<{ summa: number | null }[]>`
        SELECT SUM(miqdor * narx)::float AS summa
        FROM public.ombor_harakati
        WHERE "tovarId" = ${id} AND turi = 'KIRIM'
      `
      kirimSumma = qator?.summa ?? 0
    }

    // Joriy kurs — yaratilgandagi kurs bilan solishtirish uchun.
    // Kunlik keshlangan; olinmasa tafsilot baribir ochilishi kerak.
    const joriyKurs = await joriyUsdKursi().then(k => k.kursi).catch(() => null)

    return NextResponse.json({
      joriyKursi: joriyKurs,
      tovar: {
        id: tovar.id,
        nomi: tovar.nomi,
        kategoriya: tovar.kategoriya,
        taminotchi: tovar.taminotchi,
        filial: tovar.filial,
        shtrixKod: tovar.shtrixKod,
        keltirilganManzil: tovar.keltirilganManzil,
        yaratilganKursi: tovar.yaratilganKursi,
        qulflangan: tovar.qulflangan,
        birlik: tovar.birlik,
        valyuta: tovar.valyuta,
        holati: tovar.holati,
        kelishNarxi: narxYashirin ? null : tovar.kelishNarxi,
        sotishNarxi: tovar.sotishNarxi,
        optomNarxi: tovar.optomNarxi,
        bolishNarxi: tovar.bolishNarxi,
        minimalQoldiq: tovar.minimalQoldiq,
        rasmlar: tovar.rasmlar,
        yaroqlilikMuddati: tovar.yaroqlilikMuddati,
        yaratilgan: tovar.yaratilgan,
        yangilangan: tovar.yangilangan,
      },
      qoldiq: {
        ombor: stock.omborQoldiq,
        dokon: stock.dokonQoldiq,
        jami: jamiQoldiq,
        kamQolgan: jamiQoldiq <= tovar.minimalQoldiq,
      },
      kirim: {
        // "Bu mahsulot qachon kiritilgan" — birinchi kirim harakati.
        // Mahsulot kartasi yaratilgan sana bundan farq qilishi mumkin
        // (avval karta ochilib, keyin tovar kelgan bo'lishi mumkin).
        birinchiSana: kirimJami._min.sana,
        oxirgiSana: kirimJami._max.sana,
        marta: kirimJami._count,
        jamiMiqdor: Number(kirimJami._sum.miqdor ?? 0),
        jamiSumma: kirimSumma,
      },
      chiqim: { jamiMiqdor: Number(chiqimJami._sum.miqdor ?? 0) },
      sotuv: {
        jamiMiqdor: Number(sotuvJami._sum.miqdor ?? 0),
        jamiSumma: Number(sotuvJami._sum.jami ?? 0),
        marta: sotuvJami._count,
        oxirgiSana: oxirgiSotuv?.sotuv?.sana ?? null,
        oxirgiChek: oxirgiSotuv?.sotuv?.chekRaqami ?? null,
      },
      harakatlar: harakatlar.map(h => ({
        id: h.id,
        turi: h.turi,
        joy: h.joy,
        ishora: harakatMalumoti(h.turi).ishora,
        miqdor: Number(h.miqdor),
        narx: narxYashirin ? null : Number(h.narx),
        sana: h.sana,
        izoh: h.izoh,
        taminotchi: h.taminotchi?.nomi ?? null,
        xodim: h.foydalanuvchi?.ism ?? null,
        chekRaqami: h.sotuv?.chekRaqami ?? null,
        manbaFilial: h.otkazma?.manbaFilial?.nomi ?? null,
        qabulFilial: h.otkazma?.qabulFilial?.nomi ?? null,
      })),
      harakatJami,
      // Ro'yxat qisqartirilganini UI aytib turishi uchun
      harakatLimiti: HARAKAT_LIMITI,
    })
  } catch (e) {
    console.error('[tovar tafsilot]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
