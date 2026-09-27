'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowRight, ArrowRightLeft, Loader2, Plus, X, Send, History, Package, ChevronDown, Warehouse,
} from 'lucide-react'
import { formatSanaVaVaqt, uzSearch } from '@/lib/utils'
import {
  JOY_LABEL, otkazmaniTekshir, manzilNomi, omborSarlavhasi, joydagiQoldiq, qabulJuftiniTop,
  type OmborJoy,
} from '@/lib/otkazma'
import SearchBar from '@/components/ui/search-bar'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'

/** `/api/otkazmalar/manzillar` qaytaradigan manzil */
interface Manzil {
  filialId: string | null
  filialNomi: string | null
  omborId: string | null
  omborNomi: string | null
  faol: boolean
  tovarSoni: number
}

interface OmbordagiTovar {
  id: string
  nomi: string
  birlik: string
  shtrixKod: string | null
  omborQoldiq: number | null
  dokonQoldiq: number | null
  kategoriya: { omborId: string | null } | null
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
  manbaOmbor: { id: string; nomi: string } | null
  qabulOmbor: { id: string; nomi: string } | null
  foydalanuvchi: { ism: string } | null
  tarkiblar: OtkazmaTarkib[]
}

const inputCls = 'w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 transition text-sm'

// Select qiymati: "filialId|omborId" (bo'sh qism — null)
const manzilKaliti = (m: { filialId: string | null; omborId: string | null }) =>
  `${m.filialId ?? ''}|${m.omborId ?? ''}`

const manzilSarlavhasi = (m: Manzil) => omborSarlavhasi(m.filialNomi, m.omborNomi)

