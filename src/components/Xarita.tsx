'use client'

import { useEffect, useRef, useState } from 'react'
import type { Map as LeafletMap, Marker, LayerGroup, TileLayer, Polyline } from 'leaflet'
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
/**
 * Bitta nuqta ko'rsatilganda ishlatiladigan masshtab.
 * 17 — Esri sputnik tasviri O'zbekistonda hamma joyda mavjud bo'lgan eng
 * katta daraja (`xarita-qatlamlari.ts` dagi o'lchovga qarang), shuning
 * uchun bu yerda tasvir hali ham o'tkir.
 */
const YAGONA_ZOOM = 17

export type Yangilik = 'jonli' | 'yaqin' | 'eski'

export interface XaritaNuqta {
  id: string
  lat: number
  lng: number
  nomi: string
  /** Ikkinchi qator — lavozim, filial yoki manzil. */
  tavsif?: string | null
  /**
   * `kuryer` — buyurtma yetkazayotgan dostavchik (yuk mashinasi belgisi),
   * `manzil` — u boradigan joy (bayroqcha). Ikkalasining rangi `rang`.
   */
  turi: 'filial' | 'xodim' | 'mijoz' | 'taminotchi' | 'kuryer' | 'manzil'
  /** Nuqta tepasida ko'rinadigan yozuv. Berilmasa `nomi` ishlatiladi. */
  yorliq?: string | null
  yangilik?: Yangilik
  /** "5 daqiqa oldin" kabi matn. */
  vaqtMatni?: string | null
  /** kuryer/manzil rangi — yo'nalish chizig'i bilan bir xil */
  rang?: string
  /** Bosilganda kichik oyna o'rniga `onTanlash(id)` chaqiriladi */
  tanlanadi?: boolean
  /** Tanlangan — ajralib turadi va boshqalar ustida */
  tanlangan?: boolean
}

/** Xaritadagi chiziq — kuryerdan manzilgacha yo'nalish. */
export interface XaritaChiziq {
  id: string
  nuqtalar: [number, number][]
  rang: string
  /** Taxminiy (to'g'ri chiziq, marshrut olinmagan) — nuqtali chiziladi */
  uzuq?: boolean
  tanlangan?: boolean
  /** Chiziq bosilganda shu id bilan `onTanlash` chaqiriladi */
  tanlashId?: string
}

interface Props {
  nuqtalar: XaritaNuqta[]
  chiziqlar?: XaritaChiziq[]
  /** Shu id ga ega nuqtaga xarita uchib boradi va oynasi ochiladi. */
  fokus?: string | null
  /** `tanlanadi` nuqta yoki chiziq bosilganda */
  onTanlash?: (id: string) => void
  /**
   * Shu nuqtalarni kadrga sig'diradi — faqat `kalit` o'zgarganda (tanlov),
   * har yangilanishda emas. `pastdan` — pastki oyna egallagan joy (px).
   */
  korsatish?: { kalit: string; nuqtalar: [number, number][]; pastdan?: number; chapdan?: number } | null
  /** Xaritaga bosilganda (filial joylashuvini belgilash rejimi). */
  onBosildi?: (lat: number, lng: number) => void
  className?: string
  /** Nuqta yo'q paytdagi boshlang'ich ko'rinish (standart — butun O'zbekiston) */
  boshlangich?: { markaz: [number, number]; zoom: number }
}

// XODIM — YASHIL, MIJOZ — QIZIL. Xaritaga bir qarashda kim kimligi
// ajralib turishi uchun ranglar ataylab qarama-qarshi tanlangan.
// Xodimda yashilning ohangi "qachon ko'ringani"ni bildiradi.
const XODIM_RANG: Record<Yangilik, string> = {
  jonli: '#16a34a', // to'q yashil — hozir harakatda
  yaqin: '#65a30d', // och yashil — yaqinda ko'ringan
  eski: '#9ca3af',  // kulrang — ilova yopiq, eskirgan
}

const MIJOZ_RANG = '#dc2626'      // qizil
// TA'MINOTCHI — TO'Q SARIQ. Qizil (mijoz) va yashil (xodim) dan
// aniq farqlanadi, ko'r-rang foydalanuvchilar uchun ham ajraladi.
const TAMINOTCHI_RANG = '#d97706'

