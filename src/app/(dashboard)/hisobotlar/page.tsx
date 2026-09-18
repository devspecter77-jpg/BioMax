'use client'

import { useSession } from 'next-auth/react'
import { useRuxsat } from '@/hooks/useRuxsat'
import { Suspense, lazy } from 'react'
import { Download } from 'lucide-react'
import { useReportFilters } from './_hooks/useReportFilters'
import { ReportFilter } from './_components/ReportFilter'
import { SkeletonKPI, SkeletonChart } from './_components/Skeletons'

const UmumiyTab = lazy(() =>
  import('./_tabs/UmumiyTab').then((m) => ({ default: m.UmumiyTab })),
)
const SotuvTab = lazy(() =>
  import('./_tabs/SotuvTab').then((m) => ({ default: m.SotuvTab })),
)
const TovarlarTab = lazy(() =>
  import('./_tabs/TovarlarTab').then((m) => ({ default: m.TovarlarTab })),
)
const OmborTab = lazy(() =>
  import('./_tabs/OmborTab').then((m) => ({ default: m.OmborTab })),
)
const MijozlarTab = lazy(() =>
  import('./_tabs/MijozlarTab').then((m) => ({ default: m.MijozlarTab })),
)
const NasiyaTab = lazy(() =>
  import('./_tabs/NasiyaTab').then((m) => ({ default: m.NasiyaTab })),
)
const XaridlarTab = lazy(() =>
  import('./_tabs/XaridlarTab').then((m) => ({ default: m.XaridlarTab })),
)

const TAB_LIST: Array<{ key: string; label: string }> = [
  { key: 'umumiy', label: 'Umumiy' },
  { key: 'sotuv', label: 'Sotuv' },
  { key: 'tovarlar', label: 'Tovarlar' },
  { key: 'ombor', label: 'Ombor' },
  { key: 'mijozlar', label: 'Mijozlar' },
  { key: 'nasiya', label: 'Nasiya' },
  { key: 'xaridlar', label: 'Xaridlar' },
]

const TAB_COMPONENTS = {
  umumiy: UmumiyTab,
  sotuv: SotuvTab,
  tovarlar: TovarlarTab,
  ombor: OmborTab,
  mijozlar: MijozlarTab,
  nasiya: NasiyaTab,
  xaridlar: XaridlarTab,
} as const

// Inner component that uses useSearchParams (via useReportFilters) — must be inside Suspense
function HisobotlarInner({ isKassir }: { isKassir: boolean }) {
  const { filtrlar, yangilash } = useReportFilters()
  const ruxsat = useRuxsat()

  const visibleTabs = TAB_LIST.filter((t) => ruxsat.bor('hisobotlar.' + t.key))
  // Tanlangan (yoki standart «Umumiy») varaq ruxsat etilmagan bo'lsa — birinchi ochiq varaq
  const aktivKalit = visibleTabs.some(t => t.key === filtrlar.tab) ? filtrlar.tab : visibleTabs[0]?.key
  const ActiveTab = aktivKalit ? TAB_COMPONENTS[aktivKalit as keyof typeof TAB_COMPONENTS] ?? null : null

  function downloadExcel() {
    const qs = new URLSearchParams({
      tur: filtrlar.tur,
      ...(filtrlar.dan ? { dan: filtrlar.dan } : {}),
      ...(filtrlar.gacha ? { gacha: filtrlar.gacha } : {}),
    })
    // Excel fayl yuklab olinadi — sahifa almashmaydi
    const havola = document.createElement('a')
    havola.href = `/api/hisobotlar/export?${qs.toString()}`
    havola.download = ''
    havola.click()
  }

  return (
    <>
      {/* Header + Excel button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Hisobotlar</h1>
        {ruxsat.bor('hisobotlar.export') && (
          <button
            onClick={downloadExcel}
            className="inline-flex items-center gap-2 px-3 py-2 bg-red-600 text-white text-sm rounded-xl hover:bg-red-700"
          >
            <Download size={14} /> Excel
          </button>
        )}
      </div>

      {/* Filter */}
      <ReportFilter
        tur={filtrlar.tur}
        dan={filtrlar.dan}
        gacha={filtrlar.gacha}
        onChange={yangilash}
      />

      {/* Tab navigation */}
      <div className="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-neutral-800 -mb-px">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => yangilash({ tab: t.key })}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition ${
              aktivKalit === t.key
                ? 'border-red-600 text-red-600 dark:text-red-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Active tab (lazy) */}
      <Suspense
        fallback={
          <div className="space-y-4">
            <SkeletonKPI />
            <SkeletonChart />
          </div>
        }
      >
        {ActiveTab ? (
          <ActiveTab filtrlar={filtrlar} isKassir={isKassir} />
        ) : ruxsat.rol ? (
          <p className="rounded-2xl border border-dashed border-gray-300 dark:border-neutral-700 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
            Sizga hech qaysi hisobot ochilmagan. Administratorga murojaat qiling.
          </p>
        ) : null}
      </Suspense>
    </>
  )
}

export default function HisobotlarPage() {
  const { data: session } = useSession()
  const isKassir = (session?.user as { rol?: string } | undefined)?.rol === 'KASSIR'

  return (
    <div className="space-y-4">
      <Suspense
        fallback={
          <div className="space-y-4">
            <SkeletonKPI />
            <SkeletonChart />
          </div>
        }
      >
        <HisobotlarInner isKassir={isKassir} />
      </Suspense>
    </div>
  )
}
