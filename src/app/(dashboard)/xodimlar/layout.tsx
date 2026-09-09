import type { Metadata } from 'next'

// Brauzer yorlig'ida qaysi bo'lim ochiqligi ko'rinishi uchun.
// Sahifaning o'zi 'use client' bo'lgani sababli metadata shu yerda.
export const metadata: Metadata = {
  title: 'Xodimlar',
  description: "Oylik, bonus va yangi xodim qo‘shish",
}

export default function XodimlarLayout({ children }: { children: React.ReactNode }) {
  return children
}
