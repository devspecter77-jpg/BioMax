import { NextRequest, NextResponse } from 'next/server'
import { Readable } from 'node:stream'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { amalRuxsatiBormi } from '@/lib/ruxsat-server'
import { xodimlarDoirasi } from '@/lib/xodim-hisob'
import { imzolanganHavola, lokalFayl, omborTuri } from '@/lib/ovoz-ombor'
import { kengaytma, soatMatni, toshkentKuni } from '@/lib/smena'

// Bitta ovoz bo'lagini tinglash yoki yuklab olish.
//
// Fayl manzili brauzerga hech qachon doimiy berilmaydi: ruxsat tekshirilgach,
// S3/R2 ombori uchun 10 daqiqalik imzolangan havolaga yo'naltiriladi (audio
// to'g'ridan-to'g'ri ombordan oqadi, serverni band qilmaydi). Lokal
// rivojlanishda fayl shu yerdan uzatiladi, oldinga/orqaga surish uchun
// Range qo'llab-quvvatlanadi.

export const dynamic = 'force-dynamic'

function faylNomi(ism: string, boshlandi: Date, mimeType: string): string {
  const lotin = ism.normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'xodim'
  return `${lotin}_${toshkentKuni(boshlandi)}_${soatMatni(boshlandi).replace(':', '-')}.${kengaytma(mimeType)}`
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; yozuvId: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    if (!(await amalRuxsatiBormi(session, 'xodimlar.smena'))) {
      return NextResponse.json({ xato: 'Ovoz yozuvlarini tinglashga ruxsatingiz yo‘q', kod: 'ruxsat_yoq' }, { status: 403 })
    }
    const { id, yozuvId } = await params
    const xodim = await prisma.foydalanuvchi.findFirst({
      where: { AND: [{ id }, xodimlarDoirasi(session)] }, select: { id: true, ism: true },
    })
    if (!xodim) return NextResponse.json({ xato: 'Xodim topilmadi' }, { status: 404 })
    const yozuv = await prisma.ovozYozuv.findFirst({
      where: { id: yozuvId, xodimId: id },
      select: { kalit: true, mimeType: true, boshlandi: true, hajm: true },
    })
    if (!yozuv) return NextResponse.json({ xato: 'Yozuv topilmadi (saqlash muddati o‘tgan bo‘lishi mumkin)' }, { status: 404 })

    const yuklab = new URL(req.url).searchParams.get('yuklab') === '1'
    const nom = faylNomi(xodim.ism, yozuv.boshlandi, yozuv.mimeType)
    const turi = omborTuri()

    if (turi === 's3') {
      const havola = await imzolanganHavola(yozuv.kalit, {
        sekund: 600, mimeType: yozuv.mimeType, ...(yuklab ? { yuklabOlish: nom } : {}),
      })
      return NextResponse.redirect(havola, { status: 302, headers: { 'Cache-Control': 'private, no-store' } })
    }

    if (turi === 'lokal') {
      const f = await lokalFayl(yozuv.kalit).catch(() => null)
      if (!f) return NextResponse.json({ xato: 'Fayl topilmadi' }, { status: 404 })
      const sarlavhalar: Record<string, string> = {
        'Content-Type': yozuv.mimeType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, no-store',
        ...(yuklab ? { 'Content-Disposition': `attachment; filename="${nom}"` } : {}),
      }
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') ?? '')
      if (range && (range[1] || range[2])) {
        let dan = range[1] ? Number(range[1]) : Math.max(0, f.hajm - Number(range[2]))
        let gacha = range[1] && range[2] ? Number(range[2]) : f.hajm - 1
        gacha = Math.min(gacha, f.hajm - 1)
        if (dan > gacha || dan >= f.hajm) {
          return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${f.hajm}` } })
        }
        dan = Math.max(0, dan)
        return new Response(Readable.toWeb(f.oqim(dan, gacha) as Readable) as ReadableStream, {
          status: 206,
          headers: { ...sarlavhalar, 'Content-Range': `bytes ${dan}-${gacha}/${f.hajm}`, 'Content-Length': String(gacha - dan + 1) },
        })
      }
      return new Response(Readable.toWeb(f.oqim() as Readable) as ReadableStream, {
        status: 200, headers: { ...sarlavhalar, 'Content-Length': String(f.hajm) },
      })
    }

    return NextResponse.json({ xato: 'Ovoz ombori sozlanmagan' }, { status: 503 })
  } catch (e) {
    console.error('[ovoz yozuv GET]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
