import type { Metadata } from 'next'

// Brauzer yorlig'ida qaysi bo'lim ochiqligi ko'rinishi uchun.
// Sahifaning o'zi 'use client' bo'lgani sababli metadata shu yerda.
export const metadata: Metadata = {
  title: 'Xaridlar',
  description: "Ta’minotchilardan olingan mahsulotlar",
}

export default function XaridlarLayout({ children }: { children: React.ReactNode }) {
  return children
}
