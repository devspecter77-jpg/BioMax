// Onlayn do'kon xaridorini saytdan chiqarish (bloklash) va qayta ruxsat berish.
//
// Holatning O'ZI marketplace'da: `marketplace.mp_hisoblar.faol`. Sayt uni har
// so'rovda tekshiradi (`joriyHisob`: faol=true sharti) va kirishda ham
// ("Hisob bloklangan. Do'kon bilan bog'laning.") — shuning uchun faol=false
// bo'lishi bilan xaridorning seansi darhol tugaydi, u qayta kira olmaydi va
// buyurtma bera olmaydi. Marketplace kodiga o'zgartirish va joylash kerak emas.
//
// Bu yerda ERP bazadan to'g'ridan-to'g'ri yozadi (ikkala tizim bitta bazada,
// ERP buyurtmalarni ham shu yo'l bilan o'qiydi): bu oddiy bayroq, uni saytning
// o'zi tekshiradi. Kim, qachon, nima sababdan — ERP jurnalida
// (`onlayn_hisob_bloklari`). Jadval nomlari `marketplace.`/`public.` bilan:
// pooler orqali ulanishda search_path boshqacha bo'lishi mumkin.

import type { Session } from 'next-auth'
import { prisma } from './prisma'
import { BLOK_SABAB_CHEGARA, type OnlaynBlokYozuvi } from './onlayn-mijoz'

/** Faol (hali tugamagan) buyurtma holatlari — ogohlantirish uchun */
const FAOL_HOLATLAR = ['YANGI', 'TASDIQLANGAN', 'YIGILMOQDA', 'YOLDA']

export class BlokXatosi extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

interface HisobQatori { id: string; telefon: string; ism: string | null; faol: boolean }

function yozuv(q: { id: string; amal: 'CHIQARILDI' | 'QAYTARILDI'; sabab: string | null; foydalanuvchiIsm: string | null; yaratilgan: Date }): OnlaynBlokYozuvi {
  return { id: q.id, amal: q.amal, sabab: q.sabab, foydalanuvchiIsm: q.foydalanuvchiIsm, yaratilgan: q.yaratilgan.toISOString() }
}

/**
 * Xaridorni saytdan chiqaradi (`faol: false`) yoki qayta ruxsat beradi.
 * Holat va jurnal bitta tranzaksiyada; qator qulflanadi — ikki admin bir
 * vaqtda bossa ham jurnalda takror yozuv bo'lmaydi.
 */
export async function hisobHolatiniOzgartir(params: {
  hisobId: string
  chiqarish: boolean
  sabab: string | null
  session: Session
}): Promise<{ hisob: HisobQatori; yozuv: OnlaynBlokYozuvi; faolBuyurtmalar: number }> {
  const sabab = params.sabab?.trim().replace(/\s+/g, ' ').slice(0, BLOK_SABAB_CHEGARA) || null
  if (params.chiqarish && (!sabab || sabab.length < 3)) {
    throw new BlokXatosi(400, 'Sababini yozing — keyin nima uchun chiqarilgani ko‘rinib tursin')
  }
  const u = params.session.user as { id: string; name?: string | null; ism?: string | null }
  const foydalanuvchi = await prisma.foydalanuvchi.findUnique({ where: { id: u.id }, select: { ism: true } })

  return prisma.$transaction(async tx => {
    const [hisob] = await tx.$queryRaw<HisobQatori[]>`
      SELECT id, telefon, ism, faol FROM marketplace.mp_hisoblar WHERE id = ${params.hisobId} FOR UPDATE`
    if (!hisob) throw new BlokXatosi(404, 'Xaridor topilmadi')
    if (params.chiqarish && !hisob.faol) throw new BlokXatosi(409, 'Bu xaridor allaqachon saytdan chiqarilgan')
    if (!params.chiqarish && hisob.faol) throw new BlokXatosi(409, 'Bu xaridorning saytga kirishi ochiq')

    await tx.$executeRaw`
      UPDATE marketplace.mp_hisoblar SET faol = ${!params.chiqarish}, yangilangan = now() WHERE id = ${hisob.id}`
    const yangi = await tx.onlaynHisobBloki.create({
      data: {
        hisobId: hisob.id,
        telefon: hisob.telefon,
        ism: hisob.ism,
        amal: params.chiqarish ? 'CHIQARILDI' : 'QAYTARILDI',
        sabab,
        foydalanuvchiId: u.id,
        foydalanuvchiIsm: foydalanuvchi?.ism ?? u.name ?? null,
      },
    })
    const [son] = await tx.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM marketplace.mp_buyurtmalar
      WHERE "hisobId" = ${hisob.id} AND holati::text = ANY(${FAOL_HOLATLAR})`
    return { hisob: { ...hisob, faol: !params.chiqarish }, yozuv: yozuv(yangi), faolBuyurtmalar: son?.n ?? 0 }
  }, { maxWait: 10_000, timeout: 20_000 })
}

/** Hisoblar bo'yicha OXIRGI chiqarish yozuvi — ro'yxatda sababi ko'rinsin. */
export async function oxirgiChiqarishlar(hisobIdlar: string[]): Promise<Map<string, OnlaynBlokYozuvi>> {
  if (hisobIdlar.length === 0) return new Map()
  const qatorlar = await prisma.onlaynHisobBloki.findMany({
    where: { hisobId: { in: hisobIdlar }, amal: 'CHIQARILDI' },
    orderBy: { yaratilgan: 'desc' },
    distinct: ['hisobId'],
  })
  return new Map(qatorlar.map(q => [q.hisobId, yozuv(q)]))
}

/** Bitta xaridorning to'liq tarixi — eng yangisi tepada. */
export async function blokTarixi(hisobId: string): Promise<OnlaynBlokYozuvi[]> {
  const qatorlar = await prisma.onlaynHisobBloki.findMany({
    where: { hisobId },
    orderBy: { yaratilgan: 'desc' },
    take: 50,
  })
  return qatorlar.map(yozuv)
}

/** Saytdan chiqarilgan xaridorlar soni */
export async function bloklanganSoni(): Promise<number> {
  const [q] = await prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM marketplace.mp_hisoblar WHERE faol = false`
  return q?.n ?? 0
}

/** Buyurtma raqami bo'yicha uning xaridori (hisob) — buyurtma oynasidan chiqarish uchun */
export async function buyurtmaXaridori(raqam: string): Promise<{ hisobId: string; faol: boolean; ism: string | null; telefon: string } | null> {
  const [q] = await prisma.$queryRaw<{ hisobId: string; faol: boolean; ism: string | null; telefon: string }[]>`
    SELECT h.id AS "hisobId", h.faol, h.ism, h.telefon
    FROM marketplace.mp_buyurtmalar b JOIN marketplace.mp_hisoblar h ON h.id = b."hisobId"
    WHERE b.raqam = ${raqam} LIMIT 1`
  return q ?? null
}
