'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  ArrowRightLeft, Loader2, Plus, X, Send, History, Package, ChevronDown,
} from 'lucide-react'
import { formatSanaVaVaqt, uzSearch } from '@/lib/utils'
import {
  JOY_LABEL, otkazmaniTekshir, manzilNomi, joydagiQoldiq,
  type OmborJoy, type FilialTanlov,
} from '@/lib/otkazma'
import SearchBar from '@/components/ui/search-bar'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'

interface Filial { id: string; nomi: string; faol: boolean }

interface ManbaTovar {
  id: string
  nomi: string
  birlik: string
  shtrixKod: string | null
  omborQoldiq: number | null
  dokonQoldiq: number | null
}

interface OtkazmaTarkib {
  id: string
  miqdor: string | number
  narx: string | number
  manbaTovar: { nomi: string; birlik: string }
}

interface Otkazma {
  id: string
  manbaJoy: OmborJoy
  qabulJoy: OmborJoy
  izoh: string | null
  sana: string
  manbaFilial: { id: string; nomi: string } | null
  qabulFilial: { id: string; nomi: string } | null
  foydalanuvchi: { ism: string } | null
  tarkiblar: OtkazmaTarkib[]
}

const MARKAZIY = '__markaziy__'
const inputCls = 'w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 transition text-sm'

/** Select qiymati (`__markaziy__` yoki filial id) → API kutadigan `null | id` */
function tanlovdanId(v: string): FilialTanlov {
  return v === MARKAZIY ? null : v
}

export default function OtkazmalarPage() {
  const [filiallar, setFiliallar] = useState<Filial[]>([])
  const [otkazmalar, setOtkazmalar] = useState<Otkazma[]>([])
  const [yuklanmoqda, setYuklanmoqda] = useState(true)
  const [modal, setModal] = useState(false)

  const yukla = useCallback(async () => {
    setYuklanmoqda(true)
    try {
      const [fl, ot] = await Promise.all([
        fetch('/api/filiallar').then(r => r.ok ? r.json() : []).catch(() => []),
        fetch('/api/otkazmalar').then(r => r.ok ? r.json() : []).catch(() => []),
      ])
      setFiliallar(Array.isArray(fl) ? fl : [])
      setOtkazmalar(Array.isArray(ot) ? ot : [])
    } finally {
      setYuklanmoqda(false)
    }
  }, [])

  useEffect(() => { void yukla() }, [yukla])

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <ArrowRightLeft size={22} className="text-primary" />
            Omborlararo o&apos;tkazma
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
            Bir ombordan ikkinchisiga tovar o&apos;tkazish — ikkala tomonning qoldig&apos;i darhol yangilanadi
          </p>
        </div>
        <button
          onClick={() => setModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-medium transition text-sm"
        >
          <Plus size={16} /> Yangi o&apos;tkazma
        </button>
      </div>

      {filiallar.length === 0 && !yuklanmoqda && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/10 p-3 text-sm text-amber-800 dark:text-amber-400">
          Hali filial ochilmagan — hozircha faqat <b>Markaziy ombor</b> ning ombori va do&apos;koni
          o&apos;rtasida o&apos;tkazish mumkin. Filial qo&apos;shsangiz, u ham ro&apos;yxatda chiqadi.
        </div>
      )}

      <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 pt-1">
        <History size={16} className="text-gray-400" /> O&apos;tkazmalar tarixi
      </div>

      {yuklanmoqda ? (
        <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin text-primary" /></div>
      ) : otkazmalar.length === 0 ? (
        <p className="text-center text-gray-500 dark:text-gray-400 py-12 text-sm">
          Hali o&apos;tkazma qilinmagan
        </p>
      ) : (
        <div className="space-y-2">
          {otkazmalar.map(o => <OtkazmaKartochka key={o.id} otkazma={o} />)}
        </div>
      )}

      {modal && (
        <YangiOtkazmaModal
          filiallar={filiallar}
          onYopish={() => setModal(false)}
          onSaqlandi={() => { setModal(false); void yukla() }}
        />
      )}
    </div>
  )
}

