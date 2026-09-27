'use client'

import {
  useEffect, useId, useRef, useState, useSyncExternalStore,
  type FocusEvent, type FormEvent, type FormEventHandler, type ReactNode, type Ref,
} from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'

// Umumiy modal oyna.
//
// Nega kerak: ilova bo'ylab 50 dan ortiq oyna har biri o'zicha yozilgan edi.
// Ularning qariyb yarmida balandlik cheklanmagan — telefonda uzun forma
// (masalan "Yangi mijoz") pastga yopishib, yuqori qismi ekrandan chiqib
// ketardi va unga scroll bilan ham yetib bo'lmasdi. Qolganlarida `85vh`
// ustiga pastki menyu uchun 6rem bo'shliq qo'shilgan: mobil brauzerda
// `vh` manzil satrisiz balandlik, shuning uchun oyna baribir kesilardi.
//
// Tuzilish (har doim bir xil):
//   sarlavha  — qotib turadi (nima qilayotganing va yopish tugmasi)
//   tana      — FAQAT shu qism scroll bo'ladi
//   pastki qism — qotib turadi (asosiy amal tugmalari doim ko'rinadi)
//
// Telefonda (<640px) pastdan chiquvchi varaq, kattaroq ekranda markazdagi
// oyna. Klaviatura ochilganda oyna ko'rinib turgan qismga (visualViewport)
// siqiladi — iOS va Android ikkalasida ham input va "Saqlash" tugmasi
// klaviatura ostida qolmaydi.

const OLCHAMLAR = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl',
  '3xl': 'sm:max-w-3xl',
  '4xl': 'sm:max-w-4xl',
} as const

export type ModalOlchami = keyof typeof OLCHAMLAR

interface ModalProps {
  onYopish: () => void
  sarlavha: ReactNode
  /** Sarlavha ostidagi qisqa izoh */
  tavsif?: ReactNode
  /** Sarlavha oldidagi ikonka */
  belgi?: ReactNode
  /** Kompyuterdagi eng katta kenglik. Telefonda doim ekran eni. */
  olcham?: ModalOlchami
  children: ReactNode
  /** Qotib turadigan pastki qism — odatda Bekor / Saqlash */
  footer?: ReactNode
  /**
   * Berilsa oyna `<form>` bo'ladi: pastki qismdagi `type="submit"` tugma
   * va maydonlardagi Enter shu funksiyani chaqiradi.
   */
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void
  /**
   * Fonga bosilganda yopilsinmi. Forma oynalarida standart holatda YO'Q:
   * telefonda tasodifan fonga tegib, yozilgan ma'lumotni yo'qotish oson.
   */
  tashqaridanYopish?: boolean
  /** Saqlanayotgan paytda yopib bo'lmasin */
  yopishMumkin?: boolean
  /** Tana uchun qo'shimcha klasslar (masalan `p-0` — ro'yxatlar uchun) */
  tanaClassName?: string
  /** Ustma-ust oynalar uchun: `z-[60]` va h.k. */
  zClassName?: string
  /** Sarlavhadagi yopish tugmasining o'rniga yoki yoniga qo'shimcha narsa */
  sarlavhaQoshimcha?: ReactNode
  /**
   * Standart sarlavha o'rniga o'zining yuqori qismi (masalan kassadagi
   * yashil "Sotuv amalga oshdi" banneri). `sarlavha` bu holda faqat ekran
   * o'quvchi uchun nom bo'lib qoladi.
   */
  ustki?: ReactNode
}

/** Klaviatura ochilganda ko'rinib turgan qism (visualViewport). */
function useKorinadiganQism() {
  const [qism, setQism] = useState<{ balandlik: number; yuqori: number } | null>(null)
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    if (!vv) return
    let kadr = 0
    const yangila = () => {
      kadr = 0
      setQism(o => (o && o.balandlik === vv.height && o.yuqori === vv.offsetTop
        ? o : { balandlik: vv.height, yuqori: vv.offsetTop }))
    }
    const rejala = () => { if (!kadr) kadr = requestAnimationFrame(yangila) }
    rejala()
    vv.addEventListener('resize', rejala)
    vv.addEventListener('scroll', rejala)
    return () => {
      vv.removeEventListener('resize', rejala)
      vv.removeEventListener('scroll', rejala)
      if (kadr) cancelAnimationFrame(kadr)
    }
  }, [])
  return qism
}

