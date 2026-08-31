'use client'

import { useRef } from 'react'
import { cn } from '@/lib/utils'

interface MoneyInputProps {
  value: string | number   // raw number as string
  onChange: (value: string) => void  // returns raw number string e.g. "1500000"
  placeholder?: string
  min?: number
  max?: number
  required?: boolean
  disabled?: boolean
  className?: string
  suffix?: string  // e.g. "UZS"
}

// Format a numeric string with comma separators (e.g. "1500000" -> "1,500,000")
function formatWithCommas(val: string): string {
  const num = val.replace(/\D/g, '')
  if (!num) return ''
  return Number(num).toLocaleString('en-US')
}

export default function MoneyInput({
  value, onChange,
  placeholder = "0",
  min,
  max,
  required = false,
  disabled = false,
  className,
  suffix = 'UZS'
}: MoneyInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const displayValue = value ? formatWithCommas(String(value)) : ''
  // Keep raw number string for potential form validation usage
  const _rawNumber = String(value).replace(/\D/g, '')
  void _rawNumber // suppress unused variable warning

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, '')
    // Enforce max constraint if provided
    if (max !== undefined && raw && Number(raw) > max) {
      onChange(String(max))
      return
    }
    onChange(raw)
  }

  return (
    <div className={cn(
      'flex items-center gap-2 px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl transition',
      'focus-within:ring-2 focus-within:ring-red-500 focus-within:border-transparent',
      disabled && 'opacity-50',
      className
    )}>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        min={min}
        max={max}
        className="flex-1 bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 outline-none min-w-0"
      />
      {suffix && displayValue && (
        <span className="text-gray-400 dark:text-gray-600 text-sm shrink-0 whitespace-nowrap">{suffix}</span>
      )}
    </div>
  )
}
