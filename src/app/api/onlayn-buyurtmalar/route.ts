import { NextRequest, NextResponse } from 'next/server'
import { buyurtmalarRoyxati } from '@/lib/marketplace-baza'
import { onlaynRuxsat } from '@/lib/onlayn-buyurtma-server'
import { buyurtmaDostavchiklari, dostavchikRaqamlari, saytHolatlariBilanMoslash } from '@/lib/dostavchik-server'
import type { OnlaynRoyxat } from '@/lib/onlayn-buyurtma'

export const dynamic = 'force-dynamic'

const HOLATLAR = new Set(['FAOL', 'YANGI', 'TASDIQLANGAN', 'YIGILMOQDA', 'YOLDA', 'BAJARILGAN', 'BEKOR', 'QAYTARILGAN'])

export async function GET(req: NextRequest) {
  const r = await onlaynRuxsat()
  if (!r.ok) return r.javob

  const p = req.nextUrl.searchParams
  const holat = p.get('holat')
  const qidiruv = p.get('q')?.trim().slice(0, 60) || null
  const sahifa = Math.max(1, Math.floor(Number(p.get('sahifa')) || 1))
  let raqamlar: string[] | null = null

  // Dostavchik faqat o'ziga biriktirilgan buyurtmalarni ko'radi: boshqa
  // mijozlarning telefoni va manzili unga kerak emas
  const u = r.session.user as unknown as { id: string; rol?: string }
  const dostavchikRejimi = u.rol === 'DOSTAVCHIK'
  if (dostavchikRejimi) {
    raqamlar = await dostavchikRaqamlari(u.id)
    if (raqamlar.length === 0) {
      const bosh: OnlaynRoyxat = { buyurtmalar: [], jami: 0, sahifa: 1, sahifaHajmi: 30, sonlar: {}, dostavchikRejimi }
      return NextResponse.json(bosh)
    }
  }

  const royxat = await buyurtmalarRoyxati({
    holat: holat && HOLATLAR.has(holat) ? holat : null,
    qidiruv,
    sahifa,
    raqamlar,
  })

  await saytHolatlariBilanMoslash(royxat.buyurtmalar)
  const dostavchiklar = await buyurtmaDostavchiklari(royxat.buyurtmalar.map(b => b.raqam))
  const natija: OnlaynRoyxat = {
    ...royxat,
    buyurtmalar: royxat.buyurtmalar.map(b => ({ ...b, dostavchik: dostavchiklar.get(b.raqam) ?? null })),
    dostavchikRejimi,
  }
  return NextResponse.json(natija)
}
