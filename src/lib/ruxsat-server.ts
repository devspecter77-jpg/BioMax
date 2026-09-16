import type { Session } from 'next-auth'
import { prisma } from './prisma'
import { barchaRuxsatKalitlari, samaraliRuxsatlar } from './ruxsat-katalogi'

// Ruxsatlar — server tomoni.
//
// Ilgari ruxsatlar faqat LOGIN paytida hisoblanib JWT'ga yozilardi: Ega
// xodimning ruxsatini o'zgartirsa ham, xodim qayta kirmaguncha eski ruxsat
// bilan ishlayverardi; o'chirilgan (faol emas) xodim ham sessiyasi tugaguncha
// tizimda qolardi. Endi hisob holati bazadan jonli o'qiladi (qisqa kesh bilan)
// va sessiya har 30 soniyada yangilanadi — `auth.ts` dagi `jwt` qarang.

export interface HisobHolati {
  id: string
  ism: string
  login: string
  faol: boolean
  rol: string
  filialId: string | null
  filialNomi: string | null
  ulashilganEgaId: string | null
  tovarTahrirlashMumkin: boolean
  tovarOchirishMumkin: boolean
  /** `null` — administrator (cheklanmaydi) */
  ruxsatlar: string[] | null
  /** Yashirilgan maydonlar (`MaydonYashirish`) — masalan `kelishNarxi` */
  yashirinMaydonlar: string[]
}

const KESH_MS = 15_000
const kesh = new Map<string, { vaqt: number; holat: HisobHolati | null }>()

/** Hisob holati va samarali ruxsatlar — bazadan, 15 soniyalik kesh bilan. */
export async function hisobHolati(foydalanuvchiId: string, keshsiz = false): Promise<HisobHolati | null> {
  const bor = kesh.get(foydalanuvchiId)
  if (!keshsiz && bor && Date.now() - bor.vaqt < KESH_MS) return bor.holat

  const f = await prisma.foydalanuvchi.findUnique({
    where: { id: foydalanuvchiId },
    select: {
      id: true, ism: true, login: true, faol: true, rol: true, filialId: true, ulashilganEgaId: true,
      tovarTahrirlashMumkin: true, tovarOchirishMumkin: true,
      filial: { select: { nomi: true } },
      ruxsatlar: { select: { bolim: true, korinadi: true } },
      yashirilganMaydonlar: { select: { maydon: true } },
    },
  })
  const holat: HisobHolati | null = f ? {
    id: f.id, ism: f.ism, login: f.login, faol: f.faol, rol: f.rol, filialId: f.filialId,
    filialNomi: f.filial?.nomi ?? null, ulashilganEgaId: f.ulashilganEgaId,
    tovarTahrirlashMumkin: f.tovarTahrirlashMumkin, tovarOchirishMumkin: f.tovarOchirishMumkin,
    ruxsatlar: f.rol === 'ADMIN' ? null : samaraliRuxsatlar(f.rol, new Map(f.ruxsatlar.map(r => [r.bolim, r.korinadi]))),
    yashirinMaydonlar: f.yashirilganMaydonlar.map(m => m.maydon),
  } : null
  kesh.set(foydalanuvchiId, { vaqt: Date.now(), holat })
  return holat
}

/** Ruxsat o'zgartirilganda — keyingi so'rov bazadan yangisini o'qisin. */
export function ruxsatKeshiniTozala(foydalanuvchiId?: string) {
  if (foydalanuvchiId) kesh.delete(foydalanuvchiId)
  else kesh.clear()
}

/**
 * Bo'lim ruxsatini SERVER tomonda tekshiradi (sessiyadagi ro'yxat bo'yicha).
 *
 * ADMIN cheklanmaydi (sessiyada `ruxsatlar === null`). Katalogda yo'q kalit
 * uchun `true` qaytariladi — u ruxsatlar tizimi bilan boshqarilmaydi.
 */
export function bolimRuxsatiBormi(session: Session | null, kalit: string): boolean {
  if (!session) return false
  const u = session.user as unknown as { rol?: string; ruxsatlar?: string[] | null }
  if (u?.rol === 'ADMIN') return true
  if (!barchaRuxsatKalitlari.includes(kalit)) return true
  return Array.isArray(u?.ruxsatlar) && u.ruxsatlar.includes(kalit)
}

/**
 * Amal ruxsati — bazadan JONLI (kesh 15 s). Pul yoki o'chirish kabi nozik
 * amallarda sessiyaga emas, shunga tayanish kerak: ruxsat hozirgina olib
 * qo'yilgan bo'lsa ham darhol kuchga kiradi.
 */
export async function amalRuxsatiBormi(session: Session | null, kalit: string): Promise<boolean> {
  const id = (session?.user as { id?: string } | undefined)?.id
  if (!id) return false
  const h = await hisobHolati(id)
  if (!h || !h.faol) return false
  if (h.ruxsatlar === null) return true
  return h.ruxsatlar.includes(kalit)
}
