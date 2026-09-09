import type { Metadata } from 'next'

// Brauzer yorlig'ida qaysi bo'lim ochiqligi ko'rinishi uchun.
// Sahifaning o'zi 'use client' bo'lgani sababli metadata shu yerda.
export const metadata: Metadata = {
  title: 'Hisobotlar',
  description: "Savdo, foyda va ombor tahlili",
}

export default function HisobotlarLayout({ children }: { children: React.ReactNode }) {
  return children
}
