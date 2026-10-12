'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, X } from 'lucide-react'
import type { KategoriyaQatori, XodimQisqa } from '@/lib/mijoz-kategoriya'

// Tanlangan mijozlarni birdaniga kategoriyaga o'tkazish yoki mas'ul xodimga
// biriktirish (faqat administrator). Ro'yxat ostida qotib turadi.

const OZGARMAYDI = '__ozgarmaydi__'

export default function TanlovPaneli({ idlar, kategoriyalar, xodimlar, onTayyor, onBekor }: {
  idlar: string[]
  kategoriyalar: KategoriyaQatori[]
  xodimlar: XodimQisqa[]
  onTayyor: () => void
  onBekor: () => void
}) {
  const [kategoriya, setKategoriya] = useState(OZGARMAYDI)
  const [masul, setMasul] = useState(OZGARMAYDI)
  const [band, setBand] = useState(false)

  async function qolla() {
    if (kategoriya === OZGARMAYDI && masul === OZGARMAYDI) { toast.error('Kategoriya yoki mas’ul xodimni tanlang'); return }
    setBand(true)
    try {
      const r = await fetch('/api/mijozlar/ommaviy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idlar,
          ...(kategoriya !== OZGARMAYDI ? { kategoriyaId: kategoriya || null } : {}),
          ...(masul !== OZGARMAYDI ? { masulId: masul || null } : {}),
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.xato ?? 'Saqlanmadi'); return }
      toast.success(`${j.ozgardi ?? idlar.length} ta mijoz yangilandi`)
      onTayyor()
    } catch {
      toast.error('Internet aloqasini tekshiring')
    } finally {
      setBand(false)
    }
  }

  const tanlovCls = 'min-h-10 min-w-0 flex-1 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500'
  return (
    <div className="sticky bottom-20 lg:bottom-3 z-20">
      <div className="flex flex-col gap-2 rounded-2xl border border-gray-200 dark:border-neutral-700 bg-white/95 dark:bg-neutral-900/95 backdrop-blur p-3 shadow-lg sm:flex-row sm:items-center">
        <div className="flex items-center justify-between gap-2 sm:justify-start">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">{idlar.length} ta tanlandi</span>
          {/* Ikonkali tugmani responsiv yashirish — o'rovchi orqali (globals.css 40px qoidasi `hidden` ni yengadi) */}
          <span className="sm:hidden">
            <button type="button" onClick={onBekor} disabled={band} aria-label="Tanlashni bekor qilish"
              className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-neutral-800">
              <X size={16} />
            </button>
          </span>
        </div>
        <div className="flex min-w-0 flex-1 gap-2">
          <select value={kategoriya} onChange={e => setKategoriya(e.target.value)} className={tanlovCls} aria-label="Kategoriya">
            <option value={OZGARMAYDI}>Kategoriya: o‘zgarmaydi</option>
            <option value="">Kategoriyasiz</option>
            {kategoriyalar.map(k => <option key={k.id} value={k.id}>{k.nomi}</option>)}
          </select>
          <select value={masul} onChange={e => setMasul(e.target.value)} className={tanlovCls} aria-label="Mas’ul xodim">
            <option value={OZGARMAYDI}>Mas’ul: o‘zgarmaydi</option>
            <option value="">Hech kim (faqat adminlar)</option>
            {xodimlar.map(x => <option key={x.id} value={x.id}>{x.ism}{x.faol ? '' : ' (faol emas)'}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onBekor} disabled={band}
            className="hidden sm:block min-h-10 rounded-xl px-3 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-neutral-800">
            Bekor
          </button>
          <button type="button" onClick={() => void qolla()} disabled={band}
            className="min-h-10 flex-1 sm:flex-none rounded-xl bg-primary hover:bg-primary-hover px-4 text-sm font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-2">
            {band && <Loader2 size={15} className="animate-spin" />} Qo‘llash
          </button>
        </div>
      </div>
    </div>
  )
}
