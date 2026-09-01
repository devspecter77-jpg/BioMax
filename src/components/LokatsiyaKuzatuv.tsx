'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'

// Xodim/Ega saytga kirganda (brauzer ruxsat bergan bo'lsa) joylashuvini
// sokin ravishda yozib qo'yadi — Ega Filiallar sahifasida "hozir shu
// yerda" deb ko'rishi uchun. Ruxsat majburlanmaydi va so'ralganda rad
// etilsa yoki xato bo'lsa — hech qanday xabar ko'rsatilmaydi (fon vazifasi).
export default function LokatsiyaKuzatuv() {
  const { status } = useSession()

  useEffect(() => {
    if (status !== 'authenticated') return
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    if (typeof window === 'undefined' || !window.isSecureContext) return

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetch('/api/profil/lokatsiya', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        }).catch(() => {})
      },
      () => {},
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    )
  }, [status])

  return null
}
