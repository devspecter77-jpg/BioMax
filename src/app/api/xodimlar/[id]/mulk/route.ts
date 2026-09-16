import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sessionEgaId } from '@/lib/filial-scope'
import { amalRuxsatiBormi } from '@/lib/ruxsat-server'
import { MULK_SELECT, mulkniTekisla, oziniOzgartiryaptimi, xodimKontekst } from '@/lib/xodim-server'
import { mulkniTekshir, type MulkKiritmasi } from '@/lib/xodim-mulk'

export const dynamic = 'force-dynamic'

// Xodimga biriktirilgan mulk: ro'yxat (qo'lidagilari tepada) va yangi biriktirish.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const r = await xodimKontekst(id, 'xodimlar')
    if (!r.ok) return r.javob

    const mulklar = await prisma.xodimMulki.findMany({
      where: { xodimId: id },
      select: MULK_SELECT,
      orderBy: [{ berilganSana: 'desc' }],
    })
    const tekis = mulklar.map(mulkniTekisla)
    const qolida = tekis.filter(m => m.holati === 'BERILGAN')

    return NextResponse.json({
      mulklar: [...qolida, ...tekis.filter(m => m.holati !== 'BERILGAN')],
      xulosa: {
        qolidagiSoni: qolida.length,
        qolidagiQiymati: qolida.reduce((s, m) => s + (m.qiymati ?? 0), 0),
        tarixSoni: tekis.length - qolida.length,
      },
      boshqaraOladi: (await amalRuxsatiBormi(r.k.session, 'xodimlar.mulk')) && (r.k.admin || id !== r.k.meId),
    })
  } catch (e) {
    console.error('[xodim mulk GET]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const r = await xodimKontekst(id, 'xodimlar.mulk')
    if (!r.ok) return r.javob
    const oz = oziniOzgartiryaptimi(r.k)
    if (oz) return oz
    if (!r.k.xodim.faol) return NextResponse.json({ xato: 'Nofaol xodimga mulk biriktirib bo‘lmaydi' }, { status: 400 })

    const tana = await req.json().catch(() => null)
    if (!tana || typeof tana !== 'object') return NextResponse.json({ xato: "So'rov noto'g'ri" }, { status: 400 })
    const t = mulkniTekshir(tana)
    if ('xato' in t) return NextResponse.json({ xato: t.xato }, { status: 400 })
    const q = t.qiymat as MulkKiritmasi

    const mulk = await prisma.xodimMulki.create({
      data: {
        xodimId: id,
        turi: q.turi, nomi: q.nomi, raqami: q.raqami, qiymati: q.qiymati,
        berilganSana: q.berilganSana ?? new Date(),
        berilganHolat: q.berilganHolat, izoh: q.izoh,
        yaratganId: r.k.meId,
        filialId: r.k.xodim.filialId,
        egaId: r.k.xodim.filialId ? null : sessionEgaId(r.k.session),
      },
      // Faqat id — bog'langan maydonlar bilan qaytarish Prisma'da yashirin tranzaksiya
      // ochadi va ulanish uzilganda yozuv tushib, javob 500 bo'lib qolardi
      select: { id: true },
    })
    const toliq = await prisma.xodimMulki.findUnique({ where: { id: mulk.id }, select: MULK_SELECT })
    return NextResponse.json(toliq ? mulkniTekisla(toliq) : { id: mulk.id }, { status: 201 })
  } catch (e) {
    console.error('[xodim mulk POST]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
