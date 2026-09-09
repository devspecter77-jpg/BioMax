import type { Metadata } from 'next'

// Brauzer yorlig'ida qaysi bo'lim ochiqligi ko'rinishi uchun.
// Sahifaning o'zi 'use client' bo'lgani sababli metadata shu yerda.
export const metadata: Metadata = {
  title: 'Sotuv (POS)',
  description: "Kassa — mahsulot sotish va chek chiqarish",
}

export default function SotuvLayout({ children }: { children: React.ReactNode }) {
  return children
}
