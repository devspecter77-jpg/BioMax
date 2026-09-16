import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { imzoniTekshir } from '@/lib/marketplace-imzo'
import { kirishKodiYubor } from '@/lib/telegram'

// MARKETPLACE SHARTNOMASI — ro'yxatdan o'tish / kirish kodini yetkazish.
//
// Kod mijozning Telegram profiliga do'konning mijozlarga chek va eslatma
// yuboradigan akkaunti orqali boradi. Kodning o'zi marketplace'da
// yaratiladi va xeshlanadi — ERP uni faqat yetkazadi, hech qayerda saqlamaydi
// (jurnalga ham yozilmaydi).

export const dynamic = 'force-dynamic'
// Telegram'da raqamni topish + 3s tezlik chegarasi — javob 10 soniyagacha cho'zilishi mumkin
export const maxDuration = 30

const XATO_MATNI = {
  topilmadi: 'Bu raqamda Telegram topilmadi. Telegram ochilgan raqamni kiriting.',
  vaqtincha: 'Kod hozir yuborilmadi. Bir necha daqiqadan so‘ng qayta urinib ko‘ring.',
  ulanmagan: 'Kod yuborish xizmati vaqtincha ishlamayapti. Do‘kon bilan bog‘laning.',
  ochirilgan: 'Kod yuborish xizmati vaqtincha ishlamayapti. Do‘kon bilan bog‘laning.',
  boshqa: 'Kod yuborilmadi. Birozdan so‘ng qayta urinib ko‘ring.',
} as const

function javob(holat: number, tana: Record<string, unknown>) {
  return NextResponse.json(tana, { status: holat, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const xom = await req.text()
  const tekshiruv = imzoniTekshir(req, xom)
  if (!tekshiruv.ok) {
    console.warn('[mp/kod-yubor] imzo rad etildi:', tekshiruv.sabab)
    return javob(tekshiruv.holat, { kod: tekshiruv.sabab, xato: 'Ruxsat yo‘q' })
  }

  let tana: { telefon?: unknown; kod?: unknown }
  try {
    tana = JSON.parse(xom)
  } catch {
    return javob(400, { kod: 'notogri_sorov', xato: 'So‘rov noto‘g‘ri' })
  }
  const telefon = typeof tana.telefon === 'string' && /^\+998\d{9}$/.test(tana.telefon) ? tana.telefon : null
  const kod = typeof tana.kod === 'string' && /^\d{6}$/.test(tana.kod) ? tana.kod : null
  if (!telefon || !kod) return javob(400, { kod: 'notogri_sorov', xato: 'So‘rov noto‘g‘ri' })

  // Mahalliy rivojlanishda jonli Telegram sessiyasiga ulanilmaydi: bir sessiya
  // ikki joydan ishlatilsa Telegram serverdagisini bekor qilishi mumkin va
  // do'kon mijozlariga cheklar ham to'xtaydi.
  if (process.env.NODE_ENV !== 'production' && process.env.ONLAYN_TELEGRAM_DEV !== 'true') {
    return javob(422, { kod: 'telegram_ulanmagan', xato: 'Mahalliy rivojlanishda kod Telegram’ga yuborilmaydi (KOD_KANALI=konsol ishlating).' })
  }

  const dokon = (await prisma.sozlama.findUnique({ where: { kalit: 'dokon_nomi' } }))?.qiymat?.trim() || 'BioMax'
  const matn =
    `🔐 ${dokon} onlayn do‘koni\n\n` +
    `Tasdiqlash kodi: ${kod}\n\n` +
    `Kod 5 daqiqa amal qiladi. Uni hech kimga bermang — xodimlarimiz kodni hech qachon so‘ramaydi.\n` +
    `Agar siz so‘ramagan bo‘lsangiz, bu xabarni e’tiborsiz qoldiring.`

  const n = await kirishKodiYubor(telefon, matn)
  if (n.ok) return javob(200, { ok: true })

  // Raqam jurnalga niqoblangan holda yoziladi, kod umuman yozilmaydi
  console.warn(`[mp/kod-yubor] ${telefon.slice(0, 6)}***${telefon.slice(-2)} — ${n.sabab}: ${n.xato}`)
  // 422 — marketplace buni domen xatosi sifatida o'qiydi va qayta urinmaydi
  return javob(422, { kod: `telegram_${n.sabab}`, xato: XATO_MATNI[n.sabab] })
}
