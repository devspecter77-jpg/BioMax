'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import {
  MapPin, Loader2, Building, Users, RefreshCw, Crosshair, Check, X,
  Truck, ExternalLink, Search,
} from 'lucide-react'
import { formatPhone } from '@/lib/utils'
import type { XaritaNuqta, Yangilik } from '@/components/Xarita'
import { googleSputnik, koordinataTogrimi } from '@/lib/xarita-havola'
import { vaqtMatni, yangilikAniqla } from '@/lib/lokatsiya-vaqt'

// Leaflet `window` ga tayanadi — serverda render qilib bo'lmaydi.
const Xarita = dynamic(() => import('@/components/Xarita'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-gray-100 dark:bg-neutral-800">
      <Loader2 size={22} className="animate-spin text-primary" />
    </div>
  ),
})

interface Filial {
  id: string; nomi: string; manzil: string | null; telefon: string | null
  faol: boolean; lokatsiyaLat: number | null; lokatsiyaLng: number | null
  _count: { xodimlar: number }
}

interface Xodim {
  id: string; ism: string; rol: string; telefon: string | null; faol: boolean
  lokatsiyaLat: number | null; lokatsiyaLng: number | null
  lokatsiyaYangilangan: string | null
  filial: { id: string; nomi: string } | null
}

interface XaritaMijoz {
  id: string; ism: string; telefon: string | null; manzil: string | null
  viloyat: string | null; tuman: string | null
  lokatsiyaLat: number | null; lokatsiyaLng: number | null
}

interface XaritaTaminotchi {
  id: string; nomi: string; telefon: string | null; manzil: string | null
  kontaktShaxs: string | null
  lokatsiyaLat: number | null; lokatsiyaLng: number | null
}

/** Xarita shu oraliqda o'zi yangilanadi. */
const YANGILANISH_MS = 15_000

// Xarita komponentidagi ranglar bilan MOS bo'lishi shart —
// legendada bir rang, xaritada boshqa rang chalkashtirib yuboradi.
const YANGILIK_RANG: Record<Yangilik, string> = {
  jonli: 'bg-green-600',
  yaqin: 'bg-lime-600',
  eski: 'bg-gray-400',
}
const YANGILIK_LABEL: Record<Yangilik, string> = {
  jonli: 'Harakatda',
  yaqin: 'Yaqinda',
  eski: 'Ilova yopiq',
}

// ─── Ko'rinishlar ────────────────────────────────────────────────────────────
// Har bir guruh uchun ALOHIDA xarita: "faqat mijozlar", "faqat xodimlar",
// "faqat ta'minotchilar". Bitta ekranda hammasi aralashib ketganda kerakli
// nuqtani topish qiyin edi.
type Korinish = 'hammasi' | 'xodim' | 'mijoz' | 'taminotchi' | 'filial'

const KORINISHLAR: { kalit: Korinish; label: string; rang: string }[] = [
  { kalit: 'hammasi', label: 'Hammasi', rang: 'bg-gray-400' },
  { kalit: 'xodim', label: 'Xodimlar', rang: 'bg-green-600' },
  { kalit: 'mijoz', label: 'Mijozlar', rang: 'bg-red-600' },
  { kalit: 'taminotchi', label: "Ta'minotchilar", rang: 'bg-amber-600' },
  { kalit: 'filial', label: 'Filiallar', rang: 'bg-indigo-600' },
]

