import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, ShoppingCart, Package, Warehouse,
  Users, CreditCard, BarChart3,
  ShoppingBag, Building, Gift, ArrowRightLeft, MapPin, Truck, Wallet, ClipboardList, UsersRound,
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
  { href: '/otkazmalar', label: "Omborlararo o'tkazma", icon: ArrowRightLeft, roles: ['ADMIN'], section: 'OMBOR' },
  // Kam qolgan mahsulotlar + top mahsulotlar. Har kuni Telegramga ham ketadi.
  // KASSIR uchun standart holatda YOPIQ — Ega Ruxsatlar bo'limidan ochadi.
  { href: '/kunlik-hisobot', label: 'Kunlik hisobot', icon: ClipboardList, roles: ['ADMIN', 'KASSIR', 'OMBORCHI'], section: 'OMBOR' },

  { href: '/mijozlar', label: 'Mijozlar', icon: Users, roles: ['ADMIN', 'KASSIR'], section: "MIJOZ VA NASIYA" },
  { href: '/nasiyalar', label: 'Nasiyalar', icon: CreditCard, roles: ['ADMIN', 'KASSIR'], section: "MIJOZ VA NASIYA" },
  { href: '/ballar', label: 'Ballar va keshbeklar', icon: Gift, roles: ['ADMIN', 'KASSIR'], section: "MIJOZ VA NASIYA" },

  { href: '/taminotchilar', label: "Ta'minotchilar", icon: Truck, roles: ['ADMIN', 'KASSIR', 'OMBORCHI'], section: "TA'MINOT" },
  { href: '/xaridlar', label: 'Xaridlar', icon: ShoppingBag, roles: ['ADMIN', 'KASSIR'], section: "TA'MINOT" },

  // KASSIR ham kirishi mumkin, lekin STANDART ravishda YOPIQ ('tolovlar'
  // ROL_STANDART ichida yo'q) — Ega Ruxsatlar bo'limidan ochib beradi.
  // API filialga bog'langan xodimni o'z filiali bilan cheklaydi.
  { href: '/tolovlar', label: "To'lovlar", icon: Wallet, roles: ['ADMIN', 'KASSIR'], section: 'TIZIM' },
  { href: '/hisobotlar', label: 'Hisobotlar', icon: BarChart3, roles: ['ADMIN', 'KASSIR'], section: 'TIZIM' },
  { href: '/filiallar', label: 'Filiallar', icon: Building, roles: ['ADMIN'], section: 'TIZIM' },
  // Oylik, bonus va yangi xodim yaratish. Standart holatda faqat ADMIN;
  // katalogda bo'lgani uchun Ega xohlasa boshqa rolga ham ochib beradi.
  { href: '/xodimlar', label: 'Xodimlar', icon: UsersRound, roles: ['ADMIN'], section: 'TIZIM' },
  { href: '/xarita', label: 'Xarita', icon: MapPin, roles: ['ADMIN'], section: 'TIZIM' },
]

/** Mobil pastki navbar uchun ustuvorlik tartibi — eng ko'p ishlatiladigan
 *  bo'limlar oldinda. Birinchi 4 tasi doim ko'rinadi, qolgani "Barchasi"
 *  varag'ida chiqadi (agar 4 tadan ortiq bo'lsa). */
export const mobilePriorityOrder = [
  '/', '/sotuv', '/nasiyalar', '/tovarlar', '/ombor', '/mijozlar',
  '/ballar', '/kunlik-hisobot', '/tolovlar', '/hisobotlar', '/taminotchilar', '/xaridlar', '/otkazmalar', '/xodimlar', '/xarita', '/filiallar',
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
    // Filiallar va omborlararo o'tkazma — faqat haqiqiy bosh ega.
    // Filial admini boshqa filialning omboriga tega olmasligi kerak.
    if (
      (item.href === '/filiallar' || item.href === '/otkazmalar' || item.href === '/xarita')
      && (filialId || ulashilganEgaId)
    ) return false
    if (rol === 'ADMIN' || ruxsatlar === undefined) return true
    const bolimKalit = item.href.slice(1)
    if (!barchaRuxsatKalitlari.includes(bolimKalit)) return true
    return !!ruxsatlar?.includes(bolimKalit)
  })
}
