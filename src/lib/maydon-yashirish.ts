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
export function maydonlarniYashir<T extends object>(item: T, yashirilgan: Set<string>): T {
  if (yashirilgan.size === 0) return item
  const nusxa = { ...item } as Record<string, unknown>
  for (const kalit of yashirilgan) {
    if (kalit in nusxa) nusxa[kalit] = null
  }
  // O'ram uchun kiritilgan kelish narxi ("1 blok — 60 000") ham yashiriladi
  if (yashirilgan.has('kelishNarxi') && Array.isArray(nusxa.oramlar)) {
    nusxa.oramlar = oramKelishiniYashir(nusxa.oramlar)
  }
  return nusxa as T
}

/** `oramlar` JSON'idagi kelish narxini olib tashlaydi (kelish narxi yashirilgan hisob uchun) */
export function oramKelishiniYashir(oramlar: unknown): unknown {
  if (!Array.isArray(oramlar)) return oramlar
  return oramlar.map(o => {
    if (!o || typeof o !== 'object' || !('narx' in o) || !o.narx || typeof o.narx !== 'object') return o
    return { ...o, narx: { ...(o.narx as Record<string, unknown>), kelish: null } }
  })
}
