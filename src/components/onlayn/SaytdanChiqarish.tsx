'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Ban, LogOut, Lock, PackageCheck, RotateCcw } from 'lucide-react'
import Modal, { ModalAsosiy, ModalBekor } from '@/components/ui/modal'
import { formatPhone } from '@/lib/utils'
import { BLOK_SABABLARI, BLOK_SABAB_CHEGARA, type OnlaynBlokYozuvi } from '@/lib/onlayn-mijoz'

// Onlayn xaridorni saytdan chiqarish (sababi bilan) va qayta ruxsat berish.
// Holat marketplace'da (mp_hisoblar.faol) — sayt uni har so'rovda tekshiradi,
// shuning uchun seans darhol tugaydi. Mijozlar › Onlayn va buyurtma oynasi
// ikkalasi ham shu komponentni ishlatadi.

export interface Xaridor { id: string; ism: string | null; telefon: string }

export interface ChiqarishNatijasi { faol: boolean; yozuv: OnlaynBlokYozuvi; faolBuyurtmalar: number }

const ismi = (x: Xaridor) => x.ism?.trim() || 'Ismsiz xaridor'

/** Qayta ruxsat berish — tasdiq chaqiruvchida; natija yoki null (xato toast bilan) */
export async function qaytaRuxsatBer(x: Xaridor): Promise<ChiqarishNatijasi | null> {
  try {
    const r = await fetch(`/api/onlayn-mijozlar/${encodeURIComponent(x.id)}/bloklash`, { method: 'DELETE' })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { toast.error(d.xato ?? 'Ruxsat berilmadi'); return null }
    toast.success(`${ismi(x)} saytga qayta kira oladi`)
    return d
  } catch {
    toast.error('Internet aloqasini tekshiring')
    return null
  }
}

export default function SaytdanChiqarishOynasi({ xaridor, faolBuyurtmalar, onYopish, onBajarildi }: {
  xaridor: Xaridor
  /** Ma'lum bo'lsa — ogohlantirishda aniq son */
  faolBuyurtmalar?: number
  onYopish: () => void
  onBajarildi: (n: ChiqarishNatijasi) => void
}) {
  const [sabab, setSabab] = useState('')
  const [yuborilmoqda, setYuborilmoqda] = useState(false)
  const toza = sabab.trim()

  async function chiqar(e: React.FormEvent) {
    e.preventDefault()
    if (toza.length < 3) { toast.error('Sababini yozing — keyin nima uchun chiqarilgani ko‘rinib tursin'); return }
    setYuborilmoqda(true)
    try {
      const r = await fetch(`/api/onlayn-mijozlar/${encodeURIComponent(xaridor.id)}/bloklash`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sabab: toza }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(d.xato ?? 'Chiqarilmadi'); return }
      toast.success(`${ismi(xaridor)} saytdan chiqarildi — seansi tugadi`, {
        description: d.faolBuyurtmalar > 0 ? `${d.faolBuyurtmalar} ta faol buyurtmasi o‘z holicha qoldi` : undefined,
      })
      onBajarildi(d)
    } catch {
      toast.error('Internet aloqasini tekshiring')
    } finally {
      setYuborilmoqda(false)
    }
  }

  return (
    <Modal
      olcham="md"
      zClassName="z-[60]"
      belgi={<Ban size={18} className="text-red-600" />}
      sarlavha={<>Saytdan chiqarish</>}
      tavsif={`${ismi(xaridor)} · ${formatPhone(xaridor.telefon)}`}
      onYopish={onYopish}
      yopishMumkin={!yuborilmoqda}
      onSubmit={chiqar}
      footer={<>
        <ModalBekor onClick={onYopish} disabled={yuborilmoqda} />
        <ModalAsosiy rang="xavfli" keng yuklanmoqda={yuborilmoqda} belgi={<LogOut size={16} />}>
          Saytdan chiqarish
        </ModalAsosiy>
      </>}
    >
      <div className="space-y-4">
        <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <li className="flex gap-2.5"><LogOut size={16} className="mt-0.5 shrink-0 text-red-600" aria-hidden />Hozirgi seansi darhol tugaydi — saytdan chiqib ketadi.</li>
          <li className="flex gap-2.5"><Lock size={16} className="mt-0.5 shrink-0 text-red-600" aria-hidden />Qayta kira olmaydi va buyurtma bera olmaydi — «Hisob bloklangan. Do‘kon bilan bog‘laning» degan xabar ko‘radi.</li>
          <li className="flex gap-2.5">
            <PackageCheck size={16} className="mt-0.5 shrink-0 text-amber-600" aria-hidden />
            {faolBuyurtmalar === undefined
              ? 'Faol buyurtmalari bekor qilinmaydi — kerak bo‘lsa ularni alohida bekor qiling.'
              : faolBuyurtmalar > 0
                ? `Faol buyurtmalari (${faolBuyurtmalar} ta) bekor qilinmaydi — kerak bo‘lsa ularni alohida bekor qiling.`
                : 'Faol buyurtmasi yo‘q.'}
          </li>
          <li className="flex gap-2.5"><RotateCcw size={16} className="mt-0.5 shrink-0 text-gray-400" aria-hidden />Istalgan vaqtda qayta ruxsat berish mumkin.</li>
        </ul>

        <div>
          <label htmlFor="blok-sabab" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Sababi</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {BLOK_SABABLARI.map(s => (
              <button key={s} type="button" onClick={() => setSabab(s)} aria-pressed={toza === s}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${toza === s
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-neutral-700'}`}>
                {s}
              </button>
            ))}
          </div>
          <textarea
            id="blok-sabab"
            value={sabab}
            onChange={e => setSabab(e.target.value.slice(0, BLOK_SABAB_CHEGARA))}
            rows={2}
            placeholder="Masalan: 3 marta buyurtma berib, eshikni ochmadi"
            className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
          />
          <p className="text-[11px] text-gray-500 dark:text-gray-400 text-right tabular-nums">{toza.length}/{BLOK_SABAB_CHEGARA}</p>
        </div>
      </div>
    </Modal>
  )
}
