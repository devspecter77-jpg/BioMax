import { NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import { auth } from './auth'
import { prisma } from './prisma'
import { sessionFilialId } from './filial-scope'
import { amalRuxsatiBormi } from './ruxsat-server'

// Xodimlar bo'limi marshrutlari uchun umumiy tekshiruv.
//
// Doira `/api/xodimlar` bilan bir xil: filialga bog'langan foydalanuvchi faqat
// o'z filiali xodimlarini, filialsiz Ega esa hammasini ko'radi.

export function xodimDoirasi(session: Session | null) {
  const filialId = sessionFilialId(session)
  return filialId ? { filialId } : {}
}

export interface XodimKontekst {
  session: Session
  meId: string
  admin: boolean
  xodim: { id: string; ism: string; rol: string; faol: boolean; filialId: string | null }
}

/**
 * Sessiya, ruxsat (bazadan jonli) va xodim doirasi — bitta chaqiruvda.
 * `kalit` — kerakli ruxsat (masalan `xodimlar.mulk`).
 */
export async function xodimKontekst(xodimId: string, kalit: string): Promise<{ ok: true; k: XodimKontekst } | { ok: false; javob: NextResponse }> {
  const session = await auth()
  if (!session) return { ok: false, javob: NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 }) }
  if (!(await amalRuxsatiBormi(session, kalit))) {
    return { ok: false, javob: NextResponse.json({ xato: 'Bu amalga ruxsatingiz yo‘q', kod: 'ruxsat_yoq' }, { status: 403 }) }
  }
  const xodim = await prisma.foydalanuvchi.findFirst({
    where: { id: xodimId, ...xodimDoirasi(session) },
    select: { id: true, ism: true, rol: true, faol: true, filialId: true },
  })
  if (!xodim) return { ok: false, javob: NextResponse.json({ xato: 'Xodim topilmadi' }, { status: 404 }) }
  const u = session.user as unknown as { id: string; rol?: string }
  return { ok: true, k: { session, meId: u.id, admin: u.rol === 'ADMIN', xodim } }
}

/**
 * Administrator bo'lmagan xodim o'z hisobidagi yozuvlarni o'zgartira olmaydi
 * (o'ziga berilgan mashinani "qaytarildi" deb yopib qo'yish kabi).
 */
export function oziniOzgartiryaptimi(k: XodimKontekst, xodimId = k.xodim.id): NextResponse | null {
  if (!k.admin && xodimId === k.meId) {
    return NextResponse.json({ xato: 'O‘z hisobingizdagi yozuvni o‘zgartira olmaysiz', kod: 'ruxsat_yoq' }, { status: 403 })
  }
  return null
}

// ─── Biriktirilgan mulk ──────────────────────────────────────────────────────

export const MULK_SELECT = {
  id: true, xodimId: true, turi: true, nomi: true, raqami: true, qiymati: true,
  berilganSana: true, berilganHolat: true, izoh: true,
  holati: true, yakunSana: true, yakunIzoh: true, yaratilgan: true,
  yaratgan: { select: { ism: true } },
  yakunlagan: { select: { ism: true } },
} as const

export function mulkniTekisla<T extends { qiymati: unknown }>(m: T) {
  return { ...m, qiymati: m.qiymati === null ? null : Number(m.qiymati) }
}
