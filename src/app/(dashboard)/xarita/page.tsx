'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import {
  MapPin, Loader2, Building, Users, RefreshCw, Crosshair, Check, X,
  Truck, ExternalLink, Search,
} from 'lucide-react'
import { formatPhone } from '@/lib/utils'
import type { XaritaChiziq, XaritaNuqta, Yangilik } from '@/components/Xarita'
import { googleSputnik, koordinataTogrimi } from '@/lib/xarita-havola'
import { vaqtMatni, yangilikAniqla } from '@/lib/lokatsiya-vaqt'
import { YETKAZISH_NOMI, masofaMatni, type KuryerYetkazish } from '@/lib/dostavchik'
import {
  YETKAZISH_XARITA_RANGI, masofa, qolganVaqtS, qolganYol, transportProfili, vaqtYorligi, type Nuqta,
} from '@/lib/yonalish'
import { useYonalishlar, type YonalishSorovi } from '@/hooks/useYonalishlar'
import KuryerKartasi, { type YolHolati } from '@/components/xarita/KuryerKartasi'

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
/** Yo'ldagi kuryerlar tezroq: kuryer ilovasi siljiganda har ~3 s da joy yuboradi. */
const YETKAZISH_MS = 4_000

/** Kuryer va u boradigan joy — xaritada chiziladigan yo'l. */
interface KuryerYoli extends YolHolati {
  nuqtalar: Nuqta[]
}

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
type Korinish = 'hammasi' | 'yetkazish' | 'xodim' | 'mijoz' | 'taminotchi' | 'filial'

