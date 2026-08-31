'use client'

import { useEffect, useState } from 'react'
import { formatSum, formatSanaVaVaqt, formatPhone } from '@/lib/utils'
import { Receipt, Phone, User, Calendar, Search } from 'lucide-react'
import SearchBar from '@/components/ui/search-bar'

interface SotuvTarkibiItem { id: string; miqdor: number; birlikNarxi: number; jami: number; tovar: { nomi: string; birlik: string } }
interface Sotuv {
  id: string
  chekRaqami: string
  sana: string
  yakuniySumma: number
  tolovUsuli: string
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
  const [danFilter, setDanFilter] = useState('')
  const [gachaFilter, setGachaFilter] = useState('')
  const [renderLimit, setRenderLimit] = useState(30)

  async function yuklash() {
    setYuklanmoqda(true)
    const params = new URLSearchParams({ limit: '200' })
    if (qidiruv) params.set('q', qidiruv)
    if (danFilter) params.set('dan', danFilter)
    if (gachaFilter) params.set('gacha', gachaFilter)
    const data = await fetch(`/api/sotuvlar?${params}`).then(r => r.json())
    setSotuvlar(data.sotuvlar || [])
    setJami(data.jami || 0)
    setYuklanmoqda(false)
  }

  useEffect(() => { yuklash() }, [qidiruv, danFilter, gachaFilter])
  useEffect(() => { setRenderLimit(30) }, [qidiruv, danFilter, gachaFilter])

  const jamiSumma = sotuvlar.reduce((s, x) => s + Number(x.yakuniySumma), 0)
  const korsatiladigan = sotuvlar.slice(0, renderLimit)

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchBar value={qidiruv} onChange={setQidiruv} placeholder="Chek raqami yoki mijoz ismi bo'yicha qidirish..." className="flex-1" />
        <input
          type="date"
          value={danFilter}
          onChange={e => setDanFilter(e.target.value)}
          className="px-3 py-2.5 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
          placeholder="Dan"
        />
        <input
          type="date"
          value={gachaFilter}
          onChange={e => setGachaFilter(e.target.value)}
          className="px-3 py-2.5 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
          placeholder="Gacha"
        />
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
            <div key={s.id} className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden hover:shadow-lg hover:border-primary/30 dark:hover:border-primary/40 transition-all">
              <div className="p-4 border-b border-gray-100 dark:border-neutral-800">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-mono text-gray-500 dark:text-gray-400">
                    <Receipt size={13} />{s.chekRaqami}
                  </span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${TOLOV_RANG[s.tolovUsuli] || 'bg-gray-100 text-gray-600'}`}>
                    {TOLOV_LABEL[s.tolovUsuli] || s.tolovUsuli}
                  </span>
                </div>
                <p className="text-gray-400 dark:text-gray-600 text-xs mt-1.5 flex items-center gap-1">
                  <Calendar size={11} />{formatSanaVaVaqt(s.sana)}
                </p>
              </div>

              <div className="p-4 space-y-2">
                {s.mijoz && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300 font-medium truncate">
                      <User size={13} className="text-gray-400 shrink-0" />{s.mijoz.ism}
                    </span>
                    {s.mijoz.telefon && (
                      <a href={`tel:${s.mijoz.telefon}`} onClick={e => e.stopPropagation()} className="flex items-center gap-1 text-blue-500 hover:text-blue-600 text-xs shrink-0">
                        <Phone size={11} />{formatPhone(s.mijoz.telefon)}
                      </a>
                    )}
                  </div>
                )}

                <div className="bg-gray-50 dark:bg-neutral-800/60 rounded-xl p-3 space-y-1 max-h-32 overflow-y-auto">
                  {s.tarkiblar.map(t => (
                    <div key={t.id} className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                      <span className="truncate">{t.tovar.nomi} × {t.miqdor}</span>
                      <span className="shrink-0 ml-2 text-gray-500 dark:text-gray-500">{formatSum(t.jami)}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-gray-400 dark:text-gray-600 text-xs">Kassir: {s.kassir.ism}</span>
                  <span className="text-green-600 font-bold text-base">{formatSum(s.yakuniySumma)}</span>
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
    </div>
  )
}
