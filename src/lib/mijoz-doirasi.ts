import type { Session } from 'next-auth'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { amalRuxsatiBormi } from '@/lib/ruxsat-server'
import { sessionEgaId, sessionFilialId } from '@/lib/filial-scope'
import { ARXIV_PREFIKS } from '@/lib/xodim-hisob'

// Mijozlarni ko'rish doirasi — xodim KIMNING mijozlarini ko'radi.
//
// Maqsad: xodimlar bir-birining mijozini "o'ziniki qilib" olmasin. Xodim
//   · o'ziga biriktirilgan (mas'ul) mijozlarni — odatda o'zi kiritganlarni,
//   · "barcha xodimlarga" ochiq kategoriyadagilarni,
//   · unga alohida ochilgan kategoriyadagilarni ko'radi.
// Administrator va "Barcha mijozlarni ko'rish" ruxsati borlar — hammasini.
// Mas'ul xodimi yo'q va kategoriyasi yopiq mijoz faqat administratorlarga.
//
// Shart BITTA joyda: mijozlar ro'yxati, kassa, nasiyalar, xaridlar, ballar
// va hisobotlar shundan foydalanadi — biror sahifa "unutib" qolmasin.

/** Ruxsatlar katalogidagi kalit: boshqa xodimlarning mijozlarini ham ko'rish */
export const BARCHA_MIJOZLAR = 'mijoz-doirasi.hammasi'

const meId = (session: Session) => (session.user as { id: string }).id
const adminmi = (session: Session) => (session.user as { rol?: string }).rol === 'ADMIN'

/** Do'kon/filial doirasi (mijoz va kategoriya uchun bir xil). */
export function mijozTenant(session: Session): { filialId: string } | { egaId: string | null } {
  const filialId = sessionFilialId(session)
  return filialId ? { filialId } : { egaId: sessionEgaId(session) }
}

/** Hammasini ko'radimi (administrator yoki alohida ruxsat). Bazadan jonli, 15 s kesh. */
export function barchaMijozlarniKoradi(session: Session): Promise<boolean> {
  return amalRuxsatiBormi(session, BARCHA_MIJOZLAR)
}

/** Ko'rinish sharti (do'kon doirasisiz). `null` — cheklov yo'q. */
export async function mijozKorinishi(session: Session): Promise<Prisma.MijozWhereInput | null> {
  if (await barchaMijozlarniKoradi(session)) return null
  const id = meId(session)
  return {
    OR: [
      { masulId: id },
      { kategoriya: { hammaga: true } },
      { kategoriya: { xodimlar: { some: { foydalanuvchiId: id } } } },
    ],
  }
}

/** Mijozlar ro'yxati uchun to'liq shart: do'kon doirasi + ko'rinish. */
export async function mijozDoirasi(session: Session): Promise<Prisma.MijozWhereInput> {
  const k = await mijozKorinishi(session)
  const t = mijozTenant(session)
  return k ? { AND: [t, k] } : t
}

/**
 * Mijozga bog'lanishi ixtiyoriy yozuvlar (sotuv, saqlangan zakaz) uchun:
 * mijozsizlari ham ko'rinadi, mijozlilari — faqat ko'rinadigan mijozda.
 */
export function mijozliYozuvSharti(k: Prisma.MijozWhereInput | null) {
  return k ? { OR: [{ mijozId: null }, { mijoz: k }] } : {}
}

/** Shu mijoz bu foydalanuvchiga ko'rinadimi (yozishdan oldin tekshiruv). */
export async function mijozKorinadimi(session: Session, mijozId: string): Promise<boolean> {
  const n = await prisma.mijoz.count({ where: { AND: [{ id: mijozId }, await mijozDoirasi(session)] } })
  return n > 0
}

/**
 * Yangi mijozning egasi. Xodim kiritsa — o'ziga biriktiriladi (unga doim
 * ko'rinadi); administrator kiritsa — hech kimga (faqat administratorlar,
 * keyin xohlagan xodimga biriktiradi).
 */
