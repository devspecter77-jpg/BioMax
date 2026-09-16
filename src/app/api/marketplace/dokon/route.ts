import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { imzoniTekshir } from '@/lib/marketplace-imzo'

// MARKETPLACE SHARTNOMASI — do'konning ommaviy aloqa ma'lumotlari.
//
// Chekdagi bilan BIR XIL sozlamalar (`dokon_nomi`, `telefon`, `manzil`) —
// do'kon telefoni bir joyda o'zgartirilsa chekda ham, saytda ham yangilanadi.
// Faqat shu ro'yxatdagi kalitlar beriladi: sozlamalar jadvalida Telegram
// sessiyasi ham turadi.

export const dynamic = 'force-dynamic'

const KALITLAR = ['dokon_nomi', 'telefon', 'manzil', 'ish_vaqti', 'qaytarish_shartlari'] as const

export async function GET(req: NextRequest) {
  const tekshiruv = imzoniTekshir(req, '')
  if (!tekshiruv.ok) {
    return NextResponse.json({ kod: tekshiruv.sabab, xato: 'Ruxsat yo‘q' }, { status: tekshiruv.holat })
  }
  try {
    const qatorlar = await prisma.sozlama.findMany({ where: { kalit: { in: [...KALITLAR] } } })
    const q = (k: (typeof KALITLAR)[number]) => qatorlar.find(x => x.kalit === k)?.qiymat?.trim() || null
    return NextResponse.json({
      nomi: q('dokon_nomi'),
      telefon: q('telefon'),
      manzil: q('manzil'),
      ishVaqti: q('ish_vaqti'),
      qaytarishShartlari: q('qaytarish_shartlari'),
    })
  } catch (e) {
    console.error('[mp/dokon]', e)
    return NextResponse.json({ kod: 'server_xatosi', xato: 'Server xatosi' }, { status: 500 })
  }
}
