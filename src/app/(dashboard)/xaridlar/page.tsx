'use client'

import { useEffect, useState } from 'react'
import { formatSum, formatSanaVaVaqt, formatPhone } from '@/lib/utils'
import { Receipt, Phone, User, Calendar, Search, Download, X, Wallet, CreditCard } from 'lucide-react'
import SearchBar from '@/components/ui/search-bar'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'

interface SotuvTarkibiItem { id: string; miqdor: number; birlikNarxi: number; jami: number; tovar: { nomi: string; birlik: string } }
interface Sotuv {
  id: string
  chekRaqami: string
  sana: string
  jamiSumma: number
  chegirma: number
  yakuniySumma: number
  tolovUsuli: string
  naqdTolangan: number
  kartaTolangan: number
  mijoz: { ism: string; telefon: string | null } | null
  kassir: { ism: string }
  tarkiblar: SotuvTarkibiItem[]
}

const TOLOV_LABEL: Record<string, string> = {
  NAQD: 'Naqd', KARTA: 'Karta', ARALASH: 'Aralash', NASIYA: 'Nasiya', SHERIK: 'Sherik',
}
const TOLOV_RANG: Record<string, string> = {
  NAQD: 'bg-green-50 dark:bg-green-950/30 text-green-600',
  KARTA: 'bg-blue-50 dark:bg-blue-950/30 text-blue-600',
  ARALASH: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600',
  NASIYA: 'bg-red-50 dark:bg-red-950/30 text-red-600',
  SHERIK: 'bg-purple-50 dark:bg-purple-950/30 text-purple-600',
}

