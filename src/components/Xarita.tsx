'use client'

import { useEffect, useRef, useState } from 'react'
import type { Map as LeafletMap, Marker, LayerGroup, TileLayer } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  XARITA_QATLAMLARI, QATLAM_TARTIBI, saqlanganQatlam, qatlamniSaqla,
  type QatlamKaliti,
} from '@/lib/xarita-qatlamlari'

// Leaflet — API kalit ham, to'lov ham talab qilmaydi.
// Ko'rinishlar (oddiy / sputnik / gibrid / relyef / tungi) ro'yxati
// `lib/xarita-qatlamlari.ts` da; yangi provayder qo'shish uchun faqat
// o'sha ro'yxatga bitta yozuv qo'shiladi.

/** Hech qanday nuqta bo'lmasa xarita shu yerdan boshlanadi (O'zbekiston markazi). */
const BOSHLANGICH: [number, number] = [41.3775, 64.5853]
const BOSHLANGICH_ZOOM = 6

export type Yangilik = 'jonli' | 'yaqin' | 'eski'

export interface XaritaNuqta {
  id: string
  lat: number
  lng: number
  nomi: string
  /** Ikkinchi qator — lavozim, filial yoki manzil. */
  tavsif?: string | null
  turi: 'filial' | 'xodim'
  yangilik?: Yangilik
  /** "5 daqiqa oldin" kabi matn. */
  vaqtMatni?: string | null
}

interface Props {
  nuqtalar: XaritaNuqta[]
  /** Shu id ga ega nuqtaga xarita uchib boradi va oynasi ochiladi. */
  fokus?: string | null
  /** Xaritaga bosilganda (filial joylashuvini belgilash rejimi). */
  onBosildi?: (lat: number, lng: number) => void
  className?: string
}

const RANG: Record<Yangilik, string> = {
  jonli: '#dc2626', // qizil — hozir harakatda
  yaqin: '#f59e0b', // sariq — yaqinda ko'ringan
  eski: '#9ca3af',  // kulrang — ilova yopiq, eskirgan
}

/** Xodim nuqtasi: rangli dumaloq. "Jonli" bo'lsa atrofida urib turuvchi halqa. */
function xodimIkonHtml(yangilik: Yangilik): string {
  const rang = RANG[yangilik]
  const puls = yangilik === 'jonli'
    ? `<span style="position:absolute;inset:-6px;border-radius:9999px;background:${rang};opacity:.35;animation:xarita-puls 1.8s ease-out infinite"></span>`
    : ''
  return `<span style="position:relative;display:block;width:14px;height:14px">
    ${puls}
    <span style="position:absolute;inset:0;border-radius:9999px;background:${rang};border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>
  </span>`
}

/** Filial nuqtasi: ko'k kvadrat belgi — xodim nuqtalaridan aniq farqlansin. */
function filialIkonHtml(): string {
  return `<span style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;background:#4f46e5;border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4"/>
    </svg>
  </span>`
}

/**
 * Tanlangan ko'rinishni xaritaga qo'yadi. Eskisi olib tashlanadi —
 * aks holda qatlamlar ustma-ust to'planib, xotira va trafik behuda ketardi.
 */
function qatlamniQoy(
  L: typeof import('leaflet'),
  xarita: LeafletMap,
  kalit: QatlamKaliti,
  eski?: { asos: TileLayer | null; ust: TileLayer | null },
): { asos: TileLayer; ust: TileLayer | null } {
  if (eski?.asos) xarita.removeLayer(eski.asos)
  if (eski?.ust) xarita.removeLayer(eski.ust)

  const q = XARITA_QATLAMLARI[kalit]
  const asos = L.tileLayer(q.url, { attribution: q.atribut, maxZoom: q.maxZoom }).addTo(xarita)
  let ust: TileLayer | null = null
  if (q.ustQatlam) {
    // Yozuvlar qatlami tayl panelida qoladi, lekin zIndex bilan sputnik
    // tasviri USTIGA chiqariladi. `overlayPane` ishlatilsa Leaflet uni
    // boshqacha joylashtiradi va tasvir bilan mos tushmay qolardi.
    ust = L.tileLayer(q.ustQatlam.url, { maxZoom: q.ustQatlam.maxZoom, zIndex: 2 }).addTo(xarita)
    asos.setZIndex(1)
  }
  return { asos, ust }
}

