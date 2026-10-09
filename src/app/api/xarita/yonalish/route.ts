import { NextRequest, NextResponse } from 'next/server'
import { xaritaRuxsati } from '@/lib/xarita-server'
import { koordinataTogrimi } from '@/lib/xarita-havola'
import { masofa, type Marshrut, type Nuqta, type YolProfil } from '@/lib/yonalish'

// Kuryerdan manzilgacha KO'CHALAR BO'YLAB marshrut.
//
// OpenStreetMap asosidagi ochiq OSRM serverlaridan olinadi (API kalit va
// to'lov talab qilmaydi): avval FOSSGIS (mashina/velosiped/piyoda), mashina
// uchun zaxira — project-osrm. Ular "adolatli foydalanish" shartida ishlaydi,
// shuning uchun javob keshlanadi va xarita marshrutni har siljishda emas,
// faqat kuryer yo'ldan chetga chiqqanda qayta so'raydi. Xizmat javob
// bermasa 502 — xarita to'g'ri (uzuq) chiziq chizadi.

export const dynamic = 'force-dynamic'

const PROFILLAR: YolProfil[] = ['car', 'bike', 'foot']
const KESH_MS = 10 * 60_000
const KESH_MAX = 300
const kesh = new Map<string, { vaqt: number; marshrut: Marshrut }>()

function nuqtaOl(s: string | null): Nuqta | null {
  const [lat, lng] = (s ?? '').split(',').map(Number)
  return koordinataTogrimi(lat, lng) ? [lat, lng] : null
}

/** Taxminan 11 m aniqlik — bir joyda turgan kuryer uchun kesh ishlasin. */
const yaxlit = (n: Nuqta) => `${n[0].toFixed(4)},${n[1].toFixed(4)}`

async function osrm(url: string): Promise<Marshrut | null> {
  const javob = await fetch(url, {
    headers: { 'User-Agent': 'BioMax-ERP/1.0 (+https://www.biomaxx.store)' },
    signal: AbortSignal.timeout(6_000),
    cache: 'no-store',
  })
  if (!javob.ok) return null
  const j = await javob.json().catch(() => null) as {
    code?: string; routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[]
  } | null
  const r = j?.code === 'Ok' ? j.routes?.[0] : undefined
  if (!r || !Array.isArray(r.geometry?.coordinates) || r.geometry.coordinates.length < 2) return null
  return {
    // GeoJSON [uzunlik, kenglik] → Leaflet [kenglik, uzunlik]; 6 xona ≈ 10 sm
    nuqtalar: r.geometry.coordinates.map(([lng, lat]) => [+lat.toFixed(6), +lng.toFixed(6)] as Nuqta),
    masofaM: Math.round(r.distance),
    vaqtS: Math.round(r.duration),
  }
}

export async function GET(req: NextRequest) {
  const r = await xaritaRuxsati()
  if (!r.ok) return r.javob

  const sp = req.nextUrl.searchParams
  const dan = nuqtaOl(sp.get('dan'))
  const ga = nuqtaOl(sp.get('ga'))
  const profil = (PROFILLAR as string[]).includes(sp.get('profil') ?? '') ? (sp.get('profil') as YolProfil) : 'car'
  if (!dan || !ga) return NextResponse.json({ xato: 'Koordinata noto‘g‘ri' }, { status: 400 })
  // Shahar ichidagi yetkazish uchun; juda uzoq yo'l — xato koordinata belgisi
  if (masofa(dan, ga) > 300_000) return NextResponse.json({ xato: 'Manzil juda uzoq' }, { status: 422 })

  const kalit = `${profil}:${yaxlit(dan)}:${yaxlit(ga)}`
  const bor = kesh.get(kalit)
  if (bor && Date.now() - bor.vaqt < KESH_MS) return NextResponse.json(bor.marshrut)

  const juft = `${dan[1]},${dan[0]};${ga[1]},${ga[0]}`
  const sorov = '?overview=full&geometries=geojson&alternatives=false&steps=false'
  const manbalar = [
    `https://routing.openstreetmap.de/routed-${profil}/route/v1/driving/${juft}${sorov}`,
    ...(profil === 'car' ? [`https://router.project-osrm.org/route/v1/driving/${juft}${sorov}`] : []),
  ]
  for (const url of manbalar) {
    try {
      const marshrut = await osrm(url)
      if (!marshrut) continue
      if (kesh.size >= KESH_MAX) kesh.delete(kesh.keys().next().value!)
      kesh.set(kalit, { vaqt: Date.now(), marshrut })
      return NextResponse.json(marshrut)
    } catch {
      // vaqt tugadi yoki tarmoq — keyingi manba
    }
  }
  return NextResponse.json({ xato: 'Marshrut xizmati javob bermadi' }, { status: 502 })
}
