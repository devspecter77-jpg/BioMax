// Xodim rollari — bitta joyda. Menyu, xodim formasi, API tekshiruvi va
// yorliqlar shu ro'yxatdan oladi: yangi rol qo'shilsa hamma joyga yetadi.
// Prisma `Rol` enum bilan bir xil bo'lishi shart (prisma/schema.prisma).

export const ROLLAR = ['ADMIN', 'KASSIR', 'OMBORCHI', 'SOTUVCHI', 'DOSTAVCHIK', 'AGENT'] as const
export type XodimRoli = (typeof ROLLAR)[number]

export const ROL_NOMI: Record<string, string> = {
  ADMIN: 'Administrator',
  KASSIR: 'Kassir',
  OMBORCHI: 'Omborchi',
  SOTUVCHI: 'Sotuvchi',
  DOSTAVCHIK: 'Dostavchik',
  AGENT: 'Agent',
} satisfies Record<XodimRoli, string>

export function rolmi(x: unknown): x is XodimRoli {
  return typeof x === 'string' && (ROLLAR as readonly string[]).includes(x)
}
