import { prisma } from '@/lib/prisma'

const KALIT = 'usd_kursi'
const DEFAULT_KURS = 12700

export async function joriyUsdKursi(): Promise<number> {
  const row = await prisma.sozlama.findUnique({ where: { kalit: KALIT } })
  const n = row ? parseFloat(row.qiymat) : NaN
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_KURS
}

export async function usdKursiniOrnat(qiymat: number): Promise<void> {
  await prisma.sozlama.upsert({
    where: { kalit: KALIT },
    update: { qiymat: String(qiymat) },
    create: { kalit: KALIT, qiymat: String(qiymat) },
  })
}
