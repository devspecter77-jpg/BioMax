'use client'

import { useEffect, useRef } from 'react'

export interface JonliJavob {
  belgi: string
  [kalit: string]: unknown
}

/**
 * Jonli yangilanish: `url` dan qisqa belgini har `oraliqMs` da so'raydi va
 * belgi o'zgarganda `onOzgardi` ni chaqiradi (to'liq ma'lumotni qayta yuklash
 * uchun). Birinchi javob faqat boshlang'ich nuqta — chaqiruvsiz.
 *
 * Nega WebSocket emas: ERP va sayt serverless muhitda ham ishlashi kerak,
 * u yerda uzoq ulanish ushlab turilmaydi. Qisqa belgi so'rovi arzon (bitta
 * yig'ma SQL) va o'zgarish 2–4 soniyada ko'rinadi.
 *
 * Tejamkorlik: sahifa yashirin bo'lsa so'ramaydi, qaytib ochilganda yoki
 * internet tiklanganda darhol tekshiradi; xatoda oraliq ikki barobar uzayadi
 * (ko'pi bilan 30 soniya).
 */
export function useJonli<T extends JonliJavob>(
  url: string | null,
  onOzgardi: (yangi: T, oldingi: T) => void,
  oraliqMs = 3_000,
) {
  const qayta = useRef(onOzgardi)
  qayta.current = onOzgardi

  useEffect(() => {
    if (!url) return
    let toxtadi = false
    let taymer: ReturnType<typeof setTimeout> | undefined
    let oldingi: T | null = null
    let kutish = oraliqMs
    let boshqaruv: AbortController | null = null

    const rejala = (ms: number) => {
      clearTimeout(taymer)
      taymer = setTimeout(tekshir, ms)
    }

    async function tekshir() {
      if (toxtadi || document.visibilityState !== 'visible') return
      boshqaruv?.abort()
      boshqaruv = new AbortController()
      try {
        const javob = await fetch(url!, { cache: 'no-store', signal: boshqaruv.signal })
        if (!javob.ok) throw new Error(String(javob.status))
        const yangi = (await javob.json()) as T
        if (typeof yangi?.belgi === 'string') {
          if (oldingi && yangi.belgi !== oldingi.belgi) qayta.current(yangi, oldingi)
          oldingi = yangi
        }
        kutish = oraliqMs
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return
        kutish = Math.min(kutish * 2, 30_000)
      }
      if (!toxtadi) rejala(kutish)
    }

    const qaytaOchildi = () => {
      if (document.visibilityState === 'visible') rejala(0)
    }

    document.addEventListener('visibilitychange', qaytaOchildi)
    window.addEventListener('online', qaytaOchildi)
    rejala(0)

    return () => {
      toxtadi = true
      clearTimeout(taymer)
      boshqaruv?.abort()
      document.removeEventListener('visibilitychange', qaytaOchildi)
      window.removeEventListener('online', qaytaOchildi)
    }
  }, [url, oraliqMs])
}
