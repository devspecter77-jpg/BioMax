import type { Session } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { mijozTenant, xodimDoirasi } from '@/lib/mijoz-doirasi'
import { RANGLAR, type KategoriyaRangi } from '@/lib/mijoz-kategoriya'

type Natija =
  | { ok: true; nomi?: string; rang?: KategoriyaRangi; hammaga?: boolean; xodimIdlar?: string[] }
  | { ok: false; xato: string; holat: number }

/**
 * Kategoriya so'rovini tekshiradi. `id` — tahrirlanayotgan kategoriya (yangisida null).
 * Faqat berilgan maydonlar qaytadi; yangi kategoriyada nom majburiy.
 */
export async function kategoriyaMalumoti(session: Session, tana: unknown, id: string | null): Promise<Natija> {
  if (!tana || typeof tana !== 'object') return { ok: false, xato: "So'rov noto'g'ri", holat: 400 }
  const t = tana as Record<string, unknown>
  const natija: Extract<Natija, { ok: true }> = { ok: true }

  if (t.nomi !== undefined || !id) {
    const nomi = typeof t.nomi === 'string' ? t.nomi.trim().replace(/\s+/g, ' ') : ''
    if (nomi.length < 2) return { ok: false, xato: 'Kategoriya nomini yozing', holat: 400 }
    if (nomi.length > 40) return { ok: false, xato: 'Nom 40 belgidan oshmasin', holat: 400 }
    // Filialsiz qatorlarda @@unique ishlamaydi — takrorni shu yerda tekshiramiz
    const takror = await prisma.mijozKategoriya.findFirst({
      where: { ...mijozTenant(session), nomi: { equals: nomi, mode: 'insensitive' }, ...(id ? { NOT: { id } } : {}) },
      select: { id: true },
    })
    if (takror) return { ok: false, xato: `«${nomi}» kategoriyasi allaqachon bor`, holat: 409 }
    natija.nomi = nomi
  }
  if (t.rang !== undefined) {
    if (typeof t.rang !== 'string' || !(RANGLAR as readonly string[]).includes(t.rang)) return { ok: false, xato: 'Rang noto‘g‘ri', holat: 400 }
    natija.rang = t.rang as KategoriyaRangi
  }
  if (t.hammaga !== undefined) {
    if (typeof t.hammaga !== 'boolean') return { ok: false, xato: "So'rov noto'g'ri", holat: 400 }
    natija.hammaga = t.hammaga
  }
  if (t.xodimIdlar !== undefined) {
    if (!Array.isArray(t.xodimIdlar) || t.xodimIdlar.some(x => typeof x !== 'string') || t.xodimIdlar.length > 500) {
      return { ok: false, xato: "Xodimlar ro'yxati noto'g'ri", holat: 400 }
    }
    const idlar = [...new Set(t.xodimIdlar as string[])]
    if (idlar.length) {
      const bor = await prisma.foydalanuvchi.count({ where: { AND: [{ id: { in: idlar } }, xodimDoirasi(session), { rol: { not: 'ADMIN' } }] } })
      if (bor !== idlar.length) return { ok: false, xato: 'Xodim topilmadi', holat: 404 }
    }
    natija.xodimIdlar = idlar
  }
  return natija
}
