import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, ShoppingCart, Package, Warehouse,
  Users, CreditCard, BarChart3,
  ShoppingBag, Building,
} from 'lucide-react'
import { barchaRuxsatKalitlari } from '@/lib/ruxsat-katalogi'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  roles: string[]
  /** Sidebar'da qaysi guruh ostida chiqishi. Guruhsiz (undefined) — eng tepada, sarlavhasiz. */
  section?: string
}

/** Guruhlarning ko'rsatilish tartibi va sarlavhalari. */
export const navSections = ['SAVDO', 'OMBOR', "MIJOZ VA NASIYA", "TA'MINOT", 'TIZIM'] as const

export const navItems: NavItem[] = [
  { href: '/', label: 'Bosh sahifa', icon: LayoutDashboard, roles: ['ADMIN', 'KASSIR', 'OMBORCHI'] },

  { href: '/sotuv', label: 'Sotuv (POS)', icon: ShoppingCart, roles: ['ADMIN', 'KASSIR'], section: 'SAVDO' },

  { href: '/tovarlar', label: 'Tovarlar', icon: Package, roles: ['ADMIN', 'KASSIR', 'OMBORCHI'], section: 'OMBOR' },
  { href: '/ombor', label: 'Ombor harakati', icon: Warehouse, roles: ['ADMIN', 'KASSIR', 'OMBORCHI'], section: 'OMBOR' },

  { href: '/mijozlar', label: 'Mijozlar', icon: Users, roles: ['ADMIN', 'KASSIR'], section: "MIJOZ VA NASIYA" },
  { href: '/nasiyalar', label: 'Nasiyalar', icon: CreditCard, roles: ['ADMIN', 'KASSIR'], section: "MIJOZ VA NASIYA" },

  { href: '/xaridlar', label: 'Xaridlar', icon: ShoppingBag, roles: ['ADMIN', 'KASSIR'], section: "TA'MINOT" },

  { href: '/hisobotlar', label: 'Hisobotlar', icon: BarChart3, roles: ['ADMIN', 'KASSIR'], section: 'TIZIM' },
  { href: '/filiallar', label: 'Filiallar', icon: Building, roles: ['ADMIN'], section: 'TIZIM' },
]

/** Mobil pastki navbar uchun ustuvorlik tartibi — eng ko'p ishlatiladigan
 *  bo'limlar oldinda. Birinchi 4 tasi doim ko'rinadi, qolgani "Barchasi"
 *  varag'ida chiqadi (agar 4 tadan ortiq bo'lsa). */
export const mobilePriorityOrder = [
  '/', '/sotuv', '/nasiyalar', '/tovarlar', '/ombor', '/mijozlar',
  '/hisobotlar', '/xaridlar', '/filiallar',
]

/**
 * `ruxsatlar` — foydalanuvchining samarali ko'rish ruxsatlari (Ruxsatlar bo'limidan).
 * ADMIN uchun har doim `null` keladi va cheklovsiz. Boshqa rollar uchun massiv —
 * faqat `ruxsat-katalogi.ts` ichidagi bo'limlarga tegishli nav elementlari filtrlanadi
 * (Sozlamalar/Filiallar/Ruxsatlar kabi katalogda yo'q bo'limlar faqat `roles` bilan boshqariladi).
 */
export function visibleNavItems(rol: string | undefined, ruxsatlar?: string[] | null, filialId?: string | null, ulashilganEgaId?: string | null): NavItem[] {
  if (!rol) return navItems
  return navItems.filter((item) => {
    if (!item.roles.includes(rol)) return false
    // Filiallar — faqat haqiqiy bosh ega (Ega, filialId yo'q VA ulashilgan
    // admin ham emas) ko'radi. Filial egasi o'z filialidan tashqarida,
    // ulashilgan admin esa Ega/filiallarni umuman boshqara olmasligi kerak.
    if (item.href === '/filiallar' && (filialId || ulashilganEgaId)) return false
    if (rol === 'ADMIN' || ruxsatlar === undefined) return true
    const bolimKalit = item.href.slice(1)
    if (!barchaRuxsatKalitlari.includes(bolimKalit)) return true
    return !!ruxsatlar?.includes(bolimKalit)
  })
}
