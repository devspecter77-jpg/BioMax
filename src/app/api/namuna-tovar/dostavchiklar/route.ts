import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { sessionEgaId } from '@/lib/filial-scope'
import { dostavchikniTekshir } from '@/lib/dostavchik'
import { namunaRuxsat } from '@/lib/dostavchik-server'

export const dynamic = 'force-dynamic'

/**
 * Yangi dostavchik: tizimga kiradigan hisob (rol DOSTAVCHIK) va profili —
 * bitta so'rovda. Hisob va profil ichma-ich yaratiladi, ya'ni ikkalasi birga
 * yoziladi yoki hech biri yozilmaydi.
 *
 * Standart holatda dostavchikka faqat "Onlayn buyurtmalar" ochiq
 * (`ruxsat-katalogi.ts`), boshqasini Ega Ruxsatlar bo'limidan beradi.
 */
export async function POST(req: NextRequest) {
  const r = await namunaRuxsat('namuna-tovar.dostavchik')
  if (!r.ok) return r.javob

  let tana: Record<string, unknown>
  try {
    tana = await req.json()
  } catch {
    return NextResponse.json({ xato: "So'rov noto'g'ri" }, { status: 400 })
  }

  const m = dostavchikniTekshir(tana)
  if ('xato' in m) return NextResponse.json({ xato: m.xato }, { status: 400 })

  const login = String(tana.login ?? '').trim()
  const parol = String(tana.parol ?? '')
  if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(login)) {
    return NextResponse.json({ xato: 'Login 3–40 belgi: lotin harflari, raqam, «_», «.» yoki «-»' }, { status: 400 })
  }
  if (parol.length < 6) return NextResponse.json({ xato: 'Parol kamida 6 belgi' }, { status: 400 })

  try {
    const band = await prisma.foydalanuvchi.findUnique({ where: { login }, select: { id: true } })
    if (band) return NextResponse.json({ xato: 'Bu login band — boshqasini tanlang' }, { status: 409 })

    const yangi = await prisma.foydalanuvchi.create({
      data: {
        ism: m.ism,
        login,
        parolHash: await bcrypt.hash(parol, 10),
        rol: 'DOSTAVCHIK',
        telefon: m.telefon,
        filialId: null,
        // Markaziy do'kon katalogini ko'rsin (xodimlar bo'limidagi qoida bilan bir xil)
        ulashilganEgaId: sessionEgaId(r.session),
        dostavchikProfili: {
          create: {
            transportTuri: m.transportTuri,
            transportNomi: m.transportNomi,
            davlatRaqami: m.davlatRaqami,
            qoshimchaTelefonlar: m.qoshimchaTelefonlar,
            izoh: m.izoh,
          },
        },
      },
      select: { id: true, ism: true, login: true },
    })
    return NextResponse.json(yangi, { status: 201 })
  } catch (e) {
    // Parallel ikkinchi so'rov bir xil loginni olgan bo'lsa
    if ((e as { code?: string })?.code === 'P2002') {
      return NextResponse.json({ xato: 'Bu login band — boshqasini tanlang' }, { status: 409 })
    }
    console.error('[namuna-tovar/dostavchiklar POST]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
