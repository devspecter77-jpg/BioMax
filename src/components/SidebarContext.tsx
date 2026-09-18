'use client'

import { createContext, useContext, useState } from 'react'
import { useSaqlanganQiymat } from '@/hooks/useSaqlanganQiymat'

interface SidebarCtx {
  open: boolean
  setOpen: (v: boolean) => void
  toggle: () => void
  collapsed: boolean
  toggleCollapsed: () => void
}

const SidebarContext = createContext<SidebarCtx>({
  open: false,
  setOpen: () => {},
  toggle: () => {},
  collapsed: false,
  toggleCollapsed: () => {},
})

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [saqlangan, saqla] = useSaqlanganQiymat<'true' | 'false'>('sidebar-collapsed', 'false')
  const collapsed = saqlangan === 'true'

  function toggleCollapsed() {
    saqla(collapsed ? 'false' : 'true')
  }

  return (
    <SidebarContext.Provider value={{
      open, setOpen,
      toggle: () => setOpen(p => !p),
      collapsed, toggleCollapsed,
    }}>
      {children}
    </SidebarContext.Provider>
  )
}

export const useSidebar = () => useContext(SidebarContext)
