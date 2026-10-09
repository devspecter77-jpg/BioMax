'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { marshrutmi, masofa, qolganYol, type Marshrut, type Nuqta, type YolProfil } from '@/lib/yonalish'

export interface YonalishSorovi {
  /** Odatda buyurtma raqami */
  kalit: string
  dan: Nuqta
  ga: Nuqta
  profil: YolProfil
}

interface Saqlangan extends Marshrut {
  ga: Nuqta
  profil: YolProfil
}

// Butun ilova uchun bitta kesh: xarita va dostavchik oynasi bir buyurtmaning
// marshrutini ikki marta so'ramaydi.
const kesh = new Map<string, Saqlangan>()
const kutilmoqda = new Set<string>()
const oxirgiUrinish = new Map<string, number>()
/** Bitta buyurtma uchun so'rovlar orasidagi eng kam vaqt (xizmatni ayash). */
const ORALIQ_MS = 15_000

function yangisiKerak(s: YonalishSorovi): boolean {
  const bor = kesh.get(s.kalit)
  if (!bor) return true
  if (bor.profil !== s.profil || masofa(bor.ga, s.ga) > 30) return true
  return qolganYol(bor.nuqtalar, s.dan)?.chetda ?? true
}

/**
 * Ko'chalar bo'ylab marshrutlar. Har buyurtma uchun bir marta olinadi;
 * kuryer marshrutdan chetga chiqsa (boshqa ko'chaga burilsa) yoki manzil
 * o'zgarsa yangilanadi. Xizmat javob bermasa marshrut bo'lmaydi — chaqiruvchi
 * to'g'ri chiziq chizadi.
 */
export function useYonalishlar(sorovlar: YonalishSorovi[]): Map<string, Marshrut> {
  const [versiya, setVersiya] = useState(0)
  const tirik = useRef(true)
  useEffect(() => {
    tirik.current = true
    return () => { tirik.current = false }
  }, [])

  // Faqat mazmun o'zgarganda ishga tushsin (har render yangi massiv keladi)
  const imzo = sorovlar.map(s => `${s.kalit}|${s.profil}|${s.dan.join()}|${s.ga.join()}`).join(';')

  useEffect(() => {
    for (const s of sorovlar) {
      if (!yangisiKerak(s) || kutilmoqda.has(s.kalit)) continue
      if (Date.now() - (oxirgiUrinish.get(s.kalit) ?? 0) < ORALIQ_MS) continue
      kutilmoqda.add(s.kalit)
      oxirgiUrinish.set(s.kalit, Date.now())
      const p = new URLSearchParams({ dan: s.dan.join(','), ga: s.ga.join(','), profil: s.profil })
      void fetch(`/api/xarita/yonalish?${p}`, { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .then((j: unknown) => {
          if (marshrutmi(j)) kesh.set(s.kalit, { ...j, ga: s.ga, profil: s.profil })
        })
        .catch(() => {})
        .finally(() => {
          kutilmoqda.delete(s.kalit)
          if (tirik.current) setVersiya(v => v + 1)
        })
    }
    // `sorovlar` imzo orqali kuzatiladi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imzo])

  return useMemo(() => {
    const natija = new Map<string, Marshrut>()
    for (const s of sorovlar) {
      const m = kesh.get(s.kalit)
      if (m && m.profil === s.profil && masofa(m.ga, s.ga) <= 30) natija.set(s.kalit, m)
    }
    return natija
    // `versiya` — yangi marshrut kelganda qayta hisoblash uchun
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imzo, versiya])
}