/** Ro'yxat qatoridagi "Google sputnikda ochish" tugmasi. */
function GoogleTugma({ lat, lng, nomi }: { lat: number; lng: number; nomi: string }) {
  return (
    <a
      href={googleSputnik(lat, lng)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      title={`${nomi} — Google sputnikda ochish`}
      aria-label={`${nomi} — Google sputnikda ochish`}
      className="shrink-0 p-2 text-gray-400 hover:text-primary hover:bg-primary-light dark:hover:bg-primary/10 rounded-lg transition"
    >
      <ExternalLink size={14} />
    </a>
  )
}

export default function XaritaPage() {
  const [filiallar, setFiliallar] = useState<Filial[]>([])
  const [mijozlar, setMijozlar] = useState<XaritaMijoz[]>([])
  const [xodimlar, setXodimlar] = useState<Xodim[]>([])
  const [taminotchilar, setTaminotchilar] = useState<XaritaTaminotchi[]>([])
  const [hozir, setHozir] = useState(() => Date.now())
  const [yuklanmoqda, setYuklanmoqda] = useState(true)
  const [fokus, setFokus] = useState<string | null>(null)
  const [korinish, setKorinish] = useState<Korinish>('hammasi')
  const [qidiruv, setQidiruv] = useState('')
  // Filial joylashuvini xaritadan belgilash rejimi
  const [belgilash, setBelgilash] = useState<Filial | null>(null)
  const [saqlanmoqda, setSaqlanmoqda] = useState(false)
  const birinchiRef = useRef(true)

  const yukla = useCallback(async () => {
    if (birinchiRef.current) setYuklanmoqda(true)
    try {
      const r = await fetch('/api/xarita')
      if (!r.ok) {
        if (birinchiRef.current) toast.error("Ma'lumot yuklanmadi")
        return
      }
      const d = await r.json()
      setFiliallar(d.filiallar || [])
      setXodimlar(d.xodimlar || [])
      setMijozlar(d.mijozlar || [])
      setTaminotchilar(d.taminotchilar || [])
      setHozir(d.hozir ? new Date(d.hozir).getTime() : Date.now())
    } catch {
      if (birinchiRef.current) toast.error('Tarmoq xatosi')
    } finally {
      setYuklanmoqda(false)
      birinchiRef.current = false
    }
  }, [])

  useEffect(() => {
    void yukla()
    const t = setInterval(() => { void yukla() }, YANGILANISH_MS)
    return () => clearInterval(t)
  }, [yukla])

  const q = qidiruv.trim().toLowerCase()
  const mos = useCallback(
    (...maydonlar: (string | null | undefined)[]) =>
      !q || maydonlar.some(m => (m ?? '').toLowerCase().includes(q)),
    [q],
  )

  const korXodimlar = useMemo(
    () => xodimlar.filter(x => mos(x.ism, x.filial?.nomi, x.telefon)),
    [xodimlar, mos])
  const korMijozlar = useMemo(
    () => mijozlar.filter(m => mos(m.ism, m.manzil, m.viloyat, m.tuman, m.telefon)),
    [mijozlar, mos])
  const korTaminotchilar = useMemo(
    () => taminotchilar.filter(t => mos(t.nomi, t.manzil, t.kontaktShaxs, t.telefon)),
    [taminotchilar, mos])
  const korFiliallar = useMemo(
    () => filiallar.filter(f => mos(f.nomi, f.manzil)),
    [filiallar, mos])

  const korsatilsin = useCallback(
    (t: Korinish) => korinish === 'hammasi' || korinish === t,
    [korinish])

  const nuqtalar = useMemo<XaritaNuqta[]>(() => {
    const natija: XaritaNuqta[] = []

    if (korsatilsin('filial')) {
      for (const f of korFiliallar) {
        if (!koordinataTogrimi(f.lokatsiyaLat, f.lokatsiyaLng)) continue
        natija.push({
          id: 'f:' + f.id,
          lat: f.lokatsiyaLat!, lng: f.lokatsiyaLng!,
          nomi: f.nomi,
          tavsif: [f.manzil, `${f._count.xodimlar} xodim`].filter(Boolean).join(' · '),
          turi: 'filial',
        })
      }
    }

    if (korsatilsin('xodim')) {
      for (const x of korXodimlar) {
        if (!koordinataTogrimi(x.lokatsiyaLat, x.lokatsiyaLng)) continue
        natija.push({
          id: 'x:' + x.id,
          lat: x.lokatsiyaLat!, lng: x.lokatsiyaLng!,
          nomi: x.ism,
          tavsif: [x.rol, x.filial?.nomi ?? 'Markaziy'].join(' · '),
          turi: 'xodim',
          yangilik: yangilikAniqla(x.lokatsiyaYangilangan, hozir),
          vaqtMatni: vaqtMatni(x.lokatsiyaYangilangan, hozir),
        })
      }
    }

    if (korsatilsin('mijoz')) {
      for (const m of korMijozlar) {
        if (!koordinataTogrimi(m.lokatsiyaLat, m.lokatsiyaLng)) continue
        natija.push({
          id: 'm:' + m.id,
          lat: m.lokatsiyaLat!, lng: m.lokatsiyaLng!,
          nomi: m.ism,
          tavsif: [m.manzil, [m.viloyat, m.tuman].filter(Boolean).join(', '), m.telefon]
            .filter(Boolean).join(' · ') || null,
          turi: 'mijoz',
        })
      }
    }

    if (korsatilsin('taminotchi')) {
      for (const t of korTaminotchilar) {
        if (!koordinataTogrimi(t.lokatsiyaLat, t.lokatsiyaLng)) continue
        natija.push({
          id: 't:' + t.id,
          lat: t.lokatsiyaLat!, lng: t.lokatsiyaLng!,
          nomi: t.nomi,
          tavsif: [t.kontaktShaxs, t.manzil, t.telefon].filter(Boolean).join(' · ') || null,
          turi: 'taminotchi',
        })
      }
    }

    return natija
  }, [korFiliallar, korXodimlar, korMijozlar, korTaminotchilar, hozir, korsatilsin])

  const joylashuvsizFilial = filiallar.filter(f => !koordinataTogrimi(f.lokatsiyaLat, f.lokatsiyaLng))

  async function filialJoylashuviniSaqla(filial: Filial, lat: number, lng: number) {
    setSaqlanmoqda(true)
    try {
      const r = await fetch(`/api/filiallar/${filial.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nomi: filial.nomi, manzil: filial.manzil, telefon: filial.telefon,
          faol: filial.faol, lokatsiyaLat: lat, lokatsiyaLng: lng,
        }),
      })
      if (!r.ok) { toast.error('Saqlanmadi'); return }
      toast.success(`${filial.nomi} xaritada belgilandi`)
      setBelgilash(null)
      birinchiRef.current = false
      await yukla()
    } finally {
      setSaqlanmoqda(false)
    }
  }

  const jonliSoni = xodimlar.filter(
    x => yangilikAniqla(x.lokatsiyaYangilangan, hozir) === 'jonli',
  ).length

  const sonlar: Record<Korinish, number> = {
    hammasi: nuqtalar.length,
    xodim: korXodimlar.length,
    mijoz: korMijozlar.length,
    taminotchi: korTaminotchilar.length,
    filial: korFiliallar.length,
  }

  return (
    <div className="flex flex-col gap-3 lg:h-full">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <MapPin size={22} className="text-primary" />
            Xarita
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
            Xodim, mijoz, ta&apos;minotchi va filiallar — har {YANGILANISH_MS / 1000} soniyada yangilanadi
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
            {jonliSoni} ta harakatda
          </span>
          <button
            onClick={() => { birinchiRef.current = false; void yukla() }}
            className="p-2.5 rounded-xl border border-gray-300 dark:border-neutral-700 text-gray-500 hover:text-primary hover:border-primary/50 transition"
            title="Yangilash"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Ko'rinish tanlash — har guruh uchun alohida xarita */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {KORINISHLAR.map(k => (
          <button
            key={k.kalit}
            onClick={() => { setKorinish(k.kalit); setFokus(null) }}
            className={`shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium transition whitespace-nowrap ${
              korinish === k.kalit
                ? 'bg-gray-800 dark:bg-neutral-200 text-white dark:text-neutral-900'
                : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700'
            }`}
          >
            {k.kalit !== 'hammasi' && <span className={`w-2 h-2 rounded-full ${k.rang}`} />}
            {k.label} ({sonlar[k.kalit]})
          </button>
        ))}
      </div>

      {/* Belgilash rejimi — xaritaga bosish kutilyapti */}
      {belgilash && (
        <div className="rounded-xl border border-primary/40 bg-primary-light dark:bg-primary/10 p-3 flex items-center justify-between gap-3 text-sm">
          <span className="text-primary font-medium flex items-center gap-2 min-w-0">
            <Crosshair size={16} className="shrink-0" />
            <span className="truncate">
              <b>{belgilash.nomi}</b> ni joylashtirish — xaritada kerakli joyni bosing
            </span>
          </span>
          <button
            onClick={() => setBelgilash(null)}
            aria-label="Belgilashni bekor qilish"
            className="p-1.5 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-3 lg:flex-1 lg:min-h-0">
        {/* Xarita */}
        <div className="flex-1 min-w-0 rounded-2xl overflow-hidden border border-gray-200 dark:border-neutral-800 h-[55vh] lg:h-auto relative">
          {yuklanmoqda ? (
            <div className="h-full flex items-center justify-center bg-gray-100 dark:bg-neutral-800">
              <Loader2 size={22} className="animate-spin text-primary" />
            </div>
          ) : (
            <Xarita
              nuqtalar={nuqtalar}
              fokus={fokus}
              className="h-full w-full"
              onBosildi={belgilash
                ? (lat, lng) => { void filialJoylashuviniSaqla(belgilash, lat, lng) }
                : undefined}
            />
          )}
          {saqlanmoqda && (
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-[500]">
              <Loader2 size={24} className="animate-spin text-white" />
            </div>
          )}
        </div>

        {/* Yon ro'yxat */}
        <div className="lg:w-80 shrink-0 flex flex-col gap-3 lg:overflow-y-auto">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              suppressHydrationWarning
              value={qidiruv}
              onChange={e => setQidiruv(e.target.value)}
              placeholder="Ism, manzil yoki telefon..."
              aria-label="Xaritada qidirish"
              className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* ── Xodimlar ── */}
          {korsatilsin('xodim') && (
            <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 dark:border-neutral-800 flex items-center gap-2">
                <Users size={15} className="text-green-600" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Xodimlar ({korXodimlar.length})
                </span>
              </div>
              {korXodimlar.length === 0 ? (
                <p className="px-4 py-5 text-sm text-gray-500 dark:text-gray-400 text-center">
                  {q ? 'Qidiruvga mos xodim yo`q' : "Hali hech kimning joylashuvi yozilmagan"}
                </p>
              ) : (
                <div className={`divide-y divide-gray-100 dark:divide-neutral-800 ${korinish === 'hammasi' ? 'max-h-72 overflow-y-auto' : ''}`}>
                  {korXodimlar.map(x => {
                    const y = yangilikAniqla(x.lokatsiyaYangilangan, hozir)
                    const bor = koordinataTogrimi(x.lokatsiyaLat, x.lokatsiyaLng)
                    return (
                      <div key={x.id} className="flex items-center hover:bg-gray-50 dark:hover:bg-neutral-800/40 transition">
                        <button
                          onClick={() => bor && setFokus('x:' + x.id)}
                          className="flex-1 min-w-0 px-4 py-2.5 flex items-center gap-2.5 text-left"
                        >
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${YANGILIK_RANG[y]}`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-gray-900 dark:text-gray-100 truncate">
                              {x.ism}
                              {!x.faol && <span className="text-gray-400 text-xs"> (nofaol)</span>}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {x.filial?.nomi ?? 'Markaziy'} · {vaqtMatni(x.lokatsiyaYangilangan, hozir)}
                              {x.telefon && ` · ${formatPhone(x.telefon)}`}
                            </p>
                          </div>
                        </button>
                        {bor && <GoogleTugma lat={x.lokatsiyaLat!} lng={x.lokatsiyaLng!} nomi={x.ism} />}
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="px-4 py-2 border-t border-gray-100 dark:border-neutral-800 flex items-center gap-3 flex-wrap">
                {(['jonli', 'yaqin', 'eski'] as Yangilik[]).map(y => (
                  <span key={y} className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                    <span className={`w-2 h-2 rounded-full ${YANGILIK_RANG[y]}`} />
                    {YANGILIK_LABEL[y]}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Mijozlar ── */}
          {korsatilsin('mijoz') && (
            <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 dark:border-neutral-800 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 shrink-0" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Mijozlar ({korMijozlar.length})
                </span>
              </div>
              {korMijozlar.length === 0 ? (
                <p className="px-4 py-5 text-sm text-gray-500 dark:text-gray-400 text-center">
                  {q ? 'Qidiruvga mos mijoz yo`q' : "Joylashuvi belgilangan mijoz yo'q"}
                </p>
              ) : (
                <div className={`divide-y divide-gray-100 dark:divide-neutral-800 ${korinish === 'hammasi' ? 'max-h-64 overflow-y-auto' : ''}`}>
                  {korMijozlar.map(m => (
                    <div key={m.id} className="flex items-center hover:bg-gray-50 dark:hover:bg-neutral-800/40 transition">
                      <button
                        onClick={() => setFokus('m:' + m.id)}
                        className="flex-1 min-w-0 px-4 py-2.5 text-left"
                      >
                        <p className="text-gray-900 dark:text-gray-100 text-sm font-medium truncate">{m.ism}</p>
                        <p className="text-gray-500 dark:text-gray-400 text-[11px] truncate">
                          {[m.manzil, [m.viloyat, m.tuman].filter(Boolean).join(', '), m.telefon ? formatPhone(m.telefon) : null]
                            .filter(Boolean).join(' · ') || 'Manzil kiritilmagan'}
                        </p>
                      </button>
                      <GoogleTugma lat={m.lokatsiyaLat!} lng={m.lokatsiyaLng!} nomi={m.ism} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Ta'minotchilar ── */}
          {korsatilsin('taminotchi') && (
            <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 dark:border-neutral-800 flex items-center gap-2">
                <Truck size={15} className="text-amber-600" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Ta&apos;minotchilar ({korTaminotchilar.length})
                </span>
              </div>
              {korTaminotchilar.length === 0 ? (
                <p className="px-4 py-5 text-sm text-gray-500 dark:text-gray-400 text-center">
                  {q ? "Qidiruvga mos ta'minotchi yo`q" : "Joylashuvi belgilangan ta'minotchi yo'q"}
                </p>
              ) : (
                <div className={`divide-y divide-gray-100 dark:divide-neutral-800 ${korinish === 'hammasi' ? 'max-h-64 overflow-y-auto' : ''}`}>
                  {korTaminotchilar.map(t => (
                    <div key={t.id} className="flex items-center hover:bg-gray-50 dark:hover:bg-neutral-800/40 transition">
                      <button
                        onClick={() => setFokus('t:' + t.id)}
                        className="flex-1 min-w-0 px-4 py-2.5 text-left"
                      >
                        <p className="text-gray-900 dark:text-gray-100 text-sm font-medium truncate">{t.nomi}</p>
                        <p className="text-gray-500 dark:text-gray-400 text-[11px] truncate">
                          {[t.kontaktShaxs, t.manzil, t.telefon ? formatPhone(t.telefon) : null]
                            .filter(Boolean).join(' · ') || 'Manzil kiritilmagan'}
                        </p>
                      </button>
                      <GoogleTugma lat={t.lokatsiyaLat!} lng={t.lokatsiyaLng!} nomi={t.nomi} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Filiallar ── */}
          {korsatilsin('filial') && (
            <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 dark:border-neutral-800 flex items-center gap-2">
                <Building size={15} className="text-indigo-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Filiallar ({korFiliallar.length})
                </span>
              </div>
              {korFiliallar.length === 0 ? (
                <p className="px-4 py-5 text-sm text-gray-500 dark:text-gray-400 text-center">
                  {q ? 'Qidiruvga mos filial yo`q' : 'Hali filial ochilmagan'}
                </p>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                  {korFiliallar.map(f => {
                    const bor = koordinataTogrimi(f.lokatsiyaLat, f.lokatsiyaLng)
                    return (
                      <div key={f.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                        <button
                          onClick={() => bor && setFokus('f:' + f.id)}
                          disabled={!bor}
                          className="min-w-0 text-left flex-1 disabled:cursor-default"
                        >
                          <p className="text-sm text-gray-900 dark:text-gray-100 truncate">{f.nomi}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {f.manzil || `${f._count.xodimlar} xodim`}
                          </p>
                        </button>
                        {bor ? (
                          <div className="flex items-center shrink-0">
                            <Check size={14} className="text-green-600" />
                            <GoogleTugma lat={f.lokatsiyaLat!} lng={f.lokatsiyaLng!} nomi={f.nomi} />
                          </div>
                        ) : (
                          <button
                            onClick={() => setBelgilash(f)}
                            className="text-[11px] text-primary hover:underline shrink-0 whitespace-nowrap"
                          >
                            Belgilash
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
              {joylashuvsizFilial.length > 0 && (
                <p className="px-4 py-2 text-[11px] text-amber-600 dark:text-amber-500 border-t border-gray-100 dark:border-neutral-800">
                  {joylashuvsizFilial.length} ta filial xaritada belgilanmagan
                </p>
              )}
            </div>
          )}

          <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed px-1">
            Xodim nuqtasi u ilovani ochiq tutgandagina yangilanadi; ilova yopilsa
            oxirgi ma&apos;lum joyda kulrang bo&apos;lib qoladi.
            Sputnik tasviri O&apos;zbekistonda cheklangan masshtabgacha aniq —
            binoni yaqindan ko&apos;rish uchun qator yonidagi{' '}
            <ExternalLink size={11} className="inline -mt-0.5" /> tugmasi orqali
            Google sputnikda oching.
          </p>
        </div>
      </div>
    </div>
  )
}
