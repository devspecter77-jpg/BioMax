import type { Metadata } from 'next'

// Brauzer yorlig'ida qaysi bo'lim ochiqligi ko'rinishi uchun.
// Sahifaning o'zi 'use client' bo'lgani sababli metadata shu yerda.
export const metadata: Metadata = {
  title: 'Filiallar',
  description: "Do‘kon filiallari va xodimlari",
}

export default function FiliallarLayout({ children }: { children: React.ReactNode }) {
  return children
}
