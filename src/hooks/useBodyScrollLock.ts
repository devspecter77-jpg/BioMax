'use client'

import { useEffect } from 'react'

// Bir vaqtning o'zida bir nechta modal ochiq bo'lishi mumkin (masalan
// tovar tahrirlash modali ustida rasm lightbox'i) — shuning uchun
// oddiy boolean emas, hisoblagich ishlatiladi: faqat oxirgi modal
// yopilganda sahifa qaytadan scroll bo'ladi.
let qulflarSoni = 0

/**
 * Modal ochiq paytida orqa fon (sahifa tanasi) scroll bo'lmasligi uchun.
 * Har bir modal/overlay komponentida `useBodyScrollLock(ochiqmi)` deb chaqiring.
 */
export function useBodyScrollLock(qulflanganmi: boolean) {
  useEffect(() => {
    if (!qulflanganmi) return
    qulflarSoni++
    if (qulflarSoni === 1) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      qulflarSoni--
      if (qulflarSoni === 0) {
        document.body.style.overflow = ''
      }
    }
  }, [qulflanganmi])
}
