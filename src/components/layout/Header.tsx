'use client'

import { useSession, signOut } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { useSidebar } from '@/components/SidebarContext'
import { useTheme } from '@/components/ThemeContext'
import { Menu, LogOut, Sun, Moon, PanelLeftClose, PanelLeftOpen } from 'lucide-react'

const sahifaNomlar: Record<string, string> = {
  '/': 'Bosh sahifa',
  '/sotuv': 'Sotuv (POS)',
  '/tovarlar': 'Tovarlar',
  '/ombor': 'Ombor',
  '/mijozlar': 'Mijozlar',
  '/nasiyalar': 'Nasiyalar',
  '/xaridlar': 'Xaridlar',
  '/hisobotlar': 'Hisobotlar',
  '/filiallar': 'Filiallar',
}

export default function Header() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const { toggle: toggleSidebar, collapsed, toggleCollapsed } = useSidebar()
  const { theme, toggle: toggleTheme } = useTheme()

  const sahifaNomi = sahifaNomlar[pathname] || "ERP Do'kon"
  const rolMap: Record<string, string> = { ADMIN: 'Administrator', KASSIR: 'Kassir', OMBORCHI: 'Omborchi' }
  const rolNomi = rolMap[(session?.user as any)?.rol || 'KASSIR'] || 'Kassir'
  const filialNomi = (session?.user as any)?.filialNomi as string | null | undefined
  const firstLetter = session?.user?.name?.[0]?.toUpperCase() || 'U'

  return (
    <header className="h-16 bg-white dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800 px-4 lg:px-6 flex items-center justify-between sticky top-0 z-30 shrink-0 transition-colors duration-200">
      <div className="flex items-center gap-2">
        {/* Mobile: open sidebar */}
        <button onClick={toggleSidebar} className="lg:hidden p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-xl transition" aria-label="Menyu ochish">
          <Menu size={20} />
        </button>
        {/* Desktop: collapse/expand sidebar */}
        <button onClick={toggleCollapsed} className="hidden lg:flex p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-xl transition" aria-label={collapsed ? "Kengaytirish" : "Yig'ish"} title={collapsed ? "Kengaytirish" : "Yig'ish"}>
          {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </button>
        <h1 className="text-gray-900 dark:text-gray-100 font-semibold text-lg">{sahifaNomi}</h1>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={toggleTheme} className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-xl transition" aria-label="Mavzuni o'zgartirish">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <div className="text-right hidden sm:block">
          <p className="text-gray-800 dark:text-gray-200 text-sm font-medium leading-tight">{session?.user?.name}</p>
          <p className="text-gray-400 dark:text-gray-500 text-xs leading-tight">
            {rolNomi}{filialNomi ? ` · ${filialNomi}` : ''}
          </p>
        </div>
        <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 font-mono">
          {firstLetter}
        </div>
        <button onClick={() => signOut({ callbackUrl: '/login' })} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-xl transition" title="Chiqish" aria-label="Tizimdan chiqish">
          <LogOut size={18} />
        </button>
      </div>
    </header>
  )
}
