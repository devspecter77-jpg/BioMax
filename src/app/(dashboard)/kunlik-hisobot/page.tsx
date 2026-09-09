'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  ClipboardList, Loader2, RefreshCw, Send, Settings2, AlertTriangle,
  PackageX, Trophy, TrendingUp, Check, X, Clock, Users, PhoneOff,
} from 'lucide-react'
import { formatSum, formatSanaVaVaqt } from '@/lib/utils'
import { birlikQisqa, type KunlikHisobot, type HisobotSozlamalari } from '@/lib/kunlik-hisobot'

interface TarixQator {
  id: string
  kunKaliti: string
  status: string
  xato: string | null
  kamQolganSoni: number
  tugaganSoni: number
  yuborilganSana: string | null
  sana: string
}

interface Oluvchi {
  id: string
  ism: string
  telefon: string | null
  filialNomi: string | null
  oladi: boolean
}

interface Malumot {
  hisobot: KunlikHisobot
  sozlama: HisobotSozlamalari
  tarix: TarixQator[]
  bugun: string
  ozTelefon: string | null
  oluvchilar: Oluvchi[]
  boshqaraOladi: boolean
}

const DAVRLAR = [
  { kun: 1, label: 'Bugun' },
  { kun: 7, label: '7 kun' },
  { kun: 30, label: '30 kun' },
  { kun: 90, label: '90 kun' },
]

const STATUS_MATNI: Record<string, string> = {
  sent: 'Yuborildi', failed: 'Xato', skipped: "O'tkazib yuborildi", pending: 'Kutilmoqda',
}
const STATUS_RANG: Record<string, string> = {
  sent: 'bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400',
  failed: 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400',
  skipped: 'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-gray-400',
  pending: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400',
}

