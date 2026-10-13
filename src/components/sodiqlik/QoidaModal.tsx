'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Receipt, Package, Tags, Loader2, Save, Gift } from 'lucide-react'
import Modal from '@/components/ui/modal'
import MoneyInput from '@/components/ui/money-input'
import Combobox from '@/components/ui/combobox'
import { formatSum } from '@/lib/utils'
import { formatBall, qoidaniTasdiqla, type QoidaTuri } from '@/lib/sodiqlik'
import { birlikMatni, sonMatni, type QoidaYozuvi } from './qoida-matn'

// Sodiqlik qoidasini qo'shish yoki tahrirlash: nima uchun (chek summasi,
// mahsulot yoki kategoriya va sharti) → nima beriladi (ball, keshbek %).
// Pastda — shu qoida bo'yicha aniq misol.

export interface QoidaShabloni {
  turi: QoidaTuri
  minSumma?: number
  minMiqdor?: number
  ball?: number
  keshbekFoiz?: number
}

interface TovarQisqa { id: string; nomi: string; tartibRaqami: number | null; birlik: string; sotishNarxi: number | null; valyuta: string }
interface KategoriyaQisqa { id: string; nomi: string }

const TURLAR: { turi: QoidaTuri; nomi: string; izoh: string; Belgi: typeof Receipt }[] = [
  { turi: 'CHEK', nomi: 'Chek summasi', izoh: 'xarid summasiga qarab', Belgi: Receipt },
  { turi: 'MAHSULOT', nomi: 'Mahsulot', izoh: 'tanlangan mahsulot', Belgi: Package },
  { turi: 'KATEGORIYA', nomi: 'Kategoriya', izoh: 'butun kategoriya', Belgi: Tags },
]

const inputCls = 'w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 transition'
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'
const sonMaydoni = (v: string) => v.replace(/[^0-9.,]/g, '').replace(',', '.')
const raqam = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0 }

