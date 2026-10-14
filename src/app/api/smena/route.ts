import { NextRequest, NextResponse, after } from 'next/server'
import type { Session } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import {
  faolSmena, huquqsizSmenaniYop, jonliKuzatuvdami, pulsYoz, smenaXodimi, smenaniBoshla, smenaniTugat, texnikXizmat,
  xodimSmenaHolati,
} from '@/lib/smena-server'
import { navbatniTurt } from '@/lib/kuryer-navbat'

// Xodimning o'z ish smenasi: holat, rozilik, ishni boshlash/tugallash va
// ilova yuboradigan "tirikman" belgisi. Faqat o'zi uchun — boshqa xodimning
// smenasiga bu yerdan tegib bo'lmaydi (admin amallari /api/xodimlar/:id/smenalar).
//
// Kim yuritadi: kuryer — har doim; boshqa xodimlar — «Ish vaqtida ovoz
// yozish» ruxsati ochiq bo'lsa (`smenaKerakmi`). Ruxsat yopilsa ochiq smena
// Ruxsatlar saqlanganda yoki (ilova eskirgan bo'lsa) shu yerda yopiladi.

export const dynamic = 'force-dynamic'

function texnikni(): void {
  after(() => texnikXizmat().catch(e => console.error('[smena texnik]', e)))
}

/** Huquqi yo'q (yoki hozirgina yopilgan) — ochiq smena qolib ketmasin. */
async function huquqsiz(session: Session): Promise<void> {
  const id = (session.user as { id?: string } | undefined)?.id
  if (id) await huquqsizSmenaniYop(id, { tugatuvchi: 'avtomatik' })
}

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    const xodim = await smenaXodimi(session)
    if (!xodim) {
      await huquqsiz(session)
      return NextResponse.json({ mavjud: false })
    }
    texnikni()
    if (xodim.kuryer) navbatniTurt()
    return NextResponse.json(await xodimSmenaHolati(xodim.id, xodim.ovoz))
  } catch (e) {
    console.error('[smena GET]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    const xodim = await smenaXodimi(session)
    if (!xodim) {
      await huquqsiz(session)
      return NextResponse.json({ xato: 'Ish smenasi va ovoz yozish sizga yopilgan', kod: 'smena_yopiq' }, { status: 403 })
    }

    const data = await req.json().catch(() => ({}))
    const amal = String(data.amal ?? '')

    if (amal === 'rozilik') {
      await prisma.foydalanuvchi.updateMany({
        where: { id: xodim.id, ovozRozilik: null },
        data: { ovozRozilik: new Date() },
      })
      return NextResponse.json(await xodimSmenaHolati(xodim.id, xodim.ovoz))
    }

    if (amal === 'boshlash') {
      // Rozilik faqat ovoz yoziladigan smenaga kerak (ovozsiz kuryerdan so'ralmaydi)
      if (xodim.ovoz) {
        const u = await prisma.foydalanuvchi.findUnique({ where: { id: xodim.id }, select: { ovozRozilik: true } })
        if (!u?.ovozRozilik) {
          return NextResponse.json({ xato: 'Avval ovoz yozilishiga rozilik bering', kod: 'rozilik_kerak' }, { status: 409 })
        }
      }
      await smenaniBoshla(session, xodim.id, {
        lat: data.lat, lng: data.lng, qurilma: req.headers.get('user-agent'), ovoz: xodim.ovoz,
      })
      // Kuryer ishga chiqdi — yig'ilib turgan buyurtmalar kutmasdan taqsimlanadi
      if (xodim.kuryer) navbatniTurt(true)
      return NextResponse.json(await xodimSmenaHolati(xodim.id, xodim.ovoz))
    }

    if (amal === 'tugatish') {
      const s = await faolSmena(xodim.id)
      if (s) await smenaniTugat(s.id, { tugatuvchi: 'xodim', tugatganId: xodim.id, lat: data.lat, lng: data.lng })
      texnikni()
      return NextResponse.json(await xodimSmenaHolati(xodim.id, xodim.ovoz))
    }

    // Yengil tekshiruv: "meni hozir jonli tinglashyaptimi?" va (kuryerga)
    // "menga yangi buyurtma tushdimi?". Ilova buni tez-tez so'raydi, shuning
    // uchun to'liq holat emas — ikkita indeksli so'rov.
    if (amal === 'jonli') {
      const [s, oxirgi] = await Promise.all([
        prisma.smena.findFirst({
          where: { xodimId: xodim.id, tugadi: null },
          select: { jonliKuzatilgan: true },
        }),
        xodim.kuryer
          ? prisma.onlaynYetkazish.findFirst({
            where: { dostavchikId: xodim.id, holati: 'TAYINLANGAN' },
            orderBy: { tayinlangan: 'desc' },
            select: { buyurtmaRaqami: true, tayinlangan: true },
          })
          : null,
      ])
      if (xodim.kuryer) navbatniTurt()
      return NextResponse.json({
        // Ovoz yozilmaydigan smenani tinglab bo'lmaydi — ilova qisqa bo'lakka o'tmaydi
        jonli: xodim.ovoz && jonliKuzatuvdami(s?.jonliKuzatilgan),
        /** Ovoz yozish hozir ochiqmi — Ega yopsa yoki ochsa ilova shundan biladi */
        ovoz: xodim.ovoz,
        /** Eng so'nggi biriktirilgan (hali yo'lga chiqilmagan) buyurtma — ilova yangisini bildiradi */
        oxirgiBuyurtma: oxirgi ? { raqam: oxirgi.buyurtmaRaqami, vaqt: oxirgi.tayinlangan.getTime() } : null,
      })
    }

    if (amal === 'puls') {
      if (xodim.kuryer) navbatniTurt()
      const s = await faolSmena(xodim.id)
      // Ovoz yopilgan bo'lsa ilova holati emas, sabab yoziladi — admin "yozuv to'xtagan" deb adashmasin
      if (s) await pulsYoz(s.id, xodim.ovoz ? data.yozuvHolati : 'ochirilgan')
      return NextResponse.json(await xodimSmenaHolati(xodim.id, xodim.ovoz))
    }

    return NextResponse.json({ xato: 'Noma’lum amal' }, { status: 400 })
  } catch (e) {
    console.error('[smena POST]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
