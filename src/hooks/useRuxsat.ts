'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { barchaRuxsatKalitlari, katalogBoyicha } from '@/lib/ruxsat-katalogi'

// Sahifadagi tugma va maydonlarni xodim ruxsatiga qarab ko'rsatish.
//
//   const r = useRuxsat()
//   {r.bor('tovarlar.ochirish') && <OchirishTugmasi />}
//   {r.maydon('tovarlar.kelishNarxi') && <td>{kelishNarxi}</td>}
//
// Avval sessiyadagi ro'yxat ishlatiladi (darhol, miltillamasdan), keyin
// bazadagi jonli holat olinadi: Ega ruxsatni hozirgina o'zgartirgan bo'lsa ham
// tugmalar sahifa ochilganda to'g'ri chiqadi. Bu faqat QULAYLIK — haqiqiy
// himoya serverda (proxy va marshrutlar), yashirilgan tugmani chetlab
// o'tish hech narsa bermaydi.

interface JonliHolat {
  rol: string
  ruxsatlar: string[] | null
  yashirinMaydonlar: string[]
}

let kesh: { vaqt: number; holat: JonliHolat } | null = null
let sorov: Promise<JonliHolat | null> | null = null
const KESH_MS = 20_000

function jonliOl(majburiy = false): Promise<JonliHolat | null> {
  if (!majburiy && kesh && Date.now() - kesh.vaqt < KESH_MS) return Promise.resolve(kesh.holat)
  if (sorov) return sorov
  sorov = fetch('/api/profil/ruxsatlar', { cache: 'no-store' })
    .then(r => (r.ok ? (r.json() as Promise<JonliHolat>) : null))
    .then(h => {
      if (h) kesh = { vaqt: Date.now(), holat: h }
      return h
    })
    .catch(() => null)
    .finally(() => { sorov = null })
  return sorov
}

export function useRuxsat() {
  const { data: session } = useSession()
  const u = session?.user as { rol?: string; ruxsatlar?: string[] | null } | undefined
  const [jonli, setJonli] = useState<JonliHolat | null>(kesh?.holat ?? null)

  useEffect(() => {
    if (!u?.rol) return
    let tirik = true
    const yangila = (majburiy = false) => jonliOl(majburiy).then(h => { if (tirik && h) setJonli(h) })
    void yangila()
    const fokus = () => { if (document.visibilityState === 'visible') void yangila() }
    document.addEventListener('visibilitychange', fokus)
    return () => { tirik = false; document.removeEventListener('visibilitychange', fokus) }
  }, [u?.rol])

  const rol = jonli?.rol ?? u?.rol
  const sessiyaRuxsatlari = u?.ruxsatlar
  const ruxsatlar = useMemo(() => (jonli ? jonli.ruxsatlar : (sessiyaRuxsatlari ?? [])), [jonli, sessiyaRuxsatlari])
  const yashirin = jonli?.yashirinMaydonlar

  /** Bo'lim yoki amal ochiqmi. Katalogda yo'q kalit — ruxsat tizimi boshqarmaydi (`true`). */
  const bor = useCallback((kalit: string): boolean => {
    if (!rol) return false
    if (rol === 'ADMIN') return true
    if (!barchaRuxsatKalitlari.includes(kalit)) return true
    return Array.isArray(ruxsatlar) && ruxsatlar.includes(kalit)
  }, [rol, ruxsatlar])

  /** Ma'lumot maydoni ko'rinadimi (`tovarlar.kelishNarxi` kabi katalog kaliti). */
  const maydon = useCallback((kalit: string): boolean => {
    const r = katalogBoyicha.get(kalit)
    if (!r?.maydon) return true
    // Jonli holat kelmaguncha yashirin deb hisoblanmaydi — server baribir null qaytaradi
    return !yashirin?.includes(r.maydon)
  }, [yashirin])

  return { rol, admin: rol === 'ADMIN', bor, maydon, yuklandi: !!jonli }
}
