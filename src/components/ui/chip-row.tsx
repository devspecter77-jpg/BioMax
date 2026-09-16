'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  children: React.ReactNode
  /** Ekran o'quvchi uchun tasma nomi — "Omborlar", "Bo'limlar" kabi. */
  label: string
  className?: string
}

/**
 * Gorizontal tugmalar tasmasi — POS'dagi ombor va bo'lim "chip"lari uchun.
 *
 * Nega alohida komponent:
 *  1. Tizim scrollbar'i 10px — tasma ostida yo'g'on yo'lak paydo bo'lib,
 *     yopishgan panelni keraksiz balandlashtirardi. Bu yerda u yashiriladi.
 *  2. Scrollbar yashirilgach sichqoncha bilan surish yo'li qolmaydi —
 *     shuning uchun sig'magan tomonda chevron tugmasi chiqadi.
 *  3. Chetdagi "so'nish" (mask) yana chip borligini bildiradi. Ilgari
 *     oxirgi bo'lim panel chetida keskin qirqilib, umuman ko'rinmay
 *     qolardi va kassir uni qidirib topa olmasdi.
 */
export default function ChipRow({ children, label, className = '' }: Props) {
  const tasmaRef = useRef<HTMLDivElement>(null)
  const [chapBor, setChapBor] = useState(false)
  const [ongBor, setOngBor] = useState(false)

  const holatniHisobla = useCallback(() => {
    const el = tasmaRef.current
    if (!el) return
    const chek = el.scrollWidth - el.clientWidth
    // 2px — brauzerning kasr piksellari uchun bardosh: aks holda oxirigacha
    // surilgan tasmada o'ng chevron miltillab turadi.
    setChapBor(el.scrollLeft > 2)
    setOngBor(chek > 2 && el.scrollLeft < chek - 2)
  }, [])

  useEffect(() => {
    const el = tasmaRef.current
    if (!el) return
    holatniHisobla()
    // Chiplar API'dan keyinroq keladi, panel eni esa yon menyu yig'ilganda
    // o'zgaradi — ikkala holatda ham chetlarni qayta hisoblash kerak.
    const kuzatuvchi = new ResizeObserver(holatniHisobla)
    kuzatuvchi.observe(el)
    for (const bola of Array.from(el.children)) kuzatuvchi.observe(bola)
    return () => kuzatuvchi.disconnect()
  }, [holatniHisobla, children])

  const sur = (yonalish: -1 | 1) => {
    const el = tasmaRef.current
    if (!el) return
    el.scrollBy({ left: yonalish * Math.max(180, el.clientWidth * 0.7), behavior: 'smooth' })
  }

  // Mask faqat haqiqatan sig'magan tomonda qo'yiladi — hamma vaqt yoqilsa
  // birinchi chip bekorga xiralashib, "o'chgan" tugmadek ko'rinardi.
  const mask = `linear-gradient(to right, ${
    chapBor ? 'transparent 0, #000 2.5rem' : '#000 0'
  }, ${ongBor ? '#000 calc(100% - 2.5rem), transparent 100%' : '#000 100%'})`

  const chevronKlass =
    'flex items-center justify-center w-8 h-8 rounded-full ' +
    'bg-white/95 dark:bg-neutral-800/95 text-gray-600 dark:text-gray-300 ' +
    'shadow-md ring-1 ring-gray-200 dark:ring-neutral-700 hover:text-pos transition'

  // Chevronlar sichqoncha uchun: barmoq bilan tasma shundoq ham suriladi,
  // shuning uchun tor ekranda ular chiqmaydi.
  //
  // Yashirish AYNAN o'rovchi `span` da: globals.css'dagi
  // `button:has(> svg:only-child) { display: inline-flex }` qoidasi
  // tugmaning o'zidagi `hidden` klassini yengib, o'qni telefonda ham
  // chiqarib yuborardi. `span` esa u qoidaga tushmaydi.
  const orovchiKlass = 'hidden sm:block absolute top-1/2 -translate-y-1/2 z-10'

  return (
    <div className={`relative min-w-0 flex-1 ${className}`}>
      <div
        ref={tasmaRef}
        role="group"
        aria-label={label}
        onScroll={holatniHisobla}
        className="flex items-center gap-2 overflow-x-auto scrollbar-none"
        style={{ maskImage: mask, WebkitMaskImage: mask }}
      >
        {children}
      </div>
      {chapBor && (
        <span className={orovchiKlass} style={{ left: 0 }}>
          <button
            type="button"
            onClick={() => sur(-1)}
            aria-hidden
            tabIndex={-1}
            // Inline o'lcham: yuqoridagi 40px qoidasi bu suzuvchi o'qni
            // tasmadan balandroq qilib yuborardi.
            style={{ minWidth: '2rem', minHeight: '2rem' }}
            className={chevronKlass}
          >
            <ChevronLeft size={16} />
          </button>
        </span>
      )}
      {ongBor && (
        <span className={orovchiKlass} style={{ right: 0 }}>
          <button
            type="button"
            onClick={() => sur(1)}
            aria-hidden
            tabIndex={-1}
            style={{ minWidth: '2rem', minHeight: '2rem' }}
            className={chevronKlass}
          >
            <ChevronRight size={16} />
          </button>
        </span>
      )}
    </div>
  )
}
