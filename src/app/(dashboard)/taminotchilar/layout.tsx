import type { Metadata } from 'next'

// Brauzer yorlig'ida qaysi bo'lim ochiqligi ko'rinishi uchun.
// Sahifaning o'zi 'use client' bo'lgani sababli metadata shu yerda.
export const metadata: Metadata = {
  title: 'Ta’minotchilar',
  description: "Yetkazib beruvchilar va mahsulot so‘rovlari",
}

export default function TaminotchilarLayout({ children }: { children: React.ReactNode }) {
  return children
}
