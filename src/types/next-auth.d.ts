import type { DefaultSession } from 'next-auth'

/**
 * Sessiyadagi hisob maydonlari. `lib/auth.ts` ularni login paytida yozadi va
 * har 30 soniyada bazadan (`hisobHolati`) yangilab turadi.
 *
 * Shu yerda e'lon qilingani uchun `session.user.rol` kabi maydonlar turlangan —
 * `(session.user as any)` kerak emas.
 */
export interface HisobMaydonlari {
  rol: string
  /** Filialga bog'langan xodim; `null` — Ega darajasi */
  filialId: string | null
  filialNomi: string | null
  /** Ulashilgan admin — katalogini ko'radigan Eganing id'si */
  ulashilganEgaId: string | null
  tovarTahrirlashMumkin: boolean
  tovarOchirishMumkin: boolean
  /** Ochiq bo'limlar va amallar; `null` — administrator (cheklanmaydi) */
  ruxsatlar: string[] | null
}

declare module 'next-auth' {
  /** `authorize` qaytaradigan hisob */
  interface User extends Partial<HisobMaydonlari> {
    id?: string
  }

  interface Session {
    user: HisobMaydonlari & { id: string } & DefaultSession['user']
  }
}
