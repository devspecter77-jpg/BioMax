'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import Modal from '@/components/ui/modal'

interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn>(async () => true)

export function useConfirm() {
  return useContext(ConfirmContext)
}

export default function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { open: boolean }) | null>(null)
  const resolver = useRef<(v: boolean) => void>(null)
  useBodyScrollLock(!!state?.open)

  const confirm = useCallback<ConfirmFn>((options) => {
    const opts = typeof options === 'string' ? { message: options } : options
    setState({ open: true, ...opts })
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  function close(result: boolean) {
    setState(null)
    resolver.current?.(result)
    resolver.current = null
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state?.open && (
        <Modal
          olcham="sm"
          belgi={<AlertTriangle size={18} className={state.danger !== false ? 'text-red-500' : 'text-amber-500'} />}
          sarlavha={<>{state.title || 'Tasdiqlang'}</>}
          onYopish={() => close(false)}
          zClassName="z-[100]"
          footer={<>
            <button
              onClick={() => close(false)}
              className="flex-1 py-2.5 border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition font-medium"
            >
              {state.cancelText || 'Bekor qilish'}
            </button>
            <button
              onClick={() => close(true)}
              className={`flex-1 py-2.5 text-white rounded-xl font-medium transition ${state.danger !== false ? 'bg-red-600 hover:bg-red-500' : 'bg-primary hover:bg-primary-hover'}`}
            >
              {state.confirmText || 'Ha'}
            </button>
          </>}
        >
          <p className="text-gray-600 dark:text-gray-400 text-sm">{state.message}</p>
        </Modal>
      )}
    </ConfirmContext.Provider>
  )
}
