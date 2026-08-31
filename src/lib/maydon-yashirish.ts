import { prisma } from '@/lib/prisma'
import { YASHIRILADIGAN_MAYDONLAR } from '@/lib/maydon-katalogi'

export { YASHIRILADIGAN_MAYDONLAR }

export async function foydalanuvchiYashirilganMaydonlari(foydalanuvchiId: string): Promise<Set<string>> {
  const yozuvlar = await prisma.maydonYashirish.findMany({
    where: { foydalanuvchiId },
    select: { maydon: true },
  })
  return new Set(yozuvlar.map(y => y.maydon))
}

// Berilgan obyekt(lar)dan yashirilgan maydonlarni null qilib qaytaradi.
export function maydonlarniYashir<T extends Record<string, any>>(item: T, yashirilgan: Set<string>): T {
  if (yashirilgan.size === 0) return item
  const nusxa: any = { ...item }
  for (const kalit of yashirilgan) {
    if (kalit in nusxa) nusxa[kalit] = null
  }
  return nusxa
}
