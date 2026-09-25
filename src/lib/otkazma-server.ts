// O'tkazmaning server tomoni — qabul omborida mos mahsulotni topish yoki
// yaratish.
//
// Manzil = filial doirasi + nomli ombor (Ombor → Kategoriya → Tovar).
// Mahsulot kategoriyasi orqali bitta omborda turadi, shuning uchun qabul
// omborida manbaning jufti alohida qator bo'ladi:
//   - bor bo'lsa  — o'tkazilgan miqdor o'sha mahsulot qoldig'iga qo'shiladi;
//   - yo'q bo'lsa — manbadan nusxa ko'chirib yangi mahsulot yaratiladi.
// Filiallar orasida ham xuddi shunday: har filialning O'Z katalogi bor.

import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { sessionIsRealEga } from './filial-scope'

type PrismaTx = Prisma.TransactionClient | typeof prisma

// O'tkazmani faqat bosh Ega boshqaradi — filial admini boshqa filialning
// omboriga tega olmasligi kerak. /api/filiallar dagi bilan bir xil tekshiruv.
export function faqatEga(session: unknown): boolean {
  const s = session as { user?: { rol?: string } } | null
  return !!s && s.user?.rol === 'ADMIN' && sessionIsRealEga(s as never)
}

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
  rasmlar: string[]
}

/** Qabul manzili. */
export interface QabulManzil {
  /** null — Ega markaziy katalogi (filialsiz) */
  filialId: string | null
  /** null — omborga biriktirilmagan mahsulotlar ("Markaziy ombor") */
  omborId: string | null
  /** Yangi kategoriya nomi uchun: "Ichimliklar (Sovutgich)" */
  omborNomi: string | null
}

/** Doiralash: filialga bog'langan yozuvda egaId bo'lmaydi va aksincha —
 *  tovarlar/route.ts POST dagi naqsh bilan bir xil. */
function doira(filialId: string | null, egaId: string | null) {
  return filialId ? { filialId, egaId: null } : { filialId: null, egaId }
}

/**
 * Qabul omborida manba kategoriyasiga mos kategoriyani topadi yoki yaratadi.
 *
 * Kategoriya nomi katalog ichida takrorlanmaydi va har kategoriya bitta
 * omborga tegishli. Shu sababli bir katalogdagi boshqa omborga o'tkazilganda
 * manba nomi odatda band bo'ladi — unda ombor nomi qo'shiladi:
 * "Ichimliklar" → "Ichimliklar (Sovutgich)". Keyingi o'tkazmalar o'sha
 * kategoriyani qayta ishlatadi.
 */
async function qabulKategoriyasi(
  tx: PrismaTx,
  manbaKategoriyaId: string,
  qabul: QabulManzil,
  egaId: string | null,
): Promise<string> {
  const manba = await tx.kategoriya.findUnique({
    where: { id: manbaKategoriyaId },
    select: { nomi: true, tavsif: true },
  })
  const asosiy = manba?.nomi || 'Umumiy'
  const qoshimcha = qabul.omborNomi || 'Markaziy'
  const d = doira(qabul.filialId, egaId)

  const nomzodlar = [asosiy, `${asosiy} (${qoshimcha})`]
  for (let i = 2; i <= 9; i++) nomzodlar.push(`${asosiy} (${qoshimcha} ${i})`)

  for (const nomi of nomzodlar) {
    const band = await tx.kategoriya.findFirst({
      where: { nomi: { equals: nomi, mode: 'insensitive' }, ...d },
      select: { id: true, omborId: true },
    })
    if (band) {
      // Shu omborda allaqachon bor — qayta ishlatiladi
      if (band.omborId === qabul.omborId) return band.id
      // Nom boshqa omborda band — keyingi nomzod
      continue
    }
    const yangi = await tx.kategoriya.create({
      data: { nomi, tavsif: manba?.tavsif ?? null, omborId: qabul.omborId, ...d },
      select: { id: true },
    })
    return yangi.id
  }
  throw new Error("Qabul omborida kategoriya yaratib bo'lmadi")
}

/**
 * Qabul omborida manba mahsulotga mos qatorni topadi yoki yaratadi.
 *
 * Qidiruv FAQAT qabul omborining mahsulotlari orasida (kategoriyasi shu
 * omborda), tartib `qabulJuftiniTop` (lib/otkazma.ts) bilan bir xil:
 *   1) shtrix-kod bo'yicha
 *   2) nomi bo'yicha (registrga sezgir emas)
 *   3) topilmasa — manbadan nusxa ko'chirib yangi mahsulot
 *
 * Yangi yaratilganda narxlar va rasmlar ham ko'chiriladi: qabul ombori
 * mahsulotni noldan to'ldirishiga hojat qolmaydi.
 */
