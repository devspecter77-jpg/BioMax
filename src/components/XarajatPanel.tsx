'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, Receipt, User, Tag } from 'lucide-react'
import { formatSum, formatSanaVaVaqt } from '@/lib/utils'
import {
  XARAJAT_KATEGORIYALARI, XARAJAT_MALUMOTI, xarajatMalumoti,
  type XarajatKategoriya,
} from '@/lib/xarajat-turlari'

// Do'kon xarajatlari. Foydaga to'g'ridan-to'g'ri ta'sir qiladi:
// hisobotlarda sof foyda = daromad − xarajat.
//
// Har bir xarajat "kim uchun" qilingani bilan yoziladi: xodim tanlanadi
// yoki erkin matn yoziladi ("Damas mashina", "Soliq inspeksiyasi").

interface Xarajat {
  id: string
  kategoriya: string
  summa: number
  izoh: string | null
  kimUchun: string | null
  tolovUsuli: string | null
  sana: string
  xodim: { id: string; ism: string } | null
  foydalanuvchi: { ism: string } | null
}

interface Malumot {
  xarajatlar: Xarajat[]
  jami: number
  kategoriyaBoyicha: Record<string, number>
  boshqaraOladi: boolean
}

const inputCls =
  'w-full px-3 py-2.5 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500'

