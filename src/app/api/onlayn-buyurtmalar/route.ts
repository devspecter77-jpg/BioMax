import { NextRequest, NextResponse } from 'next/server'
import { mpSorov } from '@/lib/marketplace-mijoz'
import { onlaynRuxsat } from '@/lib/onlayn-buyurtma-server'
import { buyurtmaDostavchiklari, dostavchikRaqamlari, saytHolatlariBilanMoslash } from '@/lib/dostavchik-server'
import type { OnlaynRoyxat } from '@/lib/onlayn-buyurtma'

export const dynamic = 'force-dynamic'

const HOLATLAR = new Set(['FAOL', 'YANGI', 'TASDIQLANGAN', 'YIGILMOQDA', 'YOLDA', 'BAJARILGAN', 'BEKOR', 'QAYTARILGAN'])

export async function GET(req: NextRequest) {
  const r = await onlaynRuxsat()
  if (!r.ok) return r.javob

  const p = req.nextUrl.searchParams
  const q = new URLSearchParams()
  const holat = p.get('holat')
  if (holat && HOLATLAR.has(holat)) q.set('holat', holat)
  const qidiruv = p.get('q')?.trim().slice(0, 60)
  if (qidiruv) q.set('q', qidiruv)
  const sahifa = Math.max(1, Math.floor(Number(p.get('sahifa')) || 1))
  if (sahifa > 1) q.set('sahifa', String(sahifa))

  // Dostavchik faqat o'ziga biriktirilgan buyurtmalarni ko'radi: boshqa
  // mijozlarning telefoni va manzili unga kerak emas
  const u = r.session.user as unknown as { id: string; rol?: string }
  const dostavchikRejimi = u.rol === 'DOSTAVCHIK'
  if (dostavchikRejimi) {
    const raqamlar = await dostavchikRaqamlari(u.id)
    if (raqamlar.length === 0) {
      const bosh: OnlaynRoyxat = { buyurtmalar: [], jami: 0, sahifa: 1, sahifaHajmi: 30, sonlar: {}, dostavchikRejimi }
      return NextResponse.json(bosh)
    }
    q.set('raqamlar', raqamlar.join(','))
  }

  const s = q.toString()
  const n = await mpSorov<OnlaynRoyxat>('GET', `/api/erp/buyurtmalar${s ? `?${s}` : ''}`)
  if (!n.ok) return NextResponse.json({ kod: n.kod, xato: n.xato }, { status: n.holat >= 500 ? 502 : n.holat })

  await saytHolatlariBilanMoslash(n.qiymat.buyurtmalar)
  const dostavchiklar = await buyurtmaDostavchiklari(n.qiymat.buyurtmalar.map(b => b.raqam))
  const natija: OnlaynRoyxat = {
    ...n.qiymat,
    buyurtmalar: n.qiymat.buyurtmalar.map(b => ({ ...b, dostavchik: dostavchiklar.get(b.raqam) ?? null })),
    dostavchikRejimi,
  }
  return NextResponse.json(natija)
}
