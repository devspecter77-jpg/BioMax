import type { Metadata } from 'next'

// Brauzer yorlig'ida qaysi bo'lim ochiqligi ko'rinishi uchun.
// Sahifaning o'zi 'use client' bo'lgani sababli metadata shu yerda.
export const metadata: Metadata = {
  title: 'To‘lovlar',
  description: "Kirim va chiqim, filial kesimida",
}

export default function TolovlarLayout({ children }: { children: React.ReactNode }) {
  return children
}
