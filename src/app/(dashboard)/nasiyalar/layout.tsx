import type { Metadata } from 'next'

// Brauzer yorlig'ida qaysi bo'lim ochiqligi ko'rinishi uchun.
// Sahifaning o'zi 'use client' bo'lgani sababli metadata shu yerda.
export const metadata: Metadata = {
  title: 'Nasiyalar',
  description: "Qarzlar va to‘lov muddatlari",
}

export default function NasiyalarLayout({ children }: { children: React.ReactNode }) {
  return children
}
