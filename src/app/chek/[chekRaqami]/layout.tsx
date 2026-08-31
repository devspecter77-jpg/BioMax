import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Chek — BioMax',
  description: "Sotuv cheki — BioMax do'kon boshqaruv tizimi",
}

export default function ChekLayout({ children }: { children: React.ReactNode }) {
  return children
}
