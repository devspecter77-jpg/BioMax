'use client'

import { useEffect, useRef } from 'react'
import { SessionProvider as NextAuthSessionProvider, useSession } from 'next-auth/react'
import type { Session } from 'next-auth'
import { aslFetch, sessiyaFetchniOrnat } from '@/lib/sessiya-fetch'

// Modul yuklanganda — NextAuth birinchi so'rovni yuborishidan OLDIN
sessiyaFetchniOrnat()

// Sessiya provayderi va uni jonli tutib turuvchi qorovul.
//
// NextAuth'ning o'z avtomatik yangilashi (`refetchInterval`, `refetchOnWindowFocus`)
// ATAYLAB o'chirilgan. Sabab: so'rov bir marta muvaffaqiyatsiz bo'lsa (server qayta
// ishga tushyapti, internet uzildi, noutbuk uyqudan uyg'ondi) u
//   1) `console.error(ClientFetchError: Failed to fetch)` chiqaradi — dev rejimda
//      Next.js buni qizil xato oynasi qilib ko'rsatadi;
//   2) sessiyani `null` qilib qo'yadi — xodim tizimdan chiqmagan bo'lsa ham menyu va
//      tugmalar yo'qoladi, keyingi yangilashlar ham to'xtaydi (sahifa yangilanmaguncha).
//
// Buning ikki qatlami bor: `lib/sessiya-fetch.ts` NextAuth'ning barcha sessiya
// so'rovlarini xatodan himoyalaydi (oxirgi to'g'ri sessiyani qaytaradi), qorovul esa
// sessiyani himoyasiz asl `fetch` bilan tekshiradi: xato bo'lsa jim turadi, joriy
// sessiyaga tegmaydi va biroz kutib qayta urinadi. Ruxsatlar (yoki rol) haqiqatda
// o'zgargandagina NextAuth holatini yangilaydi. Hisob o'chirilgan yoki muddati tugagan
// bo'lsa — kirish sahifasiga yuboradi.

const ODDIY_MS = 60_000
const BIRINCHI_XATO_MS = 15_000
const ENG_UZOQ_MS = 120_000
const SOROV_KUTISH_MS = 10_000
/** Oyna qayta ko'ringanda — oxirgi tekshiruvdan shuncha o'tgan bo'lsa darhol tekshiriladi */
const FOKUS_ORALIQ_MS = 20_000
/** Sahifa ochilganda sessiya kelmagan bo'lsa (birinchi so'rov uzilgan) — tez qayta urinish */
const TIKLASH_MS = 4_000
/** Sessiyasiz ham ochiladigan sahifalar — bu yerda "kelmagan sessiya"ni tiklash kerak emas */
const OCHIQ_YOLLAR = ['/login', '/qr/', '/chek/']
const ochiqSahifami = () => OCHIQ_YOLLAR.some(y => window.location.pathname.startsWith(y))

type Natija = { ok: true; sessiya: Session | null } | { ok: false }

/** Sessiyani jim o'qish: tarmoq xatosi, vaqt tugashi yoki JSON bo'lmagan javob — `ok: false`. */
async function sessiyaniOqi(): Promise<Natija> {
  const boshqaruv = new AbortController()
  const soat = setTimeout(() => boshqaruv.abort(), SOROV_KUTISH_MS)
  try {
    const r = await aslFetch('/api/auth/session', { cache: 'no-store', credentials: 'same-origin', signal: boshqaruv.signal })
    if (!r.ok) return { ok: false }
    const matn = await r.text()
    // Dev server qayta kompilyatsiya qilayotganda HTML sahifa qaytishi mumkin
    let json: unknown
    try { json = matn ? JSON.parse(matn) : null } catch { return { ok: false } }
    const sessiya = json && typeof json === 'object' && 'user' in json ? (json as Session) : null
    return { ok: true, sessiya }
  } catch {
    return { ok: false }
  } finally {
    clearTimeout(soat)
  }
}

