import type { Metadata } from 'next'

// Brauzer yorlig'ida qaysi bo'lim ochiqligi ko'rinishi uchun.
// Sahifaning o'zi 'use client' bo'lgani sababli metadata shu yerda.
export const metadata: Metadata = {
  title: 'Kunlik hisobot',
  description: "Kam qolgan va eng ko‘p sotilgan mahsulotlar",
}

export default function KunlikhisobotLayout({ children }: { children: React.ReactNode }) {
  return children
}
