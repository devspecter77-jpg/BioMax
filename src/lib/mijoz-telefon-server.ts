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

/**
 * Raqam bo'yicha mijoz sharti — istalgan yozilishda (+998 bilan yoki 9 raqam):
 * asosiy, 2-raqam va qo'shimchalar oxirgi 9 raqam bo'yicha solishtiriladi.
 * Mijozlar bo'limi raqamni 9 raqam ko'rinishida, nasiya esa "+998…" bilan
 * saqlaydi — aniq tenglik bilan qidirilsa bir mijoz ikki marta yaratilardi.
 */
export function telefonBoyichaSharti(raqam: string | null | undefined): Prisma.MijozWhereInput | null {
  const r = String(raqam ?? '').replace(/\D/g, '').slice(-9)
  if (r.length !== 9) return null
  return { OR: [{ telefon: { endsWith: r } }, { telefon2: { endsWith: r } }, { qoshimchaTelefonlar: { has: r } }] }
}
