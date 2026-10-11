import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { amalRuxsatiBormi } from '@/lib/ruxsat-server'
import { xodimlarDoirasi } from '@/lib/xodim-hisob'
import { jonliBolaklar, jonliKuzatuvdami, jonliKuzatuvniBelgila } from '@/lib/smena-server'
import { ALOQA_YOQ_MS, JONLI_BOLAK_MS, yozuvHolatimi } from '@/lib/smena'

// Kuryer smenasini DEYARLI JONLI tinglash.
//
// Bitta so'rov ikki ish qiladi:
//   1) "men tinglayapman" deb belgilaydi — kuryer ilovasi buni keyingi
//      pulsda ko'rib, ovozni qisqa bo'laklarga bo'lib darhol yuboradi;
//   2) `dan` vaqtidan keyin kelgan bo'laklarni qaytaradi — sahifa ularni
//      ketma-ket o'ynatadi.
//
// Ovoz shu bo'laklar sifatida bazada saqlanib qoladi: jonli eshitish uchun
// alohida nusxa yaratilmaydi, tinglanmasa ham yozuv to'xtamaydi.

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    if (!(await amalRuxsatiBormi(session, 'xodimlar.smena'))) {
      return NextResponse.json({ xato: 'Jonli tinglashga ruxsatingiz yo‘q', kod: 'ruxsat_yoq' }, { status: 403 })
    }
    const { id } = await params
    const xodim = await prisma.foydalanuvchi.findFirst({
      where: { AND: [{ id }, xodimlarDoirasi(session)] }, select: { id: true },
    })
    if (!xodim) return NextResponse.json({ xato: 'Xodim topilmadi' }, { status: 404 })

    const sp = req.nextUrl.searchParams
    const smenaId = sp.get('smenaId') ?? ''
    const smena = await prisma.smena.findFirst({
      where: { id: smenaId, xodimId: id },
      select: { id: true, tugadi: true, oxirgiPuls: true, boshlandi: true, yozuvHolati: true, jonliKuzatilgan: true },
    })
    if (!smena) return NextResponse.json({ xato: 'Smena topilmadi' }, { status: 404 })
    if (smena.tugadi) return NextResponse.json({ xato: 'Smena tugagan — jonli tinglab bo‘lmaydi', kod: 'tugagan' }, { status: 409 })

    // Belgi har so'rovda yangilanadi: sahifa yopilsa u eskiradi va kuryer
    // ilovasi o'zi uzun bo'laklarga qaytadi
    await jonliKuzatuvniBelgila(smena.id)

    // `dan` berilmasa — oxirgi bo'lak uzunligicha orqadan boshlaymiz
    const danXom = Number(sp.get('dan'))
    const dan = new Date(Number.isFinite(danXom) && danXom > 0 ? danXom : Date.now() - JONLI_BOLAK_MS * 2)
    const bolaklar = await jonliBolaklar(smena.id, dan)

    const hozir = Date.now()
    const puls = (smena.oxirgiPuls ?? smena.boshlandi).getTime()
    return NextResponse.json({
      bolaklar,
      serverVaqti: hozir,
      /** Ilova tinglayotganimizni bilib, qisqa bo'laklarga o'tganmi */
      tayyor: jonliKuzatuvdami(smena.jonliKuzatilgan, hozir),
      /** Ilova bilan aloqa bormi — yo'q bo'lsa yangi bo'lak kelmaydi */
      aloqa: hozir - puls < ALOQA_YOQ_MS,
      yozuvHolati: yozuvHolatimi(smena.yozuvHolati) ? smena.yozuvHolati : null,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[smena jonli GET]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
