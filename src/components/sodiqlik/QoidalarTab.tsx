'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Gift, Receipt, Package, Tags, Plus, Pencil, Trash2, Loader2, Calculator, Settings } from 'lucide-react'
import MoneyInput from '@/components/ui/money-input'
import { useConfirm } from '@/components/ConfirmProvider'
import { formatSum } from '@/lib/utils'
import { formatBall, sotuvdanToplanadi, type QoidaTuri, type SodiqlikSozlama } from '@/lib/sodiqlik'
import QoidaModal, { type QoidaShabloni } from './QoidaModal'
import { qoidaMukofoti, qoidaSharti, sonMatni, type QoidaYozuvi } from './qoida-matn'

// "Ballar va keshbeklar" → Qoidalar: umumiy qoidaga QO'SHILADIGAN qoidalar —
// chek summasi ("1 000 000 so'mlik xaridga 5 ball"), mahsulot ("shu
// mahsulotdan 5 dona olsa har donasiga 2 ball, 3% keshbek") va kategoriya.

const GURUHLAR: { turi: QoidaTuri; sarlavha: string; izoh: string; Belgi: typeof Receipt }[] = [
  { turi: 'CHEK', sarlavha: 'Chek summasi bo‘yicha', izoh: 'Xarid summasi kamida shuncha bo‘lsa', Belgi: Receipt },
  { turi: 'MAHSULOT', sarlavha: 'Mahsulot bo‘yicha', izoh: 'Shu mahsulotdan kamida shuncha olinsa', Belgi: Package },
  { turi: 'KATEGORIYA', sarlavha: 'Kategoriya bo‘yicha', izoh: 'Kategoriyadan jami kamida shuncha olinsa', Belgi: Tags },
]

const SHABLONLAR: { nomi: string; izoh: string; shablon: QoidaShabloni }[] = [
  { nomi: '1 000 000 so‘mlik xaridga ball', izoh: 'Katta xarid uchun qo‘shimcha ball', shablon: { turi: 'CHEK', minSumma: 1_000_000, ball: 5 } },
  { nomi: 'Mahsulot uchun ball', izoh: 'Tanlangan mahsulotning har donasiga', shablon: { turi: 'MAHSULOT', minMiqdor: 1, ball: 1 } },
  { nomi: 'Ko‘p olganga keshbek', izoh: 'Masalan, 5 dona va undan ko‘p — 3%', shablon: { turi: 'MAHSULOT', minMiqdor: 5, keshbekFoiz: 3 } },
]

