// Filiallararo o'tkazmaning server tomoni — qabul filialida mos
// mahsulotni topish yoki yaratish.
//
// Eng nozik joy: har bir filialning O'Z katalogi bor (Tovar.filialId),
// ya'ni A filialdagi "Ariel" bilan B filialdagi "Ariel" — ikki xil qator.
// Shuning uchun o'tkazmada manba mahsulotga qabul filialidan juft topiladi,
// topilmasa yangisi yaratiladi.

import { Prisma } from '@prisma/client'
import { prisma } from './prisma'

type PrismaTx = Prisma.TransactionClient | typeof prisma

/** O'tkazma uchun kerak bo'ladigan manba mahsulot maydonlari. */
export type ManbaTovar = {
  id: string
  nomi: string
  shtrixKod: string | null
  kategoriyaId: string
  birlik: Prisma.TovarCreateInput['birlik']
  valyuta: Prisma.TovarCreateInput['valyuta']
  kelishNarxi: Prisma.Decimal
  sotishNarxi: Prisma.Decimal
  optomNarxi: Prisma.Decimal | null
  bolishNarxi: Prisma.Decimal | null
  minimalQoldiq: number
  yaroqlilikMuddati: Date | null
}

/** Doiralash: filialga bog'langan yozuvda egaId bo'lmaydi va aksincha —
 *  tovarlar/route.ts POST dagi naqsh bilan bir xil. */
function doira(filialId: string | null, egaId: string | null) {
  return filialId ? { filialId, egaId: null } : { filialId: null, egaId }
}

/**
 * Qabul doirasida shu nomli kategoriyani topadi, bo'lmasa yaratadi.
 * Kategoriya ham filialga bog'langan (@@unique([nomi, filialId, egaId])),
 * shuning uchun yangi filialda mahsulot yaratishdan oldin kerak bo'ladi.
 */
async function qabulKategoriyasi(
  tx: PrismaTx,
  manbaKategoriyaId: string,
  qabulFilialId: string | null,
  egaId: string | null,
): Promise<string> {
  const manba = await tx.kategoriya.findUnique({
    where: { id: manbaKategoriyaId },
    select: { nomi: true, tavsif: true },
  })
  const nomi = manba?.nomi || 'Umumiy'
  const d = doira(qabulFilialId, egaId)

  const mavjud = await tx.kategoriya.findFirst({
    where: { nomi: { equals: nomi, mode: 'insensitive' }, ...d },
    select: { id: true },
  })
  if (mavjud) return mavjud.id

  const yangi = await tx.kategoriya.create({
    data: { nomi, tavsif: manba?.tavsif ?? null, ...d },
  })
  return yangi.id
}

/**
 * Qabul filialida manba mahsulotga mos qatorni topadi yoki yaratadi.
 *
 * Tartib:
 *   1) shtrix-kod bo'yicha (`@@unique([shtrixKod, filialId])` shuni kafolatlaydi)
 *   2) nomi bo'yicha (registrga sezgir emas)
 *   3) topilmasa — manbadan nusxa ko'chirib yangi mahsulot
 *
 * Yangi yaratilganda narxlar ham ko'chiriladi: filial tovarni noldan
 * narxlashiga hojat qolmaydi, keyin xohlasa o'zgartiradi.
 */
export async function qabulTovarniTop(
  tx: PrismaTx,
  manba: ManbaTovar,
  qabulFilialId: string | null,
  egaId: string | null,
): Promise<{ id: string; yaratildi: boolean }> {
  const d = doira(qabulFilialId, egaId)

  if (manba.shtrixKod) {
    const kodBoyicha = await tx.tovar.findFirst({
      where: { shtrixKod: manba.shtrixKod, ...d },
      select: { id: true },
    })
    if (kodBoyicha) return { id: kodBoyicha.id, yaratildi: false }
  }

  const nomBoyicha = await tx.tovar.findFirst({
    where: { nomi: { equals: manba.nomi, mode: 'insensitive' }, ...d },
    select: { id: true },
  })
  if (nomBoyicha) return { id: nomBoyicha.id, yaratildi: false }

  const kategoriyaId = await qabulKategoriyasi(tx, manba.kategoriyaId, qabulFilialId, egaId)

  const yangi = await tx.tovar.create({
    data: {
      nomi: manba.nomi,
      kategoriyaId,
      // Shtrix-kod filial ichida unique — boshqa filialda bandligi to'sqinlik qilmaydi
      shtrixKod: manba.shtrixKod,
      birlik: manba.birlik,
      valyuta: manba.valyuta,
      kelishNarxi: manba.kelishNarxi,
      sotishNarxi: manba.sotishNarxi,
      optomNarxi: manba.optomNarxi,
      bolishNarxi: manba.bolishNarxi,
      minimalQoldiq: manba.minimalQoldiq,
      yaroqlilikMuddati: manba.yaroqlilikMuddati,
      ...d,
    },
    select: { id: true },
  })
  return { id: yangi.id, yaratildi: true }
}

