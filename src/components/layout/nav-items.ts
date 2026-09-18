import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, ShoppingCart, Package, Warehouse,
  Users, CreditCard, BarChart3,
  ShoppingBag, Building, Gift, ArrowRightLeft, MapPin, Truck, Wallet, ClipboardList, UsersRound, Boxes, Globe, LayoutGrid, ShieldCheck, PackageOpen, QrCode,
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

// Katalogdagi bo'limlar HAMMA rolga ochiq ro'yxatda turadi — kim ko'rishini
// Ruxsatlar bo'limi hal qiladi (rol faqat standart qiymatni beradi). Ilgari
// bu yerda rollar qattiq yozilgan edi: Ega sotuvchiga «Tovarlar»ni ochib bersa
// ham menyuda chiqmasdi, SOTUVCHI esa umuman hech narsa ko'rmasdi.
const HAMMA = ['ADMIN', 'KASSIR', 'OMBORCHI', 'SOTUVCHI', 'DOSTAVCHIK']

export const navItems: NavItem[] = [
  { href: '/', label: 'Bosh sahifa', icon: LayoutDashboard, roles: HAMMA },

  { href: '/sotuv', label: 'Sotuv (POS)', icon: ShoppingCart, roles: HAMMA, section: 'SAVDO' },
  // Onlayn do'kon buyurtmalari — markaziy do'konniki, filial xodimiga ko'rinmaydi.
  { href: '/onlayn-buyurtmalar', label: 'Onlayn buyurtmalar', icon: Globe, roles: HAMMA, section: 'SAVDO' },
  // Saytdagi mahsulot kartochkalari: rasm, tavsif, xususiyat, aksiya. Standart — faqat ADMIN (Ruxsatlar'dan ochiladi).
  { href: '/onlayn-vitrina', label: 'Onlayn vitrina', icon: LayoutGrid, roles: HAMMA, section: 'SAVDO' },
  // Dostavchiklar: berilgan namuna tovarlar, jonli joylashuv va yetkazishlar. Standart — faqat ADMIN.
  { href: '/namuna-tovar', label: 'Namuna tovar', icon: PackageOpen, roles: HAMMA, section: 'SAVDO' },
  // Mijoz skanerlab ilovani o'rnatadigan QR kod. Standart — faqat ADMIN.
  { href: '/ilova-qr', label: 'Ilova QR kodi', icon: QrCode, roles: HAMMA, section: 'SAVDO' },

  { href: '/tovarlar', label: 'Tovarlar', icon: Package, roles: HAMMA, section: 'OMBOR' },
  // Ombor — kategoriyalarning ustki guruhi (katta kategoriya).
  { href: '/omborlar', label: 'Omborlar', icon: Warehouse, roles: HAMMA, section: 'OMBOR' },
  { href: '/ombor', label: 'Ombor harakati', icon: Boxes, roles: HAMMA, section: 'OMBOR' },
  { href: '/otkazmalar', label: "Omborlararo o'tkazma", icon: ArrowRightLeft, roles: ['ADMIN'], section: 'OMBOR' },
  // Kam qolgan mahsulotlar + top mahsulotlar. Har kuni Telegramga ham ketadi.
  // KASSIR uchun standart holatda YOPIQ — Ega Ruxsatlar bo'limidan ochadi.
  { href: '/kunlik-hisobot', label: 'Kunlik hisobot', icon: ClipboardList, roles: HAMMA, section: 'OMBOR' },

  { href: '/mijozlar', label: 'Mijozlar', icon: Users, roles: HAMMA, section: "MIJOZ VA NASIYA" },
  { href: '/nasiyalar', label: 'Nasiyalar', icon: CreditCard, roles: HAMMA, section: "MIJOZ VA NASIYA" },
  { href: '/ballar', label: 'Ballar va keshbeklar', icon: Gift, roles: HAMMA, section: "MIJOZ VA NASIYA" },

  { href: '/taminotchilar', label: "Ta'minotchilar", icon: Truck, roles: HAMMA, section: "TA'MINOT" },
  { href: '/xaridlar', label: 'Xaridlar', icon: ShoppingBag, roles: HAMMA, section: "TA'MINOT" },

  // KASSIR ham kirishi mumkin, lekin STANDART ravishda YOPIQ ('tolovlar'
  // ROL_STANDART ichida yo'q) — Ega Ruxsatlar bo'limidan ochib beradi.
  // API filialga bog'langan xodimni o'z filiali bilan cheklaydi.
  { href: '/tolovlar', label: "To'lovlar", icon: Wallet, roles: HAMMA, section: 'TIZIM' },
  { href: '/hisobotlar', label: 'Hisobotlar', icon: BarChart3, roles: HAMMA, section: 'TIZIM' },
  { href: '/filiallar', label: 'Filiallar', icon: Building, roles: ['ADMIN'], section: 'TIZIM' },
  // Oylik, bonus va yangi xodim yaratish. Standart holatda faqat ADMIN;
  // katalogda bo'lgani uchun Ega xohlasa boshqa rolga ham ochib beradi.
  { href: '/xodimlar', label: 'Xodimlar', icon: UsersRound, roles: HAMMA, section: 'TIZIM' },
  { href: '/xarita', label: 'Xarita', icon: MapPin, roles: ['ADMIN'], section: 'TIZIM' },
  // Har bir xodim uchun bo'lim, amal va maydon ruxsatlari — faqat administrator
  { href: '/ruxsatlar', label: 'Ruxsatlar', icon: ShieldCheck, roles: ['ADMIN'], section: 'TIZIM' },
]

