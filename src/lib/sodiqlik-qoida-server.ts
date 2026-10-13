// Sodiqlik qoidalari API'sining umumiy qismi — tanlash maydonlari, javob
// shakli va maqsad (mahsulot/kategoriya) doirasini tekshirish.

import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import type { SodiqlikQoida } from './sodiqlik'

type Doira = { filialId: string } | { filialId: null; egaId: string | null }

export const QOIDA_SELECT = {
  id: true, turi: true, tovarId: true, kategoriyaId: true,
  minSumma: true, minMiqdor: true, ball: true, keshbekFoiz: true,
  izoh: true, faol: true, yaratilgan: true,
  tovar: { select: { id: true, nomi: true, tartibRaqami: true, birlik: true, holati: true } },
  kategoriya: { select: { id: true, nomi: true } },
} satisfies Prisma.SodiqlikQoidasiSelect

type QoidaQatori = Prisma.SodiqlikQoidasiGetPayload<{ select: typeof QOIDA_SELECT }>

/** Brauzerga: Decimal'lar son ko'rinishida. */
export function qoidaJavobi(q: QoidaQatori) {
  return {
    ...q,
    minSumma: Number(q.minSumma),
    minMiqdor: Number(q.minMiqdor),
    ball: Number(q.ball),
    keshbekFoiz: Number(q.keshbekFoiz),
  }
}

/** Mahsulot yoki kategoriya shu katalogdan bo'lishi shart; xato bo'lsa — matni. */
export async function qoidaMaqsadiniTekshir(q: Omit<SodiqlikQoida, 'id'>, doira: Doira): Promise<string | null> {
  if (q.turi === 'MAHSULOT' && q.tovarId) {
    const bor = await prisma.tovar.findFirst({ where: { id: q.tovarId, ...doira }, select: { id: true } })
    if (!bor) return 'Mahsulot topilmadi'
  }
  if (q.turi === 'KATEGORIYA' && q.kategoriyaId) {
    const bor = await prisma.kategoriya.findFirst({ where: { id: q.kategoriyaId, ...doira }, select: { id: true } })
    if (!bor) return 'Kategoriya topilmadi'
  }
  return null
}
