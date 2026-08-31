'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { Grid3x3, X } from 'lucide-react'
import { visibleNavItems, mobilePriorityOrder, type NavItem } from './nav-items'

const MAX_PRIMARY = 4

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href)
}

export default function MobileNav() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const rol = (session?.user as any)?.rol
  const ruxsatlar = (session?.user as any)?.ruxsatlar
  const filialId = (session?.user as any)?.filialId
  const ulashilganEgaId = (session?.user as any)?.ulashilganEgaId
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!moreOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false)
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [moreOpen])

  const items = visibleNavItems(rol, ruxsatlar, filialId, ulashilganEgaId)
  const sorted = [...items].sort((a, b) => {
    const ai = mobilePriorityOrder.indexOf(a.href)
    const bi = mobilePriorityOrder.indexOf(b.href)
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
  })

  const hasMore = sorted.length > MAX_PRIMARY
  const primary = hasMore ? sorted.slice(0, MAX_PRIMARY) : sorted
  const isMoreActive = hasMore && !primary.some((item) => isActive(pathname, item.href))

  return (
    <>
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-neutral-950/90 backdrop-blur-lg border-t border-gray-200 dark:border-neutral-800 safe-area-inset-bottom"
        aria-label="Mobil navigatsiya"
      >
        <div className="flex items-stretch justify-around px-1">
          {primary.map((item) => (
            <NavTab key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
          {hasMore && (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="flex flex-col items-center justify-center gap-1 py-2 px-3 min-w-[60px] flex-1 group"
              aria-label="Barcha bo'limlar"
              aria-expanded={moreOpen}
            >
              <span
                className={cn(
                  'flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 ease-out',
                  isMoreActive
                    ? 'bg-primary-light dark:bg-[#132B20] text-primary dark:text-[#2E9B6B] -translate-y-0.5 shadow-sm shadow-primary/20'
                    : 'text-gray-400 dark:text-gray-600 group-active:scale-90'
                )}
              >
                <Grid3x3 size={20} strokeWidth={isMoreActive ? 2.4 : 2} />
              </span>
              <span
                className={cn(
                  'text-[10px] font-medium leading-none transition-colors duration-200',
                  isMoreActive ? 'text-primary dark:text-[#2E9B6B]' : 'text-gray-400 dark:text-gray-600'
                )}
              >
                Barchasi
              </span>
            </button>
          )}
        </div>
      </nav>

      {hasMore && moreOpen && (
        <MoreSheet items={sorted} pathname={pathname} onClose={() => setMoreOpen(false)} />
      )}
    </>
  )
}

function NavTab({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      className="flex flex-col items-center justify-center gap-1 py-2 px-3 min-w-[60px] flex-1 active:scale-95 transition-transform"
    >
      <span
        className={cn(
          'flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 ease-out',
          active
            ? 'bg-primary-light dark:bg-[#132B20] text-primary dark:text-[#2E9B6B] -translate-y-0.5 shadow-sm shadow-primary/20'
            : 'text-gray-400 dark:text-gray-600'
        )}
      >
        <Icon size={20} strokeWidth={active ? 2.4 : 2} />
      </span>
      <span
        className={cn(
          'text-[10px] font-medium leading-none truncate max-w-[64px] transition-colors duration-200',
          active ? 'text-primary dark:text-[#2E9B6B]' : 'text-gray-400 dark:text-gray-600'
        )}
      >
        {item.label}
      </span>
    </Link>
  )
}

function MoreSheet({
  items,
  pathname,
  onClose,
}: {
  items: NavItem[]
  pathname: string
  onClose: () => void
}) {
  return (
    <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Barcha bo'limlar">
      <div
        className="absolute inset-0 bg-black/40 animate-fadeIn"
        onClick={onClose}
      />
      <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-neutral-900 rounded-t-3xl shadow-2xl max-h-[75vh] flex flex-col animate-slideInUp safe-area-inset-bottom">
        <div className="flex items-center justify-center pt-2.5 pb-1 shrink-0">
          <span className="w-9 h-1 rounded-full bg-gray-200 dark:bg-neutral-700" />
        </div>
        <div className="flex items-center justify-between px-5 pt-1 pb-3 shrink-0">
          <h2 className="text-gray-900 dark:text-gray-100 font-semibold">Barcha bo&apos;limlar</h2>
          <button
            onClick={onClose}
            aria-label="Yopish"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="grid grid-cols-4 gap-2">
            {items.map((item) => {
              const Icon = item.icon
              const active = isActive(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className="flex flex-col items-center gap-1.5 rounded-2xl py-3 px-1 active:scale-95 transition-transform"
                >
                  <span
                    className={cn(
                      'flex items-center justify-center w-11 h-11 rounded-2xl transition-colors duration-150',
                      active
                        ? 'bg-primary text-white shadow-sm shadow-primary/30'
                        : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-300'
                    )}
                  >
                    <Icon size={19} />
                  </span>
                  <span
                    className={cn(
                      'text-[10.5px] font-medium text-center leading-tight',
                      active ? 'text-primary dark:text-[#2E9B6B]' : 'text-gray-600 dark:text-gray-400'
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
