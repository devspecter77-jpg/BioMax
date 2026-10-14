'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Headphones, Loader2, Square, Volume2 } from 'lucide-react'
import {
  JONLI_ORQADA_MS, JONLI_SOROV_MS, YOZUV_HOLATI_MATNI, soatMatni, type YozuvHolati,
} from '@/lib/smena'
import type { YozuvMalumoti } from '@/lib/smena-server'

// Ochiq smenani DEYARLI JONLI tinglash.
//
// Haqiqiy jonli (WebRTC) doimiy ulanish talab qiladi — sayt serverless
// muhitda ishlaydi, u yerda bunday ulanish ushlanmaydi. Shuning uchun:
// tinglash yoqilganda kuryer ilovasi ovozni qisqa (~12 s) bo'laklarga
// bo'lib darhol yuboradi, bu sahifa esa yangi bo'lakni kelishi bilan
// navbatga qo'yib, uzluksiz o'ynatadi. Ovoz ~15-20 soniya kechikadi va
// o'sha bo'laklar odatdagidek bazada saqlanib qoladi.

interface Javob {
  bolaklar: YozuvMalumoti[]
  serverVaqti: number
  tayyor: boolean
  aloqa: boolean
  yozuvHolati: YozuvHolati | null
}

export default function JonliPleer({ xodimId, smenaId }: { xodimId: string; smenaId: string }) {
  const [yoqilgan, setYoqilgan] = useState(false)
  const [holat, setHolat] = useState<Javob | null>(null)
  const [joriy, setJoriy] = useState<YozuvMalumoti | null>(null)
  const [xato, setXato] = useState<string | null>(null)
  const [kechikish, setKechikish] = useState<number | null>(null)

  const audioRef = useRef<HTMLAudioElement>(null)
  // Kelgan, lekin hali o'ynalmagan bo'laklar
  const navbat = useRef<YozuvMalumoti[]>([])
  // Eng oxirgi olingan bo'lak vaqti — keyingi so'rov shundan keyingisini oladi
  const oxirgi = useRef(0)
  const oynamoqda = useRef(false)

  const toxta = useCallback(() => {
    setYoqilgan(false)
    navbat.current = []
    oynamoqda.current = false
    const a = audioRef.current
    if (a) { a.pause(); a.removeAttribute('src'); a.load() }
    setJoriy(null)
    setKechikish(null)
  }, [])

  /** Navbatdagi keyingi bo'lakni o'ynatadi; orqada qolsa oxirgisiga o'tadi. */
  const keyingisi = useCallback(() => {
    const a = audioRef.current
    if (!a) return
    if (navbat.current.length === 0) { oynamoqda.current = false; setJoriy(null); return }
    // Juda orqada qolgan bo'lsa (ilova fonda turgan, tarmoq sekin) — "hozir"ga sakraymiz
    const eng = navbat.current[navbat.current.length - 1]
    if (Date.now() - new Date(eng.boshlandi).getTime() > JONLI_ORQADA_MS) {
      navbat.current = [eng]
    }
    const b = navbat.current.shift()!
    oynamoqda.current = true
    setJoriy(b)
    setKechikish(Math.max(0, Date.now() - new Date(b.tugadi).getTime()))
    a.src = `/api/xodimlar/${xodimId}/ovozlar/${b.id}`
    a.play().catch((e: DOMException) => {
      oynamoqda.current = false
      if (e?.name === 'NotAllowedError') {
        setXato('Brauzer ovozni o‘zi yoqmadi — pleerdagi ▶ tugmasini bir marta bosing')
      }
    })
  }, [xodimId])

  // ── So'rov halqasi: yangi bo'laklarni olish + "tinglayapman" deb bildirish ──
  useEffect(() => {
    if (!yoqilgan) return
    let toxtadi = false
    let taymer: ReturnType<typeof setTimeout> | undefined

    async function sora() {
      if (toxtadi) return
      try {
        const u = new URL(`/api/xodimlar/${xodimId}/smenalar/jonli`, window.location.origin)
        u.searchParams.set('smenaId', smenaId)
        if (oxirgi.current) u.searchParams.set('dan', String(oxirgi.current))
        const r = await fetch(u, { cache: 'no-store' })
        const j = await r.json().catch(() => ({}))
        if (toxtadi) return
        if (!r.ok) {
          setXato(j.xato || 'Jonli tinglash uzildi')
          if (r.status === 409 || r.status === 403 || r.status === 404) { toxta(); return }
        } else {
          setXato(null)
          setHolat(j as Javob)
          for (const b of (j as Javob).bolaklar) {
            const t = new Date(b.boshlandi).getTime()
            if (t <= oxirgi.current) continue
            oxirgi.current = t
            navbat.current.push(b)
          }
          if (!oynamoqda.current && navbat.current.length > 0) keyingisi()
        }
      } catch {
        if (!toxtadi) setXato('Internet aloqasini tekshiring')
      }
      if (!toxtadi) taymer = setTimeout(sora, JONLI_SOROV_MS)
    }

    void sora()
    return () => { toxtadi = true; clearTimeout(taymer) }
  }, [yoqilgan, xodimId, smenaId, keyingisi, toxta])

  // Sahifadan chiqilsa tinglash o'zi to'xtaydi (belgi eskirib, kuryer uzun bo'lakka qaytadi)
  useEffect(() => () => { navbat.current = []; oynamoqda.current = false }, [])

  if (!yoqilgan) {
    return (
      <button
        type="button"
        onClick={() => { oxirgi.current = 0; setXato(null); setYoqilgan(true) }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 px-3 py-2 text-xs font-semibold text-sky-800 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-950/70 transition"
      >
        <Headphones size={14} aria-hidden /> Jonli tinglash
      </button>
    )
  }

  // Hech narsa o'ynalmayapti — demak yangi bo'lak kutilmoqda
  const kutilmoqda = !joriy
  const muammo = holat && !holat.aloqa
    ? 'Xodim ilovasi bilan aloqa yo‘q — yangi ovoz kelmayapti'
    : holat?.yozuvHolati && holat.yozuvHolati !== 'yozilmoqda'
      ? YOZUV_HOLATI_MATNI[holat.yozuvHolati]
      : null

  return (
    <div className="space-y-2 rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50/70 dark:bg-sky-950/30 p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-semibold text-sky-900 dark:text-sky-300">
          <span className="relative flex h-2 w-2" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-600" />
          </span>
          Jonli tinglanmoqda
          {kechikish !== null && (
            <span className="font-normal text-sky-700/80 dark:text-sky-400/80">
              · {Math.round(kechikish / 1000)} soniya orqada
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={toxta}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300"
        >
          <Square size={12} aria-hidden /> To‘xtatish
        </button>
      </div>

      {/* Pleer ko'rinib turadi: brauzer avtoijroni to'ssa ham qo'lda bosib bo'lsin */}
      <audio ref={audioRef} controls autoPlay className="w-full h-10" onEnded={keyingisi} onError={keyingisi} />

      <p className="flex items-center gap-1.5 text-[11px] text-sky-800/90 dark:text-sky-300/90">
        <Volume2 size={12} className="shrink-0" aria-hidden />
        {joriy
          ? `${soatMatni(joriy.boshlandi)}–${soatMatni(joriy.tugadi)} eshitilmoqda`
          : holat && !holat.tayyor
            ? 'Xodim ilovasiga xabar berilmoqda — birinchi ovoz ~20 soniyada keladi'
            : kutilmoqda ? 'Yangi ovoz kutilmoqda…' : 'Tayyorlanmoqda…'}
        {kutilmoqda && <Loader2 size={11} className="animate-spin" aria-hidden />}
      </p>

      {(xato || muammo) && (
        <p role="alert" className="flex items-start gap-1.5 text-[11px] text-amber-800 dark:text-amber-300">
          <AlertTriangle size={12} className="mt-px shrink-0" aria-hidden /> {xato ?? muammo}
        </p>
      )}

      <p className="text-[11px] text-gray-500 dark:text-gray-400">
        Ovoz ~15–20 soniya kechikish bilan eshitiladi va odatdagidek saqlanib boradi.
        Xodim panelida «rahbariyat jonli tinglamoqda» deb ko‘rinadi.
      </p>
    </div>
  )
}
