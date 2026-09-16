'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Loader2, Plus, Trash2, Wallet, Calendar, History, AlertTriangle,
} from 'lucide-react'
import { formatSum, formatSana, formatSanaVaVaqt } from '@/lib/utils'
import { QARZ_MALUMOTI, qarzMalumoti } from '@/lib/taminotchi-qarz'

// Do'konning O'Z qarzi — ta'minotchi bilan bog'liq bo'lmagan qarzlar:
// ijara, qarzga olingan pul, jismoniy shaxsdan olingan qarz.
//
// Mijoz nasiyasi (bizga qarzdor) bilan bir sahifada turadi, lekin
// yo'nalishi TESKARI — shuning uchun ranglar ham teskari: bu yerda
// qizil "biz qarzdormiz" degani.

interface Yozuv {
  id: string
  kimga: string
  turi: string
  summa: number
  tolovUsuli: string | null
  izoh: string | null
  muddat: string | null
  sana: string
  yaratgan: { ism: string } | null
}

interface Qarzdor {
  kimga: string
  qolda: number
  tolangan: number
  jami: number
  muddat: string | null
  yozuvlar: Yozuv[]
}

interface Malumot {
  qarzdorlar: Qarzdor[]
  jami: number
  boshqaraOladi: boolean
}

const inputCls =
  'w-full px-3 py-2.5 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500'

