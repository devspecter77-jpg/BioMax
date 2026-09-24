import { NextRequest, NextResponse } from 'next/server'
import { buyurtmaTafsiloti } from '@/lib/marketplace-baza'
import { onlaynRuxsat } from '@/lib/onlayn-buyurtma-server'
import { erpIzi } from '@/lib/onlayn-sotuv-server'
import { buyurtmaDostavchiklari } from '@/lib/dostavchik-server'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ raqam: string }> }) {
  const r = await onlaynRuxsat()
  if (!r.ok) return r.javob
  const raqam = decodeURIComponent((await params).raqam)
  if (!/^MP-\d{4}-\d{5,}$/.test(raqam)) return NextResponse.json({ xato: 'Buyurtma topilmadi' }, { status: 404 })

  const dostavchik = (await buyurtmaDostavchiklari([raqam])).get(raqam) ?? null
  // Dostavchik boshqa birovning buyurtmasini ochmasin — mavjudligini ham bilmasin
  const u = r.session.user as unknown as { id: string; rol?: string }
  if (u.rol === 'DOSTAVCHIK' && dostavchik?.id !== u.id) {
    return NextResponse.json({ xato: 'Buyurtma topilmadi' }, { status: 404 })
  }

  const b = await buyurtmaTafsiloti(raqam)
  if (!b) return NextResponse.json({ xato: 'Buyurtma topilmadi' }, { status: 404 })
  return NextResponse.json({ ...b, erp: await erpIzi(raqam), dostavchik })
}
