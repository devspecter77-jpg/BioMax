// Ovoz yozuvlarini ma'lumotlar bazasida saqlash (faqat server).
//
// Fayl baytlari `ovoz_fayllar` jadvalida, yozuv (`ovoz_yozuvlari`) bilan
// 1:1 va CASCADE: yozuv o'chsa fayl ham o'chadi, egasiz fayl qolmaydi.
//
// Asosiy xavf — hajm. Bitta kuryerning smenasi ~25–35 MB; chegara bo'lmasa
// baza bir necha kunda to'lib, butun ERP (kassa ham) yozishdan to'xtardi.
// Shuning uchun har yangi bo'lakdan keyin umumiy hajm tekshiriladi va
// chegaradan oshsa ENG ESKI yozuvlar o'chiriladi.
//
// Xom SQL'da jadval doim `public.` bilan: Neon pooler search_path'ni
// boshqa sessiyalardan "yuqtirib" olishi mumkin.

import { prisma } from '@/lib/prisma'
import { BAZA_CHEGARA_STANDART, BAZA_CHEGARA_VARIANTLARI } from '@/lib/smena'

const CHEGARA_KALITI = 'ovoz_baza_chegara_mb'
export const MB = 1024 * 1024
/** Chegaradan oshganda shu ulushgacha bo'shatiladi — har bo'lakda o'chirmaslik uchun. */
const BOSHATISH_ULUSHI = 0.9

export async function bazaChegarasiMb(): Promise<number> {
  const q = await prisma.sozlama.findUnique({ where: { kalit: CHEGARA_KALITI }, select: { qiymat: true } })
  const n = Number(q?.qiymat)
  return (BAZA_CHEGARA_VARIANTLARI as readonly number[]).includes(n) ? n : BAZA_CHEGARA_STANDART
}

export async function bazaChegarasiniOrnat(mb: number): Promise<void> {
  await prisma.sozlama.upsert({
    where: { kalit: CHEGARA_KALITI },
    update: { qiymat: String(mb) },
    create: { kalit: CHEGARA_KALITI, qiymat: String(mb) },
  })
}

export interface BazaHajmi {
  /** Bazadagi ovozlarning umumiy hajmi (bayt) */
  bayt: number
  soni: number
  /** Eng eski saqlangan yozuv — chegara qancha kunni sig'dirayotganini ko'rsatadi */
  engEski: Date | null
}

export async function bazaHajmi(): Promise<BazaHajmi> {
  const r = await prisma.ovozYozuv.aggregate({
    where: { ombor: 'baza' },
    _sum: { hajm: true },
    _count: { _all: true },
    _min: { boshlandi: true },
  })
  return { bayt: Number(r._sum.hajm ?? 0), soni: r._count._all, engEski: r._min.boshlandi }
}

/**
 * Bazadagi ovozlarni `maqsadBayt` gacha qisqartiradi: eng yangilari
 * saqlanadi, qolgani (eng eskilari) o'chiriladi. Bitta SQL — bir vaqtda
 * ikki marta ishga tushsa ham bir xil to'plamni tanlaydi. Qaytaradi:
 * o'chirilgan yozuvlar soni.
 */
export async function bazaniQisqart(maqsadBayt: number): Promise<number> {
  return prisma.$executeRaw`
    DELETE FROM public.ovoz_yozuvlari
    WHERE id IN (
      SELECT id FROM (
        SELECT id, SUM(hajm) OVER (ORDER BY boshlandi DESC, id DESC) AS yigindi
        FROM public.ovoz_yozuvlari
        WHERE ombor = 'baza'
      ) t
      WHERE t.yigindi > ${Math.max(0, Math.floor(maqsadBayt))}
    )`
}

/** Chegaradan oshgan bo'lsa — eng eskilarini o'chiradi. Qaytaradi: o'chirilganlar soni. */
export async function chegaradanOshsaQisqart(): Promise<number> {
  const [chegaraMb, hajm] = await Promise.all([bazaChegarasiMb(), bazaHajmi()])
  const chegara = chegaraMb * MB
  if (hajm.bayt <= chegara) return 0
  const ochirildi = await bazaniQisqart(chegara * BOSHATISH_ULUSHI)
  if (ochirildi > 0) {
    console.info(`[ovoz baza] chegara ${chegaraMb} MB — ${ochirildi} ta eng eski yozuv o‘chirildi`)
  }
  return ochirildi
}

/**
 * Faylni (yoki uning bir qismini — tinglashda oldinga surish uchun)
 * o'qiydi. `dan`/`gacha` — baytlar, ikkalasi ham kiradi. Butun faylni
 * xotiraga olmaslik uchun qism bazaning o'zida kesiladi.
 */
export async function bazadanOqi(
  yozuvId: string, oraliq?: { dan: number; gacha: number },
): Promise<{ data: Uint8Array<ArrayBuffer>; jami: number } | null> {
  const qatorlar = oraliq
    ? await prisma.$queryRaw<{ data: Uint8Array; jami: number }[]>`
        SELECT substring(data FROM ${oraliq.dan + 1}::int FOR ${oraliq.gacha - oraliq.dan + 1}::int) AS data,
               octet_length(data)::int AS jami
        FROM public.ovoz_fayllar WHERE "yozuvId" = ${yozuvId}`
    : await prisma.$queryRaw<{ data: Uint8Array; jami: number }[]>`
        SELECT data, octet_length(data)::int AS jami
        FROM public.ovoz_fayllar WHERE "yozuvId" = ${yozuvId}`
  const q = qatorlar[0]
  if (!q) return null
  // Drayver Buffer yoki Uint8Array qaytarishi mumkin — Response uchun toza nusxa
  const data = new Uint8Array(new ArrayBuffer(q.data.byteLength))
  data.set(q.data)
  return { data, jami: Number(q.jami) }
}

/**
 * Bazadagi ombor ishlayaptimi: jadval bor va baytlar buzilmay boradi-keladi.
 * Haqiqiy yozuv yaratilmaydi (fayl yozuvga bog'langan) — bayt aylanishi
 * SQL ichida tekshiriladi.
 */
export async function bazaniTekshir(): Promise<{ ok: true } | { ok: false; xato: string }> {
  try {
    const namuna = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 255, 128, 7])
    const [r] = await prisma.$queryRaw<{ qaytdi: Uint8Array; jadval: boolean }[]>`
      SELECT ${namuna}::bytea AS qaytdi, to_regclass('public.ovoz_fayllar') IS NOT NULL AS jadval`
    if (!r?.jadval) return { ok: false, xato: 'Bazada ovoz_fayllar jadvali yo‘q — migratsiya qo‘llanmagan' }
    const qaytdi = new Uint8Array(r.qaytdi)
    if (qaytdi.length !== namuna.length || !namuna.every((b, i) => qaytdi[i] === b)) {
      return { ok: false, xato: 'Baza baytlarni buzib qaytardi' }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, xato: e instanceof Error ? e.message.slice(0, 200) : String(e) }
  }
}
