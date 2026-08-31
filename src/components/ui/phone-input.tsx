'use client'

import { useRef } from 'react'
import { Phone } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PhoneInputProps {
  value: string          // stored as full string like "+998901234567" or "901234567"
  onChange: (value: string) => void  // returns digits only after +998, e.g. "901234567"
  placeholder?: string
  required?: boolean
  disabled?: boolean
  className?: string
  onFocus?: () => void
  onBlur?: () => void
}

// Format 9 digits into: (XX) XXX-XX-XX
function formatDigits(digits: string): string {
  const d = digits.slice(0, 9)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 5) return `(${d.slice(0,2)}) ${d.slice(2)}`
  if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2,5)}-${d.slice(5)}`
  return `(${d.slice(0,2)}) ${d.slice(2,5)}-${d.slice(5,7)}-${d.slice(7,9)}`
}

export default function PhoneInput({
  value, onChange,
  placeholder = "+998 (__) ___-__-__",
  required = false,
  disabled = false,
  className,
  onFocus,
  onBlur,
}: PhoneInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  // Extract pure 9 digits from stored value.
  // Faqat country code bilan saqlangan bo'lsa (12 xonali) — 998 prefixni olib tashlaymiz.
  // Aks holda raqam qismi o'zi 998 bilan boshlansa ham (masalan 998... kiritilgan) — saqlanadi.
  const rawDigits = value.replace(/\D/g, '')
  const digits = (rawDigits.length === 12 && rawDigits.startsWith('998') ? rawDigits.slice(3) : rawDigits).slice(0, 9)
  const displayValue = digits.length > 0 ? `+998 ${formatDigits(digits)}` : ''

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    // Extract only digits after +998
    const allDigits = raw.replace(/\D/g, '')
    // If starts with 998, remove it
    const after998 = allDigits.startsWith('998') ? allDigits.slice(3) : allDigits
    const nineDigits = after998.slice(0, 9)
    onChange(nineDigits)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // Prevent deleting the +998 prefix when cursor is at the beginning and no digits entered
    const input = inputRef.current
    if (!input) return
    const cursorPos = input.selectionStart ?? 0
    if ((e.key === 'Backspace' || e.key === 'Delete') && cursorPos <= 5 && digits.length === 0) {
      e.preventDefault()
    }
  }

  return (
    <div className={cn(
      'flex items-center gap-2 px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl transition',
      'focus-within:ring-2 focus-within:ring-red-500 focus-within:border-transparent',
      disabled && 'opacity-50',
      className
    )}>
      <Phone size={16} className="text-gray-400 shrink-0" />
      <input
        ref={inputRef}
        type="tel"
        value={displayValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className="flex-1 bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 outline-none"
      />
    </div>
  )
}
