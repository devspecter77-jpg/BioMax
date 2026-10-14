import { NextRequest, NextResponse, after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { koordinataTogrimi } from '@/lib/xarita-havola'
import { IZ_SAQLASH_KUN, izgaYozilsinmi } from '@/lib/lokatsiya-izi'

// Faqat o'zining joylashuvini yozadi — boshqa foydalanuvchiga tegib
// bo'lmaydi, id sessiyadan olinadi, so'rovdan emas.
//
// Joriy joy har so'rovda yangilanadi; yurgan yo'l (`lokatsiya_izlari`) ga esa
// faqat saralangan nuqta qo'shiladi — `lib/lokatsiya-izi.ts`.

/** Muddati o'tgan izlarni tozalash oralig'i (har server nusxasida). */
const TOZALASH_ORALIQ_MS = 6 * 3_600_000
let oxirgiTozalash = 0

function eskiIzlarniTozala(): void {
  const hozir = Date.now()
  if (hozir - oxirgiTozalash < TOZALASH_ORALIQ_MS) return
  oxirgiTozalash = hozir
  after(async () => {
    try {
      await prisma.lokatsiyaIzi.deleteMany({ where: { vaqt: { lt: new Date(hozir - IZ_SAQLASH_KUN * 86_400_000) } } })
    } catch (e) {
      console.error('[lokatsiya izi] tozalanmadi', e)
    }
  })
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    const { lat, lng, aniqlik } = await req.json()
    if (typeof lat !== 'number' || typeof lng !== 'number' || !koordinataTogrimi(lat, lng)) {
      return NextResponse.json({ xato: "Noto'g'ri ma'lumot" }, { status: 400 })
    }
    const aniq = typeof aniqlik === 'number' && Number.isFinite(aniqlik) && aniqlik >= 0 ? Math.round(aniqlik) : null
    const xodimId = session.user.id
    const hozir = new Date()

    const [, oxirgi] = await Promise.all([
      prisma.foydalanuvchi.update({
        where: { id: xodimId },
        data: { lokatsiyaLat: lat, lokatsiyaLng: lng, lokatsiyaYangilangan: hozir },
      }),
      prisma.lokatsiyaIzi.findFirst({
        where: { xodimId },
        orderBy: { vaqt: 'desc' },
        select: { lat: true, lng: true, vaqt: true },
      }),
    ])
    const avvalgi = oxirgi ? { lat: oxirgi.lat, lng: oxirgi.lng, vaqt: oxirgi.vaqt.getTime() } : null
    if (izgaYozilsinmi(avvalgi, { lat, lng, aniqlik: aniq }, hozir.getTime())) {
      await prisma.lokatsiyaIzi.create({ data: { xodimId, lat, lng, aniqlik: aniq, vaqt: hozir } })
    }
    eskiIzlarniTozala()

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
