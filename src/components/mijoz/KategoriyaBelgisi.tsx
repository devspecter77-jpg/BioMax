import { rangKlassi, type KategoriyaQisqa } from '@/lib/mijoz-kategoriya'

/** Mijoz kategoriyasi belgisi (rangli nuqta va nom). */
export default function KategoriyaBelgisi({ k, kichik = false }: { k: KategoriyaQisqa | null | undefined; kichik?: boolean }) {
  if (!k) return null
  const r = rangKlassi(k.rang)
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-full font-medium ${r.chip} ${kichik ? 'px-1.5 py-px text-[10px]' : 'px-2 py-0.5 text-[11px]'}`}
      title={`Kategoriya: ${k.nomi}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${r.nuqta}`} aria-hidden />
      <span className="truncate">{k.nomi}</span>
    </span>
  )
}
