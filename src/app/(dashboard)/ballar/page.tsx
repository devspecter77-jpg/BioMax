'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import {
  Gift, Settings, Users, History, Loader2, Plus, Minus, X, Save, Percent,
} from 'lucide-react'
import { formatSum, formatSanaVaVaqt, formatPhone } from '@/lib/utils'
import { toliqManzil } from '@/lib/hudud'
import {
  SODIQLIK_STANDART, formatBall, ballSarflanadimi, hisoblaBall, hisoblaKeshbek,
  type SodiqlikSozlama,
} from '@/lib/sodiqlik'
import MoneyInput from '@/components/ui/money-input'
import SearchBar from '@/components/ui/search-bar'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'

interface BalansMijoz {
  id: string
  ism: string
  telefon: string | null
  telefon2: string | null
  viloyat: string | null
  tuman: string | null
  maxsus_kod: string | null
  ballBalans: string | number
  keshbekBalans: string | number
  _count: { sotuvlar: number }
}

interface Harakat {
  id: string
  hisob: 'BALL' | 'KESHBEK'
  miqdor: string | number
  balansKeyin: string | number
  sabab: 'SOTUVDAN' | 'SARFLANDI' | 'QAYTARISHDAN' | 'QOLDA'
  izoh: string | null
  sana: string
  mijoz: { id: string; ism: string; telefon: string | null }
  sotuv: { chekRaqami: string; yakuniySumma: string | number } | null
  foydalanuvchi: { ism: string } | null
}

const SABAB_LABEL: Record<Harakat['sabab'], string> = {
  SOTUVDAN: 'Xariddan',
  SARFLANDI: 'Sarflandi',
  QAYTARISHDAN: 'Qaytarishdan',
  QOLDA: "Qo'lda",
}
const SABAB_RANG: Record<Harakat['sabab'], string> = {
  SOTUVDAN: 'bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400',
  SARFLANDI: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400',
  QAYTARISHDAN: 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400',
  QOLDA: 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400',
}

const inputCls = 'w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 transition text-sm'

type Tab = 'mijozlar' | 'harakatlar' | 'sozlamalar'

