import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { getStockMap } from '@/lib/stock'
import { egaFilialWhere } from '@/lib/filial-scope'
import { tovarYozishRuxsatlari } from '@/lib/tovar-ruxsat'
import { harakatniTekshir, qoldiqYetarlimi } from '@/lib/qolda-harakat'
import { harakatMalumoti } from '@/lib/harakat-turlari'
import { amalRuxsatiBormi } from '@/lib/ruxsat-server'
import { katalogBoyicha } from '@/lib/ruxsat-katalogi'
import { harakatUchunKerak, ruxsatYoqXabari } from '@/lib/ruxsat-amallar'

// BITTA mahsulot uchun qo'lda kirim/chiqim.
//
// Ilgari faqat `ommaviy` (hamma tovarga birdan) va `sozlash` (absolyut
// qoldiq) bor edi — bitta mahsulotni "5 dona kirim qildim" deb yozishning
// iloji yo'q edi. Ombor sahifasidan aynan shu kerak.
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    // Zaxirani o'zgartirish — yozish amali, tovar tahrirlash bilan bir xil
    // huquqqa tayanadi (bazadan jonli o'qiladi).
    const { tahrirlashMumkin } = await tovarYozishRuxsatlari(session)
    if (!tahrirlashMumkin) {
      return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })
    }

    const tana = await req.json()
    const tovarId = String(tana.tovarId ?? '')
    if (!tovarId) return NextResponse.json({ xato: 'tovarId majburiy' }, { status: 400 })

    const { xato, qiymat } = harakatniTekshir(tana)
    if (xato || !qiymat) return NextResponse.json({ xato }, { status: 400 })

    // Kirim va chiqim — xodimga alohida beriladi (masalan omborchi faqat kirim qiladi)
    const harakatKalit = harakatUchunKerak(qiymat.turi)
    if (!(await amalRuxsatiBormi(session, harakatKalit))) {
      return NextResponse.json(ruxsatYoqXabari(harakatKalit, katalogBoyicha.get(harakatKalit)?.label ?? harakatKalit), { status: 403 })
    }

    // Tovar so'rovchining doirasida bo'lishi shart
    const tovar = await prisma.tovar.findFirst({
      where: { id: tovarId, ...egaFilialWhere(session) },
      select: { id: true, nomi: true, birlik: true, kelishNarxi: true },
    })
    if (!tovar) return NextResponse.json({ xato: 'Tovar topilmadi' }, { status: 404 })

    // Ta'minotchi ham SHU doiradan (faqat kirimda ma'noga ega)
    let taminotchiId: string | null = null
    if (tana.taminotchiId) {
      const tam = await prisma.taminotchi.findFirst({
        where: { id: String(tana.taminotchiId), ...egaFilialWhere(session) },
        select: { id: true },
      })
      if (!tam) return NextResponse.json({ xato: "Ta'minotchi topilmadi" }, { status: 400 })
      taminotchiId = tam.id
    }

    const oldingi = (await getStockMap([tovarId])).get(tovarId) ?? { omborQoldiq: 0, dokonQoldiq: 0 }
    const joydagi = qiymat.joy === 'OMBOR' ? oldingi.omborQoldiq : oldingi.dokonQoldiq

    // Manfiy qoldiqning oldini olish — hisobotlar buzilmasin
    if (!qoldiqYetarlimi(qiymat.turi, qiymat.miqdor, joydagi)) {
      const joyNomi = qiymat.joy === 'OMBOR' ? 'omborda' : "do'konda"
      return NextResponse.json({
        xato: `Yetarli emas: ${joyNomi} ${joydagi} ${tovar.birlik.toLowerCase()} bor, `
          + `${qiymat.miqdor} chiqarib bo'lmaydi`,
        mavjud: joydagi,
      }, { status: 400 })
    }

    await prisma.omborHarakati.create({
      data: {
        tovarId,
        turi: qiymat.turi,
        joy: qiymat.joy,
        miqdor: qiymat.miqdor,
        // Narx kiritilmasa kirimda tannarx olinadi — ombor tarixida
        // "0 so'mga keldi" degan yolg'on yozuv qolmasin.
        narx: qiymat.narx > 0
          ? qiymat.narx
          : (qiymat.turi === 'KIRIM' ? Number(tovar.kelishNarxi) : 0),
        taminotchiId,
        izoh: qiymat.izoh ?? harakatMalumoti(qiymat.turi).label,
        foydalanuvchiId: (session.user as { id?: string }).id!,
      },
    })

    const yangi = (await getStockMap([tovarId])).get(tovarId) ?? { omborQoldiq: 0, dokonQoldiq: 0 }

    return NextResponse.json({
      ok: true,
      tovar: tovar.nomi,
      omborQoldiq: yangi.omborQoldiq,
      dokonQoldiq: yangi.dokonQoldiq,
      qoldiq: yangi.omborQoldiq + yangi.dokonQoldiq,
    }, { status: 201 })
  } catch (e) {
    console.error('[ombor/harakat]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
