import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sessionEgaId } from '@/lib/filial-scope'
import { MULK_SELECT, mulkniTekisla, oziniOzgartiryaptimi, xodimDoirasi, xodimKontekst } from '@/lib/xodim-server'
import { mulkniTekshir, sananiOqi, yakunAmalimi, yakunlashMumkinmi } from '@/lib/xodim-mulk'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string; mulkId: string }> }

const xato = (xabar: string, holat = 400) => NextResponse.json({ xato: xabar }, { status: holat })

/**
 * Mulkni o'zgartirish.
 *
 *   { amal: 'QAYTARISH', sana?, izoh? }             — qaytarib olindi (izoh: qanday holatda)
 *   { amal: 'YOQOLGAN',  sana?, izoh }              — yo'qolgan yoki buzilgan
 *   { amal: 'OTKAZISH',  yangiXodimId, sana?, izoh? } — boshqa xodimga o'tkazish
 *   { nomi?, turi?, raqami?, qiymati?, berilganSana?, berilganHolat?, izoh? } — ma'lumotni tuzatish
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id, mulkId } = await params
    const r = await xodimKontekst(id, 'xodimlar.mulk')
    if (!r.ok) return r.javob
    const oz = oziniOzgartiryaptimi(r.k)
    if (oz) return oz

    const mulk = await prisma.xodimMulki.findFirst({ where: { id: mulkId, xodimId: id } })
    if (!mulk) return xato('Mulk topilmadi', 404)

    const tana = await req.json().catch(() => null) as Record<string, unknown> | null
    if (!tana || typeof tana !== 'object') return xato("So'rov noto'g'ri")

    if (tana.amal !== undefined) {
      if (!yakunAmalimi(tana.amal)) return xato("Amal noto'g'ri")
      if (!yakunlashMumkinmi(mulk.holati)) return xato('Bu mulk allaqachon xodim qo‘lida emas', 409)
      const sana = sananiOqi(tana.sana)
      if (sana === 'xato') return xato('Sana noto‘g‘ri (kelajak sana bo‘lmaydi)')
      const yakunSana = sana ?? new Date()
      if (yakunSana.getTime() < mulk.berilganSana.getTime() - 86_400_000) return xato('Sana berilgan sanadan oldin bo‘lishi mumkin emas')
      const izoh = typeof tana.izoh === 'string' ? tana.izoh.trim().slice(0, 300) : ''

      if (tana.amal === 'YOQOLGAN' && izoh.length < 3) return xato('Nima bo‘lganini yozing (yo‘qolgan, buzilgan, sababi)')

      if (tana.amal !== 'OTKAZISH') {
        // Shartli yangilash: ikki kishi bir vaqtda bosganda bittasi o'tadi
        const n = await prisma.xodimMulki.updateMany({
          where: { id: mulkId, holati: 'BERILGAN' },
          data: {
            holati: tana.amal === 'QAYTARISH' ? 'QAYTARILGAN' : 'YOQOLGAN',
            yakunSana, yakunIzoh: izoh || null, yakunlaganId: r.k.meId,
          },
        })
        if (n.count === 0) return xato('Bu mulk allaqachon yopilgan — sahifani yangilang', 409)
        const yangi = await prisma.xodimMulki.findUnique({ where: { id: mulkId }, select: MULK_SELECT })
        return NextResponse.json({ mulk: yangi ? mulkniTekisla(yangi) : null })
      }

      // ── Boshqa xodimga o'tkazish ──
      const yangiXodimId = typeof tana.yangiXodimId === 'string' ? tana.yangiXodimId : ''
      if (!yangiXodimId || yangiXodimId === id) return xato('Qaysi xodimga o‘tkazilishini tanlang')
      const oz2 = oziniOzgartiryaptimi(r.k, yangiXodimId)
      if (oz2) return oz2
      const yangiXodim = await prisma.foydalanuvchi.findFirst({
        where: { id: yangiXodimId, ...xodimDoirasi(r.k.session) },
        select: { id: true, ism: true, faol: true, filialId: true },
      })
      if (!yangiXodim) return xato('Xodim topilmadi', 404)
      if (!yangiXodim.faol) return xato('Nofaol xodimga o‘tkazib bo‘lmaydi')

      const natija = await prisma.$transaction(async tx => {
        const n = await tx.xodimMulki.updateMany({
          where: { id: mulkId, holati: 'BERILGAN' },
          data: {
            holati: 'OTKAZILGAN', yakunSana, yakunlaganId: r.k.meId,
            yakunIzoh: `${yangiXodim.ism} ga o‘tkazildi${izoh ? ` — ${izoh}` : ''}`,
          },
        })
        if (n.count === 0) return null
        return tx.xodimMulki.create({
          data: {
            xodimId: yangiXodim.id,
            turi: mulk.turi, nomi: mulk.nomi, raqami: mulk.raqami, qiymati: mulk.qiymati,
            berilganSana: yakunSana,
            berilganHolat: izoh || mulk.berilganHolat,
            izoh: `${r.k.xodim.ism} dan o‘tkazildi${mulk.izoh ? ` · ${mulk.izoh}` : ''}`.slice(0, 500),
            yaratganId: r.k.meId,
            filialId: yangiXodim.filialId,
            egaId: yangiXodim.filialId ? null : sessionEgaId(r.k.session),
          },
          select: { id: true },
        })
      })
      if (!natija) return xato('Bu mulk allaqachon yopilgan — sahifani yangilang', 409)
      const yangiYozuv = await prisma.xodimMulki.findUnique({ where: { id: natija.id }, select: MULK_SELECT })
      return NextResponse.json({ mulk: null, otkazildi: yangiYozuv ? mulkniTekisla(yangiYozuv) : null, kimga: yangiXodim.ism })
    }

    // ── Ma'lumotni tuzatish ──
    const t = mulkniTekshir(tana, true)
    if ('xato' in t) return xato(t.xato)
    const { berilganSana, ...qolgan } = t.qiymat
    await prisma.xodimMulki.update({
      where: { id: mulkId },
      data: { ...qolgan, ...(berilganSana ? { berilganSana } : {}) },
      select: { id: true },
    })
    const yangilangan = await prisma.xodimMulki.findUnique({ where: { id: mulkId }, select: MULK_SELECT })
    return NextResponse.json({ mulk: yangilangan ? mulkniTekisla(yangilangan) : null })
  } catch (e) {
    console.error('[xodim mulk PATCH]', e)
    return xato('Server xatosi', 500)
  }
}

// Xato kiritilgan yozuvni o'chirish. Qaytarilgan yoki yo'qolgan mulk uchun
// o'chirish emas — PATCH amallari ishlatiladi, shunda tarix saqlanadi.
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id, mulkId } = await params
    const r = await xodimKontekst(id, 'xodimlar.mulk')
    if (!r.ok) return r.javob
    const oz = oziniOzgartiryaptimi(r.k)
    if (oz) return oz
    const n = await prisma.xodimMulki.deleteMany({ where: { id: mulkId, xodimId: id } })
    if (n.count === 0) return xato('Mulk topilmadi', 404)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[xodim mulk DELETE]', e)
    return xato('Server xatosi', 500)
  }
}
