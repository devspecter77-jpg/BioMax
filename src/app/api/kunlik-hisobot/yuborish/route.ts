import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hisobotSozlamalari, hisobotOluvchilar, kunlikHisobotYubor } from '@/lib/kunlik-hisobot-server'

// "Hozir yuborish" — admin kutmasdan o'ziga hisobot oladi.
// Faqat CHAQIRUVCHINING o'ziga yuboriladi: boshqa adminlarga qo'lda
// xabar yuborish huquqi hech kimda bo'lmasligi kerak (Telegram
// PEER_FLOOD riski va shaxsiy raqamga ruxsatsiz xabar).
export async function POST() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    const u = session.user as unknown as { id: string; rol?: string }
    if (u.rol !== 'ADMIN') {
      return NextResponse.json({ xato: 'Faqat admin yubora oladi' }, { status: 403 })
    }

    const oluvchilar = await hisobotOluvchilar()
    const men = oluvchilar.find(o => o.id === u.id)
    if (!men) {
      return NextResponse.json({ xato: 'Hisobot oluvchilar ro‘yxatida topilmadingiz' }, { status: 404 })
    }
    if (!men.telefon) {
      return NextResponse.json(
        { xato: 'Profilingizda telefon raqam yo‘q — Telegram xabari shu raqamga yuboriladi' },
        { status: 400 },
      )
    }

    const sozlama = await hisobotSozlamalari()
    const natija = await kunlikHisobotYubor(men, sozlama, { majburiy: true })

    if (natija.status !== 'sent') {
      return NextResponse.json({ xato: natija.xato || 'Yuborilmadi' }, { status: 502 })
    }
    return NextResponse.json({ ok: true, oluvchi: natija.oluvchi })
  } catch (e) {
    console.error('[kunlik-hisobot yuborish]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
