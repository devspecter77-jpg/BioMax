import { NextRequest, NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { amalRuxsatiBormi } from '@/lib/ruxsat-server'
import { xodimlarDoirasi } from '@/lib/xodim-hisob'
import { omborTuri, omborYetishmaydi } from '@/lib/ovoz-ombor'
import { saqlashKuni, smenalarXulosasi, smenaniOchir, smenaniTugat } from '@/lib/smena-server'
import { kunBoshi, toshkentKuni } from '@/lib/smena'

// Xodimning ish smenalari va ovoz yozuvlari (Xodimlar → "Ish va ovozlar").
// Ruxsat: `xodimlar.smena`. Yozuvlarni o'chirish — faqat administrator.

export const dynamic = 'force-dynamic'

async function kirish(session: Session | null, id: string) {
  if (!session) return { javob: NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 }) }
  if (!(await amalRuxsatiBormi(session, 'xodimlar.smena'))) {
    return { javob: NextResponse.json({ xato: 'Smena va ovozlarni ko‘rishga ruxsatingiz yo‘q', kod: 'ruxsat_yoq' }, { status: 403 }) }
  }
  const xodim = await prisma.foydalanuvchi.findFirst({
    where: { AND: [{ id }, xodimlarDoirasi(session)] },
    select: { id: true, ism: true, rol: true },
  })
  if (!xodim) return { javob: NextResponse.json({ xato: 'Xodim topilmadi' }, { status: 404 }) }
  return { xodim }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const { id } = await params
    const k = await kirish(session, id)
    if (!k.xodim) return k.javob

    const kunlar = Math.min(90, Math.max(1, Number(new URL(req.url).searchParams.get('kunlar')) || 14))
    const dan = kunBoshi(toshkentKuni(Date.now() - (kunlar - 1) * 86_400_000))
    const [smenalar, kun] = await Promise.all([
      smenalarXulosasi(id, dan, { yozuvlarBilan: true }),
      saqlashKuni(),
    ])
    return NextResponse.json({
      xodim: k.xodim,
      smenalar,
      kunlar,
      saqlashKun: kun,
      omborTuri: omborTuri(),
      omborYetishmaydi: omborTuri() ? [] : omborYetishmaydi(),
      adminmi: (session!.user as { rol?: string }).rol === 'ADMIN',
    })
  } catch (e) {
    console.error('[xodim smenalar GET]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

// Kuryer tugatishni unutgan smenani administrator yopadi
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const { id } = await params
    const k = await kirish(session, id)
    if (!k.xodim) return k.javob

    const data = await req.json().catch(() => ({}))
    if (data.amal !== 'tugatish') return NextResponse.json({ xato: 'Noma’lum amal' }, { status: 400 })
    const smena = await prisma.smena.findFirst({ where: { id: String(data.smenaId ?? ''), xodimId: id } })
    if (!smena) return NextResponse.json({ xato: 'Smena topilmadi' }, { status: 404 })
    if (smena.tugadi) return NextResponse.json({ ok: true, allaqachon: true })
    await smenaniTugat(smena.id, {
      tugatuvchi: 'admin', tugatganId: (session!.user as { id: string }).id,
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[xodim smenalar POST]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

// Smenaning ovoz yozuvlarini o'chirish — faqat administrator va faqat yopilgan smena
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const { id } = await params
    const k = await kirish(session, id)
    if (!k.xodim) return k.javob
    if ((session!.user as { rol?: string }).rol !== 'ADMIN') {
      return NextResponse.json({ xato: 'Yozuvlarni faqat administrator o‘chiradi', kod: 'ruxsat_yoq' }, { status: 403 })
    }
    const smenaId = new URL(req.url).searchParams.get('smenaId') ?? ''
    const smena = await prisma.smena.findFirst({ where: { id: smenaId, xodimId: id }, select: { id: true, tugadi: true } })
    if (!smena) return NextResponse.json({ xato: 'Smena topilmadi' }, { status: 404 })
    if (!smena.tugadi) {
      return NextResponse.json({ xato: 'Ochiq smenani o‘chirib bo‘lmaydi — avval yakunlang' }, { status: 409 })
    }
    const soni = await smenaniOchir(smena.id)
    return NextResponse.json({ ok: true, ochirildi: soni })
  } catch (e) {
    console.error('[xodim smenalar DELETE]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
