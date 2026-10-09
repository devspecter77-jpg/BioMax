'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { AlertTriangle, ChevronRight, Truck } from 'lucide-react'
import SmenaBelgisi, { type SmenaHolatQisqa } from './SmenaBelgisi'

interface Kuryer { id: string; ism: string; smena: SmenaHolatQisqa | null }
/** Faqat administratorga keladi */
interface OmborHolati { tayyor: boolean; yetishmaydi: string[] }

// Bosh sahifa (administrator): kuryerlar hozir ishdami, qachondan, ovoz
// yozilyaptimi. Ruxsati yo'q foydalanuvchiga va kuryer yo'q do'konga
// umuman ko'rinmaydi. Har daqiqada yangilanadi.
export default function KuryerlarHolati() {
  const { data: session } = useSession()
  const u = session?.user as { rol?: string; ruxsatlar?: string[] | null } | undefined
  // So'rov faqat ruxsati borga — kuryer va kassirda behuda 403 bo'lmasin
  const mumkin = u?.rol === 'ADMIN' || !!u?.ruxsatlar?.includes('xodimlar.smena')
  const [kuryerlar, setKuryerlar] = useState<Kuryer[] | null>(null)
  const [ombor, setOmbor] = useState<OmborHolati | null>(null)
  const [yopiq, setYopiq] = useState(false)

  useEffect(() => {
    if (!mumkin) return
    let bekor = false
    async function yukla() {
      const r = await fetch('/api/smena/kuryerlar', { cache: 'no-store' }).catch(() => null)
      if (bekor || !r) return
      if (r.status === 401 || r.status === 403) { setYopiq(true); return }
      if (!r.ok) return
      const j = await r.json().catch(() => null)
      if (!bekor && Array.isArray(j?.kuryerlar)) setKuryerlar(j.kuryerlar)
      if (!bekor) setOmbor(j?.ombor ?? null)
    }
    void yukla()
    const i = setInterval(() => { if (document.visibilityState === 'visible') void yukla() }, 60_000)
    return () => { bekor = true; clearInterval(i) }
  }, [mumkin])

  if (!mumkin || yopiq || !kuryerlar || kuryerlar.length === 0) return null
  const ishda = kuryerlar.filter(k => k.smena?.faol).length
  // Ishdagilar tepada, keyin bugun ishlaganlar
  const tartib = [...kuryerlar].sort((a, b) =>
    Number(!!b.smena?.faol) - Number(!!a.smena?.faol) || Number(!!b.smena) - Number(!!a.smena) || a.ism.localeCompare(b.ism))

  return (
    <section aria-labelledby="kuryerlar-sarlavha" className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-gray-100 dark:border-neutral-800">
        <h2 id="kuryerlar-sarlavha" className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
          <Truck size={16} className="text-primary" aria-hidden /> Kuryerlar
          <span className="font-normal text-gray-500 dark:text-gray-400">· {ishda} ta ishda</span>
        </h2>
        <Link href="/xodimlar" className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline">
          Batafsil <ChevronRight size={14} aria-hidden />
        </Link>
      </div>
      {ombor && !ombor.tayyor && (
        <div className="flex items-start gap-2.5 border-b border-amber-200/70 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 px-4 sm:px-5 py-3 text-amber-900 dark:text-amber-200">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          <div className="min-w-0 text-xs leading-relaxed">
            <p className="text-sm font-semibold">Ovoz yozuvlari serverga tushmayapti</p>
            <p className="mt-0.5">
              Bulut ombori ulanmagan. Yozuvlar kuryer telefonida xavfsiz kutib turibdi va ombor ulangach o‘zi
              yuboriladi — kuryerga bu haqda hech narsa ko‘rsatilmaydi.
            </p>
            <details className="mt-1.5">
              <summary className="cursor-pointer font-medium underline-offset-2 hover:underline">Qanday ulash (~10 daqiqa)</summary>
              <ol className="mt-1.5 list-decimal space-y-1 pl-4">
                <li>dash.cloudflare.com → R2 → Create bucket → nomi <code className="font-mono">biomax-ovozlar</code> (ochiq qilinmaydi).</li>
                <li>R2 → Manage API tokens → Create API token → «Object Read &amp; Write», faqat shu bucket.</li>
                <li>
                  Vercel → loyiha → Settings → Environment Variables:{' '}
                  {ombor.yetishmaydi.map((n, i) => (
                    <span key={n}>{i > 0 && ', '}<code className="font-mono">{n}</code></span>
                  ))}
                  {' '}→ Redeploy.
                </li>
                <li>Xodimlar → kuryer → «Ish va ovozlar» → «Tekshirish».</li>
              </ol>
            </details>
          </div>
        </div>
      )}
      <ul className="divide-y divide-gray-100 dark:divide-neutral-800">
        {tartib.map(k => (
          <li key={k.id} className="flex items-center justify-between gap-3 px-4 sm:px-5 py-2.5">
            <span className="text-sm text-gray-900 dark:text-gray-100 truncate">{k.ism}</span>
            <SmenaBelgisi smena={k.smena} bosh="Bugun ishlamadi" />
          </li>
        ))}
      </ul>
    </section>
  )
}
