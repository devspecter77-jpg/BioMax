'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import {
  MapPin, Loader2, Building, Users, RefreshCw, Crosshair, Check, X,
} from 'lucide-react'
import { formatPhone } from '@/lib/utils'
import type { XaritaNuqta, Yangilik } from '@/components/Xarita'

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

/** Necha daqiqadan keyin nuqta "jonli" bo'lmay qoladi. */
const JONLI_DAQ = 3
const YAQIN_DAQ = 20
/** Xarita shu oraliqda o'zi yangilanadi. */
const YANGILANISH_MS = 15_000

function yangilikAniqla(yangilangan: string | null, hozir: number): Yangilik {
  if (!yangilangan) return 'eski'
  const daq = (hozir - new Date(yangilangan).getTime()) / 60_000
  if (daq <= JONLI_DAQ) return 'jonli'
  if (daq <= YAQIN_DAQ) return 'yaqin'
  return 'eski'
}

function vaqtMatni(yangilangan: string | null, hozir: number): string {
  if (!yangilangan) return "Joylashuv yo'q"
  const daq = Math.max(0, Math.round((hozir - new Date(yangilangan).getTime()) / 60_000))
  if (daq < 1) return 'Hozir'
  if (daq < 60) return `${daq} daqiqa oldin`
  const soat = Math.round(daq / 60)
  if (soat < 24) return `${soat} soat oldin`
  return `${Math.round(soat / 24)} kun oldin`
}

const YANGILIK_RANG: Record<Yangilik, string> = {
  jonli: 'bg-red-500',
  yaqin: 'bg-amber-500',
  eski: 'bg-gray-400',
}
const YANGILIK_LABEL: Record<Yangilik, string> = {
  jonli: 'Harakatda',
  yaqin: 'Yaqinda',
  eski: 'Ilova yopiq',
}

export default function XaritaPage() {
  const [filiallar, setFiliallar] = useState<Filial[]>([])
  const [xodimlar, setXodimlar] = useState<Xodim[]>([])
  const [hozir, setHozir] = useState(() => Date.now())
  const [yuklanmoqda, setYuklanmoqda] = useState(true)
  const [fokus, setFokus] = useState<string | null>(null)
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

  const nuqtalar = useMemo<XaritaNuqta[]>(() => {
    const natija: XaritaNuqta[] = []

    for (const f of filiallar) {
      if (f.lokatsiyaLat == null || f.lokatsiyaLng == null) continue
      natija.push({
        id: 'f:' + f.id,
        lat: f.lokatsiyaLat,
        lng: f.lokatsiyaLng,
        nomi: f.nomi,
        tavsif: [f.manzil, `${f._count.xodimlar} xodim`].filter(Boolean).join(' · '),
        turi: 'filial',
      })
    }

    for (const x of xodimlar) {
      if (x.lokatsiyaLat == null || x.lokatsiyaLng == null) continue
      natija.push({
        id: 'x:' + x.id,
        lat: x.lokatsiyaLat,
        lng: x.lokatsiyaLng,
        nomi: x.ism,
        tavsif: [x.rol, x.filial?.nomi ?? 'Markaziy'].join(' · '),
        turi: 'xodim',
        yangilik: yangilikAniqla(x.lokatsiyaYangilangan, hozir),
        vaqtMatni: vaqtMatni(x.lokatsiyaYangilangan, hozir),
      })
    }

    return natija
  }, [filiallar, xodimlar, hozir])

  const joylashuvsizFilial = filiallar.filter(f => f.lokatsiyaLat == null || f.lokatsiyaLng == null)

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

  return (
    <div className="flex flex-col gap-3 lg:h-full">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <MapPin size={22} className="text-primary" />
            Xarita
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
            Filiallar va xodimlarning joylashuvi — har {YANGILANISH_MS / 1000} soniyada yangilanadi
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
          {/* Filiallar */}
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-100 dark:border-neutral-800 flex items-center gap-2">
              <Building size={15} className="text-indigo-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Filiallar ({filiallar.length})
              </span>
            </div>
            {filiallar.length === 0 ? (
              <p className="px-4 py-5 text-sm text-gray-500 dark:text-gray-400 text-center">
                Hali filial ochilmagan
              </p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                {filiallar.map(f => {
                  const bor = f.lokatsiyaLat != null && f.lokatsiyaLng != null
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
                        <Check size={14} className="text-green-600 shrink-0" />
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

          {/* Xodimlar */}
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-100 dark:border-neutral-800 flex items-center gap-2">
              <Users size={15} className="text-primary" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Xodimlar ({xodimlar.length})
              </span>
            </div>
            {xodimlar.length === 0 ? (
              <p className="px-4 py-5 text-sm text-gray-500 dark:text-gray-400 text-center">
                Hali hech kimning joylashuvi yozilmagan
              </p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                {xodimlar.map(x => {
                  const y = yangilikAniqla(x.lokatsiyaYangilangan, hozir)
                  return (
                    <button
                      key={x.id}
                      onClick={() => setFokus('x:' + x.id)}
                      className="w-full px-4 py-2.5 flex items-center gap-2.5 text-left hover:bg-gray-50 dark:hover:bg-neutral-800/40 transition"
                    >
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${YANGILIK_RANG[y]}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-900 dark:text-gray-100 truncate">
                          {x.ism}
                          {!x.faol && <span className="text-gray-400 text-xs"> (nofaol)</span>}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {x.filial?.nomi ?? 'Markaziy'} · {vaqtMatni(x.lokatsiyaYangilangan, hozir)}
                        </p>
                      </div>
                      {x.telefon && (
                        <span className="text-[11px] text-gray-500 dark:text-gray-400 shrink-0 hidden sm:inline">
                          {formatPhone(x.telefon)}
                        </span>
                      )}
                    </button>
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

          <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed px-1">
            Joylashuv xodimning brauzeri ilovani ochiq tutgandagina yoziladi.
            Ilova yopilsa nuqta oxirgi ma&apos;lum joyda qoladi va kulrang bo&apos;ladi.
          </p>
        </div>
      </div>
    </div>
  )
}
