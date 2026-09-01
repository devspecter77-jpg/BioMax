'use client'

import { useState, useRef, useCallback, useEffect, useId } from 'react'
import { ScanLine, X } from 'lucide-react'
import { toast } from 'sonner'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'

interface Props {
  onScan: (kod: string) => void
  className?: string
  title?: string
}

export default function BarcodeScanner({ onScan, className, title }: Props) {
  const [ochiq, setOchiq] = useState(false)
  useBodyScrollLock(ochiq)
  const skanerRef = useRef<any>(null)
  const oxirgiSkanRef = useRef<string>('')
  const readerId = 'barcode-reader-' + useId().replace(/[^a-zA-Z0-9]/g, '')

  const yopish = useCallback(() => {
    const s = skanerRef.current
    if (s) {
      s.isScanning && s.stop().then(() => s.clear()).catch(() => {})
      skanerRef.current = null
    }
    oxirgiSkanRef.current = ''
    setOchiq(false)
  }, [])

  const ochish = useCallback(async () => {
    setOchiq(true)
    oxirgiSkanRef.current = ''
    setTimeout(async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        const scanner = new Html5Qrcode(readerId)
        skanerRef.current = scanner
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 15, qrbox: { width: 280, height: 160 } },
          (kod: string) => {
            const n = kod.trim()
            if (!n || oxirgiSkanRef.current === n) return
            oxirgiSkanRef.current = n
            onScan(n)
            yopish()
          },
          () => {}
        )
      } catch {
        toast.error('Kamera ochilmadi')
        setOchiq(false)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, 100)
  }, [onScan, yopish, readerId])

  useEffect(() => () => {
    const s = skanerRef.current
    s?.isScanning && s.stop().catch(() => {})
  }, [])

  return (
    <>
      <button
        type="button"
        onClick={ochiq ? yopish : ochish}
        title="Shtrix-kodni skanerlash"
        className={className || 'shrink-0 p-2.5 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-500 dark:text-gray-400 hover:border-primary/50 hover:text-primary transition'}
      >
        <ScanLine size={18} />
      </button>
      {ochiq && (
        <div className="fixed inset-0 bg-black/80 z-[80] flex items-center justify-center p-4" onClick={yopish}>
          <div className="bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-gray-900 dark:text-gray-100 font-semibold text-sm">{title || 'Shtrix-kodni skanerlang'}</h3>
              <button onClick={yopish} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X size={18} /></button>
            </div>
            <div id={readerId} style={{ width: '100%' }} />
          </div>
        </div>
      )}
    </>
  )
}
