import type { Session } from 'next-auth'
import { prisma } from './prisma'

/**
 * Ulashilgan admin uchun tovar tahrirlash/o'chirish ruxsatini HAR DOIM
 * bazadan jonli o'qiydi — JWT sessiyadagi qiymatga tayanmaydi.
 *
 * Sabab: NextAuth JWT sessiyasi faqat login vaqtida to'ldiriladi va keyin
 * qayta bazaga so'rov yubormaydi. Agar Ega ruxsatni o'zgartirsa (masalan
 * "tahrirlash mumkin emas" qilib qo'ysa), allaqachon login qilgan
 * ulashilgan adminning sessiyasi eski ("mumkin") qiymatni saqlab qoladi —
 * u qayta login qilmaguncha. Bu yerda bazadan jonli o'qish orqali
 * o'zgarish darhol kuchga kiradi.
 */
export async function tovarYozishRuxsatlari(session: Session | null): Promise<{ tahrirlashMumkin: boolean; ochirishMumkin: boolean }> {
  const u = session?.user as any
  if (!u?.ulashilganEgaId) return { tahrirlashMumkin: true, ochirishMumkin: true }

  const foydalanuvchi = await prisma.foydalanuvchi.findUnique({
    where: { id: u.id },
    select: { tovarTahrirlashMumkin: true, tovarOchirishMumkin: true },
  })
  return {
    tahrirlashMumkin: foydalanuvchi?.tovarTahrirlashMumkin ?? true,
    ochirishMumkin: foydalanuvchi?.tovarOchirishMumkin ?? true,
  }
}
