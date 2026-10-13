import { NextRequest, NextResponse } from 'next/server'
import { mpSorov } from '@/lib/marketplace-mijoz'
import { onlaynRuxsat } from '@/lib/onlayn-buyurtma-server'
import { erpKartalari } from '@/lib/onlayn-mijoz-server'
import { bloklanganSoni, oxirgiChiqarishlar } from '@/lib/onlayn-blok-server'
import type { OnlaynMijozRoyxat } from '@/lib/onlayn-mijoz'

export const dynamic = 'force-dynamic'

const TARTIBLAR = new Set(['yangi', 'oxirgi', 'summa'])
const FILTRLAR = new Set(['hammasi', 'buyurtmali', 'buyurtmasiz'])

// Onlayn do'konda ro'yxatdan o'tgan xaridorlar — marketplace'dan, do'kondagi kartasi bilan.
export async function GET(req: NextRequest) {
  const r = await onlaynRuxsat('mijozlar.onlayn')
  if (!r.ok) return r.javob

  const p = req.nextUrl.searchParams
  const q = new URLSearchParams()
  const qidiruv = p.get('q')?.trim().slice(0, 60)
  if (qidiruv) q.set('q', qidiruv)
  const tartib = p.get('tartib')
  if (tartib && TARTIBLAR.has(tartib)) q.set('tartib', tartib)
  const filtr = p.get('filtr')
  if (filtr && FILTRLAR.has(filtr)) q.set('filtr', filtr)
  const sahifa = Math.max(1, Math.floor(Number(p.get('sahifa')) || 1))
  if (sahifa > 1) q.set('sahifa', String(sahifa))

  const s = q.toString()
  const n = await mpSorov<OnlaynMijozRoyxat>('GET', `/api/erp/mijozlar${s ? `?${s}` : ''}`)
  if (!n.ok) return NextResponse.json({ kod: n.kod, xato: n.xato }, { status: n.holat >= 500 ? 502 : n.holat })

  // Saytdan chiqarilganlarning sababi va soni — ERP jurnalidan
  const bloklanganlar = n.qiymat.mijozlar.filter(m => !m.faol).map(m => m.id)
  const [kartalar, chiqarishlar, chiqarilganSoni] = await Promise.all([
    erpKartalari(r.session, n.qiymat.mijozlar.map(m => m.telefon)),
    oxirgiChiqarishlar(bloklanganlar),
    bloklanganSoni(),
  ])
  return NextResponse.json({
    ...n.qiymat,
    bloklanganSoni: chiqarilganSoni,
    mijozlar: n.qiymat.mijozlar.map(m => ({
      ...m,
      erpKarta: kartalar.get(m.telefon) ?? null,
      blok: m.faol ? null : chiqarishlar.get(m.id) ?? null,
    })),
  })
}