/** Mobil pastki navbar uchun ustuvorlik tartibi — eng ko'p ishlatiladigan
 *  bo'limlar oldinda. Birinchi 4 tasi doim ko'rinadi, qolgani "Barchasi"
 *  varag'ida chiqadi (agar 4 tadan ortiq bo'lsa). */
export const mobilePriorityOrder = [
  '/', '/sotuv', '/onlayn-buyurtmalar', '/namuna-tovar', '/nasiyalar', '/tovarlar', '/ombor', '/mijozlar',
  '/ballar', '/omborlar', '/kunlik-hisobot', '/tolovlar', '/hisobotlar', '/taminotchilar', '/xaridlar', '/otkazmalar', '/onlayn-vitrina', '/ilova-qr', '/xodimlar', '/ruxsatlar', '/xarita', '/filiallar',
]

/**
 * `ruxsatlar` — foydalanuvchining samarali ko'rish ruxsatlari (Ruxsatlar bo'limidan).
 * ADMIN uchun har doim `null` keladi va cheklovsiz. Boshqa rollar uchun massiv —
 * faqat `ruxsat-katalogi.ts` ichidagi bo'limlarga tegishli nav elementlari filtrlanadi
 * (Sozlamalar/Filiallar/Ruxsatlar kabi katalogda yo'q bo'limlar faqat `roles` bilan boshqariladi).
 */
export function visibleNavItems(rol: string | undefined, ruxsatlar?: string[] | null, filialId?: string | null, ulashilganEgaId?: string | null): NavItem[] {
  // Sessiya hali kelmagan — faqat bosh sahifa (ilgari hamma band, jumladan faqat
  // administratorniki bir lahza ko'rinib qolardi)
  if (!rol) return navItems.filter(i => i.href === '/')
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
    // Onlayn buyurtmalar markaziy do'konniki — filial xodimi ko'rmaydi (API ham rad etadi)
    if ((item.href === '/onlayn-buyurtmalar' || item.href === '/onlayn-vitrina' || item.href === '/namuna-tovar' || item.href === '/ilova-qr') && filialId) return false
    if (rol === 'ADMIN') return true
    // Ruxsatlar hali kelmagan (eski sessiya) — faqat bosh sahifa, keyingi yangilanishgacha
    if (!Array.isArray(ruxsatlar)) return item.href === '/'
    const bolimKalit = item.href.slice(1)
    if (!barchaRuxsatKalitlari.includes(bolimKalit)) return true
    return !!ruxsatlar?.includes(bolimKalit)
  })
}