/** Menyu va ruxsatlarga ta'sir qiladigan maydonlar — `expires` har so'rovda o'zgaradi, u hisobga olinmaydi. */
export function sessiyaBelgisi(s: Session | null | undefined): string {
  const u = s?.user as Record<string, unknown> | undefined
  if (!u) return ''
  const ruxsatlar = Array.isArray(u.ruxsatlar) ? [...(u.ruxsatlar as string[])].sort() : u.ruxsatlar ?? null
  return JSON.stringify([
    u.id, u.name, u.rol, u.filialId, u.filialNomi, u.ulashilganEgaId,
    u.tovarTahrirlashMumkin, u.tovarOchirishMumkin, ruxsatlar,
  ])
}

function SessiyaQorovuli() {
  const { data, status, update } = useSession()
  // Effekt har renderda qayta ishga tushmasin — eng so'nggi qiymatlar ref orqali
  const joriy = useRef({ data, status, update })
  const tezTekshir = useRef<() => void>(() => {})
  useEffect(() => { joriy.current = { data, status, update } }, [data, status, update])

  // Himoyalangan sahifada sessiya yo'q chiqdi — birinchi so'rov uzilgan bo'lishi mumkin
  useEffect(() => {
    if (status === 'unauthenticated' && !ochiqSahifami()) tezTekshir.current()
  }, [status])

  useEffect(() => {
    let toxtadi = false
    let taymer: ReturnType<typeof setTimeout> | null = null
    let kechikish = ODDIY_MS
    let band = false
    let oxirgi = Date.now()

    const rejala = (ms: number) => {
      if (taymer) clearTimeout(taymer)
      if (!toxtadi) taymer = setTimeout(() => void tekshir(), ms)
    }

    async function tekshir() {
      if (toxtadi || band) return
      const h = joriy.current
      const tiklash = h.status === 'unauthenticated' && !ochiqSahifami()
      // Kirgan foydalanuvchi (yoki tiklanishi kerak bo'lgan sessiya), ko'rinib turgan oyna va internet bor paytda
      if ((h.status !== 'authenticated' && !tiklash) || document.visibilityState !== 'visible' || !navigator.onLine) {
        rejala(tiklash ? TIKLASH_MS : ODDIY_MS)
        return
      }
      band = true
      oxirgi = Date.now()
      try {
        const n = await sessiyaniOqi()
        if (!n.ok) {
          kechikish = tiklash
            ? Math.min(Math.max(kechikish === ODDIY_MS ? TIKLASH_MS : kechikish * 2, TIKLASH_MS), ENG_UZOQ_MS)
            : kechikish >= ODDIY_MS ? BIRINCHI_XATO_MS : Math.min(kechikish * 2, ENG_UZOQ_MS)
          return
        }
        kechikish = ODDIY_MS
        if (tiklash) {
          // Sessiya aslida bor edi — NextAuth holatini tiklaymiz; yo'q bo'lsa proxy o'zi kirishga yuboradi
          if (n.sessiya) await joriy.current.update()
          return
        }
        if (!n.sessiya) {
          // Server sessiyani tan olmadi: hisob nofaol qilingan yoki muddati tugagan
          if (!window.location.pathname.startsWith('/login')) window.location.assign('/login')
          return
        }
        if (sessiyaBelgisi(n.sessiya) !== sessiyaBelgisi(joriy.current.data)) {
          // Ruxsat yoki rol o'zgargan — menyu va tugmalar yangilansin.
          // `update()` muvaffaqiyatsiz bo'lsa ham joriy sessiyani o'chirmaydi.
          await joriy.current.update()
        }
      } finally {
        band = false
        rejala(kechikish)
      }
    }

    const qaytaKorindi = () => {
      if (document.visibilityState === 'visible' && Date.now() - oxirgi > FOKUS_ORALIQ_MS) void tekshir()
    }
    const internetQaytdi = () => { kechikish = ODDIY_MS; void tekshir() }
    tezTekshir.current = () => { kechikish = ODDIY_MS; rejala(TIKLASH_MS) }

    rejala(ODDIY_MS)
    document.addEventListener('visibilitychange', qaytaKorindi)
    window.addEventListener('online', internetQaytdi)
    return () => {
      toxtadi = true
      if (taymer) clearTimeout(taymer)
      document.removeEventListener('visibilitychange', qaytaKorindi)
      window.removeEventListener('online', internetQaytdi)
    }
  }, [])

  return null
}

export default function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider refetchOnWindowFocus={false} refetchWhenOffline={false}>
      <SessiyaQorovuli />
      {children}
    </NextAuthSessionProvider>
  )
}