// ─── Tarix kartochkasi ───────────────────────────────────────────────────────

function OtkazmaKartochka({ otkazma: o }: { otkazma: Otkazma }) {
  const [ochiq, setOchiq] = useState(false)
  const jamiMiqdor = o.tarkiblar.reduce((s, t) => s + Number(t.miqdor), 0)

  return (
    <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOchiq(v => !v)}
        className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-gray-50 dark:hover:bg-neutral-800/40 transition"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {manzilNomi(o.manbaFilial?.nomi, o.manbaJoy)}
            </span>
            <ArrowRightLeft size={14} className="text-primary shrink-0" />
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {manzilNomi(o.qabulFilial?.nomi, o.qabulJoy)}
            </span>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
            {formatSanaVaVaqt(o.sana)}
            {o.foydalanuvchi && ` · ${o.foydalanuvchi.ism}`}
            {o.izoh && ` · ${o.izoh}`}
          </p>
        </div>
        <div className="text-right shrink-0 flex items-center gap-2">
          <div>
            <p className="text-gray-900 dark:text-gray-100 font-semibold text-sm">{o.tarkiblar.length} ta</p>
            <p className="text-gray-500 dark:text-gray-400 text-xs">{jamiMiqdor} birlik</p>
          </div>
          <ChevronDown size={16} className={`text-gray-400 transition-transform ${ochiq ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {ochiq && (
        <div className="border-t border-gray-100 dark:border-neutral-800 divide-y divide-gray-100 dark:divide-neutral-800">
          {o.tarkiblar.map(t => (
            <div key={t.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
              <span className="text-gray-700 dark:text-gray-300 truncate">{t.manbaTovar.nomi}</span>
              <span className="text-gray-500 dark:text-gray-400 shrink-0 font-mono tabular-nums">
                {Number(t.miqdor)} {t.manbaTovar.birlik.toLowerCase()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Yangi o'tkazma ──────────────────────────────────────────────────────────

function YangiOtkazmaModal({
  filiallar, onYopish, onSaqlandi,
}: { filiallar: Filial[]; onYopish: () => void; onSaqlandi: () => void }) {
  useBodyScrollLock(true)

  const [manbaFilial, setManbaFilial] = useState(MARKAZIY)
  const [qabulFilial, setQabulFilial] = useState(MARKAZIY)
  const [manbaJoy, setManbaJoy] = useState<OmborJoy>('OMBOR')
  const [qabulJoy, setQabulJoy] = useState<OmborJoy>('OMBOR')
  const [izoh, setIzoh] = useState('')

  const [tovarlar, setTovarlar] = useState<ManbaTovar[]>([])
  const [tovarYuklanmoqda, setTovarYuklanmoqda] = useState(false)
  const [qidiruv, setQidiruv] = useState('')
  const [miqdorlar, setMiqdorlar] = useState<Record<string, string>>({})
  const [saqlanmoqda, setSaqlanmoqda] = useState(false)

  // Manba o'zgarganda o'sha ombordagi mahsulotlar qayta yuklanadi.
  // Mavjud /api/ombor endpoint'i Ega uchun filialId parametrini
  // qo'llab-quvvatlaydi va omborQoldiq/dokonQoldiq qaytaradi.
  useEffect(() => {
    let bekor = false
    async function yukla() {
      setTovarYuklanmoqda(true)
      setMiqdorlar({})
      try {
        const fid = tanlovdanId(manbaFilial)
        const qs = fid ? `?filialId=${encodeURIComponent(fid)}` : ''
        const d = await fetch(`/api/ombor${qs}`).then(r => r.ok ? r.json() : [])
        if (!bekor) setTovarlar(Array.isArray(d) ? d : [])
      } catch {
        if (!bekor) toast.error('Mahsulotlar yuklanmadi')
      } finally {
        if (!bekor) setTovarYuklanmoqda(false)
      }
    }
    void yukla()
    return () => { bekor = true }
  }, [manbaFilial])

  // Faqat tanlangan joyda (ombor yoki do'kon) qoldig'i bor mahsulotlar
  const korinadigan = useMemo(() => {
    return tovarlar
      .filter(t => joydagiQoldiq(t, manbaJoy) > 0)
      .filter(t => !qidiruv || uzSearch(t.nomi, qidiruv) || (t.shtrixKod || '').includes(qidiruv))
  }, [tovarlar, manbaJoy, qidiruv])

  const qatorlar = useMemo(() => {
    return Object.entries(miqdorlar)
      .map(([tovarId, v]) => {
        const t = tovarlar.find(x => x.id === tovarId)
        return {
          tovarId,
          miqdor: parseFloat(v) || 0,
          mavjud: t ? joydagiQoldiq(t, manbaJoy) : 0,
        }
      })
      .filter(q => q.miqdor > 0)
  }, [miqdorlar, tovarlar, manbaJoy])

  const tekshiruv = otkazmaniTekshir({
    manbaFilialId: tanlovdanId(manbaFilial),
    qabulFilialId: tanlovdanId(qabulFilial),
    manbaJoy, qabulJoy, qatorlar,
  })

  async function saqla() {
    if (!tekshiruv.ok) { toast.error(tekshiruv.xato!); return }
    setSaqlanmoqda(true)
    try {
      const res = await fetch('/api/otkazmalar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manbaFilialId: tanlovdanId(manbaFilial),
          qabulFilialId: tanlovdanId(qabulFilial),
          manbaJoy, qabulJoy, izoh,
          tarkiblar: qatorlar.map(q => ({ tovarId: q.tovarId, miqdor: q.miqdor })),
        }),
      })
      const d = await res.json()
      if (!res.ok) { toast.error(d.xato || "O'tkazma amalga oshmadi"); return }
      toast.success(
        `${d.qatorlar} ta mahsulot o'tkazildi` +
        (d.yangiTovarSoni > 0 ? ` (${d.yangiTovarSoni} tasi qabul omborda yangi yaratildi)` : ''),
      )
      onSaqlandi()
    } finally {
      setSaqlanmoqda(false)
    }
  }

  const filialTanlov = (qiymat: string, ozgartir: (v: string) => void) => (
    <select value={qiymat} onChange={e => ozgartir(e.target.value)} className={inputCls}>
      <option value={MARKAZIY}>Markaziy ombor</option>
      {filiallar.map(f => (
        <option key={f.id} value={f.id}>{f.nomi}{f.faol ? '' : ' (nofaol)'}</option>
      ))}
    </select>
  )

  const joyTanlov = (qiymat: OmborJoy, ozgartir: (v: OmborJoy) => void) => (
    <div className="grid grid-cols-2 gap-1.5">
      {(['OMBOR', 'DOKON'] as const).map(j => (
        <button
          key={j}
          type="button"
          onClick={() => ozgartir(j)}
          className={`py-2 rounded-xl text-xs font-medium border transition ${
            qiymat === j
              ? 'bg-primary border-primary text-white'
              : 'bg-white dark:bg-neutral-900 border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400'
          }`}
        >
          {JOY_LABEL[j]}
        </button>
      ))}
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:pb-4">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl dark:border dark:border-neutral-800 w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="p-5 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between shrink-0">
          <h3 className="text-gray-900 dark:text-gray-100 font-semibold">Yangi o&apos;tkazma</h3>
          <button onClick={onYopish} className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-gray-700 dark:text-gray-300 text-sm font-medium block">Qayerdan</label>
              {filialTanlov(manbaFilial, setManbaFilial)}
              {joyTanlov(manbaJoy, setManbaJoy)}
            </div>
            <div className="space-y-2">
              <label className="text-gray-700 dark:text-gray-300 text-sm font-medium block">Qayerga</label>
              {filialTanlov(qabulFilial, setQabulFilial)}
              {joyTanlov(qabulJoy, setQabulJoy)}
            </div>
          </div>

          <div>
            <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">
              Izoh <span className="text-gray-400 font-normal">(ixtiyoriy)</span>
            </label>
            <input value={izoh} onChange={e => setIzoh(e.target.value)}
              placeholder="masalan: haftalik tarqatish" className={inputCls} />
          </div>

          <div className="border-t border-gray-100 dark:border-neutral-800 pt-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-gray-700 dark:text-gray-300 text-sm font-medium flex items-center gap-1.5">
                <Package size={15} /> Mahsulotlar
              </span>
              {qatorlar.length > 0 && (
                <span className="text-xs text-primary font-medium">{qatorlar.length} ta tanlandi</span>
              )}
            </div>
            <SearchBar value={qidiruv} onChange={setQidiruv} placeholder="Mahsulot nomi yoki shtrix-kod..." />

            {tovarYuklanmoqda ? (
              <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-primary" /></div>
            ) : korinadigan.length === 0 ? (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8 text-sm">
                {qidiruv
                  ? 'Hech narsa topilmadi'
                  : `${JOY_LABEL[manbaJoy]}da qoldiqli mahsulot yo'q`}
              </p>
            ) : (
              <div className="border border-gray-200 dark:border-neutral-800 rounded-xl divide-y divide-gray-100 dark:divide-neutral-800 max-h-64 overflow-y-auto">
                {korinadigan.map(t => {
                  const mavjud = joydagiQoldiq(t, manbaJoy)
                  const xatoli = tekshiruv.xatoTovarlar.includes(t.id)
                  return (
                    <div key={t.id} className="px-3 py-2.5 flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-gray-900 dark:text-gray-100 text-sm truncate">{t.nomi}</p>
                        <p className="text-gray-500 dark:text-gray-400 text-xs">
                          Mavjud: {mavjud} {t.birlik.toLowerCase()}
                        </p>
                      </div>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={miqdorlar[t.id] || ''}
                        onChange={e => {
                          const v = e.target.value.replace(/[^0-9.]/g, '')
                          setMiqdorlar(p => ({ ...p, [t.id]: v }))
                        }}
                        placeholder="0"
                        className={`w-20 px-2 py-1.5 text-sm text-right rounded-lg border focus:outline-none focus:ring-1 tabular-nums ${
                          xatoli
                            ? 'border-red-400 ring-red-400 text-red-600'
                            : 'border-gray-200 dark:border-neutral-700 focus:ring-primary text-gray-900 dark:text-gray-100'
                        } bg-gray-50 dark:bg-neutral-800`}
                      />
                      <button
                        type="button"
                        onClick={() => setMiqdorlar(p => ({ ...p, [t.id]: String(mavjud) }))}
                        className="text-[11px] text-primary hover:underline shrink-0"
                      >
                        hammasi
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="p-5 border-t border-gray-200 dark:border-neutral-800 shrink-0 space-y-2">
          {!tekshiruv.ok && qatorlar.length > 0 && (
            <p className="text-xs text-red-600">{tekshiruv.xato}</p>
          )}
          <div className="flex gap-3">
            <button type="button" onClick={onYopish}
              className="flex-1 py-2.5 border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition font-medium">
              Bekor
            </button>
            <button
              type="button"
              onClick={saqla}
              disabled={saqlanmoqda || !tekshiruv.ok}
              title={tekshiruv.xato ?? undefined}
              className="flex-1 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-60 text-white rounded-xl font-medium transition flex items-center justify-center gap-2"
            >
              {saqlanmoqda ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              O&apos;tkazish
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