export default function QoidaModal({ qoida, shablon, onYopish, onSaqlandi }: {
  /** Tahrirlanayotgan qoida (yo'q bo'lsa — yangi) */
  qoida?: QoidaYozuvi
  /** Yangi qoida uchun boshlang'ich qiymatlar */
  shablon?: QoidaShabloni
  onYopish: () => void
  onSaqlandi: (q: QoidaYozuvi) => void
}) {
  const bosh = qoida ?? shablon
  const [turi, setTuri] = useState<QoidaTuri>(bosh?.turi ?? 'CHEK')
  const [minSumma, setMinSumma] = useState(String(bosh?.minSumma ?? 1_000_000))
  const [minMiqdor, setMinMiqdor] = useState(String(bosh?.minMiqdor || 1))
  const [tovarId, setTovarId] = useState(qoida?.tovarId ?? '')
  const [kategoriyaId, setKategoriyaId] = useState(qoida?.kategoriyaId ?? '')
  const [ball, setBall] = useState(bosh?.ball ? String(bosh.ball) : '')
  const [foiz, setFoiz] = useState(bosh?.keshbekFoiz ? String(bosh.keshbekFoiz) : '')
  const [izoh, setIzoh] = useState(qoida?.izoh ?? '')
  const [faol, setFaol] = useState(qoida?.faol ?? true)
  const [saqlanmoqda, setSaqlanmoqda] = useState(false)
  const [tovarlar, setTovarlar] = useState<TovarQisqa[] | null>(null)
  const [kategoriyalar, setKategoriyalar] = useState<KategoriyaQisqa[] | null>(null)

  // Ro'yxatlar kerak bo'lgandagina yuklanadi
  useEffect(() => {
    if (turi !== 'MAHSULOT' || tovarlar) return
    fetch('/api/tovarlar?limit=9999')
      .then(r => r.json())
      .then(d => setTovarlar((Array.isArray(d?.tovarlar) ? d.tovarlar : []).map((t: TovarQisqa) => ({
        id: t.id, nomi: t.nomi, tartibRaqami: t.tartibRaqami, birlik: t.birlik,
        sotishNarxi: t.sotishNarxi === null ? null : Number(t.sotishNarxi), valyuta: t.valyuta,
      }))))
      .catch(() => { setTovarlar([]); toast.error('Mahsulotlar yuklanmadi') })
  }, [turi, tovarlar])
  useEffect(() => {
    if (turi !== 'KATEGORIYA' || kategoriyalar) return
    fetch('/api/kategoriyalar')
      .then(r => r.json())
      .then(d => setKategoriyalar((Array.isArray(d) ? d : []).map((k: KategoriyaQisqa) => ({ id: k.id, nomi: k.nomi }))))
      .catch(() => { setKategoriyalar([]); toast.error('Kategoriyalar yuklanmadi') })
  }, [turi, kategoriyalar])

  // Tahrirlanayotgan qoidaning mahsuloti arxivda bo'lsa ham ro'yxatda turadi
  const tovarVariantlari = [...(tovarlar ?? [])]
  if (qoida?.tovar && !tovarVariantlari.some(t => t.id === qoida.tovar!.id)) {
    tovarVariantlari.unshift({ ...qoida.tovar, sotishNarxi: null, valyuta: 'UZS' })
  }
  const tovar = tovarVariantlari.find(t => t.id === tovarId) ?? null
  const birlik = turi === 'MAHSULOT' ? birlikMatni(tovar?.birlik) : 'dona'

  // ── Misol: shu qoida bo'yicha (umumiy qoidaga qo'shimcha) ──
  const b = raqam(ball)
  const f = raqam(foiz)
  let misol: { shart: string; ball: number; keshbek: number | null } | null = null
  if (b > 0 || f > 0) {
    if (turi === 'CHEK') {
      const s = raqam(minSumma) || 1_000_000
      misol = { shart: `${formatSum(s)} lik xaridda`, ball: b, keshbek: Math.floor((s * f) / 100) }
    } else {
      const n = Math.max(1, raqam(minMiqdor))
      const narx = turi === 'MAHSULOT' && tovar?.valyuta !== 'USD' ? tovar?.sotishNarxi ?? null : null
      misol = {
        shart: narx !== null
          ? `${sonMatni(n)} ${birlik} olinsa (${formatSum(narx * n)})`
          : `${sonMatni(n)} ${birlik} olinsa`,
        ball: Math.floor(b * n * 100) / 100,
        keshbek: narx !== null ? Math.floor((narx * n * f) / 100) : null,
      }
    }
  }

  async function saqla(e: React.FormEvent) {
    e.preventDefault()
    const tana = {
      turi, minSumma, minMiqdor, tovarId, kategoriyaId,
      ball: ball || 0, keshbekFoiz: foiz || 0, izoh, faol,
    }
    // Server bilan aynan bir xil tekshiruv — xato darhol, so'rovsiz
    const t = qoidaniTasdiqla(tana)
    if (!t.ok) { toast.error(t.xato); return }
    setSaqlanmoqda(true)
    try {
      const r = await fetch(qoida ? `/api/sodiqlik/qoidalar/${qoida.id}` : '/api/sodiqlik/qoidalar', {
        method: qoida ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tana),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(d.xato || 'Saqlanmadi'); return }
      toast.success(qoida ? 'Qoida saqlandi' : 'Qoida qo‘shildi — keyingi xariddan ishlaydi')
      onSaqlandi(d)
    } catch {
      toast.error('Tarmoq xatosi')
    } finally {
      setSaqlanmoqda(false)
    }
  }

  return (
    <Modal
      olcham="md"
      belgi={<Gift size={18} className="text-primary" />}
      sarlavha={<>{qoida ? 'Qoidani tahrirlash' : 'Yangi qoida'}</>}
      tavsif="Umumiy qoidaga qo‘shimcha ball yoki keshbek"
      onYopish={onYopish}
      onSubmit={saqla}
      footer={<>
        <button type="button" onClick={onYopish}
          className="flex-1 py-2.5 border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition font-medium">
          Bekor
        </button>
        <button type="submit" disabled={saqlanmoqda}
          className="flex-1 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-60 text-white rounded-xl font-medium transition flex items-center justify-center gap-2">
          {saqlanmoqda ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Saqlash
        </button>
      </>}
    >
      <div className="space-y-4">
        {/* Nima uchun */}
        <fieldset>
          <legend className={labelCls}>Nima uchun beriladi</legend>
          <div className="grid grid-cols-3 gap-2">
            {TURLAR.map(({ turi: t, nomi, izoh: tIzoh, Belgi }) => (
              <button key={t} type="button" aria-pressed={turi === t} onClick={() => setTuri(t)}
                className={`flex flex-col items-center gap-0.5 px-2 py-2.5 rounded-xl border text-sm font-medium transition ${
                  turi === t
                    ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                    : 'border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800'
                }`}>
                <Belgi size={16} />
                <span>{nomi}</span>
                <span className="text-[11px] font-normal opacity-75 text-center leading-tight">{tIzoh}</span>
              </button>
            ))}
          </div>
        </fieldset>

        {turi === 'CHEK' && (
          <div>
            <label htmlFor="qoida-min-summa" className={labelCls}>Xarid summasi kamida</label>
            <MoneyInput id="qoida-min-summa" value={minSumma} onChange={setMinSumma} placeholder="1 000 000" />
            <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
              Mijoz haqiqatda to‘lagan summa (chegirma va ball bilan to‘langan qismsiz). 0 — har bir xarid.
            </p>
          </div>
        )}

        {turi === 'MAHSULOT' && (
          <div>
            <label htmlFor="qoida-tovar" className={labelCls}>Mahsulot</label>
            {tovarlar === null && !qoida?.tovar ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2 py-2"><Loader2 size={14} className="animate-spin" /> Yuklanmoqda…</p>
            ) : (
              <Combobox
                id="qoida-tovar"
                options={tovarVariantlari.map(t => ({
                  value: t.id,
                  label: t.tartibRaqami !== null ? `№${t.tartibRaqami} ${t.nomi}` : t.nomi,
                  izoh: t.sotishNarxi !== null && t.valyuta !== 'USD' ? formatSum(t.sotishNarxi) : undefined,
                }))}
                value={tovarId}
                onChange={setTovarId}
                placeholder="Mahsulotni tanlang"
                searchPlaceholder="Nomi yoki № …"
              />
            )}
          </div>
        )}

        {turi === 'KATEGORIYA' && (
          <div>
            <label htmlFor="qoida-kategoriya" className={labelCls}>Kategoriya</label>
            {kategoriyalar === null && !qoida?.kategoriya ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2 py-2"><Loader2 size={14} className="animate-spin" /> Yuklanmoqda…</p>
            ) : (
              <Combobox
                id="qoida-kategoriya"
                options={[
                  ...(kategoriyalar ?? []),
                  ...(qoida?.kategoriya && !(kategoriyalar ?? []).some(k => k.id === qoida.kategoriya!.id) ? [qoida.kategoriya] : []),
                ].map(k => ({ value: k.id, label: k.nomi }))}
                value={kategoriyaId}
                onChange={setKategoriyaId}
                placeholder="Kategoriyani tanlang"
                searchPlaceholder="Kategoriya qidirish…"
              />
            )}
          </div>
        )}

        {turi !== 'CHEK' && (
          <div>
            <label htmlFor="qoida-min-miqdor" className={labelCls}>
              Kamida necha {birlik} {turi === 'KATEGORIYA' && <span className="font-normal text-gray-500">(kategoriyadan jami)</span>}
            </label>
            <input id="qoida-min-miqdor" type="text" inputMode="decimal" value={minMiqdor}
              onChange={e => setMinMiqdor(sonMaydoni(e.target.value))} className={`${inputCls} max-w-40`} />
            <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">1 — har qanday miqdorda. Bir mahsulotga bir nechta qoida bo‘lsa (5 → 3%, 10 → 5%), sharti bajarilgan eng kattasi ishlaydi.</p>
          </div>
        )}

        {/* Nima beriladi */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="qoida-ball" className={labelCls}>Ball</label>
            <input id="qoida-ball" type="text" inputMode="decimal" value={ball} placeholder="0"
              onChange={e => setBall(sonMaydoni(e.target.value))} className={inputCls} />
            <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">{turi === 'CHEK' ? 'bir xarid uchun' : `har 1 ${birlik} uchun`}</p>
          </div>
          <div>
            <label htmlFor="qoida-foiz" className={labelCls}>Keshbek, %</label>
            <input id="qoida-foiz" type="text" inputMode="decimal" value={foiz} placeholder="0"
              onChange={e => setFoiz(sonMaydoni(e.target.value))} className={inputCls} />
            <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">{turi === 'CHEK' ? 'to‘langan summadan' : 'shu mahsulotlar summasidan'}</p>
          </div>
        </div>

        <div>
          <label htmlFor="qoida-izoh" className={labelCls}>Izoh <span className="font-normal text-gray-500">(ixtiyoriy)</span></label>
          <input id="qoida-izoh" type="text" value={izoh} maxLength={200} placeholder="Masalan: Navro‘z aksiyasi"
            onChange={e => setIzoh(e.target.value)} className={inputCls} />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none">
          <input type="checkbox" checked={faol} onChange={e => setFaol(e.target.checked)} className="w-4 h-4 accent-red-600" />
          <span>Qoida yoqilgan</span>
        </label>

        {/* Misol */}
        <div className="rounded-xl bg-gray-50 dark:bg-neutral-800/60 px-4 py-3 text-sm" aria-live="polite">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Misol</p>
          {misol ? (
            <p className="text-gray-700 dark:text-gray-300">
              {misol.shart} mijoz qo‘shimcha{' '}
              {[
                misol.ball > 0 && <b key="b" className="text-gray-900 dark:text-gray-100">+{formatBall(misol.ball)} ball</b>,
                misol.keshbek !== null && misol.keshbek > 0 && <b key="k" className="text-primary">+{formatSum(misol.keshbek)} keshbek</b>,
                misol.keshbek === null && f > 0 && <b key="f" className="text-primary">summasining {sonMatni(f)}% i keshbek</b>,
              ].filter(Boolean).reduce<React.ReactNode[]>((y, x, i) => (i ? [...y, ' va ', x] : [x]), [])}
              {' '}oladi.
            </p>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">Ball yoki keshbek foizini kiriting.</p>
          )}
        </div>
      </div>
    </Modal>
  )
}
