import { Globe, UserPlus } from 'lucide-react'
import { formatSanaVaVaqt } from '@/lib/utils'
import { kiritishMalumoti, type MijozKiritgan } from '@/lib/mijoz-manba'

// Mijozni KIM qo'shgani (xodim yoki administrator) va qayerdan — kartada.
//
// `ixcham` — ro'yxat va kartochka uchun bir qator; aks holda batafsil
// oynadagi to'liq blok (qayerdan va qachon bilan).

interface Props {
  m: { yaratgan?: MijozKiritgan | null; manba?: string | null; izoh?: string | null; yaratilgan?: string | null }
  ixcham?: boolean
}

const ROL_RANGI: Record<string, string> = {
  Administrator: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  Kassir: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  Sotuvchi: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  Omborchi: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  Dostavchik: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
}

export default function KiritganBelgisi({ m, ixcham = false }: Props) {
  const k = kiritishMalumoti(m)
  const sana = m.yaratilgan ? formatSanaVaVaqt(m.yaratilgan) : null
  const Belgi = k.kim || k.nomalum ? UserPlus : Globe

  if (ixcham) {
    const izoh = [k.qayerda, sana].filter(Boolean).join(' · ')
    return (
      <span className="inline-flex min-w-0 items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400" title={`Qo‘shgan${izoh ? ` — ${izoh}` : ''}`}>
        <Belgi size={11} className="shrink-0" aria-hidden />
        <span className="sr-only">Qo‘shgan:</span>
        {k.kim ? (
          <>
            <span className={`truncate ${k.arxiv ? 'line-through decoration-gray-400' : ''}`}>{k.kim}</span>
            {k.rol && <span className="shrink-0 text-gray-400 dark:text-gray-500">· {k.rol}</span>}
          </>
        ) : (
          <span className="truncate italic">{k.nomalum ? 'Kim qo‘shgani noma’lum' : 'Onlayn do‘kon'}</span>
        )}
      </span>
    )
  }

  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-gray-200 dark:border-neutral-800 px-3 py-2.5">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-gray-400" aria-hidden>
        <Belgi size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Qo‘shgan</p>
        {k.kim ? (
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm font-medium text-gray-900 dark:text-gray-100">
            <span className={k.arxiv ? 'line-through decoration-gray-400' : ''}>{k.kim}</span>
            {k.rol && <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${ROL_RANGI[k.rol] ?? 'bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-gray-300'}`}>{k.rol}</span>}
            {k.arxiv && <span className="text-xs font-normal text-gray-500">hisobi o‘chirilgan</span>}
          </p>
        ) : (
          <p className="mt-0.5 text-sm font-medium text-gray-900 dark:text-gray-100">
            {k.nomalum ? 'Noma’lum' : 'Onlayn do‘kon — mijoz saytda o‘zi buyurtma bergan'}
          </p>
        )}
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          {[k.qayerda, sana].filter(Boolean).join(' · ') || (k.nomalum ? 'Bu mijoz kim qo‘shgani yozib borilishidan oldin kiritilgan' : '')}
          {k.nomalum && (k.qayerda || sana) && <> · kim qo‘shgani yozib borilishidan oldin kiritilgan</>}
        </p>
      </div>
    </div>
  )
}
