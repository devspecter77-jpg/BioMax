import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { egaFilialWhere } from '@/lib/filial-scope'
import { xaritaRuxsati } from '@/lib/xarita-server'

// Xarita bo'limi ma'lumotlari: filiallar, xodimlar, mijozlar va
// TA'MINOTCHILARNING joylashuvi. Sahifa ularni alohida ko'rinishlarga
// ajratadi, shuning uchun hammasi bitta so'rovda qaytariladi.
// Faqat bosh Ega ko'radi — /api/filiallar dagi bilan bir xil tekshiruv.
// Yo'ldagi kuryerlar alohida va tezroq: /api/xarita/yetkazishlar.

export async function GET() {
  try {
    const r = await xaritaRuxsati()
    if (!r.ok) return r.javob
    const session = r.session

    const [filiallar, xodimlar, mijozlar, taminotchilar] = await Promise.all([
      prisma.filial.findMany({
        select: {
          id: true, nomi: true, manzil: true, telefon: true, faol: true,
          lokatsiyaLat: true, lokatsiyaLng: true,
          _count: { select: { xodimlar: true } },
        },
        orderBy: { yaratilgan: 'asc' },
      }),
      prisma.foydalanuvchi.findMany({
        // Joylashuvi umuman yozilmagan xodimni xaritaga chiqarib bo'lmaydi
        where: { lokatsiyaLat: { not: null }, lokatsiyaLng: { not: null } },
        select: {
          id: true, ism: true, rol: true, telefon: true, faol: true,
          lokatsiyaLat: true, lokatsiyaLng: true, lokatsiyaYangilangan: true,
          filial: { select: { id: true, nomi: true } },
        },
        orderBy: { lokatsiyaYangilangan: 'desc' },
      }),
      // Mijozlar — GPS joylashuvi saqlangani. Ular xaritada ALOHIDA
      // rangda ko'rsatiladi: do'kon egasi mijozlar qayerda joylashganini
      // ko'rib, yetkazib berish yo'nalishini rejalashtira oladi.
      prisma.mijoz.findMany({
        where: {
          lokatsiyaLat: { not: null },
          lokatsiyaLng: { not: null },
          ...egaFilialWhere(session),
        },
        select: {
          id: true, ism: true, telefon: true, manzil: true,
          viloyat: true, tuman: true,
          lokatsiyaLat: true, lokatsiyaLng: true,
        },
        orderBy: { ism: 'asc' },
      }),
      // Ta'minotchilar — koordinatasi belgilangani. Yetkazib beruvchi
      // qayerdaligini bilish xarid yo'nalishini rejalashtirishda kerak.
      prisma.taminotchi.findMany({
        where: {
          lokatsiyaLat: { not: null },
          lokatsiyaLng: { not: null },
          ...egaFilialWhere(session),
        },
        select: {
          id: true, nomi: true, telefon: true, manzil: true, kontaktShaxs: true,
          lokatsiyaLat: true, lokatsiyaLng: true,
        },
        orderBy: { nomi: 'asc' },
      }),
    ])

    return NextResponse.json({
      filiallar,
      xodimlar,
      mijozlar,
      taminotchilar,
      // Server vaqti — "necha daqiqa oldin" hisobini brauzer soatiga
      // emas, serverga nisbatan qilamiz (soatlar farq qilishi mumkin).
      hozir: new Date().toISOString(),
    })
  } catch (e) {
    console.error('[xarita GET]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
