import { NextRequest, NextResponse } from 'next/server'
import { mpSorov } from '@/lib/marketplace-mijoz'
import { onlaynRuxsat } from '@/lib/onlayn-buyurtma-server'
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

  const s = q.toString()
  const n = await mpSorov<OnlaynRoyxat>('GET', `/api/erp/buyurtmalar${s ? `?${s}` : ''}`)
  if (!n.ok) return NextResponse.json({ kod: n.kod, xato: n.xato }, { status: n.holat >= 500 ? 502 : n.holat })
  return NextResponse.json(n.qiymat)
}
