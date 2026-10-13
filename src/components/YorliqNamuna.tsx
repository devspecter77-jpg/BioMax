'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Barcode } from 'lucide-react'
import { useTheme } from '@/components/ThemeContext'
import { MM_PX, yorliqNamunaHtml, yorliqOlchami, type Yorliq, type YorliqSozlama } from '@/lib/yorliq'

// Yorliqning oldindan ko'rinishi. Ichida chop etiladigan hujjatning o'zi
// (iframe) — ekranda qanday ko'rinsa, qog'ozga ham aynan shunday tushadi.
// Joyga qarab kattalashtiriladi: haqiqiy 40×30 mm ekranda juda mayda.

/** Oldindan ko'rish maydoni foni — sahifadagi gray-100 / neutral-800 bilan bir xil */
const FON = { light: '#F3F4F6', dark: '#212A24' }

export default function YorliqNamuna({ yorliq, sozlama, engKatta = 1.8 }: {
  yorliq: Yorliq
  sozlama: YorliqSozlama
  /** Kattalashtirish chegarasi */
  engKatta?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [kenglik, setKenglik] = useState(0)
  const { theme } = useTheme()

  // ResizeObserver kuzatish boshlanganda ham bir marta xabar beradi
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const kuzatuvchi = new ResizeObserver(([y]) => setKenglik(Math.round(y.contentRect.width)))
    kuzatuvchi.observe(el)
    return () => kuzatuvchi.disconnect()
  }, [])

  const olcham = yorliqOlchami(sozlama)
  const masshtab = kenglik
    ? Math.max(0.5, Math.min(engKatta, (kenglik - 32) / (olcham.kenglik * MM_PX)))
    : 1
  const fon = FON[theme]
  const html = useMemo(
    () => yorliqNamunaHtml(yorliq, sozlama, masshtab, fon),
    [yorliq, sozlama, masshtab, fon],
  )

  return (
    <div ref={ref} className="rounded-xl overflow-hidden bg-gray-100 dark:bg-neutral-800">
      {html ? (
        <iframe
          title={`${yorliq.nomi} — yorliq namunasi`}
          srcDoc={html}
          sandbox=""
          className="block w-full border-0"
          style={{ height: Math.ceil(olcham.balandlik * MM_PX * masshtab) + 32, background: fon }}
        />
      ) : (
        <p className="flex items-center justify-center gap-2 py-8 px-4 text-center text-sm text-gray-500 dark:text-gray-400">
          <Barcode size={16} className="shrink-0" />
          Shtrix-kodi yo&apos;q — yorliq chiqmaydi
        </p>
      )}
    </div>
  )
}
