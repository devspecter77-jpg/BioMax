// Sodiqlik dasturining server tomoni — sozlamani bazadan o'qish va
// balansni ATOMIK o'zgartirish.
//
// Hisob-kitob mantig'i `sodiqlik.ts`da (sof funksiyalar, client ham
// ishlatadi). Bu fayl faqat bazaga tegadi.

import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import {
  SODIQLIK_KALITLARI,
  sozlamaniOqi,
  sozlamaniYoz,
  type SodiqlikQoida,
  type SodiqlikSozlama,
  type ToplashTafsiloti,
} from './sodiqlik'

/** Tranzaksiya ichida ham, tashqarisida ham ishlaydigan Prisma klienti. */
type PrismaTx = Prisma.TransactionClient | typeof prisma

const KALIT_ROYXATI = Object.values(SODIQLIK_KALITLARI)

/** Joriy sozlamani bazadan o'qiydi. Yozuv yo'q bo'lsa standart qaytadi. */
export async function sodiqlikSozlamasi(db: PrismaTx = prisma): Promise<SodiqlikSozlama> {
  const qatorlar = await db.sozlama.findMany({ where: { kalit: { in: KALIT_ROYXATI } } })
  const xom: Record<string, string> = {}
  for (const q of qatorlar) xom[q.kalit] = q.qiymat
  return sozlamaniOqi(xom)
}

/** Sozlamani saqlaydi (barcha kalitlar bitta tranzaksiyada). */
export async function sodiqlikSozlamasiniSaqla(s: SodiqlikSozlama): Promise<void> {
  const yozuvlar = sozlamaniYoz(s)
  await prisma.$transaction(
    Object.entries(yozuvlar).map(([kalit, qiymat]) =>
      prisma.sozlama.upsert({
        where: { kalit },
        update: { qiymat },
        create: { kalit, qiymat },
      }),
    ),
  )
}

/** Katalog doirasi — `egaFilialWhere(session)` shaklida */
type Doira = { filialId: string } | { filialId: null; egaId: string | null }

/** Bazadagi qoida qatori → hisob uchun sonli shakl. */
export function qoidaniSonga(q: {
  id: string; turi: SodiqlikQoida['turi']; tovarId: string | null; kategoriyaId: string | null
  minSumma: Prisma.Decimal | number; minMiqdor: Prisma.Decimal | number
  ball: Prisma.Decimal | number; keshbekFoiz: Prisma.Decimal | number; faol: boolean
}): SodiqlikQoida {
  return {
    id: q.id, turi: q.turi, tovarId: q.tovarId, kategoriyaId: q.kategoriyaId,
    minSumma: Number(q.minSumma), minMiqdor: Number(q.minMiqdor),
    ball: Number(q.ball), keshbekFoiz: Number(q.keshbekFoiz), faol: q.faol,
  }
}

/** Shu katalogning FAOL qo'shimcha qoidalari (sotuvda to'plash uchun). */
export async function sodiqlikQoidalari(db: PrismaTx, doira: Doira): Promise<SodiqlikQoida[]> {
  const qatorlar = await db.sodiqlikQoidasi.findMany({ where: { ...doira, faol: true } })
  return qatorlar.map(qoidaniSonga)
}

export interface BalansOzgarishi {
  mijozId: string
  hisob: 'BALL' | 'KESHBEK'
  /** Musbat — qo'shiladi, manfiy — ayiriladi. */
  miqdor: number
  sabab: 'SOTUVDAN' | 'SARFLANDI' | 'QAYTARISHDAN' | 'QOLDA'
  sotuvId?: string | null
  izoh?: string | null
  foydalanuvchiId?: string | null
  /** Xariddan to'planganda — qayerdan kelgani (qaytarishda aniq bekor qilish uchun) */
  tafsilot?: ToplashTafsiloti | null
}

/**
 * Mijoz balansini o'zgartiradi va harakatni jurnalga yozadi.
 *
 * Balans HECH QACHON manfiyga ketmaydi — ayirish balansdan katta bo'lsa,
 * bor bo'lgani ayiriladi (bir vaqtda ikki kassa bir xil ballni sarflashga
 * urinsa ham hisob buzilmaydi). Haqiqatda qo'llanilgan miqdor qaytariladi.
 *
 * MUHIM: `tx` sifatida tranzaksiya klienti berilishi kerak — sotuv bilan
 * bir vaqtda yozilsin, aks holda sotuv bekor bo'lsa ball qolib ketardi.
 */
export async function balansOzgartir(
  tx: PrismaTx,
  o: BalansOzgarishi,
): Promise<{ qollanildi: number; yangiBalans: number } | null> {
  if (!o.miqdor || !Number.isFinite(o.miqdor)) return null

  const mijoz = await tx.mijoz.findUnique({
    where: { id: o.mijozId },
    select: { ballBalans: true, keshbekBalans: true },
  })
  if (!mijoz) return null

  const joriy = Number(o.hisob === 'BALL' ? mijoz.ballBalans : mijoz.keshbekBalans)
  // Ayirishda balansdan ortig'ini olmaymiz
  const qollanildi = o.miqdor < 0 ? -Math.min(Math.abs(o.miqdor), joriy) : o.miqdor
  if (qollanildi === 0) return { qollanildi: 0, yangiBalans: joriy }

  const yangiBalans = Math.round((joriy + qollanildi) * 100) / 100

  await tx.mijoz.update({
    where: { id: o.mijozId },
    data: o.hisob === 'BALL' ? { ballBalans: yangiBalans } : { keshbekBalans: yangiBalans },
  })

  await tx.sodiqlikHarakati.create({
    data: {
      mijozId: o.mijozId,
      hisob: o.hisob,
      miqdor: qollanildi,
      balansKeyin: yangiBalans,
      sabab: o.sabab,
      sotuvId: o.sotuvId ?? null,
      izoh: o.izoh ?? null,
      foydalanuvchiId: o.foydalanuvchiId ?? null,
      ...(o.tafsilot ? { tafsilot: o.tafsilot as unknown as Prisma.InputJsonValue } : {}),
    },
  })

  return { qollanildi, yangiBalans }
}

/** Bir nechta o'zgarishni ketma-ket qo'llaydi (bitta tranzaksiya ichida). */
export async function balanslarniOzgartir(
  tx: PrismaTx,
  ozgarishlar: BalansOzgarishi[],
): Promise<void> {
  for (const o of ozgarishlar) {
    if (o.miqdor) await balansOzgartir(tx, o)
  }
}
