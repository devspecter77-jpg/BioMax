'use client'

import { useCallback, useSyncExternalStore } from 'react'

// Shu tabda qiymat yozilganda xabar beriladi (`storage` hodisasi faqat
// BOSHQA tablarga keladi).
const HODISA = 'saqlangan-qiymat'

function oqi(kalit: string): string | null {
  try {
    return localStorage.getItem(kalit)
  } catch {
    return null // maxfiy rejim yoki bloklangan saqlash
  }
}

/**
 * Brauzerda (localStorage) saqlanadigan kichik sozlama — mavzu, yon panel holati.
 *
 * Serverda va gidratatsiya paytida `standart` qaytadi, so'ng saqlangan
 * qiymatga o'tadi. Effekt ichida `setState` qilinmaydi, shuning uchun ortiqcha
 * render zanjiri yo'q. Bir kalitni ishlatadigan barcha komponentlar birga
 * yangilanadi.
 */
export function useSaqlanganQiymat<T extends string>(kalit: string, standart: T): [T, (yangi: T) => void] {
  const obuna = useCallback((xabar: () => void) => {
    const tinglovchi = (e: Event) => {
      if ((e as CustomEvent<string>).detail === kalit) xabar()
    }
    window.addEventListener(HODISA, tinglovchi)
    return () => window.removeEventListener(HODISA, tinglovchi)
  }, [kalit])

  const qiymat = useSyncExternalStore(
    obuna,
    () => (oqi(kalit) as T | null) || standart,
    () => standart,
  )

  const ozgartir = useCallback((yangi: T) => {
    try {
      localStorage.setItem(kalit, yangi)
    } catch {
      // saqlab bo'lmadi — qiymat shu sahifada ham o'zgarmaydi
    }
    window.dispatchEvent(new CustomEvent(HODISA, { detail: kalit }))
  }, [kalit])

  return [qiymat, ozgartir]
}
