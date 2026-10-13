'use client'

import { useEffect, useState } from 'react'
import Combobox from '@/components/ui/combobox'
import { TAYYOR_BIRLIKLAR, birlikMatni, birlikTozala } from '@/lib/birlik'

// Asosiy o'lchov birligini tanlash: tayyorlari (dona, kg…), do'konda avval
// qo'shilganlari va yangisini yozish ("juft", "rulon").

export interface BirlikTakliflari { birliklar: string[]; oramlar: string[] }

let kesh: Promise<BirlikTakliflari> | null = null

/** Do'konda ishlatilgan maxsus birlik va o'ram nomlari — bir marta yuklanadi. */
export function birlikTakliflariniOl(yangidan = false): Promise<BirlikTakliflari> {
  if (!kesh || yangidan) {
    kesh = fetch('/api/tovarlar/birliklar')
      .then(r => (r.ok ? r.json() : { birliklar: [], oramlar: [] }))
      .then(d => ({
        birliklar: Array.isArray(d?.birliklar) ? d.birliklar : [],
        oramlar: Array.isArray(d?.oramlar) ? d.oramlar : [],
      }))
      .catch(() => ({ birliklar: [], oramlar: [] }))
  }
  return kesh
}

export function useBirlikTakliflari(): BirlikTakliflari {
  const [t, setT] = useState<BirlikTakliflari>({ birliklar: [], oramlar: [] })
  useEffect(() => {
    let bekor = false
    void birlikTakliflariniOl().then(d => { if (!bekor) setT(d) })
    return () => { bekor = true }
  }, [])
  return t
}

const TAYYOR_IZOH: Record<string, string> = { KG: 'kasrli', LITR: 'kasrli', METR: 'kasrli' }

export default function BirlikTanlash({ id, value, onChange }: {
  id?: string
  /** Saqlanadigan qiymat: "DONA", "KG" … yoki "juft" */
  value: string
  onChange: (birlik: string) => void
}) {
  const { birliklar } = useBirlikTakliflari()
  const maxsus = [...new Set([...birliklar, ...(value && !(TAYYOR_BIRLIKLAR as readonly string[]).includes(value) ? [value] : [])])]
  const variantlar = [
    ...TAYYOR_BIRLIKLAR.map(b => ({ value: b, label: birlikMatni(b), izoh: TAYYOR_IZOH[b] })),
    ...maxsus.map(b => ({ value: b, label: b, izoh: 'qo‘shilgan' })),
  ]
  return (
    <Combobox
      id={id}
      options={variantlar}
      value={value}
      onChange={v => {
        if (!v) return // asosiy birlik bo'sh qolmaydi
        if (variantlar.some(o => o.value === v)) { onChange(v); return }
        // Yangi yozilgan nom: "Kg" / "кг" tayyoriga aylanadi, boshqasi — o'zi
        const toza = birlikTozala(v)
        if (toza) onChange(toza)
      }}
      placeholder="Birlikni tanlang"
      searchPlaceholder="Birlik — tanlang yoki yozing (juft, rulon…)"
      allowCustom
      customLabel={m => `«${m}» — yangi birlik qo‘shish`}
    />
  )
}
