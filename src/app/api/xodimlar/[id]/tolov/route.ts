import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { sessionFilialId, egaFilialWhere } from '@/lib/filial-scope'
import { tolovniTekshir, TOLOV_MALUMOTI } from '@/lib/xodim-oylik'
import { amalRuxsatiBormi } from '@/lib/ruxsat-server'

// Xodimga to'lov: oylik, bonus, avans yoki jarima.
//
// Pul chiqadigan turlar (oylik/bonus/avans) MAOSH xarajatini ham yaratadi —
// aks holda moliyaviy hisobotlarda oyliklar ko'rinmay qolardi. Ikkalasi
// bitta tranzaksiyada yoziladi: xarajatsiz to'lov yoki to'lovsiz xarajat
// qolib ketmasin.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    const { id } = await params
    if (!(await amalRuxsatiBormi(session, 'xodimlar.oylik'))) {
      return NextResponse.json({ xato: 'Oylik va bonus to‘lashga ruxsatingiz yo‘q', kod: 'ruxsat_yoq' }, { status: 403 })
    }
    // Administrator bo'lmagan xodim o'ziga to'lov yoza olmaydi
    const admin = (session.user as unknown as { rol?: string }).rol === 'ADMIN'
    if (!admin && id === (session.user as unknown as { id: string }).id) {
      return NextResponse.json({ xato: 'O‘zingizga to‘lov yoza olmaysiz', kod: 'ruxsat_yoq' }, { status: 403 })
    }
    const ownFilialId = sessionFilialId(session)

    const xodim = await prisma.foydalanuvchi.findFirst({
      where: { id, ...(ownFilialId ? { filialId: ownFilialId } : {}) },
      select: { id: true, ism: true, filialId: true },
    })
    if (!xodim) return NextResponse.json({ xato: 'Topilmadi' }, { status: 404 })

    const tekshiruv = tolovniTekshir(await req.json())
    if (!tekshiruv.ok) return NextResponse.json({ xato: tekshiruv.xato }, { status: 400 })

    const yaratganId = (session.user as unknown as { id: string }).id
    const xarajatDoira = egaFilialWhere(session)
    const malumot = TOLOV_MALUMOTI[tekshiruv.turi]

    const tolov = await prisma.$transaction(async (tx) => {
      let xarajatId: string | null = null

      if (malumot.xarajatYaratadi) {
        const xarajat = await tx.xarajat.create({
          data: {
            kategoriya: 'MAOSH',
            summa: tekshiruv.summa,
            izoh: `${malumot.label} — ${xodim.ism}${tekshiruv.izoh ? ` (${tekshiruv.izoh})` : ''}`,
            foydalanuvchiId: yaratganId,
            ...xarajatDoira,
          },
          select: { id: true },
        })
        xarajatId = xarajat.id
      }

      return tx.xodimTolov.create({
        data: {
          xodimId: xodim.id,
          turi: tekshiruv.turi,
          summa: tekshiruv.summa,
          davr: tekshiruv.davr,
          izoh: tekshiruv.izoh,
          yaratganId,
          // To'lov xodimning filialiga yoziladi — hisobot shu kesimda
          filialId: xodim.filialId,
          egaId: 'egaId' in xarajatDoira ? xarajatDoira.egaId : null,
          xarajatId,
        },
        select: {
          id: true, turi: true, summa: true, davr: true, izoh: true, sana: true,
          yaratgan: { select: { ism: true } },
        },
      })
    })

    return NextResponse.json({ ...tolov, summa: Number(tolov.summa) }, { status: 201 })
  } catch (e) {
    console.error('[xodim tolov]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

// Xato kiritilgan to'lovni bekor qilish — bog'langan xarajat ham o'chadi.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    const { id } = await params
    if (!(await amalRuxsatiBormi(session, 'xodimlar.oylik'))) {
      return NextResponse.json({ xato: 'Oylik va bonus to‘lashga ruxsatingiz yo‘q', kod: 'ruxsat_yoq' }, { status: 403 })
    }
    if ((session.user as unknown as { rol?: string }).rol !== 'ADMIN' && id === (session.user as unknown as { id: string }).id) {
      return NextResponse.json({ xato: 'O‘z to‘lovingizni o‘chira olmaysiz', kod: 'ruxsat_yoq' }, { status: 403 })
    }
    const tolovId = new URL(req.url).searchParams.get('tolovId')
    if (!tolovId) return NextResponse.json({ xato: 'tolovId kerak' }, { status: 400 })

    const ownFilialId = sessionFilialId(session)
    const tolov = await prisma.xodimTolov.findFirst({
      where: {
        id: tolovId,
        xodimId: id,
        ...(ownFilialId ? { xodim: { filialId: ownFilialId } } : {}),
      },
      select: { id: true, xarajatId: true },
    })
    if (!tolov) return NextResponse.json({ xato: 'Topilmadi' }, { status: 404 })

    await prisma.$transaction(async (tx) => {
      await tx.xodimTolov.delete({ where: { id: tolov.id } })
      // Xarajat FK'si SetNull — to'lov o'chgach uni ham qo'lda olib tashlaymiz
      if (tolov.xarajatId) {
        await tx.xarajat.delete({ where: { id: tolov.xarajatId } }).catch(() => {})
      }
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[xodim tolov DELETE]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
