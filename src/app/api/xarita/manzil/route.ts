import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { xaritaRuxsati } from '@/lib/xarita-server'
import { koordinataTogrimi } from '@/lib/xarita-havola'
import { manzilKaliti } from '@/lib/lokatsiya-izi'

// Koordinata → ko'cha manzili (yurgan yo'ldagi to'xtash joylari uchun).
//
// OpenStreetMap Nominatim — ochiq xizmat, API kalit talab qilmaydi, lekin
// sekundiga bitta so'rov va aniq User-Agent shart. Shuning uchun: avval
// bazadagi kesh (`manzil_keshi`, bir joy bir marta so'raladi), so'rovlar
// ketma-ket va orasi kamida 1,1 s. Xizmat javob bermasa 502 — sahifa
// koordinata va xarita havolasini ko'rsatadi, keshga hech narsa yozilmaydi.

export const dynamic = 'force-dynamic'

const UA = 'BioMax-ERP/1.0 (+https://www.biomaxx.store)'
const ORALIQ_MS = 1_100
let navbat: Promise<unknown> = Promise.resolve()
let oxirgiSorov = 0

interface NominatimManzil {
  road?: string; pedestrian?: string; footway?: string; residential?: string; house_number?: string
  amenity?: string; shop?: string; building?: string; office?: string
  neighbourhood?: string; suburb?: string; quarter?: string
  city_district?: string; county?: string; district?: string
  city?: string; town?: string; village?: string
}

/** Qisqa, o'qiladigan manzil: "Korzinka, Bunyodkor ko'chasi 12, Chilonzor tumani, Toshkent". */
function manzilMatni(a: NominatimManzil | undefined, toliq: string | undefined): string | null {
  if (!a) return toliq?.split(',').slice(0, 4).join(',').trim() || null
  const kocha = [a.road ?? a.pedestrian ?? a.footway ?? a.residential, a.house_number].filter(Boolean).join(' ')
  const qismlar = [
    a.amenity ?? a.shop ?? a.office,
    kocha,
    a.neighbourhood ?? a.quarter ?? a.suburb,
    a.city_district ?? a.district ?? a.county,
    a.city ?? a.town ?? a.village,
  ].filter((x): x is string => !!x && x.trim().length > 0)
  const takrorsiz = qismlar.filter((x, i) => qismlar.indexOf(x) === i)
  return takrorsiz.slice(0, 4).join(', ') || toliq?.split(',').slice(0, 4).join(',').trim() || null
}

/** `undefined` — xizmat javob bermadi (keshlanmaydi), `null` — joy uchun manzil yo'q. */
async function nominatim(lat: number, lng: number): Promise<string | null | undefined> {
  const ish = navbat.then(async () => {
    const kutish = oxirgiSorov + ORALIQ_MS - Date.now()
    if (kutish > 0) await new Promise(r => setTimeout(r, kutish))
    oxirgiSorov = Date.now()
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=uz,ru`
    const javob = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(6_000),
      cache: 'no-store',
    })
    if (!javob.ok) return undefined
    const j = await javob.json().catch(() => null) as { error?: string; address?: NominatimManzil; display_name?: string } | null
    if (!j) return undefined
    if (j.error) return null
    return manzilMatni(j.address, j.display_name)
  })
  navbat = ish.catch(() => undefined)
  return ish.catch(() => undefined)
}

export async function GET(req: NextRequest) {
  const r = await xaritaRuxsati()
  if (!r.ok) return r.javob

  const lat = Number(req.nextUrl.searchParams.get('lat'))
  const lng = Number(req.nextUrl.searchParams.get('lng'))
  if (!koordinataTogrimi(lat, lng)) return NextResponse.json({ xato: 'Koordinata noto‘g‘ri' }, { status: 400 })

  const kalit = manzilKaliti(lat, lng)
  try {
    const bor = await prisma.manzilKeshi.findUnique({ where: { kalit }, select: { manzil: true } })
    if (bor) return NextResponse.json({ manzil: bor.manzil })

    const manzil = await nominatim(Number(lat.toFixed(5)), Number(lng.toFixed(5)))
    if (manzil === undefined) return NextResponse.json({ manzil: null, xato: 'Manzil xizmati javob bermadi' }, { status: 502 })
    await prisma.manzilKeshi.upsert({ where: { kalit }, update: { manzil }, create: { kalit, manzil } })
    return NextResponse.json({ manzil })
  } catch (e) {
    console.error('[xarita manzil]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
