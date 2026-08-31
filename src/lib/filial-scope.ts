import type { Session } from 'next-auth'

/**
 * Filialga bog'langan foydalanuvchi (filial egasi/xodimi) uchun filialId qaytaradi.
 * Bosh egasi (Ega, filialId yo'q) uchun `null` — bu holatda ma'lumotlar cheklanmaydi,
 * chunki Ega barcha filiallarni (va filialsiz eski ma'lumotlarni) ko'rishi kerak.
 */
export function sessionFilialId(session: Session | null): string | null {
  return (session?.user as any)?.filialId ?? null
}