export async function qabulTovarniTop(
  tx: PrismaTx,
  manba: ManbaTovar,
  qabul: QabulManzil,
  egaId: string | null,
): Promise<{ id: string; yaratildi: boolean }> {
  const d = doira(qabul.filialId, egaId)
  const omborda: Prisma.TovarWhereInput = {
    ...d,
    id: { not: manba.id },
    // Arxivdagi mahsulotga qoldiq qo'shilsa, u ko'zdan yashirin qolardi
    holati: 'FAOL',
    kategoriya: { omborId: qabul.omborId },
  }

  if (manba.shtrixKod) {
    const kodBoyicha = await tx.tovar.findFirst({
      where: { ...omborda, shtrixKod: manba.shtrixKod },
      select: { id: true },
    })
    if (kodBoyicha) return { id: kodBoyicha.id, yaratildi: false }
  }

  const nomBoyicha = await tx.tovar.findFirst({
    where: { ...omborda, nomi: { equals: manba.nomi, mode: 'insensitive' } },
    select: { id: true },
  })
  if (nomBoyicha) return { id: nomBoyicha.id, yaratildi: false }

  const kategoriyaId = await qabulKategoriyasi(tx, manba.kategoriyaId, qabul, egaId)

  // Shtrix-kod: bu o'sha jismoniy mahsulot, kod saqlanadi — kassa skaneri
  // bir nechta mos kelganda tanlangan ombor va qoldiqqa qarab ajratadi.
  // Faqat filial katalogida kod bazada unique (@@unique([shtrixKod,
  // filialId])): u yerda band bo'lsa, nusxa kodsiz yaratiladi.
  let shtrixKod = manba.shtrixKod
  if (shtrixKod && qabul.filialId) {
    const band = await tx.tovar.findFirst({
      where: { shtrixKod, filialId: qabul.filialId },
      select: { id: true },
    })
    if (band) shtrixKod = null
  }

  const yangi = await tx.tovar.create({
    data: {
      nomi: manba.nomi,
      kategoriyaId,
      shtrixKod,
      birlik: manba.birlik,
      valyuta: manba.valyuta,
      kelishNarxi: manba.kelishNarxi,
      sotishNarxi: manba.sotishNarxi,
      optomNarxi: manba.optomNarxi,
      bolishNarxi: manba.bolishNarxi,
      minimalQoldiq: manba.minimalQoldiq,
      yaroqlilikMuddati: manba.yaroqlilikMuddati,
      rasmlar: manba.rasmlar,
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
  rasmlar: true,
} as const

// ─── O'tkazmani bajarish ─────────────────────────────────────────────────────

export interface OtkazmaBajarParams {
  manbaFilialId: string | null
  manbaOmborId: string | null
  qabul: QabulManzil
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
      qabulFilialId: p.qabul.filialId,
      manbaOmborId: p.manbaOmborId,
      qabulOmborId: p.qabul.omborId,
      manbaJoy: p.manbaJoy,
      qabulJoy: p.qabulJoy,
      izoh: p.izoh,
      foydalanuvchiId: p.foydalanuvchiId,
      egaId: p.egaId,
    },
  })

  let yangiTovarSoni = 0
  let qatorSoni = 0
  // Filial ham, ombor ham bir xil — faqat joy (ombor ↔ do'kon) almashadi:
  // mahsulot o'sha-o'sha, nusxa yaratilmaydi.
  const ichki = (p.manbaFilialId ?? null) === (p.qabul.filialId ?? null)
    && (p.manbaOmborId ?? null) === (p.qabul.omborId ?? null)

  for (const q of p.qatorlar) {
    if (!(q.miqdor > 0)) continue
    const manba = p.tovarMap.get(q.tovarId)
    if (!manba) continue

    // Qabul omborida juftini topamiz. Mavjud bo'lsa o'sha qaytadi —
    // shuning uchun ikkinchi o'tkazmada qoldiq ustiga qo'shiladi.
    const qabul = ichki
      ? { id: manba.id, yaratildi: false }
      : await qabulTovarniTop(tx, manba, p.qabul, p.egaId)
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
        izoh: "Omborlararo o'tkazma",
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
        izoh: "Omborlararo o'tkazma",
        foydalanuvchiId: p.foydalanuvchiId,
      },
    })

    qatorSoni++
  }

  return { otkazmaId: otkazma.id, yangiTovarSoni, qatorSoni }
}
