import type { Session } from 'next-auth'
import { barchaRuxsatKalitlari } from './ruxsat-katalogi'

/**
 * Bo'lim ruxsatini SERVER tomonda tekshiradi.
 *
 * `proxy.ts` faqat SAHIFA manzillarini qo'riqlaydi — `/api/...` har doim
 * o'tkaziladi ("API'lar o'zi tekshiradi" degan taxmin bilan). Shuning uchun
 * nozik ma'lumot qaytaradigan marshrut sahifa yopiq bo'lsa ham to'g'ridan-to'g'ri
 * chaqirilishi mumkin. Bu yordamchi shu teshikni yopadi.
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
