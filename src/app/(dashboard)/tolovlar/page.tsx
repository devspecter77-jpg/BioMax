'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Wallet, Loader2, RefreshCw, Building, TrendingUp, TrendingDown, RotateCcw, Info,
} from 'lucide-react'
import { formatSum, formatSanaVaVaqt } from '@/lib/utils'
import {
  KANAL_USULLARI, TOLOV_MALUMOTI, tolovQisqa, tolovBadge, type KanalUsuli,
} from '@/lib/tolov-usullari'
import type { ReportTur } from '@/lib/hisobotlar'

type KanalYigindi = Record<KanalUsuli, number> & { jami: number }

interface FilialQator extends KanalYigindi { id: string; nomi: string; chiqim: number }

interface Tranzaksiya {
  id: string
  turi: 'sotuv' | 'nasiya' | 'xarid' | 'xarajat'
  sana: string
  nomi: string
  kim: string | null
  xodim: string | null
  kanallar: { usul: KanalUsuli; summa: number }[]
  jami: number
}

interface Malumot {
  jami: KanalYigindi
  manbalar: { sotuvdan: KanalYigindi; nasiyadan: KanalYigindi }
  qaytarish: number
  sofKirim: number
  chiqim: KanalYigindi
  filiallar: FilialQator[]
  filialRoyxati: { id: string; nomi: string }[]
  egaMi: boolean
  tranzaksiyalar: Tranzaksiya[]
}

const DAVRLAR: { kalit: ReportTur; label: string }[] = [
  { kalit: 'kunlik', label: 'Bugun' },
  { kalit: 'haftalik', label: 'Hafta' },
  { kalit: 'oylik', label: 'Oy' },
  { kalit: 'yillik', label: 'Yil' },
]

const TUR_LABEL: Record<Tranzaksiya['turi'], string> = {
  sotuv: 'Sotuv', nasiya: 'Nasiya to‘lovi', xarid: "Ta'minotchiga", xarajat: 'Xarajat',
}
const TUR_RANG: Record<Tranzaksiya['turi'], string> = {
  sotuv: 'bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400',
  nasiya: 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400',
  xarid: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400',
  xarajat: 'bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400',
}