/** HTML matnini xavfsiz qilish — nom foydalanuvchi kiritgan matn. */
function xavfsiz(matn: string): string {
  return String(matn ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Nuqta tepasidagi nom yozuvi.
 *
 * Belgidan TASHQARIDA joylashadi (`bottom` manfiy emas, balandroq),
 * shuning uchun ikon o'lchamiga ta'sir qilmaydi va nuqta o'z
 * koordinatasida aniq turaveradi. `pointer-events:none` — yozuv
 * bosishni to'smasin.
 */
function yorliqHtml(matn: string | null | undefined, pastdan: number): string {
  const t = (matn ?? '').trim()
  if (!t) return ''
  return `<span style="
    position:absolute;bottom:${pastdan}px;left:50%;transform:translateX(-50%);
    white-space:nowrap;pointer-events:none;
    font-size:11px;font-weight:600;line-height:1.4;
    color:#111827;background:rgba(255,255,255,.92);
    padding:1px 6px;border-radius:6px;
    box-shadow:0 1px 3px rgba(0,0,0,.28);
  ">${xavfsiz(t)}</span>`
}

/** Xodim nuqtasi: YASHIL dumaloq. "Jonli" bo'lsa atrofida urib turuvchi halqa. */
function xodimIkonHtml(yangilik: Yangilik, yorliq?: string | null): string {
  const rang = XODIM_RANG[yangilik]
  const puls = yangilik === 'jonli'
    ? `<span style="position:absolute;inset:-6px;border-radius:9999px;background:${rang};opacity:.35;animation:xarita-puls 1.8s ease-out infinite"></span>`
    : ''
  return `<span style="position:relative;display:block;width:14px;height:14px">
    ${puls}
    <span style="position:absolute;inset:0;border-radius:9999px;background:${rang};border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>
    ${yorliqHtml(yorliq, 20)}
  </span>`
}

/** Mijoz nuqtasi: QIZIL dumaloq — xodimdan aniq farqlansin. */
function mijozIkonHtml(yorliq?: string | null): string {
  return `<span style="position:relative;display:block;width:14px;height:14px">
    <span style="position:absolute;inset:0;border-radius:9999px;background:${MIJOZ_RANG};border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>
    ${yorliqHtml(yorliq, 20)}
  </span>`
}

/** Ta'minotchi nuqtasi: TO'Q SARIQ romb — dumaloqlardan shakli bilan ham farqlanadi. */
function taminotchiIkonHtml(yorliq?: string | null): string {
  return `<span style="position:relative;display:block;width:16px;height:16px">
    <span style="position:absolute;inset:1px;background:${TAMINOTCHI_RANG};border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);transform:rotate(45deg);border-radius:3px"></span>
    ${yorliqHtml(yorliq, 22)}
  </span>`
}

/**
 * Yetkazayotgan kuryer: rangli doira ichida yuk mashinasi. Joylashuvi
 * eskirgan bo'lsa (ilova yopiq) kulrang — chiziq oxirgi ma'lum joydan.
 */
function kuryerIkonHtml(rang: string, yangilik: Yangilik, yorliq: string | null | undefined, tanlangan: boolean): string {
  const puls = yangilik === 'jonli'
    ? `<span style="position:absolute;inset:-7px;border-radius:9999px;background:${rang};opacity:.3;animation:xarita-puls 1.8s ease-out infinite"></span>`
    : ''
  const halqa = tanlangan ? `,0 0 0 5px ${rang}55` : ''
  const kulrang = yangilik === 'eski' ? 'filter:grayscale(1);opacity:.8;' : ''
  return `<span style="position:relative;display:block;width:30px;height:30px">
    ${puls}
    <span style="position:absolute;inset:0;border-radius:9999px;background:${rang};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)${halqa};display:flex;align-items:center;justify-content:center;${kulrang}">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/>
        <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
        <circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>
      </svg>
    </span>
    ${yorliqHtml(yorliq, 36)}
  </span>`
}

/** Yetkazish manzili: bayroqcha (uchi aynan nuqtada), ustida buyurtma raqami. */
function manzilIkonHtml(rang: string, yorliq: string | null | undefined, tanlangan: boolean): string {
  const k = tanlangan ? 1.15 : 1
  return `<span style="position:relative;display:block;width:26px;height:34px">
    <svg width="26" height="34" viewBox="0 0 26 34" style="display:block;transform:scale(${k});transform-origin:50% 100%;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))">
      <path d="M13 1C6.4 1 1 6.3 1 12.9 1 21.6 13 33 13 33s12-11.4 12-20.1C25 6.3 19.6 1 13 1z" fill="${rang}" stroke="#fff" stroke-width="2"/>
      <circle cx="13" cy="13" r="4.6" fill="#fff"/>
    </svg>
    ${yorliqHtml(yorliq, tanlangan ? 42 : 38)}
  </span>`
}

/** Filial nuqtasi: ko'k kvadrat belgi — xodim nuqtalaridan aniq farqlansin. */
function filialIkonHtml(yorliq?: string | null): string {
  return `<span style="position:relative;display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;background:#4f46e5;border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4"/>
    </svg>
    ${yorliqHtml(yorliq, 32)}
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
  // `maxNativeZoom` — provayderda tayl bor bo'lgan eng katta masshtab.
  // Undan yaqinroqda Leaflet mavjud taylni kattalashtiradi; usiz Esri
  // "ma'lumot yo'q" kulrang rasmini qaytarardi.
  const asos = L.tileLayer(q.url, {
    attribution: q.atribut, maxZoom: q.maxZoom, maxNativeZoom: q.maxNativeZoom,
  }).addTo(xarita)
  let ust: TileLayer | null = null
  if (q.ustQatlam) {
    // Yozuvlar qatlami tayl panelida qoladi, lekin zIndex bilan sputnik
    // tasviri USTIGA chiqariladi. `overlayPane` ishlatilsa Leaflet uni
    // boshqacha joylashtiradi va tasvir bilan mos tushmay qolardi.
    ust = L.tileLayer(q.ustQatlam.url, {
      maxZoom: q.ustQatlam.maxZoom, maxNativeZoom: q.ustQatlam.maxNativeZoom, zIndex: 2,
    }).addTo(xarita)
    asos.setZIndex(1)
  }
  return { asos, ust }
}

export default function Xarita({ nuqtalar, chiziqlar, fokus, onTanlash, korsatish, onBosildi, className, boshlangich }: Props) {
  const idishRef = useRef<HTMLDivElement>(null)
  const xaritaRef = useRef<LeafletMap | null>(null)
  const qatlamRef = useRef<LayerGroup | null>(null)
  const chiziqQatlamRef = useRef<LayerGroup | null>(null)
  const markerlarRef = useRef<Map<string, Marker>>(new Map())
  // Ikon HTML — o'zgarmasa qayta qo'yilmaydi (aks holda har yangilanishda
  // puls animatsiyasi boshidan boshlanib, belgi "miltillardi")
  const ikonlarRef = useRef<Map<string, string>>(new Map())
  const tanlanadiRef = useRef<Map<string, boolean>>(new Map())
  const chiziqlarRef = useRef<Map<string, { hoshiya: Polyline | null; asos: Polyline }>>(new Map())
  // Boshlang'ich kadrlash faqat BIR marta bo'lsin — har yangilanishda
  // xarita sakrab, foydalanuvchi qaragan joyni yo'qotmasin.
  const kadrlandiRef = useRef(false)
  const onBosildiRef = useRef(onBosildi)
  onBosildiRef.current = onBosildi
  const onTanlashRef = useRef(onTanlash)
  onTanlashRef.current = onTanlash
  const boshlangichRef = useRef(boshlangich)
  const [tayyor, setTayyor] = useState(false)

  // Xaritani bir marta yaratish
  useEffect(() => {
    let bekor = false
    let xarita: LeafletMap | null = null
    let kuzatuvchi: ResizeObserver | null = null

    async function boshla() {
      const L = await import('leaflet')
      if (bekor || !idishRef.current || xaritaRef.current) return

      xarita = L.map(idishRef.current, {
        center: boshlangichRef.current?.markaz ?? BOSHLANGICH,
        zoom: boshlangichRef.current?.zoom ?? BOSHLANGICH_ZOOM,
        zoomControl: true,
        attributionControl: true,
      })
      LRef.current = L
      taylRef.current = qatlamniQoy(L, xarita, qatlamRefKalit.current)
      // Chiziqlar markerlardan PASTDA (Leaflet'da overlayPane < markerPane)
      chiziqQatlamRef.current = L.layerGroup().addTo(xarita)
      qatlamRef.current = L.layerGroup().addTo(xarita)
      xarita.on('click', (e) => onBosildiRef.current?.(e.latlng.lat, e.latlng.lng))
      xaritaRef.current = xarita
      if (typeof ResizeObserver !== 'undefined') {
        kuzatuvchi = new ResizeObserver(() => xaritaRef.current?.invalidateSize({ pan: false }))
        kuzatuvchi.observe(idishRef.current)
      }
      setTayyor(true)
    }

    void boshla()
    // Ref qiymatlarini effekt ICHIDA nusxalab olamiz — tozalash paytida
    // `markerlarRef.current` boshqa Map'ga almashgan bo'lishi mumkin.
    const markerlar = markerlarRef.current
    const ikonlar = ikonlarRef.current
    const chiziqlarXaritasi = chiziqlarRef.current
    return () => {
      bekor = true
      kuzatuvchi?.disconnect()
      xaritaRef.current?.remove()
      xaritaRef.current = null
      qatlamRef.current = null
      chiziqQatlamRef.current = null
      markerlar.clear()
      ikonlar.clear()
      chiziqlarXaritasi.clear()
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

        const yorliq = n.yorliq ?? n.nomi
        const rang = n.rang ?? '#2563eb'
        const tanlangan = !!n.tanlangan
        const html =
          n.turi === 'filial' ? filialIkonHtml(yorliq)
          : n.turi === 'mijoz' ? mijozIkonHtml(yorliq)
          : n.turi === 'taminotchi' ? taminotchiIkonHtml(yorliq)
          : n.turi === 'kuryer' ? kuryerIkonHtml(rang, n.yangilik ?? 'eski', yorliq, tanlangan)
          : n.turi === 'manzil' ? manzilIkonHtml(rang, yorliq, tanlangan)
          : xodimIkonHtml(n.yangilik ?? 'eski', yorliq)
        const olcham: [number, number] =
          n.turi === 'filial' ? [26, 26]
          : n.turi === 'taminotchi' ? [16, 16]
          : n.turi === 'kuryer' ? [30, 30]
          : n.turi === 'manzil' ? [26, 34]
          : [14, 14]
        // Bayroqcha uchi bilan nuqtaga tegadi, qolganlari markazi bilan
        const langar: [number, number] = n.turi === 'manzil' ? [13, 33] : [olcham[0] / 2, olcham[1] / 2]
        const oyna =
          `<div style="min-width:150px">
            <div style="font-weight:600;margin-bottom:2px">${xavfsiz(n.nomi)}</div>
            ${n.tavsif ? `<div style="color:#6b7280;font-size:12px">${xavfsiz(n.tavsif)}</div>` : ''}
            ${n.vaqtMatni ? `<div style="color:#9ca3af;font-size:11px;margin-top:3px">${xavfsiz(n.vaqtMatni)}</div>` : ''}
          </div>`
        // Tanlangan kuryer/manzil boshqa belgilar ustida turadi
        const ustunlik = tanlangan ? 1000 : n.turi === 'kuryer' ? 500 : n.turi === 'manzil' ? 400 : 0

        let marker = markerlarRef.current.get(n.id)
        if (marker) {
          marker.setLatLng([n.lat, n.lng])
          if (ikonlarRef.current.get(n.id) !== html) {
            marker.setIcon(L.divIcon({ html, className: 'xarita-ikon', iconSize: olcham, iconAnchor: langar }))
          }
          marker.setZIndexOffset(ustunlik)
        } else {
          const id = n.id
          marker = L.marker([n.lat, n.lng], {
            icon: L.divIcon({ html, className: 'xarita-ikon', iconSize: olcham, iconAnchor: langar }),
            title: n.nomi,
            zIndexOffset: ustunlik,
          }).addTo(qatlam)
          marker.on('click', () => { if (tanlanadiRef.current.get(id)) onTanlashRef.current?.(id) })
          markerlarRef.current.set(id, marker)
        }
        ikonlarRef.current.set(n.id, html)
        // Tanlanadigan nuqtada kichik oyna yo'q — sahifa o'z kartasini ochadi
        const tanlanadi = !!n.tanlanadi && !!onTanlashRef.current
        tanlanadiRef.current.set(n.id, tanlanadi)
        if (tanlanadi) {
          if (marker.getPopup()) marker.unbindPopup()
        } else if (marker.getPopup()) {
          marker.setPopupContent(oyna)
        } else {
          marker.bindPopup(oyna)
        }
      }

      // Yo'qolgan nuqtalarni olib tashlash
      for (const [id, marker] of markerlarRef.current.entries()) {
        if (!koringan.has(id)) {
          qatlam.removeLayer(marker)
          markerlarRef.current.delete(id)
          ikonlarRef.current.delete(id)
          tanlanadiRef.current.delete(id)
        }
      }

      // Birinchi ma'lumot kelganda hamma nuqtani kadrga sig'diramiz.
      // YAGONA nuqta bo'lsa (bitta obyektning joylashuvi oynasi) uzoqdan
      // ko'rsatishning ma'nosi yo'q — sputnik tasviri aniq bo'lgan eng
      // katta darajaga yaqinlashtiramiz, ya'ni bino ko'rinadi.
      if (!kadrlandiRef.current && markerlarRef.current.size > 0) {
        const chegara = L.latLngBounds(nuqtalar.map(n => [n.lat, n.lng] as [number, number]))
        xarita.fitBounds(chegara, {
          padding: [50, 50],
          maxZoom: nuqtalar.length === 1 ? YAGONA_ZOOM : 15,
        })
        kadrlandiRef.current = true
      }
    }

    void yangila()
    return () => { bekor = true }
  }, [nuqtalar, tayyor])

  // Chiziqlar — mavjudlari joyida yangilanadi (qayta yaratilmaydi)
  useEffect(() => {
    const L = LRef.current
    const qatlam = chiziqQatlamRef.current
    if (!tayyor || !L || !qatlam) return
    const koringan = new Set<string>()
    const tanlanganlar: Polyline[] = []

    for (const c of chiziqlar ?? []) {
      if (c.nuqtalar.length < 2) continue
      koringan.add(c.id)
      const qalin = c.tanlangan ? 6 : 4
      const uslub = {
        color: c.rang,
        weight: c.uzuq ? qalin - 1 : qalin,
        opacity: c.tanlangan ? 1 : 0.85,
        dashArray: c.uzuq ? '1 9' : undefined,
        lineCap: 'round' as const,
        lineJoin: 'round' as const,
        // Chiziq bosilishi xaritaning o'z bosilishiga o'tmasin (tanlov yopilib qolardi)
        bubblingMouseEvents: false,
      }
      let ch = chiziqlarRef.current.get(c.id)
      if (ch && !!ch.hoshiya !== !c.uzuq) {
        // Taxminiy ↔ haqiqiy marshrut almashdi — hoshiya bor/yo'qligi o'zgaradi
        if (ch.hoshiya) qatlam.removeLayer(ch.hoshiya)
        qatlam.removeLayer(ch.asos)
        chiziqlarRef.current.delete(c.id)
        ch = undefined
      }
      if (!ch) {
        // Oq hoshiya chiziqni sputnik va to'q xaritada ham ajratib turadi
        const hoshiya = c.uzuq ? null : L.polyline(c.nuqtalar, {
          color: '#ffffff', weight: qalin + 4, opacity: 0.9, lineCap: 'round', lineJoin: 'round', interactive: false,
        }).addTo(qatlam)
        const asos = L.polyline(c.nuqtalar, uslub).addTo(qatlam)
        const tanlashId = c.tanlashId
        if (tanlashId) asos.on('click', () => onTanlashRef.current?.(tanlashId))
        ch = { hoshiya, asos }
        chiziqlarRef.current.set(c.id, ch)
      } else {
        ch.hoshiya?.setLatLngs(c.nuqtalar).setStyle({ weight: qalin + 4 })
        ch.asos.setLatLngs(c.nuqtalar).setStyle(uslub)
      }
      if (c.tanlangan) tanlanganlar.push(...(ch.hoshiya ? [ch.hoshiya] : []), ch.asos)
    }

    for (const [id, ch] of chiziqlarRef.current.entries()) {
      if (koringan.has(id)) continue
      if (ch.hoshiya) qatlam.removeLayer(ch.hoshiya)
      qatlam.removeLayer(ch.asos)
      chiziqlarRef.current.delete(id)
    }
    // Tanlangan yo'nalish boshqa chiziqlar ustida
    for (const p of tanlanganlar) p.bringToFront()
  }, [chiziqlar, tayyor])

  // Tanlangan yo'nalishni kadrga sig'dirish — faqat tanlov o'zgarganda
  const korsatilganRef = useRef<string | null>(null)
  useEffect(() => {
    const L = LRef.current
    const xarita = xaritaRef.current
    if (!tayyor || !L || !xarita) return
    if (!korsatish) { korsatilganRef.current = null; return }
    if (korsatish.kalit === korsatilganRef.current || korsatish.nuqtalar.length === 0) return
    korsatilganRef.current = korsatish.kalit
    kadrlandiRef.current = true
    const pastdan = korsatish.pastdan ?? 0
    const chapdan = korsatish.chapdan ?? 0
    if (korsatish.nuqtalar.length === 1) {
      xarita.flyTo(korsatish.nuqtalar[0], Math.max(xarita.getZoom(), 15), { duration: 0.8 })
      return
    }
    xarita.flyToBounds(L.latLngBounds(korsatish.nuqtalar), {
      paddingTopLeft: [50 + chapdan, 60],
      paddingBottomRight: [50, 50 + pastdan],
      maxZoom: 16,
      duration: 0.8,
    })
  }, [korsatish, tayyor])

  // ── Ko'rinish (tayl qatlami) ──
  // Boshlang'ich qiymat brauzerdan o'qiladi, lekin SERVERDA localStorage
  // yo'q — shuning uchun avval 'oddiy', keyin effektda tiklanadi
  // (gidratatsiya nomuvofiqligining oldini oladi).
  const [qatlam, setQatlam] = useState<QatlamKaliti>('oddiy')
  const [qatlamOchiq, setQatlamOchiq] = useState(false)
  const qatlamRefKalit = useRef<QatlamKaliti>('oddiy')
  const tanlagichRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!qatlamOchiq) return
    const tashqari = (e: PointerEvent) => {
      if (!tanlagichRef.current?.contains(e.target as Node)) setQatlamOchiq(false)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setQatlamOchiq(false) }
    document.addEventListener('pointerdown', tashqari)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', tashqari)
      document.removeEventListener('keydown', esc)
    }
  }, [qatlamOchiq])
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
      {/* O'lcham TASHQI o'ramga beriladi: ichki xarita idishi `h-full`
          bilan uni to'ldiradi. Ilgari `className` ichki divga qo'yilgan
          edi va o'ram balandligi nol bo'lgani uchun xarita umuman
          ko'rinmasdi. */}
      <div className={`relative ${className ?? ''}`}>
        <div ref={idishRef} className="h-full w-full" />

        {/* ── Ko'rinish tanlagich ──
            Xarita ustida suzib turadi. Leaflet'ning o'z boshqaruvi
            o'rniga ilova uslubida — qolgan bo'limlar bilan bir xil. */}
        <div ref={tanlagichRef} className="absolute top-3 right-3 z-[1000]">
          <button
            type="button"
            onClick={() => setQatlamOchiq(o => !o)}
            title="Xarita ko'rinishi"
            aria-haspopup="menu"
            aria-expanded={qatlamOchiq}
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
            <div role="menu" className="mt-2 w-56 max-w-[calc(100vw-3rem)] rounded-xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 shadow-xl overflow-hidden">
              {QATLAM_TARTIBI.map(k => (
                <button
                  key={k}
                  type="button"
                  role="menuitemradio"
                  aria-checked={qatlam === k}
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
