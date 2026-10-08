'use client'

import { MicOff, WifiOff } from 'lucide-react'
import { soatMatni, type YozuvHolati } from '@/lib/smena'

export interface SmenaHolatQisqa {
  faol: boolean
  boshlandi: string
  tugadi: string | null
  aloqa: boolean | null
  yozuvHolati: YozuvHolati | null
}

/**
 * Kuryerning bugungi holati bir qarashda: ishda (yozuv ketyapti), ishda
 * lekin muammo (aloqa yo'q / yozuv to'xtagan), yoki ishni tugatgan.
 * Holat rang bilan birga matn va belgi bilan ham beriladi.
 */
export default function SmenaBelgisi({ smena, bosh }: { smena: SmenaHolatQisqa | null; bosh?: string }) {
  if (!smena) {
    return bosh ? (
      <span className="inline-flex items-center rounded-md bg-gray-100 dark:bg-neutral-800 px-1.5 py-0.5 text-[11px] text-gray-500 dark:text-gray-400">
        {bosh}
      </span>
    ) : null
  }
  if (!smena.faol) {
    return (
      <span className="inline-flex items-center rounded-md bg-gray-100 dark:bg-neutral-800 px-1.5 py-0.5 text-[11px] text-gray-600 dark:text-gray-400">
        Tugatdi · {smena.tugadi ? soatMatni(smena.tugadi) : ''}
      </span>
    )
  }
  if (smena.aloqa === false) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-400"
        title="Ilovadan bir necha daqiqadan beri xabar yo‘q — yopilgan yoki internet yo‘q">
        <WifiOff size={11} aria-hidden /> Ishda · aloqa yo‘q
      </span>
    )
  }
  if (smena.yozuvHolati && smena.yozuvHolati !== 'yozilmoqda') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-400"
        title="Smena ochiq, lekin ovoz yozilmayapti">
        <MicOff size={11} aria-hidden /> Ishda · yozuv to‘xtagan
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
      </span>
      Ishda · {soatMatni(smena.boshlandi)} dan
    </span>
  )
}
