import { NextRequest, NextResponse, after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { mpSorov } from '@/lib/marketplace-mijoz'
import { onlaynRuxsat } from '@/lib/onlayn-buyurtma-server'
import { ichkiXabarYubor } from '@/lib/telegram'
import { mijozXabari, type OnlaynBuyurtma, type OnlaynHolat } from '@/lib/onlayn-buyurtma'
import { erpIzi, onlaynSotuvYarat, rezervniBoshat, rezervniUzaytir, rezervQoy } from '@/lib/onlayn-sotuv-server'
import { amalRuxsatiBormi } from '@/lib/ruxsat-server'
import { katalogBoyicha } from '@/lib/ruxsat-katalogi'
import { onlaynHolatUchunKerak, ruxsatYoqXabari } from '@/lib/ruxsat-amallar'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const HOLATLAR = new Set<OnlaynHolat>(['TASDIQLANGAN', 'YIGILMOQDA', 'YOLDA', 'BAJARILGAN', 'BEKOR', 'QAYTARILGAN'])

const xato = (xabar: string, holat = 400, kod?: string) => NextResponse.json({ xato: xabar, kod }, { status: holat })

/**
 * Buyurtma holatini o'zgartirish — ERP'dagi izi bilan birga.
 *
 * Tartib ataylab shunday (sayt va ERP ikki alohida baza, bitta tranzaksiya yo'q):
 *   · TASDIQLANGAN — avval ERP'da zaxira band qilinadi, keyin sayt. Sayt rad
 *     etsa, shu chaqiruvda yaratilgan band bo'shatiladi.
 *   · BAJARILGAN — avval ERP'da sotuv (idempotent), keyin sayt. Sayt javob
 *     bermasa xodim qayta bosadi — ikkinchi sotuv yaratilmaydi.
 *   · BEKOR — avval sayt, keyin band bo'shatiladi.
 * Shunda hech qaysi nosozlikda "saytda topshirildi, ERP'da sotuv yo'q" holati qolmaydi.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ raqam: string }> }) {
  const r = await onlaynRuxsat()
  if (!r.ok) return r.javob

  const raqam = decodeURIComponent((await params).raqam)
  if (!/^MP-\d{4}-\d{5,}$/.test(raqam)) return xato('Buyurtma topilmadi', 404)

  let tana: { holat?: unknown; sabab?: unknown; izoh?: unknown }
  try {
    tana = await req.json()
  } catch {
    return xato("So'rov noto'g'ri")
  }
  const holat = typeof tana.holat === 'string' && HOLATLAR.has(tana.holat as OnlaynHolat) ? (tana.holat as OnlaynHolat) : null
  if (!holat) return xato("Holat noto'g'ri")
  const sabab = typeof tana.sabab === 'string' ? tana.sabab.trim().slice(0, 300) : ''
  if (holat === 'BEKOR' && sabab.length < 3) return xato('Bekor qilish sababini yozing')

  const holatKalit = onlaynHolatUchunKerak(holat)
  if (!(await amalRuxsatiBormi(r.session, holatKalit))) {
    return NextResponse.json(ruxsatYoqXabari(holatKalit, katalogBoyicha.get(holatKalit)?.label ?? holatKalit), { status: 403 })
  }

  const foydalanuvchiId = (r.session.user as { id: string }).id
  const kim = (r.session.user as { name?: string | null })?.name || 'xodim'

  // Joriy holat va tarkib — ERP amallari saytdagi haqiqiy buyurtmaga asoslansin
  const joriy = await mpSorov<OnlaynBuyurtma>('GET', `/api/erp/buyurtmalar/${encodeURIComponent(raqam)}`)
  if (!joriy.ok) return xato(joriy.xato, joriy.holat >= 500 ? 502 : joriy.holat, joriy.kod)
  const b = joriy.qiymat
  if (!b.keyingiHolatlar?.includes(holat)) {
    return xato(`Buyurtma hozir «${b.holatYorligi}» holatida — bu amal mumkin emas. Sahifani yangilang.`, 409, 'holat_mos_emas')
  }

  let yangiRezerv = false
  let sotuvMatni: string | null = null

  if (holat === 'TASDIQLANGAN') {
    const z = await rezervQoy(b, foydalanuvchiId)
    if (!z.ok) return xato(z.xato, 409, 'zaxira_yetmadi')
    yangiRezerv = z.qiymat.yangi
  } else if (holat === 'BAJARILGAN') {
    const s = await onlaynSotuvYarat(b, r.session)
    if (!s.ok) return xato(s.xato, 409, 'sotuv_yaratilmadi')
    sotuvMatni = s.qiymat.chekRaqami
  }

  const n = await mpSorov<OnlaynBuyurtma>('POST', `/api/erp/buyurtmalar/${encodeURIComponent(raqam)}/holat`, {
    holat, kim, sabab: sabab || undefined, izoh: typeof tana.izoh === 'string' ? tana.izoh.slice(0, 300) : undefined,
  })
  if (!n.ok) {
    if (yangiRezerv) await rezervniBoshat(raqam)
    const qoshimcha = holat === 'BAJARILGAN' && sotuvMatni
      ? ` ERP’da sotuv yaratildi (${sotuvMatni}) — tugmani qayta bosing, ikkinchi sotuv yaratilmaydi.`
      : ''
    return xato(n.xato + qoshimcha, n.holat >= 500 ? 502 : n.holat, n.kod)
  }

  if (holat === 'BEKOR') await rezervniBoshat(raqam)
  if (holat === 'YIGILMOQDA' || holat === 'YOLDA') await rezervniUzaytir(raqam)

  const yangi = n.qiymat
  // Mahalliy rivojlanishda jonli Telegram sessiyasiga ulanilmaydi: bir sessiya
  // ikki joydan ishlatilsa Telegram serverdagisini bekor qilishi mumkin.
  const xabarYuborilsin = process.env.NODE_ENV === 'production' || process.env.ONLAYN_TELEGRAM_DEV === 'true'
  if (xabarYuborilsin) {
    after(async () => {
      try {
        const soz = await prisma.sozlama.findMany({ where: { kalit: { in: ['dokon_nomi', 'manzil'] } } })
        const q = (k: string) => soz.find(x => x.kalit === k)?.qiymat?.trim() || null
        const matn = mijozXabari(yangi, holat, {
          dokon: q('dokon_nomi') || 'BioMax',
          dokonManzili: q('manzil'),
          saytUrl: process.env.MARKETPLACE_OMMAVIY_URL || null,
        })
        if (!matn) return
        const x = await ichkiXabarYubor(yangi.aloqaTel, matn)
        if (!x.ok) console.warn(`[onlayn] ${yangi.raqam} ${holat} — mijozga xabar ketmadi: ${x.xato}`)
      } catch (e) {
        console.error('[onlayn] xabar yuborish xatosi', e)
      }
    })
  }

  return NextResponse.json({ ...yangi, erp: await erpIzi(raqam), xabarYuboriladi: xabarYuborilsin })
}