// Faqat brauzerda (portal uchun document kerak). Server va gidratsiyada
// `false` — shu bilan server/klient HTML'i mos keladi.
const bosh = () => () => {}
const useBrauzerda = () => useSyncExternalStore(bosh, () => true, () => false)

const FOKUSLANADIGAN = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function Modal({
  onYopish, sarlavha, tavsif, belgi, olcham = 'md', children, footer, onSubmit,
  tashqaridanYopish, yopishMumkin = true, tanaClassName = '', zClassName = 'z-50',
  sarlavhaQoshimcha, ustki,
}: ModalProps) {
  useBodyScrollLock(true)
  const sarlavhaId = useId()
  const oynaRef = useRef<HTMLElement>(null)
  const qism = useKorinadiganQism()
  const tayyor = useBrauzerda()
  const fondanYopiladi = tashqaridanYopish ?? !onSubmit

  // Eng so'nggi qiymatlar — tinglovchilarni har renderda qayta ulamaslik uchun
  const yopishRef = useRef({ onYopish, yopishMumkin })
  useEffect(() => { yopishRef.current = { onYopish, yopishMumkin } })

  // Ochilganda fokus oynaga o'tadi, yopilganda qaytib joyiga keladi.
  // Birinchi inputga emas: telefonda darhol klaviatura ochilib, formaning
  // yarmini yopib qo'yardi. `autoFocus` berilgan maydon o'zi fokus oladi.
  useEffect(() => {
    if (!tayyor) return
    const oldingi = document.activeElement as HTMLElement | null
    const oyna = oynaRef.current
    if (oyna && !oyna.contains(document.activeElement)) oyna.focus({ preventScroll: true })
    return () => { oldingi?.focus?.({ preventScroll: true }) }
  }, [tayyor])

  // Esc — yopadi; Tab — oyna ichida aylanadi
  useEffect(() => {
    if (!tayyor) return
    const bosildi = (e: KeyboardEvent) => {
      const oyna = oynaRef.current
      if (!oyna) return
      // Ustida boshqa oyna ochiq bo'lsa (masalan tasdiqlash) — u javob beradi
      const eng = Array.from(document.querySelectorAll('[data-modal-oyna]')).pop()
      if (eng !== oyna) return
      if (e.key === 'Escape') {
        if (e.defaultPrevented) return
        e.preventDefault()
        if (yopishRef.current.yopishMumkin) yopishRef.current.onYopish()
        return
      }
      if (e.key !== 'Tab') return
      const elementlar = Array.from(oyna.querySelectorAll<HTMLElement>(FOKUSLANADIGAN))
        .filter(el => el.offsetParent !== null)
      if (elementlar.length === 0) { e.preventDefault(); return }
      const birinchi = elementlar[0]
      const oxirgi = elementlar[elementlar.length - 1]
      if (e.shiftKey && (document.activeElement === birinchi || document.activeElement === oyna)) {
        e.preventDefault(); oxirgi.focus()
      } else if (!e.shiftKey && document.activeElement === oxirgi) {
        e.preventDefault(); birinchi.focus()
      }
    }
    document.addEventListener('keydown', bosildi)
    return () => document.removeEventListener('keydown', bosildi)
  }, [tayyor])

  // Fokus olgan maydon klaviatura ochilib bo'lgach ko'rinadigan joyga suriladi
  const fokusOldi = (e: FocusEvent) => {
    const el = e.target as HTMLElement
    if (!el.matches('input, textarea, select')) return
    window.setTimeout(() => el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 300)
  }

  if (!tayyor) return null

  // Forma bo'lsa `<form>`, aks holda `<div>` — tiplar bir xil qilib beriladi
  const Oyna = (onSubmit ? 'form' : 'div') as 'div'

  // Portal: ota elementdagi `backdrop-blur`/`transform` `fixed` ni o'ziga
  // bog'lab qo'ymasin va z-index sahifa qatlamlari bilan to'qnashmasin.
  return createPortal(
    <div
      className={`fixed inset-x-0 top-0 h-dvh ${zClassName} flex items-end sm:items-center justify-center bg-black/50 sm:p-4 animate-qoplama`}
      // Klaviatura ochiq bo'lsa qoplama faqat ko'rinib turgan qismni egallaydi
      style={qism ? { height: qism.balandlik, top: qism.yuqori } : undefined}
      onMouseDown={e => {
        if (e.target === e.currentTarget && fondanYopiladi && yopishMumkin) onYopish()
      }}
    >
      <Oyna
        ref={oynaRef as Ref<HTMLDivElement>}
        data-modal-oyna=""
        role="dialog"
        aria-modal="true"
        aria-labelledby={sarlavhaId}
        tabIndex={-1}
        onSubmit={onSubmit as unknown as FormEventHandler<HTMLDivElement> | undefined}
        onFocus={fokusOldi}
        className={`w-full ${OLCHAMLAR[olcham]} max-h-[calc(100%-0.75rem)] sm:max-h-full flex flex-col bg-white dark:bg-neutral-900 rounded-t-2xl sm:rounded-2xl shadow-2xl dark:border dark:border-neutral-800 outline-none overflow-hidden animate-varaq sm:animate-oyna`}
      >
        {ustki ? (
          <div className="shrink-0">
            <h2 id={sarlavhaId} className="sr-only">{sarlavha}</h2>
            {ustki}
          </div>
        ) : (
        <div className="shrink-0 flex items-start gap-3 px-4 sm:px-5 py-3.5 border-b border-gray-200 dark:border-neutral-800">
          {belgi && <span className="shrink-0 mt-0.5 text-primary">{belgi}</span>}
          <div className="min-w-0 flex-1 self-center">
            <h2 id={sarlavhaId} className="text-base font-semibold text-gray-900 dark:text-gray-100 leading-snug text-balance">
              {sarlavha}
            </h2>
            {tavsif && <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{tavsif}</div>}
          </div>
          {sarlavhaQoshimcha}
          <button
            type="button"
            onClick={onYopish}
            disabled={!yopishMumkin}
            aria-label="Yopish"
            className="shrink-0 -mr-1.5 -mt-0.5 p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-40 transition"
          >
            <X size={18} />
          </button>
        </div>
        )}

        <div className={`flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-5 py-4 ${tanaClassName}`}>
          {children}
        </div>

        {footer && (
          <div className="shrink-0 flex gap-3 px-4 sm:px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3 border-t border-gray-200 dark:border-neutral-800">
            {footer}
          </div>
        )}
      </Oyna>
    </div>,
    document.body,
  )
}