export default function XaridlarPage() {
  const [sotuvlar, setSotuvlar] = useState<Sotuv[]>([])
  const [jami, setJami] = useState(0)
  const [yuklanmoqda, setYuklanmoqda] = useState(true)
  const [qidiruv, setQidiruv] = useState('')
  // Bitta sana bo'yicha qidirish — shu kunning boshidan oxirigacha
  // (serverda "dan" va "gacha" bir xil sanaga o'rnatiladi).
  const [sanaFilter, setSanaFilter] = useState('')
  const [renderLimit, setRenderLimit] = useState(30)
  const [tafsilot, setTafsilot] = useState<Sotuv | null>(null)
  useBodyScrollLock(!!tafsilot)

  async function yuklash() {
    setYuklanmoqda(true)
    const params = new URLSearchParams({ limit: '200' })
    if (qidiruv) params.set('q', qidiruv)
    if (sanaFilter) { params.set('dan', sanaFilter); params.set('gacha', sanaFilter) }
    const data = await fetch(`/api/sotuvlar?${params}`).then(r => r.json())
    setSotuvlar(data.sotuvlar || [])
    setJami(data.jami || 0)
    setYuklanmoqda(false)
  }

  useEffect(() => { yuklash() }, [qidiruv, sanaFilter])
  useEffect(() => { setRenderLimit(30) }, [qidiruv, sanaFilter])

  const jamiSumma = sotuvlar.reduce((s, x) => s + Number(x.yakuniySumma), 0)
  const korsatiladigan = sotuvlar.slice(0, renderLimit)

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
        <SearchBar value={qidiruv} onChange={setQidiruv} placeholder="Chek raqami yoki mijoz ismi bo'yicha qidirish..." className="flex-1" />
        <div className="flex gap-2">
          <input
            type="date"
            value={sanaFilter}
            onChange={e => setSanaFilter(e.target.value)}
            title="Sana bo'yicha qidirish"
            className="flex-1 sm:flex-none px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
          />
          <a
            href={`/api/sotuvlar/export${sanaFilter ? `?dan=${sanaFilter}&gacha=${sanaFilter}` : ''}`}
            title="Excel export"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-medium transition whitespace-nowrap border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 text-xs sm:text-sm shrink-0"
          >
            <Download size={14} />
            Export
          </a>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4">
          <p className="text-gray-400 dark:text-gray-600 text-xs">Jami xaridlar</p>
          <p className="text-gray-900 dark:text-gray-100 font-bold text-xl mt-1">{jami} ta</p>
        </div>
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4">
          <p className="text-gray-400 dark:text-gray-600 text-xs">Jami summa</p>
          <p className="text-green-600 font-bold text-xl mt-1">{formatSum(jamiSumma)}</p>
        </div>
      </div>

      {/* Cards */}
      {yuklanmoqda ? (
        <p className="text-gray-400 dark:text-gray-600 text-center py-12">Yuklanmoqda...</p>
      ) : korsatiladigan.length === 0 ? (
        <div className="text-center py-16">
          <Search size={36} className="mx-auto mb-3 text-gray-300 dark:text-gray-700" />
          <p className="text-gray-400 dark:text-gray-600">Xaridlar topilmadi</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {korsatiladigan.map(s => (
            <div
              key={s.id}
              onClick={() => setTafsilot(s)}
              className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden hover:shadow-lg hover:border-primary/30 dark:hover:border-primary/40 transition-all cursor-pointer">
              <div className="p-4 border-b border-gray-100 dark:border-neutral-800">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm font-mono text-gray-600 dark:text-gray-300">
                    <Receipt size={15} />{s.chekRaqami}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TOLOV_RANG[s.tolovUsuli] || 'bg-gray-100 text-gray-600'}`}>
                    {TOLOV_LABEL[s.tolovUsuli] || s.tolovUsuli}
                  </span>
                </div>
                <p className="text-gray-500 dark:text-gray-500 text-sm mt-1.5 flex items-center gap-1">
                  <Calendar size={13} />{formatSanaVaVaqt(s.sana)}
                </p>
              </div>

              <div className="p-4 space-y-2.5">
                {s.mijoz && (
                  <div className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-1.5 text-gray-800 dark:text-gray-200 font-medium truncate">
                      <User size={15} className="text-gray-400 shrink-0" />{s.mijoz.ism}
                    </span>
                    {s.mijoz.telefon && (
                      <a href={`tel:${s.mijoz.telefon}`} onClick={e => e.stopPropagation()} className="flex items-center gap-1 text-blue-500 hover:text-blue-600 text-sm shrink-0">
                        <Phone size={13} />{formatPhone(s.mijoz.telefon)}
                      </a>
                    )}
                  </div>
                )}

                <div className="bg-gray-50 dark:bg-neutral-800/60 rounded-xl p-3 space-y-1.5 max-h-32 overflow-y-auto">
                  {s.tarkiblar.map(t => (
                    <div key={t.id} className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-300">
                      <span className="truncate">{t.tovar.nomi} × {t.miqdor}</span>
                      <span className="shrink-0 ml-2 text-gray-600 dark:text-gray-400">{formatSum(t.jami)}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-gray-500 dark:text-gray-500 text-sm">Kassir: {s.kassir.ism}</span>
                  <span className="text-green-600 font-bold text-lg">{formatSum(s.yakuniySumma)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {sotuvlar.length > renderLimit && (
        <button onClick={() => setRenderLimit(r => r + 30)} className="w-full py-2.5 text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-white dark:hover:bg-neutral-900 transition border border-gray-200 dark:border-neutral-800 rounded-xl">
          Yana ko&apos;rsatish ({sotuvlar.length - renderLimit} ta qoldi)
        </button>
      )}

      {/* Batafsil ma'lumot modali */}
      {tafsilot && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4 pb-24 sm:pb-4" onClick={() => setTafsilot(null)}>
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl dark:border dark:border-neutral-800 w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-200 dark:border-neutral-800 flex items-start justify-between gap-3 shrink-0">
              <div>
                <h3 className="text-gray-900 dark:text-gray-100 font-semibold flex items-center gap-2">
                  <Receipt size={18} className="text-primary" />
                  {tafsilot.chekRaqami}
                </h3>
                <p className="text-gray-400 dark:text-gray-600 text-xs mt-1 flex items-center gap-1">
                  <Calendar size={11} />{formatSanaVaVaqt(tafsilot.sana)}
                </p>
              </div>
              <button onClick={() => setTafsilot(null)} className="p-1.5 text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition shrink-0">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="flex flex-wrap gap-2 text-sm">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg font-medium ${TOLOV_RANG[tafsilot.tolovUsuli] || 'bg-gray-100 text-gray-600'}`}>
                  {TOLOV_LABEL[tafsilot.tolovUsuli] || tafsilot.tolovUsuli}
                </span>
                {tafsilot.mijoz && (
                  <span className="inline-flex items-center gap-1.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-neutral-800 px-2.5 py-1 rounded-lg font-medium">
                    <User size={12} />{tafsilot.mijoz.ism}
                  </span>
                )}
                {tafsilot.mijoz?.telefon && (
                  <a href={`tel:${tafsilot.mijoz.telefon}`} className="inline-flex items-center gap-1.5 text-blue-500 hover:text-blue-600 bg-blue-50 dark:bg-blue-950/30 px-2.5 py-1 rounded-lg font-medium">
                    <Phone size={12} />{formatPhone(tafsilot.mijoz.telefon)}
                  </a>
                )}
                <span className="inline-flex items-center gap-1.5 text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-neutral-800 px-2.5 py-1 rounded-lg">
                  Kassir: {tafsilot.kassir.ism}
                </span>
              </div>

              {/* To'lov usuli aralash bo'lsa — naqd/karta bo'linmasi */}
              {tafsilot.tolovUsuli === 'ARALASH' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 dark:bg-neutral-800/60 rounded-xl p-3 flex items-center gap-2">
                    <Wallet size={16} className="text-green-600 shrink-0" />
                    <div>
                      <p className="text-gray-400 dark:text-gray-600 text-[11px]">Naqd</p>
                      <p className="text-gray-900 dark:text-gray-100 font-semibold text-sm">{formatSum(tafsilot.naqdTolangan)}</p>
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-neutral-800/60 rounded-xl p-3 flex items-center gap-2">
                    <CreditCard size={16} className="text-blue-600 shrink-0" />
                    <div>
                      <p className="text-gray-400 dark:text-gray-600 text-[11px]">Karta</p>
                      <p className="text-gray-900 dark:text-gray-100 font-semibold text-sm">{formatSum(tafsilot.kartaTolangan)}</p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <p className="text-gray-700 dark:text-gray-300 text-sm font-semibold mb-2">
                  Tarkibi ({tafsilot.tarkiblar.length} ta)
                </p>
                <div className="border border-gray-200 dark:border-neutral-700 rounded-xl divide-y divide-gray-100 dark:divide-neutral-800">
                  {tafsilot.tarkiblar.map(t => (
                    <div key={t.id} className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="text-gray-900 dark:text-gray-100 truncate">{t.tovar.nomi}</p>
                        <p className="text-gray-400 dark:text-gray-600 text-xs">{t.miqdor} {t.tovar.birlik.toLowerCase()} × {formatSum(t.birlikNarxi)}</p>
                      </div>
                      <span className="text-gray-700 dark:text-gray-300 font-medium shrink-0">{formatSum(t.jami)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-neutral-800 pt-3 space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400 dark:text-gray-600">Summa</span>
                  <span className="text-gray-700 dark:text-gray-300">{formatSum(tafsilot.jamiSumma)}</span>
                </div>
                {tafsilot.chegirma > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400 dark:text-gray-600">Chegirma</span>
                    <span className="text-red-500">-{formatSum(tafsilot.chegirma)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-gray-700 dark:text-gray-300 font-semibold">Yakuniy summa</span>
                  <span className="text-green-600 font-bold text-lg">{formatSum(tafsilot.yakuniySumma)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
