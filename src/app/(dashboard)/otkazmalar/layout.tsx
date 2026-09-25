import type { Metadata } from 'next'

// Brauzer yorlig'ida qaysi bo'lim ochiqligi ko'rinishi uchun.
// Sahifaning o'zi 'use client' bo'lgani sababli metadata shu yerda.
export const metadata: Metadata = {
  title: 'Omborlararo o‘tkazma',
  description: "Omborlar va filiallar orasida mahsulot ko‘chirish",
}

export default function OtkazmalarLayout({ children }: { children: React.ReactNode }) {
  return children
}
