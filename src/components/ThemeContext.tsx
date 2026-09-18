'use client'
import { createContext, useContext } from 'react'
import { useSaqlanganQiymat } from '@/hooks/useSaqlanganQiymat'

type Theme = 'light' | 'dark'
interface ThemeCtx { theme: Theme; toggle: () => void }
const ThemeContext = createContext<ThemeCtx>({ theme: 'light', toggle: () => {} })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Standart — yorug' (qizil-oq brend) uslub. Foydalanuvchi tugma orqali
  // aniq tanlagan bo'lsa, o'sha ustunlik qiladi. Sahifa ochilganda `.dark`
  // klassini layout'dagi `themeInitScript` render'dan oldin qo'yadi.
  const [theme, setTheme] = useSaqlanganQiymat<Theme>('theme', 'light')

  function toggle() {
    const next = theme === 'light' ? 'dark' : 'light'
    document.documentElement.classList.toggle('dark', next === 'dark')
    setTheme(next)
  }

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
