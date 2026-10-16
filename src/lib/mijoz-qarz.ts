// Mijozning joriy qarzi (nasiyalar qoldig'i) — cheklarda ko'rsatish uchun.
//
// Qarz chek chiqarilgan PAYTDAGI holat: kassada sotuvdan keyin darhol —
// shu sotuv bilan birga; keyin qayta chiqarilgan chekda — o'sha kundagi
// qoldiq. Shuning uchun chekda vaqti bilan yoziladi ("… holatiga").

import { prisma } from './prisma'
import type { MijozQarzi } from './chek-print'

/** Ochiq (to'lanmagan) nasiyalar: qoldiq hisoblanadiganlar. */
const OCHIQ = ['OCHIQ', 'MUDDATI_OTGAN'] as const

/** Mijoz id → qarz (so'm, > 0). Qarzi yo'q mijoz natijada bo'lmaydi. Bitta so'rov. */
export async function mijozQarzlari(mijozIdlar: (string | null | undefined)[]): Promise<Map<string, number>> {
  const idlar = [...new Set(mijozIdlar.filter((x): x is string => !!x))]
  if (idlar.length === 0) return new Map()
  const guruhlar = await prisma.nasiya.groupBy({
    by: ['mijozId'],
    where: { mijozId: { in: idlar }, holati: { in: [...OCHIQ] }, ochirilgan: false, qoldiq: { gt: 0 } },
    _sum: { qoldiq: true },
  })
  const natija = new Map<string, number>()
  for (const g of guruhlar) {
    const summa = Math.round(Number(g._sum.qoldiq ?? 0))
    if (summa > 0) natija.set(g.mijozId, summa)
  }
  return natija
}

/** Chek uchun: qarz bo'lsa summa va hisoblangan vaqt, aks holda `null`. */
export function chekQarzi(qarzlar: Map<string, number>, mijozId: string | null | undefined, vaqt = new Date()): MijozQarzi | null {
  const summa = mijozId ? qarzlar.get(mijozId) : undefined
  return summa ? { summa, vaqt: vaqt.toISOString() } : null
}