export default function QoidalarTab({ sozlama, tahrir, onSozlamalar }: {
  sozlama: SodiqlikSozlama
  /** «Sodiqlik dasturi sozlamalari» ruxsati — qo'shish/o'zgartirish */
  tahrir: boolean
  /** Umumiy qoidani o'zgartirish — Sozlamalar bo'limiga o'tish */
  onSozlamalar: () => void
}) {
  const confirm = useConfirm()
  const [qoidalar, setQoidalar] = useState<QoidaYozuvi[]>([])
  const [yuklanmoqda, setYuklanmoqda] = useState(true)
  const [oyna, setOyna] = useState<{ qoida?: QoidaYozuvi; shablon?: QoidaShabloni } | null>(null)
  const [amalda, setAmalda] = useState<string | null>(null)
  const [namunaSumma, setNamunaSumma] = useState('1000000')

  const yukla = useCallback(async () => {
    try {
      const r = await fetch('/api/sodiqlik/qoidalar')
      const d = await r.json()
      if (!r.ok) { toast.error(d.xato || 'Qoidalar yuklanmadi'); return }
      setQoidalar(Array.isArray(d) ? d : [])
    } catch {
      toast.error('Qoidalar yuklanmadi')
    } finally {
      setYuklanmoqda(false)
    }
  }, [])
  useEffect(() => { void yukla() }, [yukla])

  async function faolniAlmashtir(q: QoidaYozuvi) {
    setAmalda(q.id)
    try {
      const r = await fetch(`/api/sodiqlik/qoidalar/${q.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faol: !q.faol }),
      })
      const d = await r.json()
      if (!r.ok) { toast.error(d.xato || 'Saqlanmadi'); return }
      setQoidalar(p => p.map(x => (x.id === q.id ? d : x)))
      toast.success(d.faol ? 'Qoida yoqildi' : 'Qoida to‘xtatildi — hisobga olinmaydi')
    } finally {
      setAmalda(null)
    }
  }

  async function ochir(q: QoidaYozuvi) {
    const ok = await confirm({
      title: 'Qoida o‘chirilsinmi?',
      message: `${qoidaSharti(q)} → ${qoidaMukofoti(q).join(', ')}. Avval to‘plangan ballar mijozlarda qoladi.`,
      confirmText: "O'chirish",
      danger: true,
    })
    if (!ok) return
    setAmalda(q.id)
    try {
      const r = await fetch(`/api/sodiqlik/qoidalar/${q.id}`, { method: 'DELETE' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(d.xato || 'O‘chirilmadi'); return }
      setQoidalar(p => p.filter(x => x.id !== q.id))
      toast.success('Qoida o‘chirildi')
    } finally {
      setAmalda(null)
    }
  }

  function saqlandi(q: QoidaYozuvi) {
    setQoidalar(p => (p.some(x => x.id === q.id) ? p.map(x => (x.id === q.id ? q : x)) : [...p, q]))
    setOyna(null)
  }

  // Hisoblagich: umumiy qoida + chek summasi qoidasi (mahsulot qoidalari savatga bog'liq)
  const summa = Number(namunaSumma) || 0
  const namuna = sotuvdanToplanadi({
    tolangan: summa, tolovUsuli: 'NAQD', sozlama: { ...sozlama, faol: true },
    qoidalar: qoidalar.filter(q => q.turi === 'CHEK'),
  })
  const umumiyBor = sozlama.ballHarSumma > 0 && sozlama.ballMiqdori > 0

  return (
    <div className="space-y-4 max-w-3xl">
      {/* ── Umumiy qoida (Sozlamalar'dan) ── */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Umumiy qoida — har xaridda</p>
          <p className="text-gray-900 dark:text-gray-100 text-sm mt-1">
            {umumiyBor
              ? <>Har <b className="tabular-nums">{formatSum(sozlama.ballHarSumma)}</b> xaridga <b>{formatBall(sozlama.ballMiqdori)} ball</b></>
              : 'Ball berilmaydi'}
            {' · '}
            {sozlama.keshbekFoiz > 0 ? <>keshbek <b>{sonMatni(sozlama.keshbekFoiz)}%</b></> : 'keshbek yo‘q'}
          </p>
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">Quyidagi qoidalar shunga QO‘SHIB beriladi.</p>
        </div>
        {tahrir && (
          <button type="button" onClick={onSozlamalar}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-300 text-xs font-medium hover:border-primary/50 hover:text-primary transition">
            <Settings size={13} /> O‘zgartirish
          </button>
        )}
      </div>

      {/* ── Qo'shimcha qoidalar ── */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-gray-900 dark:text-gray-100 font-semibold">Qo‘shimcha qoidalar</h2>
        {tahrir && (
          <button type="button" onClick={() => setOyna({})}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-medium transition">
            <Plus size={15} /> Qoida qo‘shish
          </button>
        )}
      </div>

      {yuklanmoqda ? (
        <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin text-primary" /></div>
      ) : qoidalar.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-neutral-700 p-5">
          <p className="text-gray-700 dark:text-gray-300 text-sm">
            Hali qo‘shimcha qoida yo‘q. Masalan: katta xaridga ball, tanlangan mahsulot uchun ball yoki ko‘p olganga keshbek.
          </p>
          {tahrir && (
            <div className="grid sm:grid-cols-3 gap-2 mt-3">
              {SHABLONLAR.map(sh => (
                <button key={sh.nomi} type="button" onClick={() => setOyna({ shablon: sh.shablon })}
                  className="text-left rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3 hover:border-primary/50 transition">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1.5"><Plus size={14} className="text-primary shrink-0" />{sh.nomi}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sh.izoh}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {GURUHLAR.map(({ turi, sarlavha, izoh, Belgi }) => {
            const royxat = qoidalar.filter(q => q.turi === turi)
            if (royxat.length === 0) return null
            return (
              <section key={turi} className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-neutral-800 flex items-center gap-2">
                  <Belgi size={16} className="text-primary shrink-0" />
                  <div className="min-w-0">
                    <h3 className="text-gray-900 dark:text-gray-100 font-semibold text-sm">{sarlavha}</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-xs">{izoh}</p>
                  </div>
                </div>
                <ul className="divide-y divide-gray-100 dark:divide-neutral-800">
                  {royxat.map(q => (
                    <li key={q.id} className={`px-4 py-3 flex items-start gap-3 ${q.faol ? '' : 'opacity-60'}`}>
                      <div className="min-w-0 flex-1">
                        {q.turi !== 'CHEK' && (
                          <p className="text-gray-900 dark:text-gray-100 text-sm font-medium flex items-center gap-1.5 min-w-0">
                            {q.tovar && q.tovar.tartibRaqami !== null && (
                              <span className="shrink-0 px-1.5 py-0.5 rounded-md border border-gray-300 dark:border-neutral-600 text-gray-600 dark:text-gray-300 text-[11px] font-bold leading-none tabular-nums">№ {q.tovar.tartibRaqami}</span>
                            )}
                            <span className="truncate">{q.tovar?.nomi ?? q.kategoriya?.nomi ?? '—'}</span>
                            {q.tovar && q.tovar.holati !== 'FAOL' && (
                              <span className="shrink-0 text-[11px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 text-gray-500">arxivda</span>
                            )}
                          </p>
                        )}
                        <p className={`text-sm ${q.turi === 'CHEK' ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-600 dark:text-gray-400 text-xs mt-0.5'}`}>
                          {qoidaSharti(q)}
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {qoidaMukofoti(q).map(m => (
                            <span key={m} className="text-xs px-2 py-0.5 rounded-md bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 font-medium">{m}</span>
                          ))}
                          {!q.faol && <span className="text-xs px-2 py-0.5 rounded-md bg-gray-100 dark:bg-neutral-800 text-gray-500">to‘xtatilgan</span>}
                        </div>
                        {q.izoh && <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">{q.izoh}</p>}
                      </div>
                      {tahrir && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button type="button" role="switch" aria-checked={q.faol} disabled={amalda === q.id}
                            onClick={() => void faolniAlmashtir(q)}
                            title={q.faol ? 'To‘xtatish (vaqtincha hisobga olinmasin)' : 'Yoqish'}
                            aria-label={q.faol ? 'Qoidani to‘xtatish' : 'Qoidani yoqish'}
                            className={`relative w-10 h-6 rounded-full transition shrink-0 disabled:opacity-50 ${q.faol ? 'bg-green-600' : 'bg-gray-300 dark:bg-neutral-700'}`}>
                            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${q.faol ? 'left-5' : 'left-1'}`} />
                          </button>
                          <button type="button" onClick={() => setOyna({ qoida: q })} title="Tahrirlash"
                            className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition">
                            <Pencil size={15} />
                          </button>
                          <button type="button" onClick={() => void ochir(q)} disabled={amalda === q.id} title="O‘chirish"
                            className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition disabled:opacity-50">
                            {amalda === q.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}

      {/* ── Hisoblab ko'rish ── */}
      <div className="rounded-2xl border border-dashed border-gray-300 dark:border-neutral-700 p-4 space-y-3">
        <p className="text-gray-900 dark:text-gray-100 font-medium text-sm flex items-center gap-1.5">
          <Calculator size={15} className="text-primary" /> Hisoblab ko‘rish
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <label htmlFor="sodiqlik-namuna-summa" className="text-sm text-gray-600 dark:text-gray-400">Xarid summasi</label>
          <div className="w-44">
            <MoneyInput id="sodiqlik-namuna-summa" value={namunaSumma} onChange={setNamunaSumma} placeholder="1 000 000" />
          </div>
        </div>
        <div className="text-sm space-y-1" aria-live="polite">
          {namuna.tafsilot.ball.umumiy > 0 || namuna.tafsilot.keshbek.umumiy > 0 ? (
            <p className="text-gray-600 dark:text-gray-400 flex justify-between gap-3">
              <span>Umumiy qoida</span>
              <span className="tabular-nums">{[
                namuna.tafsilot.ball.umumiy > 0 && `+${formatBall(namuna.tafsilot.ball.umumiy)} ball`,
                namuna.tafsilot.keshbek.umumiy > 0 && `+${formatSum(namuna.tafsilot.keshbek.umumiy)}`,
              ].filter(Boolean).join(' · ')}</span>
            </p>
          ) : null}
          {namuna.qollanilgan.map(a => (
            <p key={a.qoidaId} className="text-gray-600 dark:text-gray-400 flex justify-between gap-3">
              <span>Chek qoidasi ({formatSum(qoidalar.find(q => q.id === a.qoidaId)?.minSumma ?? 0)} dan)</span>
              <span className="tabular-nums">{[a.ball > 0 && `+${formatBall(a.ball)} ball`, a.keshbek > 0 && `+${formatSum(a.keshbek)}`].filter(Boolean).join(' · ')}</span>
            </p>
          ))}
          <p className="flex justify-between gap-3 pt-1 border-t border-gray-200 dark:border-neutral-800 font-semibold text-gray-900 dark:text-gray-100">
            <span className="flex items-center gap-1.5"><Gift size={14} className="text-primary" /> Mijoz oladi</span>
            <span className="tabular-nums">
              {namuna.ball > 0 || namuna.keshbek > 0
                ? [namuna.ball > 0 && `${formatBall(namuna.ball)} ball`, namuna.keshbek > 0 && `${formatSum(namuna.keshbek)} keshbek`].filter(Boolean).join(' · ')
                : 'hech narsa'}
            </span>
          </p>
          <p className="text-gray-500 dark:text-gray-400 text-xs">
            Mahsulot va kategoriya qoidalari kassada savatdagi mahsulotlarga qarab qo‘shiladi.
            {!sozlama.faol && ' Dastur hozir o‘chirilgan — kassada hech narsa to‘planmaydi.'}
          </p>
        </div>
      </div>

      {oyna && (
        <QoidaModal
          qoida={oyna.qoida}
          shablon={oyna.shablon}
          onYopish={() => setOyna(null)}
          onSaqlandi={saqlandi}
        />
      )}
    </div>
  )
}
