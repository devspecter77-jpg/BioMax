'use client'

import { birlikKasrlimi, birlikMatni, miqdorMatni, oramlarTartibda, qismlardanJami, type Oram } from '@/lib/birlik'

// Miqdorni qo'shimcha birliklarda kiritish: "5 karobka + 1 qop + 3 dona" →
// jami asosiy birlikda (bazaga shu yoziladi). O'ram bo'lmasa — bitta maydon.
// Qismlar: kalit — o'ram nomi, '' — asosiy birlik.

const inputCls = 'w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 transition tabular-nums'

export default function MiqdorKiritish({ idPrefiks, asosiy, oramlar, qismlar, onChange }: {
  /** Maydonlar id'si: `${idPrefiks}-dona`, `${idPrefiks}-karobka` */
  idPrefiks: string
  asosiy: string
  oramlar: Oram[]
  qismlar: Record<string, string>
  onChange: (q: Record<string, string>) => void
}) {
  const asosiyMatn = birlikMatni(asosiy)
  const kasrli = birlikKasrlimi(asosiy)
  const tartibda = oramlarTartibda(oramlar)
  const jami = qismlardanJami(qismlar, oramlar)
  const tozala = (v: string, kasr: boolean) => (kasr ? v.replace(',', '.').replace(/[^0-9.]/g, '') : v.replace(/\D/g, ''))
  const maydonId = (nomi: string) => `${idPrefiks}-${nomi.replace(/\s+/g, '-')}`

  const qator = (nomi: string, belgi: string, izoh: string | null, kasr: boolean) => (
    <div key={nomi || '__asosiy'} className="flex items-center gap-2">
      <input
        id={maydonId(nomi || asosiyMatn)}
        value={qismlar[nomi] ?? ''}
        onChange={e => onChange({ ...qismlar, [nomi]: tozala(e.target.value, kasr) })}
        inputMode={kasr ? 'decimal' : 'numeric'}
        placeholder="0"
        aria-label={`Nechta ${belgi}`}
        className={`${inputCls} max-w-32 text-right`}
      />
      <span className="text-sm text-gray-700 dark:text-gray-300">{belgi}</span>
      {izoh && <span className="text-xs text-gray-500 dark:text-gray-400">{izoh}</span>}
    </div>
  )

  if (tartibda.length === 0) return qator('', asosiyMatn, null, kasrli)

  return (
    <div className="space-y-2">
      {tartibda.map(o => qator(o.nomi, o.nomi, `× ${o.miqdor} ${asosiyMatn}`, kasrli))}
      {qator('', asosiyMatn, null, kasrli)}
      <p className="text-sm text-gray-700 dark:text-gray-300 tabular-nums" aria-live="polite">
        Jami: <b className="text-gray-900 dark:text-gray-100">{jami} {asosiyMatn}</b>
        {jami > 0 && miqdorMatni(jami, asosiy, oramlar) !== `${jami} ${asosiyMatn}` && (
          <span className="text-gray-500 dark:text-gray-400"> ({miqdorMatni(jami, asosiy, oramlar)})</span>
        )}
      </p>
    </div>
  )
}