export default function DokonQarzPanel() {
  const [data, setData] = useState<Malumot | null>(null)
  const [yuklanmoqda, setYuklanmoqda] = useState(true)
  const [ochiq, setOchiq] = useState<string | null>(null)

  const [turi, setTuri] = useState<'QARZ' | 'TOLOV'>('QARZ')
  const [kimga, setKimga] = useState('')
  const [summa, setSumma] = useState('')
  const [usuli, setUsuli] = useState('NAQD')
  const [muddat, setMuddat] = useState('')
  const [izoh, setIzoh] = useState('')
  const [amalda, setAmalda] = useState(false)

  const yukla = useCallback(async () => {
    setYuklanmoqda(true)
    try {
      const r = await fetch('/api/dokon-qarz')
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.xato || "Ma'lumot yuklanmadi"); return }
      setData(j)
    } catch {
      toast.error('Tarmoq xatosi')
    } finally {
      setYuklanmoqda(false)
    }
  }, [])

  useEffect(() => { void yukla() }, [yukla])

  async function qosh(e: React.FormEvent) {
    e.preventDefault()
    const n = Number(summa)
    if (!kimga.trim()) { toast.error('Kimga qarzdorligingizni yozing'); return }
    if (!Number.isFinite(n) || n <= 0) { toast.error('Summani kiriting'); return }
    setAmalda(true)
    try {
      const r = await fetch('/api/dokon-qarz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kimga: kimga.trim(),
          turi,
          summa: n,
          tolovUsuli: turi === 'TOLOV' ? usuli : null,
          muddat: turi === 'QARZ' && muddat ? muddat : null,
          izoh: izoh.trim() || null,
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.xato || 'Qo‘shilmadi'); return }
      toast.success(turi === 'QARZ' ? 'Qarz yozildi' : 'To‘lov yozildi')
      setSumma(''); setIzoh(''); setMuddat('')
      void yukla()
    } catch {
      toast.error('Tarmoq xatosi')
    } finally {
      setAmalda(false)
    }
  }

  async function ochir(id: string) {
    setAmalda(true)
    try {
      const r = await fetch(`/api/dokon-qarz?yozuvId=${id}`, { method: 'DELETE' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.xato || 'O‘chirilmadi'); return }
      toast.success('Yozuv bekor qilindi')
      void yukla()
    } finally {
      setAmalda(false)
    }
  }

  if (yuklanmoqda && !data) {
    return <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-primary" /></div>
  }
  if (!data) return null

  const bugun = new Date()
  bugun.setHours(0, 0, 0, 0)

  return (
    <div className="space-y-4">
      {/* Umumiy qarz */}
      <div className={`rounded-2xl p-5 border-2 ${
        data.jami > 0
          ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50'
          : 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/50'
      }`}>
        <p className={`text-sm font-medium ${data.jami > 0 ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
          Do&apos;konning umumiy qarzi
        </p>
        <p className={`text-2xl sm:text-3xl font-bold mt-1 font-mono tabular-nums ${
          data.jami > 0 ? 'text-red-600' : 'text-green-600'
        }`}>
          {formatSum(Math.abs(data.jami))}
        </p>
        <p className="text-gray-600 dark:text-gray-400 text-xs mt-1">
          {data.jami > 0
            ? `${data.qarzdorlar.filter(q => q.jami > 0).length} ta qarzdorlik`
            : 'Qarz yo‘q'}
        </p>
      </div>

      {/* Yangi yozuv */}
      {data.boshqaraOladi && (
        <form onSubmit={qosh} className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 space-y-3">
          <div className="flex bg-gray-100 dark:bg-neutral-800 rounded-xl p-1 gap-1">
            {(['QARZ', 'TOLOV'] as const).map(k => (
              <button
                key={k}
                type="button"
                onClick={() => setTuri(k)}
                className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  turi === k
                    ? 'bg-white dark:bg-neutral-700 shadow-sm text-gray-900 dark:text-gray-100'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {k === 'QARZ' ? 'Qarz oldim' : 'To‘lov qildim'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              value={kimga}
              onChange={e => setKimga(e.target.value)}
              placeholder="Kimdan? (ism yoki tashkilot)"
              maxLength={200}
              className={inputCls}
            />
            <input
              value={summa}
              onChange={e => setSumma(e.target.value)}
              inputMode="numeric"
              placeholder="Summa"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {turi === 'TOLOV' ? (
              <select value={usuli} onChange={e => setUsuli(e.target.value)} aria-label="To'lov usuli" className={inputCls}>
                <option value="NAQD">Naqd</option>
                <option value="KARTA">Karta</option>
                <option value="CLICK">Click</option>
                <option value="BANK">Bank o&apos;tkazmasi</option>
              </select>
            ) : (
              <input
                type="date"
                value={muddat}
                onChange={e => setMuddat(e.target.value)}
                aria-label="Qaytarish muddati"
                className={inputCls}
              />
            )}
            <input
              value={izoh}
              onChange={e => setIzoh(e.target.value)}
              placeholder="Izoh (ixtiyoriy)"
              maxLength={500}
              className={inputCls}
            />
          </div>

          <button
            type="submit"
            disabled={amalda || !kimga.trim() || !summa}
            className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {amalda ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            {QARZ_MALUMOTI[turi].label} yozish
          </button>
        </form>
      )}

      {/* Qarzdorlar */}
      {data.qarzdorlar.length === 0 ? (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl py-12 text-center">
          <Wallet size={28} className="text-gray-300 dark:text-neutral-700 mx-auto" />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Hali qarz yozilmagan</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.qarzdorlar.map(q => {
            // Muddati o'tgan qarz alohida belgilanadi
            const kechikkan = q.jami > 0 && q.muddat && new Date(q.muddat) < bugun
            return (
              <div
                key={q.kimga}
                className={`bg-white dark:bg-neutral-900 border rounded-2xl overflow-hidden ${
                  kechikkan ? 'border-red-300 dark:border-red-900' : 'border-gray-200 dark:border-neutral-800'
                }`}
              >
                <button
                  onClick={() => setOchiq(o => o === q.kimga ? null : q.kimga)}
                  className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-50 dark:hover:bg-neutral-800/40 transition text-left"
                >
                  <div className="min-w-0">
                    <p className="text-gray-900 dark:text-gray-100 font-medium truncate">{q.kimga}</p>
                    <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span>{q.yozuvlar.length} ta yozuv</span>
                      {q.tolangan > 0 && <span>· to&apos;langan {formatSum(q.tolangan)}</span>}
                      {q.muddat && (
                        <span className={`flex items-center gap-1 ${kechikkan ? 'text-red-600 font-medium' : ''}`}>
                          <Calendar size={10} />
                          {formatSana(q.muddat)}
                          {kechikkan && ' — muddati o‘tgan'}
                        </span>
                      )}
                    </p>
                  </div>
                  <span className={`font-mono tabular-nums font-bold shrink-0 ${
                    q.jami > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {formatSum(Math.abs(q.jami))}
                  </span>
                </button>

                {ochiq === q.kimga && (
                  <div className="border-t border-gray-100 dark:border-neutral-800 divide-y divide-gray-100 dark:divide-neutral-800">
                    <p className="px-4 py-2 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                      <History size={11} /> Yozuvlar
                    </p>
                    {q.yozuvlar.map(y => {
                      const m = qarzMalumoti(y.turi)
                      return (
                        <div key={y.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${m.badge}`}>
                                {m.label}
                              </span>
                              {y.tolovUsuli && (
                                <span className="text-gray-500 dark:text-gray-400 text-[11px]">{y.tolovUsuli}</span>
                              )}
                            </div>
                            <p className="text-gray-500 dark:text-gray-400 text-[11px] mt-0.5 truncate">
                              {formatSanaVaVaqt(y.sana)}
                              {y.yaratgan && ` · ${y.yaratgan.ism}`}
                              {y.izoh && ` · ${y.izoh}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className={`font-mono tabular-nums text-sm font-semibold ${
                              m.ishora > 0 ? 'text-red-600' : 'text-green-600'
                            }`}>
                              {m.ishora > 0 ? '+' : '−'}{formatSum(y.summa)}
                            </span>
                            {data.boshqaraOladi && (
                              <button
                                onClick={() => void ochir(y.id)}
                                disabled={amalda}
                                title="Yozuvni bekor qilish"
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition disabled:opacity-50"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!data.boshqaraOladi && (
        <p className="text-gray-500 dark:text-gray-400 text-xs flex items-center gap-1.5">
          <AlertTriangle size={12} /> Qarz yozish faqat adminga ochiq
        </p>
      )}
    </div>
  )
}
