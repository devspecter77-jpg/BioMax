import type { Metadata } from 'next'

// Brauzer yorlig'ida qaysi bo'lim ochiqligi ko'rinishi uchun.
// Sahifaning o'zi 'use client' bo'lgani sababli metadata shu yerda.
export const metadata: Metadata = {
  title: 'Ombor harakati',
  description: "Kirim, chiqim va qoldiqlar",
}

export default function OmborLayout({ children }: { children: React.ReactNode }) {
  return children
}
