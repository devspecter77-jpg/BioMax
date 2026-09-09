import type { Metadata } from 'next'

// Brauzer yorlig'ida qaysi bo'lim ochiqligi ko'rinishi uchun.
// Sahifaning o'zi 'use client' bo'lgani sababli metadata shu yerda.
export const metadata: Metadata = {
  title: 'Tovarlar',
  description: "Mahsulotlar katalogi, narxlar va QR yorliqlar",
}

export default function TovarlarLayout({ children }: { children: React.ReactNode }) {
  return children
}
