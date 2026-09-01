'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { useSidebar } from '@/components/SidebarContext'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { visibleNavItems, navSections } from './nav-items'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'

export default function Sidebar() {
  const pathname = usePathname()
  const { open, setOpen, collapsed, toggleCollapsed } = useSidebar()
  useBodyScrollLock(open)
  const [dokonNomi, setDokonNomi] = useState('BioMax')
  const { data: session } = useSession()
  const rol = (session?.user as any)?.rol
  const ruxsatlar = (session?.user as any)?.ruxsatlar
  const filialId = (session?.user as any)?.filialId
  const ulashilganEgaId = (session?.user as any)?.ulashilganEgaId

  const visibleItems = visibleNavItems(rol, ruxsatlar, filialId, ulashilganEgaId)

  useEffect(() => {
    fetch('/api/sozlamalar')
      .then(r => r.json())
      .then(data => { if (data?.dokon_nomi) setDokonNomi(data.dokon_nomi) })
      .catch(() => {})
  }, [])

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 dark:bg-black/60 z-40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside className={cn(
        'fixed top-0 left-0 h-full bg-white dark:bg-neutral-950 border-r border-gray-200 dark:border-neutral-800 z-50 flex flex-col transition-all duration-300 overflow-hidden',
        'w-64',
        collapsed ? 'lg:w-16' : 'lg:w-64',
        open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      )}>

        {/* Logo */}
        <div className="h-16 flex items-center border-b border-gray-200 dark:border-neutral-800 shrink-0">
          <div className={cn(
            'flex items-center px-3 flex-1 min-w-0 gap-2.5',
            collapsed && 'lg:justify-center lg:px-0 lg:gap-0'
          )}>
            {/* Kengaytirilgan holat: urg'u belgisi + Bebas Neue nomi */}
            <div className={cn('flex items-center gap-2.5 min-w-0 flex-1', collapsed && 'lg:hidden')}>
              <div className="w-9 h-9 bg-white border border-gray-200 dark:border-neutral-800 rounded-xl flex items-center justify-center shrink-0 shadow-sm overflow-hidden p-1">
                <Image src="/maxbio-icon.png" alt="BioMax" width={36} height={36} className="w-full h-full object-contain" />
              </div>
              <div className="min-w-0 flex-1">
                <span
                  className="block truncate leading-none"
                  style={{ fontFamily: 'var(--font-bebas)', fontSize: 20, letterSpacing: '0.04em' }}
                >
                  {dokonNomi.trim().toLowerCase() === 'biomax' ? (
                    <>
                      <span className="text-gray-900 dark:text-white">BIO</span>
                      <span className="text-primary">MAX</span>
                    </>
                  ) : (
                    <span className="text-gray-900 dark:text-gray-100">{dokonNomi.toUpperCase()}</span>
                  )}
                </span>
              </div>
            </div>
            {/* Yig'ilgan holat (faqat desktop): Store ikonkasi */}
            <div className={cn(
              'w-9 h-9 bg-white border border-gray-200 dark:border-neutral-800 rounded-xl items-center justify-center shrink-0 shadow-sm overflow-hidden p-1',
              collapsed ? 'lg:flex hidden' : 'hidden'
            )}>
              <Image src="/maxbio-icon.png" alt="BioMax" width={36} height={36} className="w-full h-full object-contain" />
            </div>
          </div>
          {/* Mobil: yopish tugmasi */}
          <button
            onClick={() => setOpen(false)}
            className="lg:hidden mr-3 shrink-0 p-1.5 text-gray-400 dark:text-gray-600 hover:text-gray-700 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition"
            aria-label="Yopish"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 overflow-y-auto overflow-x-hidden">
          {(() => {
            const renderItem = (item: typeof visibleItems[number]) => {
              const Icon = item.icon
              const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  title={item.label}
                  className={cn(
                    'flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-150',
                    collapsed ? 'lg:justify-center lg:gap-0 lg:px-0 lg:py-2.5 px-3 py-2.5' : 'px-3 py-2.5',
                    active
                      ? cn(
                          'bg-primary-light dark:bg-[#132B20] text-primary dark:text-[#2E9B6B]',
                          collapsed
                            ? 'border-l-[3px] border-primary dark:border-[#2E9B6B] pl-[9px] lg:border-0 lg:pl-0'
                            : 'border-l-[3px] border-primary dark:border-[#2E9B6B] pl-[9px]'
                        )
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-neutral-800'
                  )}
                >
                  <Icon
                    size={18}
                    className={cn(
                      'shrink-0',
                      active ? 'text-primary dark:text-[#2E9B6B]' : 'text-gray-400 dark:text-gray-600'
                    )}
                  />
                  <span className={cn('truncate', collapsed && 'lg:hidden')}>
                    {item.label}
                  </span>
                </Link>
              )
            }

            const top = visibleItems.filter(i => !i.section)
            const groups = navSections
              .map(section => ({ section, items: visibleItems.filter(i => i.section === section) }))
              .filter(g => g.items.length > 0)

            return (
              <>
                {top.length > 0 && <div className="space-y-0.5">{top.map(renderItem)}</div>}
                {groups.map(({ section, items }) => (
                  <div
                    key={section}
                    className={cn(
                      'mt-4',
                      collapsed && 'lg:mt-2 lg:pt-2 lg:border-t lg:border-gray-200 lg:dark:border-neutral-800'
                    )}
                  >
                    <p className={cn(
                      'px-3 mb-1 text-[10px] font-bold tracking-widest text-gray-400 dark:text-gray-600 select-none',
                      collapsed && 'lg:hidden'
                    )}>
                      {section}
                    </p>
                    <div className="space-y-0.5">{items.map(renderItem)}</div>
                  </div>
                ))}
              </>
            )
          })()}
        </nav>

        {/* Footer */}
        <div className={cn(
          'border-t border-gray-200 dark:border-neutral-800 shrink-0 flex items-center py-3',
          collapsed ? 'lg:justify-center lg:px-2 px-4 justify-between' : 'px-4 justify-between'
        )}>
          <p className={cn('text-gray-400 dark:text-gray-600 text-[11px]', collapsed && 'lg:hidden')}>
            v1.0.0
          </p>
          <button
            onClick={toggleCollapsed}
            className="hidden lg:flex items-center justify-center p-1.5 text-gray-400 dark:text-gray-600 hover:text-gray-700 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition"
            title={collapsed ? "Kengaytirish" : "Yig'ish"}
            aria-label={collapsed ? "Kengaytirish" : "Yig'ish"}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

      </aside>
    </>
  )
}
