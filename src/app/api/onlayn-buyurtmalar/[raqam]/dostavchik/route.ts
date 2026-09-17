import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { mpSorov } from '@/lib/marketplace-mijoz'
import { onlaynRuxsat } from '@/lib/onlayn-buyurtma-server'
import { FAOL_HOLATLAR, type OnlaynBuyurtma } from '@/lib/onlayn-buyurtma'
import { DOSTAVCHIK_DOIRASI, buyurtmaDostavchiklari } from '@/lib/dostavchik-server'

export const dynamic = 'force-dynamic'

const xato = (xabar: string, holat = 400) => NextResponse.json({ xato: xabar }, { status: holat })

/**
 * Buyurtmaga dostavchik biriktirish, almashtirish yoki olib tashlash.
 * Tana: `{ dostavchikId: string | null }`.
 *
 * Mijoz ismi, telefoni, manzili va summasi shu paytda nusxa qilinadi —
 * dostavchik paneli marketplace'ga har safar murojaat qilmasin. Buyurtma
 * allaqachon "yo'lda" bo'lsa, yangi dostavchik ham darhol "yo'lda" hisoblanadi.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ raqam: string }> }) {
  const r = await onlaynRuxsat('onlayn-buyurtmalar.kuryer')
  if (!r.ok) return r.javob

  const raqam = decodeURIComponent((await params).raqam)
  if (!/^MP-\d{4}-\d{5,}$/.test(raqam)) return xato('Buyurtma topilmadi', 404)

  let dostavchikId: string | null
  try {
    const tana = await req.json()
    if (tana?.dostavchikId !== null && typeof tana?.dostavchikId !== 'string') return xato("So'rov noto'g'ri")
    dostavchikId = tana.dostavchikId
  } catch {
    return xato("So'rov noto'g'ri")
  }

  const joriy = await mpSorov<OnlaynBuyurtma>('GET', `/api/erp/buyurtmalar/${encodeURIComponent(raqam)}`)
  if (!joriy.ok) return NextResponse.json({ xato: joriy.xato, kod: joriy.kod }, { status: joriy.holat >= 500 ? 502 : joriy.holat })
  const b = joriy.qiymat
  if (b.yetkazish !== 'KURYER') return xato('Mijoz o‘zi olib ketadigan buyurtmaga dostavchik biriktirilmaydi', 409)
  if (!FAOL_HOLATLAR.includes(b.holati)) return xato(`Buyurtma «${b.holatYorligi}» — dostavchikni o‘zgartirib bo‘lmaydi`, 409)

  try {
    const mavjud = await prisma.onlaynYetkazish.findUnique({
      where: { buyurtmaRaqami: raqam },
      select: { dostavchikId: true, holati: true },
    })

    if (dostavchikId === null) {
      if (mavjud) await prisma.onlaynYetkazish.delete({ where: { buyurtmaRaqami: raqam } })
      return NextResponse.json({ dostavchik: null })
    }

    const dostavchik = await prisma.foydalanuvchi.findFirst({
      where: { id: dostavchikId, ...DOSTAVCHIK_DOIRASI },
      select: { id: true, faol: true },
    })
    if (!dostavchik) return xato('Dostavchik topilmadi', 404)
    if (!dostavchik.faol) return xato('Bu dostavchik faol emas', 409)

    const nusxa = {
      aloqaIsm: b.aloqaIsm,
      aloqaTel: b.aloqaTel,
      manzilMatni: [b.hudud, b.manzilMatni].filter(Boolean).join(', ') || null,
      lat: b.lat,
      lng: b.lng,
      jamiSumma: b.jamiSumma,
    }

    if (mavjud?.dostavchikId === dostavchikId) {
      // O'sha dostavchik — vaqtlar saqlanadi, faqat nusxa yangilanadi
      await prisma.onlaynYetkazish.update({ where: { buyurtmaRaqami: raqam }, data: nusxa })
    } else {
      const yolda = b.holati === 'YOLDA'
      const hozir = new Date()
      const bosqich = {
        dostavchikId,
        holati: yolda ? ('YOLDA' as const) : ('TAYINLANGAN' as const),
        tayinlaganId: (r.session.user as unknown as { id: string }).id,
        tayinlangan: hozir,
        yolgaChiqdi: yolda ? hozir : null,
        yetibKeldi: null,
        topshirildi: null,
      }
      await prisma.onlaynYetkazish.upsert({
        where: { buyurtmaRaqami: raqam },
        create: { buyurtmaRaqami: raqam, ...nusxa, ...bosqich },
        update: { ...nusxa, ...bosqich },
      })
    }

    return NextResponse.json({ dostavchik: (await buyurtmaDostavchiklari([raqam])).get(raqam) ?? null })
  } catch (e) {
    console.error('[onlayn-buyurtmalar/dostavchik]', e)
    return xato('Server xatosi', 500)
  }
}
