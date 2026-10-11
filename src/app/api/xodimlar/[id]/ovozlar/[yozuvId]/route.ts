import { NextRequest, NextResponse } from 'next/server'
import { Readable } from 'node:stream'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { amalRuxsatiBormi } from '@/lib/ruxsat-server'
import { xodimlarDoirasi } from '@/lib/xodim-hisob'
import { imzolanganHavola, lokalFayl, s3Bormi } from '@/lib/ovoz-ombor'
import { bazadanOqi } from '@/lib/ovoz-baza'
import { kengaytma, soatMatni, toshkentKuni } from '@/lib/smena'

// Bitta ovoz bo'lagini tinglash yoki yuklab olish.
//
// Har yozuv O'Z omboridan o'qiladi (`OvozYozuv.ombor`): ombor keyinroq
// almashtirilsa ham eski yozuvlar tinglanaveradi.
//   · baza  — shu yerdan uzatiladi; oldinga/orqaga surish uchun Range
//             qo'llanadi va kerakli qism bazaning o'zida kesiladi
//   · s3    — ruxsat tekshirilgach 10 daqiqalik imzolangan havolaga
//             yo'naltiriladi (audio to'g'ridan-to'g'ri ombordan oqadi)
//   · lokal — rivojlanishdagi papkadan, Range bilan
// Fayl manzili brauzerga hech qachon doimiy berilmaydi.

export const dynamic = 'force-dynamic'

function faylNomi(ism: string, boshlandi: Date, mimeType: string): string {
  const lotin = ism.normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'xodim'
  return `${lotin}_${toshkentKuni(boshlandi)}_${soatMatni(boshlandi).replace(':', '-')}.${kengaytma(mimeType)}`
}

/** `Range: bytes=…` sarlavhasi. `null` — butun fayl; `'xato'` — 416. */
function oraliqOqi(sarlavha: string | null, hajm: number): { dan: number; gacha: number } | 'xato' | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(sarlavha ?? '')
  if (!m || (!m[1] && !m[2])) return null
  const dan = m[1] ? Number(m[1]) : Math.max(0, hajm - Number(m[2]))
  const gacha = Math.min(m[1] && m[2] ? Number(m[2]) : hajm - 1, hajm - 1)
  if (dan > gacha || dan >= hajm) return 'xato'
  return { dan: Math.max(0, dan), gacha }
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
      select: { kalit: true, mimeType: true, boshlandi: true, hajm: true, ombor: true },
    })
    if (!yozuv) return NextResponse.json({ xato: 'Yozuv topilmadi (saqlash muddati o‘tgan bo‘lishi mumkin)' }, { status: 404 })

    const yuklab = new URL(req.url).searchParams.get('yuklab') === '1'
    const nom = faylNomi(xodim.ism, yozuv.boshlandi, yozuv.mimeType)
    const sarlavhalar: Record<string, string> = {
      'Content-Type': yozuv.mimeType,
      'Accept-Ranges': 'bytes',
      ...(yuklab ? { 'Content-Disposition': `attachment; filename="${nom}"` } : {}),
    }

    if (yozuv.ombor === 's3') {
      if (!s3Bormi()) return NextResponse.json({ xato: 'Bu yozuv bulut omborida, u esa endi ulanmagan' }, { status: 503 })
      const havola = await imzolanganHavola(yozuv.kalit, {
        sekund: 600, mimeType: yozuv.mimeType, ...(yuklab ? { yuklabOlish: nom } : {}),
      })
      return NextResponse.redirect(havola, { status: 302, headers: { 'Cache-Control': 'private, no-store' } })
    }

    if (yozuv.ombor === 'baza') {
      const oraliq = oraliqOqi(req.headers.get('range'), yozuv.hajm)
      if (oraliq === 'xato') {
        return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${yozuv.hajm}` } })
      }
      const f = await bazadanOqi(yozuvId, oraliq ?? undefined)
      if (!f) return NextResponse.json({ xato: 'Fayl topilmadi' }, { status: 404 })
      // Yozuv o'zgarmaydi: pleer oldinga/orqaga surganda bazadan qayta o'qilmasin
      const kesh = { 'Cache-Control': 'private, max-age=3600', ETag: `"${yozuvId}"` }
      if (oraliq) {
        return new Response(f.data, {
          status: 206,
          headers: {
            ...sarlavhalar, ...kesh,
            'Content-Range': `bytes ${oraliq.dan}-${oraliq.dan + f.data.byteLength - 1}/${f.jami}`,
            'Content-Length': String(f.data.byteLength),
          },
        })
      }
      return new Response(f.data, {
        status: 200,
        headers: { ...sarlavhalar, ...kesh, 'Content-Length': String(f.data.byteLength) },
      })
    }

    // lokal
    const f = await lokalFayl(yozuv.kalit).catch(() => null)
    if (!f) return NextResponse.json({ xato: 'Fayl topilmadi' }, { status: 404 })
    const lokalSarlavha = { ...sarlavhalar, 'Cache-Control': 'private, no-store' }
    const oraliq = oraliqOqi(req.headers.get('range'), f.hajm)
    if (oraliq === 'xato') {
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${f.hajm}` } })
    }
    if (oraliq) {
      return new Response(Readable.toWeb(f.oqim(oraliq.dan, oraliq.gacha) as Readable) as ReadableStream, {
        status: 206,
        headers: {
          ...lokalSarlavha,
          'Content-Range': `bytes ${oraliq.dan}-${oraliq.gacha}/${f.hajm}`,
          'Content-Length': String(oraliq.gacha - oraliq.dan + 1),
        },
      })
    }
    return new Response(Readable.toWeb(f.oqim() as Readable) as ReadableStream, {
      status: 200, headers: { ...lokalSarlavha, 'Content-Length': String(f.hajm) },
    })
  } catch (e) {
    console.error('[ovoz yozuv GET]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
