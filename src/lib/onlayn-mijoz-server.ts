import type { Session } from 'next-auth'
import { prisma } from './prisma'
import { egaFilialWhere } from './filial-scope'
import { telefonVariantlari } from './onlayn-sotuv'
import type { ErpKarta } from './onlayn-mijoz'

// Onlayn xaridorning do'kondagi izi — baza bilan ishlaydigan qism.

const oxirgiToqqiz = (t: string) => t.replace(/\D/g, '').slice(-9)

/**
 * Telefon raqamlari bo'yicha do'kondagi mijoz kartalari (xodim doirasida).
 * Onlayn buyurtma topshirilganda karta aynan shu qoida bilan topiladi yoki
 * ochiladi (`onlaynSotuvYarat`) — shuning uchun bu yerda ham telefon kalit.
 */
export async function erpKartalari(session: Session, telefonlar: string[]): Promise<Map<string, ErpKarta>> {
  const variantlar = [...new Set(telefonlar.flatMap(telefonVariantlari))]
  if (variantlar.length === 0) return new Map()
  const kartalar = await prisma.mijoz.findMany({
    where: {
      AND: [
        { OR: [{ telefon: { in: variantlar } }, { telefon2: { in: variantlar } }, { qoshimchaTelefonlar: { hasSome: variantlar } }] },
        egaFilialWhere(session),
      ],
    },
    select: { id: true, ism: true, telefon: true, telefon2: true, qoshimchaTelefonlar: true, _count: { select: { sotuvlar: true } } },
    orderBy: { yaratilgan: 'asc' },
  })
  const natija = new Map<string, ErpKarta>()
  for (const k of kartalar) {
    for (const t of [k.telefon, k.telefon2, ...k.qoshimchaTelefonlar]) {
      if (!t) continue
      const kalit = oxirgiToqqiz(t)
      // Bir raqamda bir nechta karta bo'lsa — eng eskisi (birinchi ochilgani)
      if (!natija.has(kalit)) natija.set(kalit, { id: k.id, ism: k.ism, sotuvSoni: k._count.sotuvlar })
    }
  }
  return new Map(telefonlar.map(t => [t, natija.get(oxirgiToqqiz(t))]).filter((x): x is [string, ErpKarta] => !!x[1]))
}

/** Buyurtma raqamlari bo'yicha ERP'dagi sotuv (chek) — topshirilganlarda bo'ladi. */
export async function onlaynCheklar(raqamlar: string[]) {
  if (raqamlar.length === 0) return new Map<string, { id: string; chekRaqami: string; sana: string; holati: string }>()
  const sotuvlar = await prisma.sotuv.findMany({
    where: { onlaynRaqam: { in: raqamlar } },
    select: { id: true, chekRaqami: true, sana: true, holati: true, onlaynRaqam: true },
  })
  return new Map(sotuvlar.map(s => [s.onlaynRaqam!, { id: s.id, chekRaqami: s.chekRaqami, sana: s.sana.toISOString(), holati: s.holati }]))
}
