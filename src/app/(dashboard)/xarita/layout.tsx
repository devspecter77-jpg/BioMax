import type { Metadata } from 'next'

// Brauzer yorlig'ida qaysi bo'lim ochiqligi ko'rinishi uchun.
// Sahifaning o'zi 'use client' bo'lgani sababli metadata shu yerda.
export const metadata: Metadata = {
  title: 'Xarita',
  description: "Filiallar va xodimlar joylashuvi",
}

export default function XaritaLayout({ children }: { children: React.ReactNode }) {
  return children
}