export default function Xarita({ nuqtalar, fokus, onBosildi, className }: Props) {
  const idishRef = useRef<HTMLDivElement>(null)
  const xaritaRef = useRef<LeafletMap | null>(null)
  const qatlamRef = useRef<LayerGroup | null>(null)
  const markerlarRef = useRef<Map<string, Marker>>(new Map())
  // Boshlang'ich kadrlash faqat BIR marta bo'lsin — har yangilanishda
  // xarita sakrab, foydalanuvchi qaragan joyni yo'qotmasin.
  const kadrlandiRef = useRef(false)
  const onBosildiRef = useRef(onBosildi)
  onBosildiRef.current = onBosildi

  // Xaritani bir marta yaratish
  useEffect(() => {
    let bekor = false
    let xarita: LeafletMap | null = null

    async function boshla() {
      const L = await import('leaflet')
      if (bekor || !idishRef.current || xaritaRef.current) return

      xarita = L.map(idishRef.current, {
        center: BOSHLANGICH,
        zoom: BOSHLANGICH_ZOOM,
        zoomControl: true,
        attributionControl: true,
      })
      LRef.current = L
      taylRef.current = qatlamniQoy(L, xarita, qatlamRefKalit.current)
      qatlamRef.current = L.layerGroup().addTo(xarita)
      xarita.on('click', (e) => onBosildiRef.current?.(e.latlng.lat, e.latlng.lng))
      xaritaRef.current = xarita
    }

    void boshla()
    // Ref qiymatini effekt ICHIDA nusxalab olamiz — tozalash paytida
    // `markerlarRef.current` boshqa Map'ga almashgan bo'lishi mumkin.
    const markerlar = markerlarRef.current
    return () => {
      bekor = true
      xaritaRef.current?.remove()
      xaritaRef.current = null
      qatlamRef.current = null
      markerlar.clear()
      kadrlandiRef.current = false
    }
  }, [])

  // Nuqtalarni yangilash — markerlar QAYTA yaratilmaydi, faqat joyi
  // ko'chadi. Shuning uchun jonli harakat silliq ko'rinadi.
  useEffect(() => {
    let bekor = false

    async function yangila() {
      const L = await import('leaflet')
      const xarita = xaritaRef.current
      const qatlam = qatlamRef.current
      if (bekor || !xarita || !qatlam) return

      const koringan = new Set<string>()

      for (const n of nuqtalar) {
        if (!Number.isFinite(n.lat) || !Number.isFinite(n.lng)) continue
        koringan.add(n.id)

        const html = n.turi === 'filial' ? filialIkonHtml() : xodimIkonHtml(n.yangilik ?? 'eski')
        const ikon = L.divIcon({
          html,
          className: 'xarita-ikon',
          iconSize: n.turi === 'filial' ? [26, 26] : [14, 14],
          iconAnchor: n.turi === 'filial' ? [13, 13] : [7, 7],
        })
        const oyna =
          `<div style="min-width:150px">
            <div style="font-weight:600;margin-bottom:2px">${n.nomi}</div>
            ${n.tavsif ? `<div style="color:#6b7280;font-size:12px">${n.tavsif}</div>` : ''}
            ${n.vaqtMatni ? `<div style="color:#9ca3af;font-size:11px;margin-top:3px">${n.vaqtMatni}</div>` : ''}
          </div>`

        const mavjud = markerlarRef.current.get(n.id)
        if (mavjud) {
          mavjud.setLatLng([n.lat, n.lng])
          mavjud.setIcon(ikon)
          mavjud.setPopupContent(oyna)
        } else {
          const marker = L.marker([n.lat, n.lng], { icon: ikon, title: n.nomi })
            .bindPopup(oyna)
            .addTo(qatlam)
          markerlarRef.current.set(n.id, marker)
        }
      }

      // Yo'qolgan nuqtalarni olib tashlash
      for (const [id, marker] of markerlarRef.current.entries()) {
        if (!koringan.has(id)) {
          qatlam.removeLayer(marker)
          markerlarRef.current.delete(id)
        }
      }

      // Birinchi ma'lumot kelganda hamma nuqtani kadrga sig'diramiz
      if (!kadrlandiRef.current && markerlarRef.current.size > 0) {
        const chegara = L.latLngBounds(nuqtalar.map(n => [n.lat, n.lng] as [number, number]))
        xarita.fitBounds(chegara, { padding: [50, 50], maxZoom: 15 })
        kadrlandiRef.current = true
      }
    }

    void yangila()
    return () => { bekor = true }
  }, [nuqtalar])

  // ── Ko'rinish (tayl qatlami) ──
  // Boshlang'ich qiymat brauzerdan o'qiladi, lekin SERVERDA localStorage
  // yo'q — shuning uchun avval 'oddiy', keyin effektda tiklanadi
  // (gidratatsiya nomuvofiqligining oldini oladi).
  const [qatlam, setQatlam] = useState<QatlamKaliti>('oddiy')
  const [qatlamOchiq, setQatlamOchiq] = useState(false)
  const qatlamRefKalit = useRef<QatlamKaliti>('oddiy')
  const LRef = useRef<typeof import('leaflet') | null>(null)
  const taylRef = useRef<{ asos: TileLayer | null; ust: TileLayer | null }>({ asos: null, ust: null })

  useEffect(() => {
    const saqlangan = saqlanganQatlam()
    qatlamRefKalit.current = saqlangan
    setQatlam(saqlangan)
  }, [])

  // Ko'rinish almashganda taylni qayta qo'yamiz
  useEffect(() => {
    qatlamRefKalit.current = qatlam
    const L = LRef.current
    const xarita = xaritaRef.current
    if (!L || !xarita) return
    taylRef.current = qatlamniQoy(L, xarita, qatlam, taylRef.current)
  }, [qatlam])

  // Ro'yxatdan tanlangan nuqtaga uchib borish
  useEffect(() => {
    if (!fokus) return
    const xarita = xaritaRef.current
    const marker = markerlarRef.current.get(fokus)
    if (!xarita || !marker) return
    xarita.flyTo(marker.getLatLng(), Math.max(xarita.getZoom(), 15), { duration: 0.8 })
    marker.openPopup()
  }, [fokus])

  return (
    <>
      {/* Leaflet ikonlari uchun global uslub — divIcon o'z fonini
          olib kelmasligi va puls animatsiyasi ishlashi uchun. */}
      <style>{`
        .xarita-ikon { background: transparent; border: none; }
        @keyframes xarita-puls {
          0%   { transform: scale(.6); opacity: .5 }
          70%  { transform: scale(1.6); opacity: 0 }
          100% { transform: scale(1.6); opacity: 0 }
        }
        .leaflet-container { font-family: inherit; background: #e5e7eb; }
      `}</style>
      <div className="relative">
        <div ref={idishRef} className={className} />

        {/* ── Ko'rinish tanlagich ──
            Xarita ustida suzib turadi. Leaflet'ning o'z boshqaruvi
            o'rniga ilova uslubida — qolgan bo'limlar bilan bir xil. */}
        <div className="absolute top-3 right-3 z-[1000]">
          <button
            onClick={() => setQatlamOchiq(o => !o)}
            title="Xarita ko'rinishi"
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 shadow-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-primary/50 transition"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
            {XARITA_QATLAMLARI[qatlam].nomi}
          </button>

          {qatlamOchiq && (
            <div className="mt-2 w-56 rounded-xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 shadow-xl overflow-hidden">
              {QATLAM_TARTIBI.map(k => (
                <button
                  key={k}
                  onClick={() => { setQatlam(k); qatlamniSaqla(k); setQatlamOchiq(false) }}
                  className={`w-full text-left px-3 py-2.5 transition ${
                    qatlam === k
                      ? 'bg-primary/10 text-primary'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <span className="block text-sm font-medium">{XARITA_QATLAMLARI[k].nomi}</span>
                  <span className="block text-[11px] text-gray-500 dark:text-gray-400">
                    {XARITA_QATLAMLARI[k].izoh}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