export default function BallarPage() {
  const { data: session } = useSession()
  const admin = (session?.user as { rol?: string } | undefined)?.rol === 'ADMIN'

  const [tab, setTab] = useState<Tab>('mijozlar')
  const [sozlama, setSozlama] = useState<SodiqlikSozlama>(SODIQLIK_STANDART)
  const [sozlamaYuklandi, setSozlamaYuklandi] = useState(false)

  useEffect(() => {
    fetch('/api/sodiqlik/sozlamalar')
      .then(r => r.json())
      .then(d => { if (d && !d.xato) setSozlama(d) })
      .catch(() => {})
      .finally(() => setSozlamaYuklandi(true))
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Gift size={22} className="text-primary" />
            Ballar va keshbeklar
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
            Mijozlar xaridiga qarab ball va keshbek to&apos;playdi, kassada chegirma sifatida sarflaydi
          </p>
        </div>
        {sozlamaYuklandi && (
          <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${
            sozlama.faol
              ? 'bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400'
              : 'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-gray-400'
          }`}>
            {sozlama.faol ? 'Dastur yoqilgan' : "Dastur o'chirilgan"}
          </span>
        )}
      </div>

      {/* Dastur o'chiq bo'lsa — nima qilish kerakligi darhol aytiladi */}
      {sozlamaYuklandi && !sozlama.faol && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/10 p-3 text-sm text-amber-800 dark:text-amber-400">
          Dastur hozircha o&apos;chirilgan — sotuvda ball va keshbek to&apos;planmaydi.
          {admin
            ? ' Yoqish uchun "Sozlamalar" bo\'limiga o\'ting.'
            : ' Yoqishni administrator bajaradi.'}
        </div>
      )}

      <div className="flex gap-1 border-b border-gray-200 dark:border-neutral-800 overflow-x-auto">
        {([
          ['mijozlar', 'Mijozlar', Users],
          ['harakatlar', 'Harakatlar', History],
          ...(admin ? [['sozlamalar', 'Sozlamalar', Settings] as const] : []),
        ] as [Tab, string, typeof Users][]).map(([kalit, label, Icon]) => (
          <button
            key={kalit}
            onClick={() => setTab(kalit)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition ${
              tab === kalit
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Icon size={15} />{label}
          </button>
        ))}
      </div>

      {tab === 'mijozlar' && <MijozlarTab sozlama={sozlama} admin={admin} />}
      {tab === 'harakatlar' && <HarakatlarTab />}
      {tab === 'sozlamalar' && admin && (
        <SozlamalarTab sozlama={sozlama} onSaqlandi={setSozlama} />
      )}
    </div>
  )
}

// ─── Mijozlar balansi ────────────────────────────────────────────────────────

function MijozlarTab({ sozlama, admin }: { sozlama: SodiqlikSozlama; admin: boolean }) {
  const [mijozlar, setMijozlar] = useState<BalansMijoz[]>([])
  const [yigindi, setYigindi] = useState({ ball: 0, keshbek: 0 })
  const [yuklanmoqda, setYuklanmoqda] = useState(true)
  const [qidiruv, setQidiruv] = useState('')
  const [barchasi, setBarchasi] = useState(false)
  const [tuzatish, setTuzatish] = useState<BalansMijoz | null>(null)

  const yukla = useCallback(async () => {
    setYuklanmoqda(true)
    try {
      const qs = new URLSearchParams()
      if (qidiruv) qs.set('q', qidiruv)
      if (barchasi) qs.set('barchasi', 'true')
      const d = await fetch(`/api/sodiqlik/mijozlar?${qs}`).then(r => r.json())
      setMijozlar(d.mijozlar || [])
      setYigindi(d.yigindi || { ball: 0, keshbek: 0 })
    } catch {
      toast.error("Ma'lumot yuklanmadi")
    } finally {
      setYuklanmoqda(false)
    }
  }, [qidiruv, barchasi])

  useEffect(() => { yukla() }, [yukla])

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4">
          <p className="text-gray-500 dark:text-gray-400 text-xs font-mono uppercase tracking-wide">Jami ball</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1 font-mono tabular-nums">
            {formatBall(yigindi.ball)}
          </p>
          {ballSarflanadimi(sozlama) && (
            <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
              ≈ {formatSum(yigindi.ball * sozlama.ballSomQiymati)}
            </p>
          )}
        </div>
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4">
          <p className="text-gray-500 dark:text-gray-400 text-xs font-mono uppercase tracking-wide">Jami keshbek</p>
          <p className="text-2xl font-bold text-primary mt-1 font-mono tabular-nums">
            {formatSum(yigindi.keshbek)}
          </p>
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">mijozlar oldidagi majburiyat</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <SearchBar value={qidiruv} onChange={setQidiruv} placeholder="Ism, telefon yoki kod..." />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={barchasi}
            onChange={e => setBarchasi(e.target.checked)}
            className="rounded border-gray-300 dark:border-neutral-700"
          />
          Balanssizlar ham
        </label>
      </div>

      {yuklanmoqda ? (
        <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin text-primary" /></div>
      ) : mijozlar.length === 0 ? (
        <p className="text-center text-gray-500 dark:text-gray-400 py-12 text-sm">
          {qidiruv ? 'Hech narsa topilmadi' : "Hali hech kimda ball yoki keshbek yo'q"}
        </p>
      ) : (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-neutral-800/60">
                <tr>
                  <th className="text-left text-gray-500 dark:text-gray-400 text-xs font-medium px-4 py-3">Mijoz</th>
                  <th className="text-left text-gray-500 dark:text-gray-400 text-xs font-medium px-4 py-3 hidden md:table-cell">Hudud</th>
                  <th className="text-right text-gray-500 dark:text-gray-400 text-xs font-medium px-4 py-3">Ball</th>
                  <th className="text-right text-gray-500 dark:text-gray-400 text-xs font-medium px-4 py-3">Keshbek</th>
                  <th className="text-right text-gray-500 dark:text-gray-400 text-xs font-medium px-4 py-3 hidden sm:table-cell">Xarid</th>
                  {admin && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                {mijozlar.map(m => (
                  <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800/40 transition">
                    <td className="px-4 py-3">
                      <p className="text-gray-900 dark:text-gray-100 font-medium">{m.ism}</p>
                      {m.telefon && (
                        <p className="text-gray-500 dark:text-gray-400 text-xs">{formatPhone(m.telefon)}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs hidden md:table-cell">
                      {toliqManzil(m) || '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-gray-900 dark:text-gray-100">
                      {formatBall(m.ballBalans)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-primary font-semibold">
                      {formatSum(m.keshbekBalans)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                      {m._count.sotuvlar} ta
                    </td>
                    {admin && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setTuzatish(m)}
                          className="text-xs text-primary hover:underline whitespace-nowrap"
                        >
                          Tuzatish
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tuzatish && (
        <TuzatishModal
          mijoz={tuzatish}
          onYopish={() => setTuzatish(null)}
          onSaqlandi={() => { setTuzatish(null); yukla() }}
        />
      )}
    </div>
  )
}

// ─── Qo'lda tuzatish ─────────────────────────────────────────────────────────

function TuzatishModal({
  mijoz, onYopish, onSaqlandi,
}: { mijoz: BalansMijoz; onYopish: () => void; onSaqlandi: () => void }) {
  useBodyScrollLock(true)
  const [hisob, setHisob] = useState<'BALL' | 'KESHBEK'>('KESHBEK')
  const [yonalish, setYonalish] = useState<'qoshish' | 'ayirish'>('qoshish')
  const [miqdor, setMiqdor] = useState('')
  const [izoh, setIzoh] = useState('')
  const [saqlanmoqda, setSaqlanmoqda] = useState(false)

  const joriy = hisob === 'BALL' ? Number(mijoz.ballBalans) : Number(mijoz.keshbekBalans)

  async function saqla(e: React.FormEvent) {
    e.preventDefault()
    const son = parseFloat(miqdor.replace(/\s/g, ''))
    if (!Number.isFinite(son) || son <= 0) { toast.error('Miqdorni kiriting'); return }

    setSaqlanmoqda(true)
    try {
      const res = await fetch('/api/sodiqlik/qolda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mijozId: mijoz.id,
          hisob,
          miqdor: yonalish === 'ayirish' ? -son : son,
          izoh,
        }),
      })
      const d = await res.json()
      if (!res.ok) { toast.error(d.xato || 'Saqlanmadi'); return }
      toast.success(
        `${mijoz.ism}: yangi balans ${hisob === 'BALL' ? formatBall(d.yangiBalans) + ' ball' : formatSum(d.yangiBalans)}`,
      )
      onSaqlandi()
    } finally {
      setSaqlanmoqda(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:pb-4">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl dark:border dark:border-neutral-800 w-full max-w-sm">
        <div className="p-5 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="min-w-0">
            <h3 className="text-gray-900 dark:text-gray-100 font-semibold truncate">{mijoz.ism}</h3>
            <p className="text-gray-500 dark:text-gray-400 text-xs">
              {formatBall(mijoz.ballBalans)} ball &middot; {formatSum(mijoz.keshbekBalans)}
            </p>
          </div>
          <button onClick={onYopish} className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition shrink-0">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={saqla} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(['KESHBEK', 'BALL'] as const).map(h => (
              <button
                key={h}
                type="button"
                onClick={() => setHisob(h)}
                className={`py-2 rounded-xl text-sm font-medium border transition ${
                  hisob === h
                    ? 'bg-primary border-primary text-white'
                    : 'bg-white dark:bg-neutral-900 border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                {h === 'BALL' ? 'Ball' : 'Keshbek'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {([['qoshish', "Qo'shish", Plus], ['ayirish', 'Ayirish', Minus]] as const).map(([k, label, Icon]) => (
              <button
                key={k}
                type="button"
                onClick={() => setYonalish(k)}
                className={`py-2 rounded-xl text-sm font-medium border transition flex items-center justify-center gap-1 ${
                  yonalish === k
                    ? k === 'qoshish'
                      ? 'bg-green-600 border-green-600 text-white'
                      : 'bg-red-600 border-red-600 text-white'
                    : 'bg-white dark:bg-neutral-900 border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                <Icon size={14} />{label}
              </button>
            ))}
          </div>

          <div>
            <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">
              Miqdor {hisob === 'BALL' ? '(ball)' : "(so'm)"}
            </label>
            {hisob === 'KESHBEK' ? (
              <MoneyInput
                value={miqdor}
                onChange={setMiqdor}
                max={yonalish === 'ayirish' ? joriy : undefined}
                min={0}
                placeholder="0"
              />
            ) : (
              <input
                type="text"
                inputMode="decimal"
                value={miqdor}
                onChange={e => setMiqdor(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="0"
                className={inputCls}
              />
            )}
            {yonalish === 'ayirish' && (
              <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                Joriy balans: {hisob === 'BALL' ? formatBall(joriy) : formatSum(joriy)}
                {' — '}balansdan ortig&apos;i ayirilmaydi
              </p>
            )}
          </div>

          <div>
            <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">
              Izoh <span className="text-gray-400 font-normal">(nima uchun)</span>
            </label>
            <input
              type="text"
              value={izoh}
              onChange={e => setIzoh(e.target.value)}
              placeholder="masalan: bayram aksiyasi"
              className={inputCls}
            />
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={onYopish}
              className="flex-1 py-2.5 border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition font-medium">
              Bekor
            </button>
            <button type="submit" disabled={saqlanmoqda}
              className="flex-1 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-60 text-white rounded-xl font-medium transition flex items-center justify-center gap-2">
              {saqlanmoqda ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Saqlash
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Harakatlar jurnali ──────────────────────────────────────────────────────

function HarakatlarTab() {
  const [harakatlar, setHarakatlar] = useState<Harakat[]>([])
  const [yuklanmoqda, setYuklanmoqda] = useState(true)
  const [hisob, setHisob] = useState('')
  const [sabab, setSabab] = useState('')

  useEffect(() => {
    // Filtr tez o'zgarsa oldingi so'rovning kech kelgan javobi
    // yangisining ustidan yozib yubormasligi uchun bekor bayrog'i.
    let bekor = false
    async function yukla() {
      setYuklanmoqda(true)
      const qs = new URLSearchParams({ limit: '100' })
      if (hisob) qs.set('hisob', hisob)
      if (sabab) qs.set('sabab', sabab)
      try {
        const d = await fetch(`/api/sodiqlik/harakatlar?${qs}`).then(r => r.json())
        if (!bekor) setHarakatlar(d.harakatlar || [])
      } catch {
        if (!bekor) toast.error('Yuklanmadi')
      } finally {
        if (!bekor) setYuklanmoqda(false)
      }
    }
    void yukla()
    return () => { bekor = true }
  }, [hisob, sabab])

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <select value={hisob} onChange={e => setHisob(e.target.value)} className={`${inputCls} w-auto`}>
          <option value="">Barcha hisoblar</option>
          <option value="BALL">Ball</option>
          <option value="KESHBEK">Keshbek</option>
        </select>
        <select value={sabab} onChange={e => setSabab(e.target.value)} className={`${inputCls} w-auto`}>
          <option value="">Barcha sabablar</option>
          <option value="SOTUVDAN">Xariddan</option>
          <option value="SARFLANDI">Sarflandi</option>
          <option value="QAYTARISHDAN">Qaytarishdan</option>
          <option value="QOLDA">Qo&apos;lda</option>
        </select>
      </div>

      {yuklanmoqda ? (
        <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin text-primary" /></div>
      ) : harakatlar.length === 0 ? (
        <p className="text-center text-gray-500 dark:text-gray-400 py-12 text-sm">Hali harakat yo&apos;q</p>
      ) : (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl divide-y divide-gray-100 dark:divide-neutral-800">
          {harakatlar.map(h => {
            const miqdor = Number(h.miqdor)
            const musbat = miqdor > 0
            return (
              <div key={h.id} className="p-3.5 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-gray-900 dark:text-gray-100 font-medium text-sm">{h.mijoz.ism}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-md ${SABAB_RANG[h.sabab]}`}>
                      {SABAB_LABEL[h.sabab]}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-gray-400">
                      {h.hisob === 'BALL' ? 'Ball' : 'Keshbek'}
                    </span>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
                    {formatSanaVaVaqt(h.sana)}
                    {h.sotuv && ` · ${h.sotuv.chekRaqami}`}
                    {h.foydalanuvchi && ` · ${h.foydalanuvchi.ism}`}
                  </p>
                  {h.izoh && <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5 truncate">{h.izoh}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className={`font-semibold text-sm font-mono tabular-nums ${musbat ? 'text-green-600' : 'text-amber-600'}`}>
                    {musbat ? '+' : ''}
                    {h.hisob === 'BALL' ? formatBall(miqdor) : formatSum(miqdor)}
                  </p>
                  <p className="text-gray-500 dark:text-gray-400 text-[11px] font-mono tabular-nums">
                    → {h.hisob === 'BALL' ? formatBall(h.balansKeyin) : formatSum(h.balansKeyin)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Sozlamalar (faqat admin) ────────────────────────────────────────────────

function SozlamalarTab({
  sozlama, onSaqlandi,
}: { sozlama: SodiqlikSozlama; onSaqlandi: (s: SodiqlikSozlama) => void }) {
  const [form, setForm] = useState<SodiqlikSozlama>(sozlama)
  const [saqlanmoqda, setSaqlanmoqda] = useState(false)

  useEffect(() => { setForm(sozlama) }, [sozlama])

  function son(v: string): number {
    const n = parseFloat(v.replace(/\s/g, ''))
    return Number.isFinite(n) && n >= 0 ? n : 0
  }

  async function saqla(e: React.FormEvent) {
    e.preventDefault()
    setSaqlanmoqda(true)
    try {
      const res = await fetch('/api/sodiqlik/sozlamalar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await res.json()
      if (!res.ok) { toast.error(d.xato || 'Saqlanmadi'); return }
      onSaqlandi(d)
      toast.success('Qoidalar saqlandi')
    } finally {
      setSaqlanmoqda(false)
    }
  }

  // Namuna hisob — admin qoidani yozayotganda natijani darhol ko'rsin
  const namunaSumma = 1_000_000
  const namunaBall = hisoblaBall(namunaSumma, { ...form, faol: true })
  const namunaKeshbek = hisoblaKeshbek(namunaSumma, { ...form, faol: true })

  return (
    <form onSubmit={saqla} className="space-y-4 max-w-2xl">
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-gray-900 dark:text-gray-100 font-medium text-sm">Dasturni yoqish</p>
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
            O&apos;chirilganda to&apos;planmaydi ham, sarflanmaydi ham. Mavjud balanslar saqlanadi.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setForm(f => ({ ...f, faol: !f.faol }))}
          className={`relative w-12 h-7 rounded-full transition shrink-0 ${form.faol ? 'bg-green-600' : 'bg-gray-300 dark:bg-neutral-700'}`}
        >
          <span className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${form.faol ? 'left-6' : 'left-1'}`} />
        </button>
      </div>

      {/* BALL */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 space-y-3">
        <h3 className="text-gray-900 dark:text-gray-100 font-semibold text-sm flex items-center gap-1.5">
          <Gift size={15} className="text-primary" /> Ball to&apos;plash
        </h3>
        <div className="flex items-end gap-2 flex-wrap">
          <span className="text-sm text-gray-600 dark:text-gray-400 pb-2">Har</span>
          <div className="w-40">
            <MoneyInput
              value={String(form.ballHarSumma)}
              onChange={v => setForm(f => ({ ...f, ballHarSumma: son(v) }))}
              placeholder="1 000 000"
            />
          </div>
          <span className="text-sm text-gray-600 dark:text-gray-400 pb-2">so&apos;m xaridga</span>
          <input
            type="text"
            inputMode="decimal"
            value={String(form.ballMiqdori)}
            onChange={e => setForm(f => ({ ...f, ballMiqdori: son(e.target.value.replace(/[^0-9.]/g, '')) }))}
            className={`${inputCls} w-24`}
          />
          <span className="text-sm text-gray-600 dark:text-gray-400 pb-2">ball</span>
        </div>

        <div className="flex items-end gap-2 flex-wrap pt-1 border-t border-gray-100 dark:border-neutral-800">
          <span className="text-sm text-gray-600 dark:text-gray-400 pb-2 pt-3">Sarflashda 1 ball =</span>
          <div className="w-36">
            <MoneyInput
              value={String(form.ballSomQiymati)}
              onChange={v => setForm(f => ({ ...f, ballSomQiymati: son(v) }))}
              placeholder="0"
            />
          </div>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-xs">
          0 qoldirilsa — ball sarflanmaydi, faqat to&apos;planadi (mijoz reytingi uchun).
        </p>
      </div>

      {/* KESHBEK */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 space-y-3">
        <h3 className="text-gray-900 dark:text-gray-100 font-semibold text-sm flex items-center gap-1.5">
          <Percent size={15} className="text-primary" /> Keshbek to&apos;plash
        </h3>
        <div className="flex items-end gap-2 flex-wrap">
          <span className="text-sm text-gray-600 dark:text-gray-400 pb-2">Xarid summasining</span>
          <input
            type="text"
            inputMode="decimal"
            value={String(form.keshbekFoiz)}
            onChange={e => setForm(f => ({ ...f, keshbekFoiz: Math.min(100, son(e.target.value.replace(/[^0-9.]/g, ''))) }))}
            className={`${inputCls} w-24`}
          />
          <span className="text-sm text-gray-600 dark:text-gray-400 pb-2">% i keshbek sifatida qaytadi</span>
        </div>
      </div>

      {/* Chegaralar */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 space-y-3">
        <h3 className="text-gray-900 dark:text-gray-100 font-semibold text-sm">Chegaralar</h3>
        <div className="flex items-end gap-2 flex-wrap">
          <span className="text-sm text-gray-600 dark:text-gray-400 pb-2">Bitta chekning eng ko&apos;pi bilan</span>
          <input
            type="text"
            inputMode="decimal"
            value={String(form.maksQoplashFoiz)}
            onChange={e => setForm(f => ({ ...f, maksQoplashFoiz: Math.min(100, son(e.target.value.replace(/[^0-9.]/g, ''))) }))}
            className={`${inputCls} w-24`}
          />
          <span className="text-sm text-gray-600 dark:text-gray-400 pb-2">% i ball/keshbek bilan yopilsin</span>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer select-none pt-1">
          <input
            type="checkbox"
            checked={form.nasiyagaHam}
            onChange={e => setForm(f => ({ ...f, nasiyagaHam: e.target.checked }))}
            className="rounded border-gray-300 dark:border-neutral-700"
          />
          Nasiya sotuvda ham to&apos;plansin
          <span className="text-gray-500 dark:text-gray-400 text-xs">(pul hali kelmagan bo&apos;lsa ham)</span>
        </label>
      </div>

      {/* Namuna */}
      <div className="rounded-2xl border border-dashed border-gray-300 dark:border-neutral-700 p-4">
        <p className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide font-mono mb-2">Namuna</p>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {formatSum(namunaSumma)} lik xaridda mijoz{' '}
          <span className="font-semibold text-gray-900 dark:text-gray-100">{formatBall(namunaBall)} ball</span>
          {namunaKeshbek > 0 && (
            <> va <span className="font-semibold text-primary">{formatSum(namunaKeshbek)} keshbek</span></>
          )}
          {' '}oladi.
        </p>
        {form.ballSomQiymati > 0 && namunaBall > 0 && (
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
            Bu ball sarflanganda {formatSum(namunaBall * form.ballSomQiymati)} ga teng.
          </p>
        )}
      </div>

      <button type="submit" disabled={saqlanmoqda}
        className="w-full sm:w-auto px-6 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-60 text-white rounded-xl font-medium transition flex items-center justify-center gap-2">
        {saqlanmoqda ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        Qoidalarni saqlash
      </button>
    </form>
  )
}