export default function XarajatPanel() {
  const [data, setData] = useState<Malumot | null>(null)
  const [xodimlar, setXodimlar] = useState<{ id: string; ism: string }[]>([])
  const [yuklanmoqda, setYuklanmoqda] = useState(true)

  const [kategoriya, setKategoriya] = useState<XarajatKategoriya>('BOSHQA')
  const [summa, setSumma] = useState('')
  const [usuli, setUsuli] = useState('NAQD')
  const [xodimId, setXodimId] = useState('')
  const [kimUchun, setKimUchun] = useState('')
  const [izoh, setIzoh] = useState('')
  const [amalda, setAmalda] = useState(false)

  const yukla = useCallback(async () => {
    setYuklanmoqda(true)
    try {
      const r = await fetch('/api/xarajatlar')
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

  // Xodimlar ro'yxati — "kim uchun" tanlash uchun.
  // Ruxsat bo'lmasa ro'yxat bo'sh qoladi va faqat erkin matn ishlatiladi.
  useEffect(() => {
    fetch('/api/xodimlar')
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j?.xodimlar) setXodimlar(j.xodimlar.map((x: { id: string; ism: string }) => ({ id: x.id, ism: x.ism }))) })
      .catch(() => {})
  }, [])

  const xodimgaBoglanadi = XARAJAT_MALUMOTI[kategoriya].xodimgaBoglanadi

  async function qosh(e: React.FormEvent) {
    e.preventDefault()
    const n = Number(summa)
    if (!Number.isFinite(n) || n <= 0) { toast.error('Summani kiriting'); return }
    setAmalda(true)
    try {
      const r = await fetch('/api/xarajatlar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kategoriya, summa: n, tolovUsuli: usuli,
          xodimId: xodimgaBoglanadi && xodimId ? xodimId : undefined,
          kimUchun: kimUchun.trim() || null,
          izoh: izoh.trim() || null,
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.xato || 'Qo‘shilmadi'); return }
      toast.success('Xarajat yozildi')
      setSumma(''); setIzoh(''); setKimUchun(''); setXodimId('')
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
      const r = await fetch(`/api/xarajatlar?id=${id}`, { method: 'DELETE' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.xato || 'O‘chirilmadi'); return }
      toast.success('Xarajat o‘chirildi')
      void yukla()
    } finally {
      setAmalda(false)
    }
  }

  if (yuklanmoqda && !data) {
    return <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-primary" /></div>
  }
  if (!data) return null

  // Eng ko'p ketgan uchta kategoriya
  const engKop = Object.entries(data.kategoriyaBoyicha)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  return (
    <div className="space-y-4">
      {/* Umumiy xarajat */}
      <div className="rounded-2xl p-5 border-2 bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/50">
        <p className="text-sm font-medium text-orange-700 dark:text-orange-400">
          Do&apos;konning umumiy xarajati
        </p>
        <p className="text-2xl sm:text-3xl font-bold mt-1 font-mono tabular-nums text-orange-600">
          {formatSum(data.jami)}
        </p>
        {engKop.length > 0 && (
          <p className="text-gray-600 dark:text-gray-400 text-xs mt-1.5">
            {engKop.map(([k, v]) => `${xarajatMalumoti(k).label} ${formatSum(v)}`).join(' · ')}
          </p>
        )}
        <p className="text-gray-500 dark:text-gray-400 text-[11px] mt-1">
          Bu summa hisobotlarda sof foydadan ayriladi
        </p>
      </div>

      {/* Yangi xarajat */}
      {data.boshqaraOladi && (
        <form onSubmit={qosh} className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Yangi xarajat
          </p>

          {/* Kategoriya */}
          <div className="flex flex-wrap gap-1.5">
            {XARAJAT_KATEGORIYALARI.map(k => (
              <button
                key={k}
                type="button"
                onClick={() => setKategoriya(k)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition ${
                  kategoriya === k
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700'
                }`}
              >
                {XARAJAT_MALUMOTI[k].label}
              </button>
            ))}
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-[11px]">
            {XARAJAT_MALUMOTI[kategoriya].izoh}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              value={summa}
              onChange={e => setSumma(e.target.value)}
              inputMode="numeric"
              placeholder="Summa"
              className={inputCls}
            />
            <select value={usuli} onChange={e => setUsuli(e.target.value)} aria-label="To'lov usuli" className={inputCls}>
              <option value="NAQD">Naqd</option>
              <option value="KARTA">Karta</option>
              <option value="CLICK">Click</option>
              <option value="BANK">Bank o&apos;tkazmasi</option>
            </select>
          </div>

          {/* Kim uchun — xodim yoki erkin matn */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {xodimgaBoglanadi && xodimlar.length > 0 ? (
              <select
                value={xodimId}
                onChange={e => setXodimId(e.target.value)}
                aria-label="Qaysi xodim uchun"
                className={inputCls}
              >
                <option value="">— Xodim tanlanmagan —</option>
                {xodimlar.map(x => <option key={x.id} value={x.id}>{x.ism}</option>)}
              </select>
            ) : (
              <div className="hidden sm:block" />
            )}
            <input
              value={kimUchun}
              onChange={e => setKimUchun(e.target.value)}
              maxLength={200}
              placeholder="Nima uchun? (masalan: Damas mashina)"
              className={inputCls}
            />
          </div>

          <input
            value={izoh}
            onChange={e => setIzoh(e.target.value)}
            maxLength={500}
            placeholder="Izoh (ixtiyoriy)"
            className={inputCls}
          />

          <button
            type="submit"
            disabled={amalda || !summa}
            className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {amalda ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            Xarajat yozish
          </button>
        </form>
      )}

      {/* Ro'yxat */}
      {data.xarajatlar.length === 0 ? (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl py-12 text-center">
          <Receipt size={28} className="text-gray-300 dark:text-neutral-700 mx-auto" />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Hali xarajat yozilmagan</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl divide-y divide-gray-100 dark:divide-neutral-800 overflow-hidden">
          {data.xarajatlar.map(x => {
            const m = xarajatMalumoti(x.kategoriya)
            // Kim uchun: xodim tanlangan bo'lsa uning ismi, aks holda erkin matn
            const uchun = x.xodim?.ism ?? x.kimUchun
            return (
              <div key={x.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${m.badge}`}>
                      {m.label}
                    </span>
                    {uchun && (
                      <span className="text-gray-700 dark:text-gray-300 text-sm font-medium flex items-center gap-1 truncate">
                        {x.xodim ? <User size={11} /> : <Tag size={11} />}
                        {uchun}
                      </span>
                    )}
                    {x.tolovUsuli && (
                      <span className="text-gray-500 dark:text-gray-400 text-[11px]">{x.tolovUsuli}</span>
                    )}
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 text-[11px] mt-0.5 truncate">
                    {formatSanaVaVaqt(x.sana)}
                    {x.foydalanuvchi && ` · ${x.foydalanuvchi.ism}`}
                    {x.izoh && ` · ${x.izoh}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="font-mono tabular-nums text-sm font-semibold text-orange-600">
                    −{formatSum(x.summa)}
                  </span>
                  {data.boshqaraOladi && (
                    <button
                      onClick={() => void ochir(x.id)}
                      disabled={amalda}
                      title="Xarajatni o'chirish"
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
}
