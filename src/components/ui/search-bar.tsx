'use client'

import { Search, X } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import BarcodeScanner from '@/components/BarcodeScanner'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  debounceMs?: number
  onScan?: (kod: string) => void
}

export default function SearchBar({
  value,
  onChange,
  placeholder = 'Qidirish...',
  className = '',
  debounceMs = 300,
  onScan,
}: SearchBarProps) {
  const [local, setLocal] = useState(value)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Sync from parent when value resets to ''
  useEffect(() => {
    setLocal(value)
  }, [value])

  // Debounced onChange
  useEffect(() => {
    const t = setTimeout(() => onChangeRef.current(local), debounceMs)
    return () => clearTimeout(t)
  }, [local, debounceMs])

  return (
    <div className={`relative ${className}`}>
      <Search
        size={16}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-600 pointer-events-none"
      />
      <input
        type="text"
        value={local}
        onChange={e => setLocal(e.target.value)}
        placeholder={placeholder}
        className={`w-full pl-9 py-2.5 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500 transition ${onScan ? (local ? 'pr-16' : 'pr-9') : 'pr-9'}`}
      />
      {local && (
        <button
          type="button"
          onClick={() => { setLocal(''); onChangeRef.current('') }}
          className={`absolute top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition ${onScan ? 'right-9' : 'right-3'}`}
          aria-label="Tozalash"
        >
          <X size={14} />
        </button>
      )}
      {onScan && (
        <BarcodeScanner
          onScan={onScan}
          title="Shtrix-kodni skanerlang"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-600 hover:text-primary transition p-1"
        />
      )}
    </div>
  )
}