/** Mahsulotning o'tkazma uchun kerakli maydonlarini tanlash — bitta joyda. */
export const MANBA_TOVAR_SELECT = {
  id: true,
  nomi: true,
  shtrixKod: true,
  kategoriyaId: true,
  birlik: true,
  valyuta: true,
  kelishNarxi: true,
  sotishNarxi: true,
  optomNarxi: true,
  bolishNarxi: true,
  minimalQoldiq: true,
  yaroqlilikMuddati: true,
} as const

// ─── O'tkazmani bajarish ─────────────────────────────────────────────────────

export interface OtkazmaBajarParams {
  manbaFilialId: string | null
  qabulFilialId: string | null
  manbaJoy: 'OMBOR' | 'DOKON'
  qabulJoy: 'OMBOR' | 'DOKON'
  izoh: string | null
  egaId: string | null
  foydalanuvchiId: string
  /** Manba mahsulotlar — id bo'yicha. Route ularni doira tekshiruvidan o'tkazadi. */
  tovarMap: Map<string, ManbaTovar>
  qatorlar: Array<{ tovarId: string; miqdor: number }>
}

/**
 * Hujjat + qatorlar + zaxira harakatlarini yozadi.
 *
 * Ataylab alohida funksiya: marshrut ham, testlar ham AYNAN shuni chaqiradi,
 * ya'ni test ishlab turgan kodni sinaydi, uning nusxasini emas.
 *
 * Har qator uchun ikkita harakat yoziladi:
 *   manba mahsulotda OTKAZMA_CHIQIM  (o'sha ombordan ayriladi)
 *   qabul mahsulotda OTKAZMA_KIRIM   (o'sha omborga qo'shiladi)
 *
 * Qabul mahsulot mavjud bo'lsa YANGI yaratilmaydi — kirim harakati o'sha
 * mahsulotga yoziladi va qoldiq ustiga qo'shiladi.
 *
 * `tx` MAJBURIY tranzaksiya klienti bo'lishi kerak: chiqim yozilib, kirim
 * yozilmay qolsa tovar yo'qolib qolardi.
 */
export async function otkazmaniBajar(
  tx: PrismaTx,
  p: OtkazmaBajarParams,
): Promise<{ otkazmaId: string; yangiTovarSoni: number; qatorSoni: number }> {
  const otkazma = await tx.otkazma.create({
    data: {
      manbaFilialId: p.manbaFilialId,
      qabulFilialId: p.qabulFilialId,
      manbaJoy: p.manbaJoy,
      qabulJoy: p.qabulJoy,
      izoh: p.izoh,
      foydalanuvchiId: p.foydalanuvchiId,
      egaId: p.egaId,
    },
  })

  let yangiTovarSoni = 0
  let qatorSoni = 0

  for (const q of p.qatorlar) {
    if (!(q.miqdor > 0)) continue
    const manba = p.tovarMap.get(q.tovarId)
    if (!manba) continue

    // Qabul doirasida juftini topamiz. Mavjud bo'lsa o'sha qaytadi —
    // shuning uchun ikkinchi o'tkazmada qoldiq ustiga qo'shiladi.
    const qabul = await qabulTovarniTop(tx, manba, p.qabulFilialId, p.egaId)
    if (qabul.yaratildi) yangiTovarSoni++

    await tx.otkazmaTarkibi.create({
      data: {
        otkazmaId: otkazma.id,
        manbaTovarId: manba.id,
        qabulTovarId: qabul.id,
        miqdor: q.miqdor,
        narx: manba.kelishNarxi,
      },
    })

    // Manbadan ayirish
    await tx.omborHarakati.create({
      data: {
        tovarId: manba.id,
        turi: 'OTKAZMA_CHIQIM',
        joy: p.manbaJoy,
        miqdor: q.miqdor,
        narx: manba.kelishNarxi,
        otkazmaId: otkazma.id,
        izoh: "Filiallararo o'tkazma",
        foydalanuvchiId: p.foydalanuvchiId,
      },
    })
    // Qabulga qo'shish
    await tx.omborHarakati.create({
      data: {
        tovarId: qabul.id,
        turi: 'OTKAZMA_KIRIM',
        joy: p.qabulJoy,
        miqdor: q.miqdor,
        narx: manba.kelishNarxi,
        otkazmaId: otkazma.id,
        izoh: "Filiallararo o'tkazma",
        foydalanuvchiId: p.foydalanuvchiId,
      },
    })

    qatorSoni++
  }

  return { otkazmaId: otkazma.id, yangiTovarSoni, qatorSoni }
}