export function yangiMijozEgaligi(session: Session): { yaratganId: string; masulId: string | null } {
  const id = meId(session)
  return { yaratganId: id, masulId: adminmi(session) ? null : id }
}

/** Foydalanuvchi ko'radigan (va mijozga tanlay oladigan) kategoriyalar sharti. */
export async function kategoriyaDoirasi(session: Session): Promise<Prisma.MijozKategoriyaWhereInput> {
  const t = mijozTenant(session)
  if (await barchaMijozlarniKoradi(session)) return t
  const id = meId(session)
  return { AND: [t, { OR: [{ hammaga: true }, { xodimlar: { some: { foydalanuvchiId: id } } }] }] }
}

/**
 * So'rovdagi `kategoriyaId` ni tekshiradi: bo'sh — kategoriyasiz,
 * `undefined` — o'zgartirilmaydi, aks holda shu foydalanuvchiga ko'rinadigan bo'lishi shart.
 */
export async function kategoriyaniTekshir(
  session: Session, qiymat: unknown,
): Promise<{ ok: true; kategoriyaId: string | null | undefined } | { ok: false; xato: string }> {
  if (qiymat === undefined) return { ok: true, kategoriyaId: undefined }
  if (qiymat === null || qiymat === '') return { ok: true, kategoriyaId: null }
  if (typeof qiymat !== 'string') return { ok: false, xato: 'Kategoriya noto‘g‘ri' }
  const bor = await prisma.mijozKategoriya.count({ where: { AND: [{ id: qiymat }, await kategoriyaDoirasi(session)] } })
  return bor ? { ok: true, kategoriyaId: qiymat } : { ok: false, xato: 'Kategoriya topilmadi' }
}

/**
 * Mas'ul xodimni tekshiradi — faqat administrator belgilaydi va xodim shu
 * do'kon/filialniki bo'lishi shart. `undefined` — o'zgartirilmaydi.
 */
export async function masulniTekshir(
  session: Session, qiymat: unknown,
): Promise<{ ok: true; masulId: string | null | undefined } | { ok: false; xato: string; holat: number }> {
  if (qiymat === undefined) return { ok: true, masulId: undefined }
  if (!adminmi(session)) return { ok: false, xato: 'Mas’ul xodimni faqat administrator belgilaydi', holat: 403 }
  if (qiymat === null || qiymat === '') return { ok: true, masulId: null }
  if (typeof qiymat !== 'string') return { ok: false, xato: 'Xodim noto‘g‘ri', holat: 400 }
  const x = await prisma.foydalanuvchi.findFirst({ where: { AND: [{ id: qiymat }, xodimDoirasi(session)] }, select: { id: true } })
  return x ? { ok: true, masulId: x.id } : { ok: false, xato: 'Xodim topilmadi', holat: 404 }
}

/**
 * Mijozga mas'ul bo'la oladigan xodimlar: mijoz bilan bir do'kon/filialda
 * ishlaydiganlar (filial xodimi markaziy do'kon mijozini baribir ko'rmaydi).
 * O'chirilgan (arxiv) hisoblar kirmaydi.
 */
export function xodimDoirasi(session: Session): Prisma.FoydalanuvchiWhereInput {
  const arxivEmas: Prisma.FoydalanuvchiWhereInput = { NOT: { login: { startsWith: ARXIV_PREFIKS } } }
  const filialId = sessionFilialId(session)
  if (filialId) return { AND: [{ filialId }, arxivEmas] }
  const ega = sessionEgaId(session)
  if (!ega) return { id: '' }
  return {
    AND: [arxivEmas, { filialId: null }, {
      // Ega, unga ulangan xodimlar va hech kimga biriktirilmagan eski xodimlar
      OR: [{ id: ega }, { ulashilganEgaId: ega }, { ulashilganEgaId: null, rol: { not: 'ADMIN' } }],
    }],
  }
}