export default function TolovlarPage() {
  const [data, setData] = useState<Malumot | null>(null)
  const [yuklanmoqda, setYuklanmoqda] = useState(true)
  const [davr, setDavr] = useState<ReportTur>('oylik')
  const [filial, setFilial] = useState('')

  const yukla = useCallback(async () => {
    setYuklanmoqda(true)
    try {
      const qs = new URLSearchParams({ tur: davr })
      if (filial) qs.set('filialId', filial)
      const r = await fetch(`/api/tolovlar?${qs}`)
      if (!r.ok) { toast.error("Ma'lumot yuklanmadi"); return }
      setData(await r.json())
    } catch {
      toast.error('Tarmoq xatosi')
    } finally {
      setYuklanmoqda(false)
    }
  }, [davr, filial])

  useEffect(() => { void yukla() }, [yukla])

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Wallet size={22} className="text-primary" />
            To&apos;lovlar
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
            Kirgan va chiqqan pul — to&apos;lov usuli va filial kesimida
          </p>
        </div>
        <button
          onClick={() => void yukla()}
          className="p-2.5 rounded-xl border border-gray-300 dark:border-neutral-700 text-gray-500 hover:text-primary hover:border-primary/50 transition"
          title="Yangilash"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Filtrlar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex bg-gray-100 dark:bg-neutral-800 rounded-xl p-1 gap-1">
          {DAVRLAR.map(d => (
            <button
              key={d.kalit}
              onClick={() => setDavr(d.kalit)}
              className={`px-3.5 py-2.5 rounded-lg text-sm font-medium transition ${
                davr === d.kalit
                  ? 'bg-white dark:bg-neutral-700 shadow-sm text-gray-900 dark:text-gray-100'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        {data?.egaMi && (
          <select
            value={filial}
            onChange={e => setFilial(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="">Barcha filiallar</option>
            <option value="markaziy">Markaziy</option>
            {data.filialRoyxati.map(f => (
              <option key={f.id} value={f.id}>{f.nomi}</option>
            ))}
          </select>
        )}
      </div>

      {yuklanmoqda || !data ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-primary" /></div>
      ) : (
        <>
          {/* To'lov usuli bo'yicha — asosiy statistika */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {KANAL_USULLARI.map(usul => {
              const summa = data.jami[usul]
              const ulush = data.jami.jami > 0 ? Math.round((summa / data.jami.jami) * 100) : 0
              return (
                <div
                  key={usul}
                  className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${tolovBadge(usul)}`}>
                      {TOLOV_MALUMOTI[usul].qisqa}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 text-xs tabular-nums">{ulush}%</span>
                  </div>
                  <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 mt-2 font-mono tabular-nums truncate">
                    {formatSum(summa)}
                  </p>
                </div>
              )
            })}
          </div>

          {/* Yakun */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4">
              <p className="text-gray-500 dark:text-gray-400 text-xs font-mono uppercase tracking-wide flex items-center gap-1.5">
                <TrendingUp size={13} className="text-green-600" /> Jami kirim
              </p>
              <p className="text-2xl font-bold text-green-600 mt-1 font-mono tabular-nums">
                {formatSum(data.jami.jami)}
              </p>
              <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                Sotuvdan {formatSum(data.manbalar.sotuvdan.jami)} · Nasiyadan {formatSum(data.manbalar.nasiyadan.jami)}
              </p>
            </div>

            <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4">
              <p className="text-gray-500 dark:text-gray-400 text-xs font-mono uppercase tracking-wide flex items-center gap-1.5">
                <RotateCcw size={13} className="text-amber-600" /> Qaytarishlar
              </p>
              <p className="text-2xl font-bold text-amber-600 mt-1 font-mono tabular-nums">
                {data.qaytarish > 0 ? `-${formatSum(data.qaytarish)}` : formatSum(0)}
              </p>
              <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                Sof kirim: <span className="font-semibold text-gray-600 dark:text-gray-300">{formatSum(data.sofKirim)}</span>
              </p>
            </div>

            <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4">
              <p className="text-gray-500 dark:text-gray-400 text-xs font-mono uppercase tracking-wide flex items-center gap-1.5">
                <TrendingDown size={13} className="text-red-600" /> Ta&apos;minotchiga to&apos;langan
              </p>
              <p className="text-2xl font-bold text-red-600 mt-1 font-mono tabular-nums">
                {formatSum(data.chiqim.jami)}
              </p>
              <p className="text-gray-500 dark:text-gray-400 text-[11px] mt-1 flex items-start gap-1">
                <Info size={11} className="shrink-0 mt-0.5" />
                Ta&apos;minotchining filiali bo&apos;yicha hisoblanadi
              </p>
            </div>
          </div>

          {/* Filiallar kesimi */}
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-neutral-800 flex items-center gap-2">
              <Building size={15} className="text-primary" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Filiallar bo&apos;yicha to&apos;lovlar
              </span>
            </div>
            {data.filiallar.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400 text-center">
                Bu davrda to&apos;lov bo&apos;lmagan
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-neutral-800/60">
                    <tr>
                      <th className="text-left text-gray-500 dark:text-gray-400 text-xs font-medium px-4 py-2.5">Filial</th>
                      {KANAL_USULLARI.map(u => (
                        <th key={u} className="text-right text-gray-500 dark:text-gray-400 text-xs font-medium px-4 py-2.5 whitespace-nowrap">
                          {TOLOV_MALUMOTI[u].qisqa}
                        </th>
                      ))}
                      <th className="text-right text-gray-500 dark:text-gray-400 text-xs font-medium px-4 py-2.5">Jami kirim</th>
                      <th className="text-right text-gray-500 dark:text-gray-400 text-xs font-medium px-4 py-2.5 whitespace-nowrap">Chiqim</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                    {data.filiallar.map(f => (
                      <tr key={f.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800/40 transition">
                        <td className="px-4 py-2.5 text-gray-900 dark:text-gray-100 font-medium whitespace-nowrap">{f.nomi}</td>
                        {KANAL_USULLARI.map(u => (
                          <td key={u} className="px-4 py-2.5 text-right font-mono tabular-nums text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            {f[u] > 0 ? formatSum(f[u]) : '—'}
                          </td>
                        ))}
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                          {formatSum(f.jami)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-red-600 whitespace-nowrap">
                          {f.chiqim > 0 ? `-${formatSum(f.chiqim)}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 dark:bg-neutral-800/60 border-t-2 border-gray-200 dark:border-neutral-700">
                    <tr>
                      <td className="px-4 py-2.5 text-gray-900 dark:text-gray-100 font-semibold">Jami</td>
                      {KANAL_USULLARI.map(u => (
                        <td key={u} className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                          {formatSum(data.jami[u])}
                        </td>
                      ))}
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums font-bold text-green-600 whitespace-nowrap">
                        {formatSum(data.jami.jami)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums font-bold text-red-600 whitespace-nowrap">
                        {data.chiqim.jami > 0 ? `-${formatSum(data.chiqim.jami)}` : formatSum(0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Tranzaksiyalar */}
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">To&apos;lovlar ro&apos;yxati</span>
              <span className="text-gray-500 dark:text-gray-400 text-xs">{data.tranzaksiyalar.length} ta</span>
            </div>
            {data.tranzaksiyalar.length === 0 ? (
              <p className="px-4 py-8 text-sm text-gray-500 dark:text-gray-400 text-center">
                Bu davrda to&apos;lov yo&apos;q
              </p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-neutral-800 max-h-[520px] overflow-y-auto">
                {data.tranzaksiyalar.map(t => (
                  <div key={t.id} className="px-4 py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[11px] px-2 py-0.5 rounded-md ${TUR_RANG[t.turi]}`}>
                          {TUR_LABEL[t.turi]}
                        </span>
                        <span className="text-gray-900 dark:text-gray-100 text-sm font-medium truncate">{t.nomi}</span>
                      </div>
                      <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5 truncate">
                        {formatSanaVaVaqt(t.sana)}
                        {t.kim && ` · ${t.kim}`}
                        {t.xodim && ` · ${t.xodim}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-semibold text-sm font-mono tabular-nums ${
                        t.turi === 'xarid' || t.turi === 'xarajat' ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {t.turi === 'xarid' || t.turi === 'xarajat' ? '-' : '+'}{formatSum(t.jami)}
                      </p>
                      <p className="text-gray-500 dark:text-gray-400 text-[11px] truncate">
                        {t.kanallar.map(k => tolovQisqa(k.usul)).join(' + ')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
