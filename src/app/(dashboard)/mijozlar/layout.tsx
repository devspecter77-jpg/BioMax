import type { Metadata } from 'next'

// Brauzer yorlig'ida qaysi bo'lim ochiqligi ko'rinishi uchun.
// Sahifaning o'zi 'use client' bo'lgani sababli metadata shu yerda.
export const metadata: Metadata = {
  title: 'Mijozlar',
  description: "Mijozlar bazasi va xarid tarixi",
}

export default function MijozlarLayout({ children }: { children: React.ReactNode }) {
  return children
}