// Pastki qism uchun standart tugmalar — hamma oynada bir xil ko'rinsin.
export function ModalBekor({ onClick, children = 'Bekor qilish', disabled }: {
  onClick: () => void; children?: ReactNode; disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex-1 min-h-11 px-4 rounded-xl border border-gray-300 dark:border-neutral-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-50 transition"
    >
      {children}
    </button>
  )
}

export function ModalAsosiy({ children, yuklanmoqda, disabled, type = 'submit', onClick, rang = 'primary', belgi, keng }: {
  children: ReactNode
  yuklanmoqda?: boolean
  disabled?: boolean
  type?: 'submit' | 'button'
  onClick?: () => void
  /**
   * `xavfli` — o'chirish kabi qaytarib bo'lmaydigan amallar; `tolov` —
   * kassadagi to'lov yashili; `ogohlantirish` — qaytarish kabi amallar.
   */
  rang?: 'primary' | 'xavfli' | 'yashil' | 'tolov' | 'ogohlantirish' | 'pos' | 'binafsha'
  /** Yuklanmayotgan paytdagi ikonka */
  belgi?: ReactNode
  /** Bekor tugmasidan ikki barobar keng — asosiy amal ajralib tursin */
  keng?: boolean
}) {
  const ranglar = {
    primary: 'bg-primary hover:bg-primary-hover',
    xavfli: 'bg-red-600 hover:bg-red-700',
    yashil: 'bg-emerald-600 hover:bg-emerald-700',
    tolov: 'bg-pos-pay hover:bg-pos-pay-hover',
    ogohlantirish: 'bg-amber-600 hover:bg-amber-700',
    pos: 'bg-pos hover:bg-pos-hover',
    binafsha: 'bg-violet-600 hover:bg-violet-700',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || yuklanmoqda}
      className={`${keng ? 'flex-[2]' : 'flex-1'} min-h-11 px-4 rounded-xl text-sm font-semibold text-white ${ranglar[rang]} disabled:opacity-60 transition flex items-center justify-center gap-2`}
    >
      {yuklanmoqda
        ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" aria-hidden />
        : belgi}
      {children}
    </button>
  )
}
