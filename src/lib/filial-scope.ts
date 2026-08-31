import type { Session } from 'next-auth'

/**
 * Filialga bog'langan foydalanuvchi (filial egasi/xodimi) uchun filialId qaytaradi.
 * Bosh egasi (Ega, filialId yo'q) uchun `null` — bu holatda ma'lumotlar cheklanmaydi,
 * chunki Ega barcha filiallarni (va filialsiz eski ma'lumotlarni) ko'rishi kerak.
 */
export function sessionFilialId(session: Session | null): string | null {
  return (session?.user as any)?.filialId ?? null
}

/**
 * Filialsiz (Ega darajasidagi) foydalanuvchi uchun — mahsulotlar qaysi
 * Eganing katalogiga tegishli ekanini aniqlaydi. Haqiqiy Ega o'zining
 * id'sini ko'radi; ulashilgan admin esa ulashgan Eganing id'sini —
 * ya'ni bir xil qatorlarni jonli (nusxasiz) ko'radi.
 */
export function sessionEgaId(session: Session | null): string | null {
  const u = session?.user as any
  if (!u || u.filialId) return null
  return u.ulashilganEgaId || u.id
}

/** Haqiqiy Ega — boshqa birovning ulashgan admin emas. */
export function sessionIsRealEga(session: Session | null): boolean {
  const u = session?.user as any
  return !!u && !u.filialId && !u.ulashilganEgaId
}

/**
 * filialId/egaId modeliga ega har qanday jadval (Kategoriya, Taminotchi,
 * Sotuv, Tovar, Mijoz) uchun to'g'ridan-to'g'ri `where`ga qo'shiladigan
 * qism qaytaradi — filialga bog'langan bo'lsa shu filialga, aks holda
 * shu (yoki ulashgan) Eganing egaId'siga qulflaydi. Hech qachon "bo'sh
 * obyekt" qaytarmaydi — shuning uchun Ega darajasidagi ma'lumotlar
 * boshqa Egalarnikiga aralashib ketmaydi.
 */
export function egaFilialWhere(session: Session | null): { filialId: string } | { filialId: null; egaId: string | null } {
  const filialId = sessionFilialId(session)
  if (filialId) return { filialId }
  return { filialId: null, egaId: sessionEgaId(session) }
}
