'use client'

import { useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { masofaM } from '@/lib/dostavchik'

// Xodim/Ega ilova ochiq turganda joylashuvini sokin ravishda yozib boradi —
// Xarita bo'limida "hozir qayerda" jonli ko'rinishi uchun.
//
// MUHIM CHEKLOV: brauzer ilova YOPIQ bo'lganda joylashuvni o'qiy olmaydi.
// Ya'ni xodim ilovani yopsa, uning nuqtasi oxirgi ma'lum joyda qotib qoladi
// (Xarita bo'limi buni "eskirgan" deb kulrang ko'rsatadi).
//
// Ruxsat majburlanmaydi: rad etilsa yoki xato bo'lsa hech qanday xabar
// chiqmaydi, ilova odatdagidek ishlayveradi.

/** Serverga eng tez-tez shuncha vaqtda bir marta yoziladi. */
const MIN_ORALIQ_MS = 15_000
/** Shu masofadan kam siljish yozilmaydi (GPS "sakrashi" bazani to'ldirmasin). */
const MIN_MASOFA_M = 20
/**
 * Joyidan qimirlamasa ham shuncha vaqtda bir "tirikman" yuboriladi. Brauzer
 * joylashuv o'zgarmasa hodisa bermaydi — mijoz oldida turgan dostavchik
 * aks holda bir necha daqiqada "eskirgan" bo'lib ko'rinardi.
 */
const TIRIK_ORALIQ_MS = 60_000

export default function LokatsiyaKuzatuv() {
  const { status } = useSession()
  const oxirgi = useRef<{ lat: number; lng: number; vaqt: number } | null>(null)
  const yuborilmoqda = useRef(false)

  useEffect(() => {
    if (status !== 'authenticated') return
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    // Geolocation faqat xavfsiz kontekstda (https:// yoki localhost) ishlaydi
    if (typeof window === 'undefined' || !window.isSecureContext) return

    async function yubor(lat: number, lng: number) {
      if (yuborilmoqda.current) return
      yuborilmoqda.current = true
      try {
        await fetch('/api/profil/lokatsiya', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lng }),
        })
        oxirgi.current = { lat, lng, vaqt: Date.now() }
      } catch {
        // Tarmoq uzilgan bo'lsa jim o'tkazib yuboramiz — keyingi
        // o'zgarishda yana urinib ko'riladi.
      } finally {
        yuborilmoqda.current = false
      }
    }

    const kuzatuvId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        const oldingi = oxirgi.current

        if (oldingi) {
          const vaqtOtdi = Date.now() - oldingi.vaqt
          const siljidi = masofaM(oldingi, { lat, lng })
          // Har mayda tebranishda so'rov yubormaymiz: yo yetarlicha
          // siljigan bo'lsin, yo oxirgi yozuvdan ancha vaqt o'tgan bo'lsin.
          if (siljidi < MIN_MASOFA_M && vaqtOtdi < MIN_ORALIQ_MS) return
          if (vaqtOtdi < 3_000) return
        }

        void yubor(lat, lng)
      },
      () => {},
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 10_000 },
    )

    // Joyidan siljimaganda ham vaqti-vaqti bilan oxirgi nuqtani qayta yozamiz
    const tirik = setInterval(() => {
      const o = oxirgi.current
      if (!o || document.visibilityState !== 'visible') return
      if (Date.now() - o.vaqt >= TIRIK_ORALIQ_MS - 1_000) void yubor(o.lat, o.lng)
    }, TIRIK_ORALIQ_MS)

    return () => {
      navigator.geolocation.clearWatch(kuzatuvId)
      clearInterval(tirik)
    }
  }, [status])

  return null
}
