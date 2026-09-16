import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getStockMap } from '@/lib/stock'
import { joriyUsdKursi } from '@/lib/kurs'
import { imzoniTekshir } from '@/lib/marketplace-imzo'
import { faolRezervlar } from '@/lib/onlayn-sotuv-server'
import { aksiyalarniYangila, rasmVersiyalari } from '@/lib/vitrina-server'
import { aksiyaHolati, xususiyatlarniTozala } from '@/lib/vitrina'

// MARKETPLACE SHARTNOMASI — vitrina katalogi.
//
// QAT'IY QOIDA: bu marshrut hech qachon `kelishNarxi`, ta'minotchi,
// foyda yoki ANIQ QOLDIQ SONINI qaytarmaydi. Mavjudlik faqat uch
// holat: BOR / KAM / YOQ.
//
// Sabab (TZ 12.3): aniq qoldiq raqobatchiga ombor hajmini ochib beradi.
// Bu qoida SHU YERDA yashaydi — marketplace ERP jadvallarini o'zi
// o'qimaydi, shuning uchun qoidani ikkinchi marta yozish kerak emas.
//
// Saytga faqat "Onlayn vitrina"da `saytda` belgilangan mahsulot chiqadi.
// Rasmlarning O'ZI bu javobda yo'q (har biri ~200 KB) — faqat versiyasi;
// rasm alohida `/api/marketplace/rasm/...` dan olinadi va keshlanadi.

export const dynamic = 'force-dynamic'

/**
 * Mavjudlik OMBOR + DO'KON yig'indisidan hisoblanadi (TZ 5.1), onlayn
 * buyurtmalar band qilgani ayirilgan holda.
 */
function mavjudlik(jami: number, minimal: number): 'BOR' | 'KAM' | 'YOQ' {
  if (jami <= 0) return 'YOQ'
  // `minimalQoldiq` — ERP'da allaqachon "kam qoldi" chegarasi sifatida
  // ishlatiladi; shu bir xil chegara vitrinada ham qo'llanadi.
  if (jami <= Math.max(1, minimal)) return 'KAM'
  return 'BOR'
}

export async function GET(req: NextRequest) {
  try {
    // GET da tana bo'sh — imzo ham bo'sh tana bilan hisoblanadi.
    const tekshiruv = imzoniTekshir(req, '')
    if (!tekshiruv.ok) {
      console.warn('[mp/katalog] imzo rad etildi:', tekshiruv.sabab)
      return NextResponse.json({ kod: tekshiruv.sabab, xato: 'Ruxsat yo‘q' }, { status: tekshiruv.holat })
    }

    // Vaqti kelgan aksiya narxlari avval qo'llanadi — sayt eskirgan narx ko'rsatmasin
    await aksiyalarniYangila()

    const tovarlar = await prisma.tovar.findMany({
      where: {
        holati: 'FAOL',
        // Qulflangan tovar POS'da ham ko'rinmaydi — vitrinada ham
        // ko'rinmasligi kerak, aks holda mijoz sotib bo'lmaydigan
        // narsani buyurtma qilardi.
        qulflangan: false,
        kartochka: { saytda: true },
      },
      select: {
        id: true, nomi: true, birlik: true, shtrixKod: true,
        sotishNarxi: true, valyuta: true, minimalQoldiq: true, yangilangan: true,
        kategoriya: { select: { id: true, nomi: true, ombor: { select: { id: true, nomi: true } } } },
        kartochka: {
          select: {
            sarlavha: true, brend: true, tavsif: true, xususiyatlar: true, hajm: true, hajmBirligi: true,
            aksiyaNarxi: true, aksiyaBoshi: true, aksiyaOxiri: true, aksiyaEskiNarx: true, yangilangan: true,
          },
        },
      },
      orderBy: { nomi: 'asc' },
    })

    const ids = tovarlar.map(t => t.id)
    const [stok, band, kurs, versiyalar] = await Promise.all([
      getStockMap(ids),
      // Onlayn buyurtmalar band qilgani ayiriladi — oxirgi donani ikki xaridor olmasin
      faolRezervlar(tovarlar.map(t => t.id)),
      // Kurs olinmasa `null` — marketplace dollarli tovarni sotmaydi,
      // taxminiy kurs bilan sotgandan ko'ra shunisi to'g'ri.
      joriyUsdKursi().then(k => k.kursi).catch(() => null),
      // Rasm versiyalari BAZADA hisoblanadi: rasmlarning o'zi (har biri ~200 KB)
      // katalog so'roviga tortilsa javob soniyalab cho'zilardi.
      rasmVersiyalari(ids),
    ])

    return NextResponse.json({
      tovarlar: tovarlar.map(t => {
        const s = stok.get(t.id) ?? { omborQoldiq: 0, dokonQoldiq: 0 }
        const jami = s.omborQoldiq + s.dokonQoldiq - (band.get(t.id) ?? 0)
        const k = t.kartochka
        const aksiya = k ? {
          aksiyaNarxi: k.aksiyaNarxi === null ? null : Number(k.aksiyaNarxi),
          aksiyaBoshi: k.aksiyaBoshi, aksiyaOxiri: k.aksiyaOxiri,
          aksiyaEskiNarx: k.aksiyaEskiNarx === null ? null : Number(k.aksiyaEskiNarx),
        } : null
        // Eski narx faqat aksiya haqiqatan qo'llangan va narx aksiyadagidek bo'lsa ko'rsatiladi —
        // "chizilgan narx" hech qachon uydirma bo'lmasin
        const aksiyaFaol = aksiya !== null
          && aksiyaHolati(aksiya) === 'FAOL'
          && aksiya.aksiyaEskiNarx !== null
          && Number(t.sotishNarxi) === aksiya.aksiyaNarxi
        return {
          id: t.id,
          nomi: t.nomi,
          birlik: t.birlik,
          shtrixKod: t.shtrixKod,
          sotishNarxi: Number(t.sotishNarxi),
          valyuta: t.valyuta,
          mavjudlik: mavjudlik(jami, t.minimalQoldiq),
          kategoriya: t.kategoriya ? { id: t.kategoriya.id, nomi: t.kategoriya.nomi } : null,
          ombor: t.kategoriya?.ombor ?? null,
          sarlavha: k?.sarlavha ?? null,
          brend: k?.brend ?? null,
          tavsif: k?.tavsif ?? null,
          xususiyatlar: xususiyatlarniTozala(k?.xususiyatlar),
          hajm: k?.hajm === null || k?.hajm === undefined ? null : Number(k.hajm),
          hajmBirligi: k?.hajmBirligi ?? null,
          eskiNarx: aksiyaFaol ? aksiya.aksiyaEskiNarx : null,
          aksiyaOxiri: aksiyaFaol ? aksiya.aksiyaOxiri!.toISOString() : null,
          rasmlar: versiyalar.get(t.id) ?? [],
          yangilangan: new Date(Math.max(t.yangilangan.getTime(), k?.yangilangan.getTime() ?? 0)).toISOString(),
        }
      }),
      usdKursi: kurs,
      vaqt: new Date().toISOString(),
    })
  } catch (e) {
    console.error('[mp/katalog]', e)
    return NextResponse.json({ kod: 'server_xatosi', xato: 'Server xatosi' }, { status: 500 })
  }
}
