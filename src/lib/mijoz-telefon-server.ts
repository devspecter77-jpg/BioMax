import { Prisma } from '@prisma/client'
import { prisma } from './prisma'

/**
 * Qo'shimcha raqamlar (3-raqamdan boshlab) bo'yicha qisman qidiruv — Prisma
 * massiv ichida `contains` qila olmaydi, shuning uchun bitta SQL bilan id'lar.
 * Kamida 3 ta raqam bo'lsa ishlaydi; aks holda bo'sh.
 */
export async function qoshimchaTelefonBoyichaIdlar(qidiruv: string): Promise<string[]> {
  const raqam = qidiruv.replace(/\D/g, '')
  if (raqam.length < 3) return []
  const qatorlar = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT id FROM public.mijozlar
    WHERE cardinality("qoshimchaTelefonlar") > 0
      AND array_to_string("qoshimchaTelefonlar", ' ') LIKE ${`%${raqam}%`}
    LIMIT 500`)
  return qatorlar.map(q => q.id)
}
