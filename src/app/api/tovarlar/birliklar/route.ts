import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { egaFilialWhere } from '@/lib/filial-scope'
import { TAYYOR_BIRLIKLAR, oramlarniOqi } from '@/lib/birlik'

// Shu katalogda foydalanuvchi O'ZI qo'shgan birliklar va o'ram nomlari —
// tovar formasida taklif sifatida chiqadi ("juft" bir marta yozilsa,
// keyingi mahsulotda ro'yxatdan tanlanadi).

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    const qatorlar = await prisma.tovar.findMany({
      where: egaFilialWhere(session),
      select: { birlik: true, oramlar: true },
    })
    const tayyor = new Set<string>(TAYYOR_BIRLIKLAR)
    const birliklar = [...new Set(qatorlar.map(q => q.birlik).filter(b => !tayyor.has(b)))].sort()
    const oramlar = [...new Set(qatorlar.flatMap(q => oramlarniOqi(q.oramlar).map(o => o.nomi)))].sort()
    return NextResponse.json({ birliklar, oramlar })
  } catch (e) {
    console.error('[tovarlar/birliklar]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
