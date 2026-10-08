import { NextRequest, NextResponse, after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import {
  faolSmena, kuryerHolati, pulsYoz, smenaXodimi, smenaniBoshla, smenaniTugat, texnikXizmat,
} from '@/lib/smena-server'

// Kuryerning o'z ish smenasi: holat, rozilik, ishni boshlash/tugallash va
// ilova yuboradigan "tirikman" belgisi. Faqat o'zi uchun — boshqa xodimning
// smenasiga bu yerdan tegib bo'lmaydi (admin amallari /api/xodimlar/:id/smenalar).

export const dynamic = 'force-dynamic'

function texnikni(): void {
  after(() => texnikXizmat().catch(e => console.error('[smena texnik]', e)))
}

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    const xodim = smenaXodimi(session)
    if (!xodim) return NextResponse.json({ mavjud: false })
    texnikni()
    return NextResponse.json(await kuryerHolati(xodim.id))
  } catch (e) {
    console.error('[smena GET]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    const xodim = smenaXodimi(session)
    if (!xodim) return NextResponse.json({ xato: 'Ish smenasi faqat kuryerlar uchun' }, { status: 403 })

    const data = await req.json().catch(() => ({}))
    const amal = String(data.amal ?? '')

    if (amal === 'rozilik') {
      await prisma.foydalanuvchi.updateMany({
        where: { id: xodim.id, ovozRozilik: null },
        data: { ovozRozilik: new Date() },
      })
      return NextResponse.json(await kuryerHolati(xodim.id))
    }

    if (amal === 'boshlash') {
      const u = await prisma.foydalanuvchi.findUnique({ where: { id: xodim.id }, select: { ovozRozilik: true } })
      if (!u?.ovozRozilik) {
        return NextResponse.json({ xato: 'Avval ovoz yozilishiga rozilik bering', kod: 'rozilik_kerak' }, { status: 409 })
      }
      await smenaniBoshla(session, xodim.id, {
        lat: data.lat, lng: data.lng, qurilma: req.headers.get('user-agent'),
      })
      return NextResponse.json(await kuryerHolati(xodim.id))
    }

    if (amal === 'tugatish') {
      const s = await faolSmena(xodim.id)
      if (s) await smenaniTugat(s.id, { tugatuvchi: 'xodim', tugatganId: xodim.id, lat: data.lat, lng: data.lng })
      texnikni()
      return NextResponse.json(await kuryerHolati(xodim.id))
    }

    if (amal === 'puls') {
      const s = await faolSmena(xodim.id)
      if (s) await pulsYoz(s.id, data.yozuvHolati)
      return NextResponse.json(await kuryerHolati(xodim.id))
    }

    return NextResponse.json({ xato: 'Noma’lum amal' }, { status: 400 })
  } catch (e) {
    console.error('[smena POST]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