function miqdorMatni(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

export default function KunlikHisobotPage() {
  const [data, setData] = useState<Malumot | null>(null)
  const [yuklanmoqda, setYuklanmoqda] = useState(true)
  const [topKun, setTopKun] = useState(7)
  const [yuborilmoqda, setYuborilmoqda] = useState(false)
  const [sozlamaOchiq, setSozlamaOchiq] = useState(false)
  const [forma, setForma] = useState<HisobotSozlamalari | null>(null)
  const [saqlanmoqda, setSaqlanmoqda] = useState(false)
  const [telefon, setTelefon] = useState('')

  const yukla = useCallback(async () => {
    setYuklanmoqda(true)
    try {
      const r = await fetch(`/api/kunlik-hisobot?topKun=${topKun}`)
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        toast.error(j.xato || "Ma'lumot yuklanmadi")
        return
      }
      const j: Malumot = await r.json()
      setData(j)
      setForma(j.sozlama)
      setTelefon(j.ozTelefon ?? '')
    } catch {
      toast.error('Tarmoq xatosi')
    } finally {
      setYuklanmoqda(false)
    }
  }, [topKun])

  useEffect(() => { void yukla() }, [yukla])

  async function hozirYubor() {
    setYuborilmoqda(true)
    try {
      const r = await fetch('/api/kunlik-hisobot/yuborish', { method: 'POST' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.xato || 'Yuborilmadi'); return }
      toast.success('Hisobot Telegramga yuborildi')
      void yukla()
    } catch {
      toast.error('Tarmoq xatosi')
    } finally {
      setYuborilmoqda(false)
    }
  }

  async function sozlamaSaqla() {
    if (!forma) return
    setSaqlanmoqda(true)
    try {
      const r = await fetch('/api/kunlik-hisobot', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...forma, telefon }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.xato || 'Saqlanmadi'); return }
      toast.success('Sozlama saqlandi')
      setForma(j.sozlama)
      setSozlamaOchiq(false)
      // Oluvchilar ro'yxati ham yangilansin (raqam kiritilgan bo'lishi mumkin)
      void yukla()
    } catch {
      toast.error('Tarmoq xatosi')
    } finally {
      setSaqlanmoqda(false)
    }
  }

  const h = data?.hisobot
  const engKopSumma = h && h.topTovarlar.length > 0 ? h.topTovarlar[0].summa : 0

  return (
    <div className="space-y-4">
      {/* Sarlavha */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <ClipboardList size={22} className="text-primary" />
            Kunlik hisobot
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
            Kam qolgan mahsulotlar va eng ko&apos;p sotilganlar — har kuni Telegramga yuboriladi
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data?.boshqaraOladi && (
            <>
              <button
                onClick={() => setSozlamaOchiq(o => !o)}
                className={`p-2.5 rounded-xl border transition ${
                  sozlamaOchiq
                    ? 'border-primary/50 text-primary bg-primary/5'
                    : 'border-gray-300 dark:border-neutral-700 text-gray-500 hover:text-primary hover:border-primary/50'
                }`}
                title="Sozlamalar"
              >
                <Settings2 size={16} />
              </button>
              <button
                onClick={() => void hozirYubor()}
                disabled={yuborilmoqda}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
              >
                {yuborilmoqda ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                Hozir yuborish
              </button>
            </>
          )}
          <button
            onClick={() => void yukla()}
            className="p-2.5 rounded-xl border border-gray-300 dark:border-neutral-700 text-gray-500 hover:text-primary hover:border-primary/50 transition"
            title="Yangilash"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Sozlamalar */}
      {sozlamaOchiq && forma && (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Avtomatik yuborish sozlamalari
            </span>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={forma.yoqilgan}
                onChange={e => setForma(f => (f ? { ...f, yoqilgan: e.target.checked } : f))}
                className="w-4 h-4 accent-red-600"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">Yoqilgan</span>
            </label>
          </div>

          <Maydon
            label="Sizning Telegram raqamingiz"
            izoh="Hisobot shu raqamga yuboriladi. Masalan: 901234567"
          >
            <input
              value={telefon}
              onChange={e => setTelefon(e.target.value)}
              placeholder="901234567"
              inputMode="numeric"
              className={inputCls}
            />
          </Maydon>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Maydon label="Yuborish soati" izoh="Toshkent vaqti">
              <select
                value={forma.soat}
                onChange={e => setForma(f => (f ? { ...f, soat: Number(e.target.value) } : f))}
                className={inputCls}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                ))}
              </select>
            </Maydon>
            <Maydon label="Top davri" izoh="necha kunlik savdo">
              <input
                type="number" min={1} max={365} value={forma.topKun}
                onChange={e => setForma(f => (f ? { ...f, topKun: Number(e.target.value) } : f))}
                className={inputCls}
              />
            </Maydon>
            <Maydon label="Top mahsulot soni" izoh="xabarda nechta">
              <input
                type="number" min={1} max={50} value={forma.topSoni}
                onChange={e => setForma(f => (f ? { ...f, topSoni: Number(e.target.value) } : f))}
                className={inputCls}
              />
            </Maydon>
            <Maydon label="Kam qolgan soni" izoh="xabarda nechta">
              <input
                type="number" min={1} max={100} value={forma.kamSoni}
                onChange={e => setForma(f => (f ? { ...f, kamSoni: Number(e.target.value) } : f))}
                className={inputCls}
              />
            </Maydon>
          </div>

          {/* Kimga ketadi — avtomatik xabar real odamlarga boradi, shuning
              uchun ro'yxat ochiq ko'rsatiladi */}
          <div className="border-t border-gray-100 dark:border-neutral-800 pt-3">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1.5 mb-2">
              <Users size={13} /> Hisobot kimga ketadi ({data?.oluvchilar.filter(o => o.oladi).length ?? 0} ta)
            </p>
            {(data?.oluvchilar.length ?? 0) === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-xs">Faol admin topilmadi</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {data!.oluvchilar.map(o => (
                  <span
                    key={o.id}
                    className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border ${
                      o.oladi
                        ? 'border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-gray-400'
                        : 'border-amber-200 dark:border-amber-900 text-amber-600 bg-amber-50 dark:bg-amber-950/20'
                    }`}
                  >
                    {!o.oladi && <PhoneOff size={11} />}
                    {o.ism}
                    {o.filialNomi && <span className="text-gray-400">· {o.filialNomi}</span>}
                    <span className="font-mono text-[11px] text-gray-400">
                      {o.telefon || 'raqam yo‘q'}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => { setForma(data!.sozlama); setTelefon(data!.ozTelefon ?? ''); setSozlamaOchiq(false) }}
              className="px-3.5 py-2 rounded-xl border border-gray-300 dark:border-neutral-700 text-sm text-gray-600 dark:text-gray-400"
            >
              Bekor qilish
            </button>
            <button
              onClick={() => void sozlamaSaqla()}
              disabled={saqlanmoqda}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-white text-sm font-medium disabled:opacity-50"
            >
              {saqlanmoqda ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Saqlash
            </button>
          </div>
        </div>
      )}

      {/* Telegram raqami yo'q bo'lsa — hisobot hech kimga bormaydi */}
      {data?.boshqaraOladi && data.oluvchilar.length > 0 &&
        data.oluvchilar.every(o => !o.oladi) && (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20">
          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="text-amber-800 dark:text-amber-300 font-medium">
              Hisobot hozircha hech kimga yuborilmaydi
            </p>
            <p className="text-amber-700/80 dark:text-amber-400/80 text-xs mt-0.5">
              Hech bir adminda Telegram raqami kiritilmagan. Sozlamalar
              (<Settings2 size={11} className="inline" />) tugmasidan o&apos;z raqamingizni kiriting.
            </p>
          </div>
        </div>
      )}

      {yuklanmoqda || !data || !h ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-primary" /></div>
      ) : (
        <>
          {/* Yakuniy raqamlar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Karta
              belgi={<PackageX size={13} className="text-red-600" />}
              sarlavha="Tugagan"
              qiymat={String(h.tugaganSoni)}
              rang="text-red-600"
              izoh="qoldiq nolga tushgan"
            />
            <Karta
              belgi={<AlertTriangle size={13} className="text-amber-600" />}
              sarlavha="Kam qolgan"
              qiymat={String(h.kamQolganSoni)}
              rang="text-amber-600"
              izoh="minimal chegaradan past"
            />
            <Karta
              belgi={<TrendingUp size={13} className="text-green-600" />}
              sarlavha="Kechagi savdo"
              qiymat={formatSum(h.kecha.summa)}
              rang="text-green-600"
              izoh={`${h.kecha.soni} ta chek`}
            />
            <Karta
              belgi={<Clock size={13} className="text-primary" />}
              sarlavha="Yuborish"
              qiymat={data.sozlama.yoqilgan ? `${String(data.sozlama.soat).padStart(2, '0')}:00` : "O'chiq"}
              rang={data.sozlama.yoqilgan ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'}
              izoh={data.sozlama.yoqilgan ? 'har kuni, Telegram' : 'avtomatik yuborilmaydi'}
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* Kam qolgan mahsulotlar */}
            <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <AlertTriangle size={15} className="text-amber-600" />
                  Kam qolgan mahsulotlar
                </span>
                <span className="text-gray-500 dark:text-gray-400 text-xs">{h.kamQolganSoni} ta</span>
              </div>
              {h.kamQolganlar.length === 0 ? (
                <p className="px-4 py-10 text-sm text-gray-500 dark:text-gray-400 text-center">
                  Barcha qoldiqlar yetarli
                </p>
              ) : (
                <div className="overflow-x-auto max-h-[540px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-neutral-800/60 sticky top-0">
                      <tr>
                        <th className="text-left text-gray-500 dark:text-gray-400 text-xs font-medium px-4 py-2.5">Mahsulot</th>
                        <th className="text-right text-gray-500 dark:text-gray-400 text-xs font-medium px-4 py-2.5 whitespace-nowrap">Qoldiq</th>
                        <th className="text-right text-gray-500 dark:text-gray-400 text-xs font-medium px-4 py-2.5 whitespace-nowrap">Minimal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                      {h.kamQolganlar.map(t => (
                        <tr key={t.id} className={t.tugagan ? 'bg-red-50/50 dark:bg-red-950/20' : ''}>
                          <td className="px-4 py-2.5">
                            <p className="text-gray-900 dark:text-gray-100 font-medium">{t.nomi}</p>
                            {t.taminotchi && (
                              <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5 truncate">{t.taminotchi}</p>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right whitespace-nowrap">
                            {t.tugagan ? (
                              <span className="text-[11px] px-2 py-0.5 rounded-md bg-red-600 text-white font-medium">
                                Tugagan
                              </span>
                            ) : (
                              <span className="font-mono tabular-nums font-semibold text-amber-600">
                                {miqdorMatni(t.qoldiq)} {birlikQisqa(t.birlik)}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono tabular-nums text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {t.minimalQoldiq}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Top mahsulotlar */}
            <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Trophy size={15} className="text-amber-500" />
                  Eng ko&apos;p sotilgan mahsulotlar
                </span>
                <div className="flex bg-gray-100 dark:bg-neutral-800 rounded-lg p-0.5 gap-0.5">
                  {DAVRLAR.map(d => (
                    <button
                      key={d.kun}
                      onClick={() => setTopKun(d.kun)}
                      className={`px-2.5 py-2 rounded-md text-xs font-medium transition ${
                        topKun === d.kun
                          ? 'bg-white dark:bg-neutral-700 shadow-sm text-gray-900 dark:text-gray-100'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
              {h.topTovarlar.length === 0 ? (
                <p className="px-4 py-10 text-sm text-gray-500 dark:text-gray-400 text-center">
                  Bu davrda savdo bo&apos;lmagan
                </p>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-neutral-800 max-h-[540px] overflow-y-auto">
                  {h.topTovarlar.map((t, i) => (
                    <div key={t.id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`w-6 h-6 shrink-0 rounded-lg flex items-center justify-center text-[11px] font-bold ${
                            i === 0 ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-600'
                              : i === 1 ? 'bg-gray-100 dark:bg-neutral-800 text-gray-500'
                              : i === 2 ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-600'
                              : 'bg-gray-50 dark:bg-neutral-800/50 text-gray-400'
                          }`}>
                            {i + 1}
                          </span>
                          <span className="text-gray-900 dark:text-gray-100 text-sm font-medium truncate">{t.nomi}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono tabular-nums text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {formatSum(t.summa)}
                          </p>
                          <p className="text-gray-500 dark:text-gray-400 text-[11px]">
                            {miqdorMatni(t.miqdor)} {birlikQisqa(t.birlik)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 h-1.5 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: engKopSumma > 0 ? `${(t.summa / engKopSumma) * 100}%` : '0%' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Yuborilgan hisobotlar tarixi */}
          {data.boshqaraOladi && (
            <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Yuborilgan hisobotlar
                </span>
                <span className="text-gray-500 dark:text-gray-400 text-xs">oxirgi {data.tarix.length} ta</span>
              </div>
              {data.tarix.length === 0 ? (
                <p className="px-4 py-8 text-sm text-gray-500 dark:text-gray-400 text-center">
                  Hali hisobot yuborilmagan
                </p>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-neutral-800 max-h-[320px] overflow-y-auto">
                  {data.tarix.map(t => (
                    <div key={t.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[11px] px-2 py-0.5 rounded-md ${STATUS_RANG[t.status] ?? STATUS_RANG.pending}`}>
                            {STATUS_MATNI[t.status] ?? t.status}
                          </span>
                          <span className="text-gray-900 dark:text-gray-100 text-sm font-medium">{t.kunKaliti}</span>
                          {t.kunKaliti === data.bugun && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">bugun</span>
                          )}
                        </div>
                        {t.xato && (
                          <p className="text-red-500 text-xs mt-0.5 flex items-center gap-1 truncate">
                            <X size={11} className="shrink-0" />{t.xato}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-gray-600 dark:text-gray-400 text-xs">
                          {t.tugaganSoni} tugagan · {t.kamQolganSoni} kam
                        </p>
                        {t.yuborilganSana && (
                          <p className="text-gray-500 dark:text-gray-400 text-[11px]">
                            {formatSanaVaVaqt(t.yuborilganSana)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

const inputCls =
  'w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500'

function Maydon({ label, izoh, children }: { label: string; izoh?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      {children}
      {izoh && <p className="text-gray-500 dark:text-gray-400 text-[11px] mt-1">{izoh}</p>}
    </div>
  )
}

function Karta({ belgi, sarlavha, qiymat, rang, izoh }: {
  belgi: React.ReactNode; sarlavha: string; qiymat: string; rang: string; izoh: string
}) {
  return (
    <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4">
      <p className="text-gray-500 dark:text-gray-400 text-xs font-mono uppercase tracking-wide flex items-center gap-1.5">
        {belgi} {sarlavha}
      </p>
      <p className={`text-xl sm:text-2xl font-bold mt-1 font-mono tabular-nums truncate ${rang}`}>{qiymat}</p>
      <p className="text-gray-500 dark:text-gray-400 text-xs mt-1 truncate">{izoh}</p>
    </div>
  )
}