const KORINISHLAR: { kalit: Korinish; label: string; rang: string }[] = [
  { kalit: 'hammasi', label: 'Hammasi', rang: 'bg-gray-400' },
  { kalit: 'yetkazish', label: 'Yetkazishlar', rang: 'bg-blue-600' },
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
  // Telefonda ro'yxat xaritaning OSTIDA — nuqta tanlanganda xarita ko'rinmay
  // qolardi. Tanlov xarita ekrandan chiqib ketgan bo'lsagina unga suriladi.
  const xaritaIdishRef = useRef<HTMLDivElement>(null)
  const nuqtagaBor = useCallback((kalit: string) => {
    setFokus(kalit)
    const el = xaritaIdishRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

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

  // ── Yo'ldagi kuryerlar — alohida va tez yangilanadi ──
  const [kuryerlar, setKuryerlar] = useState<KuryerYetkazish[]>([])
  const [kuryerHozir, setKuryerHozir] = useState(() => Date.now())
  const [tanlangan, setTanlangan] = useState<string | null>(null)
  const [korsatish, setKorsatish] = useState<
    { kalit: string; nuqtalar: [number, number][]; pastdan?: number; chapdan?: number } | null
  >(null)

  useEffect(() => {
    let toxtadi = false
    let taymer: ReturnType<typeof setTimeout> | undefined
    let kutish = YETKAZISH_MS
    let boshqaruv: AbortController | null = null

    async function ol() {
      if (toxtadi) return
      // Sahifa yashirin bo'lsa so'ramaymiz — qaytib ochilganda darhol
      if (document.visibilityState === 'visible') {
        boshqaruv?.abort()
        boshqaruv = new AbortController()
        try {
          const r = await fetch('/api/xarita/yetkazishlar', { cache: 'no-store', signal: boshqaruv.signal })
          if (!r.ok) throw new Error(String(r.status))
          const d = await r.json()
          if (!toxtadi && Array.isArray(d.kuryerlar)) {
            const royxat = d.kuryerlar as KuryerYetkazish[]
            setKuryerlar(royxat)
            setKuryerHozir(d.hozir ? new Date(d.hozir).getTime() : Date.now())
            // Kuryer barcha buyurtmasini topshirsa karta o'zi yopiladi
            setTanlangan(t => (t && royxat.some(k => k.id === t) ? t : null))
          }
          kutish = YETKAZISH_MS
        } catch (e) {
          if ((e as Error)?.name === 'AbortError') return
          kutish = Math.min(kutish * 2, 30_000)
        }
      }
      if (!toxtadi) taymer = setTimeout(ol, kutish)
    }

    const qaytdi = () => {
      if (document.visibilityState !== 'visible') return
      clearTimeout(taymer)
      void ol()
    }
    document.addEventListener('visibilitychange', qaytdi)
    void ol()
    return () => {
      toxtadi = true
      clearTimeout(taymer)
      boshqaruv?.abort()
      document.removeEventListener('visibilitychange', qaytdi)
    }
  }, [])

  const q = qidiruv.trim().toLowerCase()
  const mos = useCallback(
    (...maydonlar: (string | null | undefined)[]) =>
      !q || maydonlar.some(m => (m ?? '').toLowerCase().includes(q)),
    [q],
  )

  const kuryerXaritasi = useMemo(() => new Map(kuryerlar.map(k => [k.id, k])), [kuryerlar])
  const korKuryerlar = useMemo(
    () => kuryerlar.filter(k => mos(k.ism, k.telefon, ...k.yetkazishlar.flatMap(y => [y.raqam, y.aloqaIsm, y.manzilMatni]))),
    [kuryerlar, mos])
  const kuryerKorinadi = korinish === 'hammasi' || korinish === 'yetkazish' || korinish === 'xodim'

  // Ko'chalar bo'ylab marshrut — yo'ldagi joriy buyurtmalar uchun
  const sorovlar = useMemo<YonalishSorovi[]>(() => {
    const s: YonalishSorovi[] = []
    for (const k of kuryerlar) {
      const j = k.joriy
      if (!k.lokatsiya || j?.holati !== 'YOLDA' || j.lat == null || j.lng == null) continue
      s.push({ kalit: j.raqam, dan: [k.lokatsiya.lat, k.lokatsiya.lng], ga: [j.lat, j.lng], profil: transportProfili(k.transportTuri) })
    }
    return s
  }, [kuryerlar])
  const marshrutlar = useYonalishlar(sorovlar)

  // Har kuryer uchun joriy buyurtmagacha qolgan yo'l: marshrut bo'lsa uning
  // QOLGAN qismi (kuryer turgan joydan), bo'lmasa to'g'ri chiziq
  const yollar = useMemo(() => {
    const m = new Map<string, KuryerYoli>()
    for (const k of kuryerlar) {
      const j = k.joriy
      if (!k.lokatsiya || !j || j.lat == null || j.lng == null) continue
      const dan: Nuqta = [k.lokatsiya.lat, k.lokatsiya.lng]
      const ga: Nuqta = [j.lat, j.lng]
      const marshrut = j.holati === 'YOLDA' ? marshrutlar.get(j.raqam) : undefined
      const qolgan = marshrut ? qolganYol(marshrut.nuqtalar, dan) : null
      m.set(k.id, marshrut && qolgan
        ? {
            nuqtalar: qolgan.nuqtalar,
            masofaM: qolgan.masofaM,
            vaqtS: qolganVaqtS(marshrut.masofaM, marshrut.vaqtS, qolgan.masofaM),
            yolBoylab: true,
          }
        : { nuqtalar: [dan, ga], masofaM: masofa(dan, ga), vaqtS: null, yolBoylab: false })
    }
    return m
  }, [kuryerlar, marshrutlar])

  const kuryerniTanla = useCallback((kuryerId: string) => {
    const k = kuryerXaritasi.get(kuryerId)
    if (!k) return
    setTanlangan(kuryerId)
    const nuqtalar: [number, number][] = []
    if (k.lokatsiya) nuqtalar.push([k.lokatsiya.lat, k.lokatsiya.lng])
    if (k.joriy?.lat != null && k.joriy.lng != null) nuqtalar.push([k.joriy.lat, k.joriy.lng])
    // Karta telefonda pastda, kompyuterda chapda turadi — yo'l uning ostida qolmasin
    const telefon = window.innerWidth < 640
    setKorsatish({ kalit: `${kuryerId}:${Date.now()}`, nuqtalar, pastdan: telefon ? 280 : 0, chapdan: telefon ? 0 : 370 })
    const el = xaritaIdishRef.current
    if (el) {
      const r = el.getBoundingClientRect()
      if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [kuryerXaritasi])

  const onTanlash = useCallback((id: string) => {
    if (id.startsWith('k:')) kuryerniTanla(id.slice(2))
    else if (id.startsWith('y:')) {
      const raqam = id.slice(2)
      const k = kuryerlar.find(x => x.yetkazishlar.some(y => y.raqam === raqam))
      if (k) kuryerniTanla(k.id)
    }
  }, [kuryerlar, kuryerniTanla])

  const tanlanganKuryer = tanlangan ? kuryerXaritasi.get(tanlangan) ?? null : null

  const chiziqlar = useMemo<XaritaChiziq[]>(() => {
    if (!kuryerKorinadi) return []
    const c: XaritaChiziq[] = []
    for (const k of korKuryerlar) {
      if (!k.lokatsiya) continue
      const dan: Nuqta = [k.lokatsiya.lat, k.lokatsiya.lng]
      const tanlanganmi = tanlangan === k.id
      for (const y of k.yetkazishlar) {
        if (y.lat == null || y.lng == null) continue
        if (y.holati === 'YOLDA') {
          // Joriy buyurtma — ko'chalar bo'ylab; bir vaqtda olib ketayotgan boshqalari — to'g'ri chiziq
          const yol = y.raqam === k.joriy?.raqam ? yollar.get(k.id) : undefined
          c.push({
            id: 'c:' + y.raqam,
            nuqtalar: yol?.nuqtalar ?? [dan, [y.lat, y.lng]],
            rang: YETKAZISH_XARITA_RANGI.YOLDA,
            uzuq: !yol?.yolBoylab,
            tanlangan: tanlanganmi,
            tanlashId: 'k:' + k.id,
          })
        } else if (y.holati === 'TAYINLANGAN' && tanlanganmi) {
          // Hali yo'lga chiqmagan — faqat tanlanganda, qayerga borishi nuqtali chiziqda
          c.push({
            id: 'c:' + y.raqam,
            nuqtalar: [dan, [y.lat, y.lng]],
            rang: YETKAZISH_XARITA_RANGI.TAYINLANGAN,
            uzuq: true,
            tanlashId: 'k:' + k.id,
          })
        }
      }
    }
    return c
  }, [kuryerKorinadi, korKuryerlar, yollar, tanlangan])

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
        // Buyurtma olib ketayotgan kuryer pastda alohida (yuk mashinasi belgisi)
        if (kuryerXaritasi.get(x.id)?.lokatsiya) continue
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

    // Yo'ldagi kuryerlar va ular boradigan manzillar — bosilganda karta ochiladi
    if (kuryerKorinadi) {
      for (const k of korKuryerlar) {
        const tanlanganmi = tanlangan === k.id
        if (k.lokatsiya && koordinataTogrimi(k.lokatsiya.lat, k.lokatsiya.lng)) {
          natija.push({
            id: 'k:' + k.id,
            lat: k.lokatsiya.lat, lng: k.lokatsiya.lng,
            nomi: k.ism,
            turi: 'kuryer',
            rang: YETKAZISH_XARITA_RANGI[k.joriy?.holati ?? 'TAYINLANGAN'],
            yangilik: yangilikAniqla(k.lokatsiya.yangilangan, kuryerHozir),
            tanlanadi: true,
            tanlangan: tanlanganmi,
          })
        }
        for (const y of k.yetkazishlar) {
          if (!koordinataTogrimi(y.lat, y.lng)) continue
          // Hali yo'lga chiqilmagan buyurtma manzili — faqat kuryer tanlanganda
          if (y.holati === 'TAYINLANGAN' && !tanlanganmi) continue
          natija.push({
            id: 'y:' + y.raqam,
            lat: y.lat!, lng: y.lng!,
            nomi: `${y.raqam} · ${y.aloqaIsm ?? 'Mijoz'}`,
            yorliq: y.raqam,
            turi: 'manzil',
            rang: YETKAZISH_XARITA_RANGI[y.holati],
            tanlanadi: true,
            tanlangan: tanlanganmi && y.raqam === k.joriy?.raqam,
          })
        }
      }
    }

    return natija
  }, [korFiliallar, korXodimlar, korMijozlar, korTaminotchilar, hozir, korsatilsin,
    kuryerKorinadi, korKuryerlar, kuryerXaritasi, kuryerHozir, tanlangan])

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
    yetkazish: korKuryerlar.length,
    xodim: korXodimlar.length,
    mijoz: korMijozlar.length,
    taminotchi: korTaminotchilar.length,
    filial: korFiliallar.length,
  }

  return (
    <div className="flex flex-col gap-3 lg:h-full">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <MapPin size={22} className="text-primary" />
            Xarita
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
            Yo&apos;ldagi kuryerlar har {YETKAZISH_MS / 1000} soniyada, qolganlari har {YANGILANISH_MS / 1000} soniyada yangilanadi
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
            {jonliSoni} ta harakatda
          </span>
          <button
            onClick={() => { birinchiRef.current = false; void yukla() }}
            className="p-2.5 rounded-xl border border-gray-300 dark:border-neutral-700 text-gray-500 hover:text-primary hover:border-primary/50 transition"
            title="Yangilash"
            aria-label="Xaritani yangilash"
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
        {/* Balandlik: telefon/planshetda aniq (dvh — manzil satri hisobga olinadi),
            kompyuterda qolgan joyni egallaydi. `flex-1` faqat lg da — ustun
            tartibida u balandlikni nolga tushirib, xarita ko'rinmay qolardi. */}
        <div
          ref={xaritaIdishRef}
          className="min-w-0 rounded-2xl overflow-hidden border border-gray-200 dark:border-neutral-800 h-[62dvh] min-h-[320px] max-h-[720px] lg:max-h-none lg:h-auto lg:min-h-[480px] lg:flex-1 relative scroll-mt-4"
        >
          {yuklanmoqda ? (
            <div className="h-full flex items-center justify-center bg-gray-100 dark:bg-neutral-800">
              <Loader2 size={22} className="animate-spin text-primary" />
            </div>
          ) : (
            <Xarita
              nuqtalar={nuqtalar}
              chiziqlar={chiziqlar}
              fokus={fokus}
              onTanlash={onTanlash}
              korsatish={korsatish}
              className="h-full w-full"
              onBosildi={belgilash
                ? (lat, lng) => { void filialJoylashuviniSaqla(belgilash, lat, lng) }
                // Bo'sh joyga bosilsa kuryer kartasi yopiladi
                : tanlangan ? () => setTanlangan(null) : undefined}
            />
          )}
          {!yuklanmoqda && kuryerKorinadi && tanlanganKuryer && (
            <div className="absolute z-[1000] inset-x-2 bottom-2 sm:inset-x-auto sm:left-3 sm:bottom-3 sm:w-[360px]">
              <KuryerKartasi
                kuryer={tanlanganKuryer}
                yol={yollar.get(tanlanganKuryer.id) ?? null}
                hozir={kuryerHozir}
                onYopish={() => setTanlangan(null)}
              />
            </div>
          )}
          {!yuklanmoqda && nuqtalar.length === 0 && !belgilash && (
            <div className="absolute inset-x-3 bottom-3 z-[500] pointer-events-none flex justify-center">
              <div className="pointer-events-auto max-w-sm rounded-xl bg-white/95 dark:bg-neutral-900/95 border border-gray-200 dark:border-neutral-800 shadow-lg px-4 py-3 text-sm">
                {korinish === 'yetkazish' ? (
                  <>
                    <p className="font-medium text-gray-900 dark:text-gray-100">Hozir yo&apos;lda kuryer yo&apos;q</p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      Buyurtma kuryerga biriktirilib, u «Yo&apos;lga chiqdim»ni bosganda shu yerda manzilgacha
                      chiziq bilan ko&apos;rinadi.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-gray-900 dark:text-gray-100">Xaritada hali belgi yo&apos;q</p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      Mijoz yoki ta&apos;minotchi kartasida «GPS joylashuv»ni belgilang — shu yerda paydo bo&apos;ladi.
                      Xodimlar ilovani ochganda o&apos;zi chiqadi.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
          {saqlanmoqda && (
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-[500]">
              <Loader2 size={24} className="animate-spin text-white" />
            </div>
          )}
        </div>

        {/* Yon ro'yxat */}
        {/* `[&>*]:shrink-0` — kartochkalar (overflow-hidden) siqilib ichi kesilmasin, ustun o'zi aylansin */}
        <div className="lg:w-80 shrink-0 flex flex-col gap-3 lg:overflow-y-auto [&>*]:shrink-0">
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

          {/* ── Yo'ldagi kuryerlar ── */}
          {kuryerKorinadi && (korinish === 'yetkazish' || korKuryerlar.length > 0) && (
            <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 dark:border-neutral-800 flex items-center gap-2">
                <Truck size={15} className="text-blue-600" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Yetkazishda ({korKuryerlar.length})
                </span>
              </div>
              {korKuryerlar.length === 0 ? (
                <p className="px-4 py-5 text-sm text-gray-500 dark:text-gray-400 text-center">
                  {q ? 'Qidiruvga mos kuryer yo`q' : "Hozir buyurtma olib ketayotgan kuryer yo'q"}
                </p>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                  {korKuryerlar.map(k => {
                    const j = k.joriy
                    const yol = yollar.get(k.id)
                    const rang = YETKAZISH_XARITA_RANGI[j?.holati ?? 'TAYINLANGAN']
                    const qolgani = j?.holati === 'YOLDA' && yol?.masofaM != null
                      ? [masofaMatni(yol.masofaM), vaqtYorligi(yol.vaqtS)].filter(Boolean).join(' · ')
                      : null
                    return (
                      <button
                        key={k.id}
                        type="button"
                        onClick={() => kuryerniTanla(k.id)}
                        aria-pressed={tanlangan === k.id}
                        className={`w-full px-4 py-2.5 flex items-center gap-2.5 text-left transition ${
                          tanlangan === k.id ? 'bg-blue-50 dark:bg-blue-950/30' : 'hover:bg-gray-50 dark:hover:bg-neutral-800/40'
                        }`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: rang }} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-900 dark:text-gray-100 truncate">{k.ism}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {j ? `${j.raqam} · ${YETKAZISH_NOMI[j.holati]}` : ''}
                            {qolgani ? ` · ${qolgani}` : ''}
                            {!k.lokatsiya ? ' · joylashuv yo‘q' : ''}
                          </p>
                        </div>
                        {k.yetkazishlar.length > 1 && (
                          <span className="shrink-0 rounded-full bg-gray-100 dark:bg-neutral-800 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:text-gray-400" title="Tugallanmagan buyurtmalar">
                            {k.yetkazishlar.length}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
              <div className="px-4 py-2 border-t border-gray-100 dark:border-neutral-800 flex items-center gap-3 flex-wrap">
                {(['YOLDA', 'YETIB_KELDI', 'TAYINLANGAN'] as const).map(h => (
                  <span key={h} className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                    <span className="w-2 h-2 rounded-full" style={{ background: YETKAZISH_XARITA_RANGI[h] }} />
                    {YETKAZISH_NOMI[h]}
                  </span>
                ))}
              </div>
            </div>
          )}

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
                          onClick={() => {
                            // Yetkazayotgan kuryer — xaritada yuk mashinasi belgisi, kartasi ochiladi
                            if (kuryerXaritasi.get(x.id)?.lokatsiya) kuryerniTanla(x.id)
                            else if (bor) nuqtagaBor('x:' + x.id)
                          }}
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
                        onClick={() => nuqtagaBor('m:' + m.id)}
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
                        onClick={() => nuqtagaBor('t:' + t.id)}
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
                          onClick={() => bor && nuqtagaBor('f:' + f.id)}
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
