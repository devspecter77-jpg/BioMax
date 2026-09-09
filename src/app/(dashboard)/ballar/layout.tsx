import type { Metadata } from 'next'

// Brauzer yorlig'ida qaysi bo'lim ochiqligi ko'rinishi uchun.
// Sahifaning o'zi 'use client' bo'lgani sababli metadata shu yerda.
export const metadata: Metadata = {
  title: 'Ballar va keshbeklar',
  description: "Mijozlar sodiqlik dasturi",
}

export default function BallarLayout({ children }: { children: React.ReactNode }) {
  return children
}
