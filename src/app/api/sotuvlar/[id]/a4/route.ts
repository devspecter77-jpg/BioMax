import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import QRCode from 'qrcode'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { egaFilialWhere } from '@/lib/filial-scope'
import { mijozKorinishi, mijozliYozuvSharti } from '@/lib/mijoz-doirasi'
import type { ChekA4Malumot } from '@/lib/chek-a4'

export const dynamic = 'force-dynamic'

// A4 rasmli chek uchun sotuv: mahsulotlar (rasmi bilan) va onlayn chek QR kodi.
//
// Rasmlar bazada 1080px gacha (~200–400 KB). A4 jadvalidagi rasm katagi
// ~22 mm — 320px shu o'lchamda ~370 DPI, bitta rasm esa ~15–25 KB.
// Kichraytirish SERVERDA: kassa telefoni va sekin internet og'ir rasmlarni
// tortmaydi. Galereyada 10 tagacha rasm bo'lishi mumkin — faqat birinchisi o'qiladi.

const RASM_OLCHAMI = 320

async function kichrayt(dataUrl: string): Promise<string | null> {
  try {
    const base64 = dataUrl.split(',')[1]
    if (!base64) return null
    const bufer = await sharp(Buffer.from(base64, 'base64'))
      .rotate()
      .resize(RASM_OLCHAMI, RASM_OLCHAMI, { fit: 'inside', withoutEnlargement: true })
      // Shaffof PNG JPEG'da qora fon bo'lib chiqmasin
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer()
    return `data:image/jpeg;base64,${bufer.toString('base64')}`
  } catch {
    return null
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    const { id } = await params

    // Sotuv shu foydalanuvchining ko'rish doirasidami (boshqa Ega/filial cheki ochilmasin)
    const sotuv = await prisma.sotuv.findFirst({
      where: { id, ...egaFilialWhere(session), ...mijozliYozuvSharti(await mijozKorinishi(session)) },
      select: {
        chekRaqami: true, sana: true, holati: true,
        jamiSumma: true, chegirma: true, ballIshlatilgan: true, keshbekIshlatilgan: true,
        yakuniySumma: true, yetkazishNarx: true, tolovUsuli: true,
        naqdTolangan: true, kartaTolangan: true, clickTolangan: true, bankTolangan: true,
        mijoz: { select: { ism: true, telefon: true } },
        kassir: { select: { ism: true, telefon: true } },
        tarkiblar: {
          orderBy: { id: 'asc' },
          select: {
            tovarId: true, miqdor: true, birlikNarxi: true, jami: true,
            tovar: { select: { nomi: true, birlik: true, shtrixKod: true } },
          },
        },
      },
    })
    if (!sotuv) return NextResponse.json({ xato: 'Chek topilmadi' }, { status: 404 })

    // Har mahsulotning faqat BIRINCHI rasmi — butun galereya bazadan tortilmasin
    const idlar = [...new Set(sotuv.tarkiblar.map(t => t.tovarId))]
    const rasmQatorlari = idlar.length === 0 ? [] : await prisma.$queryRaw<{ id: string; rasm: string | null }[]>`
      SELECT id, rasmlar[1] AS rasm FROM public.tovarlar WHERE id = ANY(${idlar})`
    const rasmlar = new Map(await Promise.all(rasmQatorlari.map(async r =>
      [r.id, r.rasm?.startsWith('data:image/') ? await kichrayt(r.rasm) : null] as const)))

    // Onlayn chek havolasi: manzil mijozdan keladi (localhost / domen bir xil
    // bo'lishi uchun), lekin faqat sxema va host olinadi
    let asos = req.nextUrl.origin
    try {
      const u = new URL(req.nextUrl.searchParams.get('origin') || asos)
      if (u.protocol === 'https:' || u.protocol === 'http:') asos = `${u.protocol}//${u.host}`
    } catch {
      // noto'g'ri manzil — serverniki qoladi
    }
    const havola = `${asos}/chek/${encodeURIComponent(sotuv.chekRaqami)}`
    const qr = await QRCode.toDataURL(havola, { width: 240, margin: 1, errorCorrectionLevel: 'M' }).catch(() => null)

    const javob: ChekA4Malumot = {
      chekRaqami: sotuv.chekRaqami,
      sana: sotuv.sana.toISOString(),
      holati: sotuv.holati,
      qatorlar: sotuv.tarkiblar.map(t => ({
        nomi: t.tovar.nomi,
        birlik: t.tovar.birlik,
        shtrixKod: t.tovar.shtrixKod,
        miqdor: Number(t.miqdor),
        birlikNarxi: Number(t.birlikNarxi),
        jami: Number(t.jami),
        rasm: rasmlar.get(t.tovarId) ?? null,
      })),
      jamiSumma: Number(sotuv.jamiSumma),
      chegirma: Number(sotuv.chegirma),
      ballIshlatilgan: Number(sotuv.ballIshlatilgan),
      keshbekIshlatilgan: Number(sotuv.keshbekIshlatilgan),
      yakuniySumma: Number(sotuv.yakuniySumma),
      yetkazishNarx: Number(sotuv.yetkazishNarx),
      tolovUsuli: sotuv.tolovUsuli,
      naqdTolangan: Number(sotuv.naqdTolangan),
      kartaTolangan: Number(sotuv.kartaTolangan),
      clickTolangan: Number(sotuv.clickTolangan),
      bankTolangan: Number(sotuv.bankTolangan),
      mijoz: sotuv.mijoz,
      kassir: sotuv.kassir,
      havola,
      qr,
    }
    return NextResponse.json(javob, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[sotuv a4]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