export default function OtkazmalarPage() {
  const [manzillar, setManzillar] = useState<Manzil[]>([])
  const [otkazmalar, setOtkazmalar] = useState<Otkazma[]>([])
  const [yuklanmoqda, setYuklanmoqda] = useState(true)
  const [modal, setModal] = useState(false)

  const yukla = useCallback(async () => {
    setYuklanmoqda(true)
    try {
      const [mz, ot] = await Promise.all([
        fetch('/api/otkazmalar/manzillar').then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/otkazmalar').then(r => r.ok ? r.json() : []).catch(() => []),
      ])
      if (!mz) toast.error("Omborlar ro'yxati yuklanmadi")
      setManzillar(Array.isArray(mz?.manzillar) ? mz.manzillar : [])
      setOtkazmalar(Array.isArray(ot) ? ot : [])
    } finally {
      setYuklanmoqda(false)
    }
  }, [])

  useEffect(() => { void yukla() }, [yukla])

  const nomliOmborSoni = manzillar.filter(m => m.omborId).length

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
          disabled={yuklanmoqda || manzillar.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-60 text-white rounded-xl font-medium transition text-sm"
        >
          <Plus size={16} /> Yangi o&apos;tkazma
        </button>
      </div>

      {!yuklanmoqda && manzillar.length > 0 && nomliOmborSoni === 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/10 p-3 text-sm text-amber-800 dark:text-amber-400">
          Hali ombor yaratilmagan — hozircha faqat <b>Markaziy ombor</b>ning zaxirasi va do&apos;koni
          o&apos;rtasida o&apos;tkazish mumkin.{' '}
          <Link href="/omborlar" className="font-medium underline underline-offset-2">Omborlar</Link>{' '}
          sahifasida ombor qo&apos;shsangiz, u shu yerda chiqadi.
        </div>
      )}

      {!yuklanmoqda && manzillar.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {manzillar.map(m => (
            <span
              key={manzilKaliti(m)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-2.5 py-1.5 text-xs text-gray-700 dark:text-gray-300"
            >
              <Warehouse size={13} className="text-primary" />
              {manzilSarlavhasi(m)}
              <span className="text-gray-400 tabular-nums">· {m.tovarSoni} mahsulot</span>
            </span>
          ))}
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
          manzillar={manzillar}
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
              {manzilNomi(o.manbaFilial?.nomi, o.manbaJoy, o.manbaOmbor?.nomi)}
            </span>
            <ArrowRight size={14} className="text-primary shrink-0" />
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {manzilNomi(o.qabulFilial?.nomi, o.qabulJoy, o.qabulOmbor?.nomi)}
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

/** Bitta filial doirasining (null — markaziy katalog) mahsulotlari va qoldig'i. */
async function doiraTovarlari(filialId: string | null): Promise<OmbordagiTovar[]> {
  const qs = filialId ? `?filialId=${encodeURIComponent(filialId)}` : ''
  const r = await fetch(`/api/ombor${qs}`)
  if (!r.ok) throw new Error('yuklanmadi')
  const d = await r.json()
  return Array.isArray(d) ? d : []
}

const omborda = (t: OmbordagiTovar, omborId: string | null) => (t.kategoriya?.omborId ?? null) === omborId

function YangiOtkazmaModal({
  manzillar, onYopish, onSaqlandi,
}: { manzillar: Manzil[]; onYopish: () => void; onSaqlandi: () => void }) {
  useBodyScrollLock(true)

  // Boshlang'ich tanlov: mahsuloti bor birinchi manzil → undan boshqa birinchisi
  const [manbaKalit, setManbaKalit] = useState(() =>
    manzilKaliti(manzillar.find(m => m.tovarSoni > 0) ?? manzillar[0]))
  const [qabulKalit, setQabulKalit] = useState(() =>
    manzilKaliti(manzillar.find(m => manzilKaliti(m) !== manbaKalit) ?? manzillar[0]))
  // Kirimlar odatda do'konga yoziladi — sotiladigan qoldiq shu yerda
  const [manbaJoy, setManbaJoy] = useState<OmborJoy>('DOKON')
  const [qabulJoy, setQabulJoy] = useState<OmborJoy>('DOKON')
  const [izoh, setIzoh] = useState('')

  const manba = manzillar.find(m => manzilKaliti(m) === manbaKalit) ?? manzillar[0]
  const qabul = manzillar.find(m => manzilKaliti(m) === qabulKalit) ?? manzillar[0]

  // Mahsulotlar filial doirasi bo'yicha keshlanadi: bir katalog ichidagi
  // omborlar almashtirilganda qayta so'rov yuborilmaydi.
  const [doiralar, setDoiralar] = useState<Record<string, OmbordagiTovar[]>>({})
  const soralgan = useRef(new Set<string>())
  const [qidiruv, setQidiruv] = useState('')
  const [miqdorlar, setMiqdorlar] = useState<Record<string, string>>({})
  const [saqlanmoqda, setSaqlanmoqda] = useState(false)

  useEffect(() => {
    for (const filialId of new Set([manba.filialId, qabul.filialId])) {
      const k = filialId ?? ''
      if (soralgan.current.has(k)) continue
      soralgan.current.add(k)
      doiraTovarlari(filialId)
        .then(list => setDoiralar(d => ({ ...d, [k]: list })))
        .catch(() => {
          toast.error('Mahsulotlar yuklanmadi')
          setDoiralar(d => ({ ...d, [k]: [] }))
        })
    }
  }, [manba.filialId, qabul.filialId])

  // Manba o'zgarsa kiritilgan miqdorlar boshqa omborga tegishli bo'lib qoladi
  const manbaniTanla = (kalit: string) => { setManbaKalit(kalit); setMiqdorlar({}) }
  const manbaJoyiniTanla = (joy: OmborJoy) => { setManbaJoy(joy); setMiqdorlar({}) }

  const manbaTovarlari = useMemo(
    () => (doiralar[manba.filialId ?? ''] ?? []).filter(t => omborda(t, manba.omborId)),
    [doiralar, manba.filialId, manba.omborId],
  )
  const qabulTovarlari = useMemo(
    () => (doiralar[qabul.filialId ?? ''] ?? []).filter(t => omborda(t, qabul.omborId)),
    [doiralar, qabul.filialId, qabul.omborId],
  )
  const tovarYuklanmoqda = !doiralar[manba.filialId ?? '']
  const ichki = manbaKalit === qabulKalit

  // Tanlangan joyda qoldig'i bor mahsulotlar
  const qoldiqlilar = useMemo(
    () => manbaTovarlari.filter(t => joydagiQoldiq(t, manbaJoy) > 0),
    [manbaTovarlari, manbaJoy],
  )
  const korinadigan = useMemo(
    () => qoldiqlilar.filter(t => !qidiruv || uzSearch(t.nomi, qidiruv) || (t.shtrixKod || '').includes(qidiruv)),
    [qoldiqlilar, qidiruv],
  )
  const boshqaJoy: OmborJoy = manbaJoy === 'OMBOR' ? 'DOKON' : 'OMBOR'
  const boshqaJoydagiSoni = manbaTovarlari.filter(t => joydagiQoldiq(t, boshqaJoy) > 0).length

  /** Qabul omborida nima bo'ladi: ustiga qo'shiladi / yangi yaratiladi. */
  const juftlar = useMemo(() => {
    const m = new Map<string, OmbordagiTovar | null>()
    for (const t of manbaTovarlari) m.set(t.id, ichki ? t : qabulJuftiniTop(t, qabulTovarlari))
    return m
  }, [manbaTovarlari, qabulTovarlari, ichki])

  const qatorlar = useMemo(() => {
    return Object.entries(miqdorlar)
      .map(([tovarId, v]) => {
        const t = manbaTovarlari.find(x => x.id === tovarId)
        return {
          tovarId,
          miqdor: parseFloat(v) || 0,
          mavjud: t ? joydagiQoldiq(t, manbaJoy) : 0,
        }
      })
      .filter(q => q.miqdor > 0)
  }, [miqdorlar, manbaTovarlari, manbaJoy])
  const yangiSoni = qatorlar.filter(q => !juftlar.get(q.tovarId)).length

  const tekshiruv = otkazmaniTekshir({
    manbaFilialId: manba.filialId,
    qabulFilialId: qabul.filialId,
    manbaOmborId: manba.omborId,
    qabulOmborId: qabul.omborId,
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
          manbaFilialId: manba.filialId,
          qabulFilialId: qabul.filialId,
          manbaOmborId: manba.omborId,
          qabulOmborId: qabul.omborId,
          manbaJoy, qabulJoy, izoh,
          tarkiblar: qatorlar.map(q => ({ tovarId: q.tovarId, miqdor: q.miqdor })),
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(d.xato || "O'tkazma amalga oshmadi"); return }
      toast.success(
        `${d.qatorlar} ta mahsulot «${manzilSarlavhasi(qabul)}» ga o'tkazildi` +
        (d.yangiTovarSoni > 0 ? ` (${d.yangiTovarSoni} tasi u yerda yangi yaratildi)` : ''),
      )
      onSaqlandi()
    } finally {
      setSaqlanmoqda(false)
    }
  }

  const filialBor = manzillar.some(m => m.filialId)
  const variant = (m: Manzil) => (
    <option key={manzilKaliti(m)} value={manzilKaliti(m)}>
      {filialBor ? (m.omborNomi || 'Omborga biriktirilmagan') : manzilSarlavhasi(m)}
      {` — ${m.tovarSoni} mahsulot`}{m.faol ? '' : ' (nofaol)'}
    </option>
  )
  // Filiallar bo'lsa har doira alohida guruh; bo'lmasa oddiy ro'yxat
  const manzilTanlov = (id: string, qiymat: string, ozgartir: (v: string) => void) => (
    <select id={id} value={qiymat} onChange={e => ozgartir(e.target.value)} className={inputCls}>
      {filialBor
        ? Array.from(new Set(manzillar.map(m => m.filialId ?? ''))).map(fid => {
            const guruh = manzillar.filter(m => (m.filialId ?? '') === fid)
            return (
              <optgroup key={fid || 'markaziy'} label={guruh[0].filialNomi || 'Markaziy'}>
                {guruh.map(variant)}
              </optgroup>
            )
          })
        : manzillar.map(variant)}
    </select>
  )

  const joyTanlov = (qiymat: OmborJoy, ozgartir: (v: OmborJoy) => void) => (
    <div className="space-y-1">
      <p className="text-[11px] text-gray-500 dark:text-gray-400">Qoldiq joyi</p>
      <div className="grid grid-cols-2 gap-1.5">
        {(['OMBOR', 'DOKON'] as const).map(j => (
          <button
            key={j}
            type="button"
            onClick={() => ozgartir(j)}
            aria-pressed={qiymat === j}
            title={j === 'OMBOR' ? 'Zaxira — sotuvga chiqarilmagan qoldiq' : "Do'kon — kassada sotiladigan qoldiq"}
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
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div role="dialog" aria-modal="true" aria-label="Yangi o'tkazma" className="bg-white dark:bg-neutral-900 rounded-t-2xl sm:rounded-2xl shadow-xl dark:border dark:border-neutral-800 w-full max-w-2xl max-h-[calc(100dvh-0.75rem)] sm:max-h-[90dvh] flex flex-col">
        <div className="p-5 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between shrink-0">
          <h3 className="text-gray-900 dark:text-gray-100 font-semibold">Yangi o&apos;tkazma</h3>
          <button onClick={onYopish} aria-label="Yopish" className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="otkazma-manba" className="text-gray-700 dark:text-gray-300 text-sm font-medium block">Qayerdan</label>
              {manzilTanlov('otkazma-manba', manbaKalit, manbaniTanla)}
              {joyTanlov(manbaJoy, manbaJoyiniTanla)}
            </div>
            <div className="space-y-2">
              <label htmlFor="otkazma-qabul" className="text-gray-700 dark:text-gray-300 text-sm font-medium block">Qayerga</label>
              {manzilTanlov('otkazma-qabul', qabulKalit, setQabulKalit)}
              {joyTanlov(qabulJoy, setQabulJoy)}
            </div>
          </div>

          <div>
            <label htmlFor="otkazma-izoh" className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">
              Izoh <span className="text-gray-400 font-normal">(ixtiyoriy)</span>
            </label>
            <input id="otkazma-izoh" value={izoh} onChange={e => setIzoh(e.target.value)}
              placeholder="masalan: haftalik tarqatish" className={inputCls} />
          </div>

          <div className="border-t border-gray-100 dark:border-neutral-800 pt-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-gray-700 dark:text-gray-300 text-sm font-medium flex items-center gap-1.5 min-w-0">
                <Package size={15} className="shrink-0" />
                <span className="truncate">«{manzilSarlavhasi(manba)}» dagi mahsulotlar</span>
              </span>
              {qatorlar.length > 0 && (
                <span className="text-xs text-primary font-medium shrink-0">{qatorlar.length} ta tanlandi</span>
              )}
            </div>
            <SearchBar value={qidiruv} onChange={setQidiruv} placeholder="Mahsulot nomi yoki shtrix-kod..." />

            {tovarYuklanmoqda ? (
              <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-primary" /></div>
            ) : korinadigan.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8 text-sm space-y-2">
                {qidiruv ? (
                  <p>Hech narsa topilmadi</p>
                ) : manbaTovarlari.length === 0 ? (
                  <p>Bu omborda mahsulot yo&apos;q</p>
                ) : (
                  <>
                    <p>{JOY_LABEL[manbaJoy]}da qoldig&apos;i bor mahsulot yo&apos;q</p>
                    {boshqaJoydagiSoni > 0 && (
                      <button
                        type="button"
                        onClick={() => manbaJoyiniTanla(boshqaJoy)}
                        className="text-primary font-medium hover:underline"
                      >
                        {JOY_LABEL[boshqaJoy]}da {boshqaJoydagiSoni} ta mahsulot bor — o&apos;tish
                      </button>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="border border-gray-200 dark:border-neutral-800 rounded-xl divide-y divide-gray-100 dark:divide-neutral-800 max-h-72 overflow-y-auto">
                {korinadigan.map(t => {
                  const mavjud = joydagiQoldiq(t, manbaJoy)
                  const xatoli = tekshiruv.xatoTovarlar.includes(t.id)
                  const birlik = t.birlik.toLowerCase()
                  const juft = juftlar.get(t.id)
                  const tanlangan = (parseFloat(miqdorlar[t.id] || '') || 0) > 0
                  return (
                    <div key={t.id} className={`px-3 py-2.5 flex items-center gap-3 ${tanlangan ? 'bg-primary/5' : ''}`}>
                      <div className="min-w-0 flex-1">
                        <p className="text-gray-900 dark:text-gray-100 text-sm truncate">{t.nomi}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-x-2">
                          <span className="tabular-nums">Mavjud: {mavjud} {birlik}</span>
                          {!ichki && (juft ? (
                            <span className="text-emerald-700 dark:text-emerald-400">
                              → bor, ustiga qo&apos;shiladi (hozir {joydagiQoldiq(juft, qabulJoy)} {birlik})
                            </span>
                          ) : (
                            <span className="text-blue-600 dark:text-blue-400">→ u yerda yangi yaratiladi</span>
                          ))}
                        </p>
                      </div>
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label={`${t.nomi} — o'tkaziladigan miqdor`}
                        value={miqdorlar[t.id] || ''}
                        onChange={e => {
                          const v = e.target.value.replace(',', '.').replace(/[^0-9.]/g, '')
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

        <div className="p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5 border-t border-gray-200 dark:border-neutral-800 shrink-0 space-y-2">
          {qatorlar.length > 0 && (tekshiruv.ok ? (
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {qatorlar.length} ta mahsulot «{manzilSarlavhasi(manba)}» dan ayiriladi va «{manzilSarlavhasi(qabul)}» ga qo&apos;shiladi
              {!ichki && yangiSoni > 0 && ` — ${yangiSoni} tasi u yerda yangi yaratiladi`}
            </p>
          ) : (
            <p className="text-xs text-red-600">{tekshiruv.xato}</p>
          ))}
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
