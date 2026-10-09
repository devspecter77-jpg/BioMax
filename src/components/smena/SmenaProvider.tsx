'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { OvozYozgich, mikrofonXatosi, mikrofonniOch, yozishQollanadimi } from '@/lib/ovoz-yozgich'
import {
  barchaSegmentlar, navbatHolati, navbatniQisqart, segmentFayli, segmentniOchir, urinishniBelgila, yetimlarniYop,
} from '@/lib/ovoz-navbat'
import {
  BITREYT, BOLAK_MAX_BAYT, BOLAK_MS, NAVBAT_MAX_BAYT, PULS_MS, QISM_MS, kengaytma, smenaRolimi,
  type YozuvHolati,
} from '@/lib/smena'

// Kuryerning ish smenasi va ovoz yozuvi — butun panel darajasida.
//
// Layout'da turadi: kuryer "Bosh sahifa" va "Onlayn buyurtmalar" orasida
// o'tganda ham yozuv uzilmaydi (sahifaga bog'lansa har o'tishda to'xtardi).
// Kuryer bo'lmagan foydalanuvchi uchun hech narsa qilmaydi.

export interface SmenaServerHolati {
  mavjud: true
  rozilik: boolean
  omborTayyor: boolean
  saqlashKun: number
  serverVaqti: number
  smena: { id: string; boshlandi: string } | null
  bugun: { id: string; boshlandi: string; tugadi: string | null; yozilganMs: number; smenaMs: number }[]
}

export type YozuvKorinishi = YozuvHolati | 'toxtatilgan' | 'boshlanmoqda'

interface SmenaKonteksti {
  /** Foydalanuvchi kuryer va smena yurita oladi */
  mavjud: boolean
  server: SmenaServerHolati | null
  yozuv: { holat: YozuvKorinishi; xato?: string }
  daraja: number
  navbat: { soni: number; hajm: number }
  yuborildi: number
  rad: number
  band: boolean
  onlayn: boolean
  ekranYoniq: boolean
  /** Server vaqtiga moslangan hozirgi vaqt (ms) */
  vaqt: () => number
  boshla: () => Promise<void>
  tugat: () => Promise<void>
  rozilikBer: () => Promise<boolean>
  qaytaUlan: () => Promise<void>
}

const Kontekst = createContext<SmenaKonteksti | null>(null)

/** `null` — provayder yo'q (masalan login sahifasi). */
export function useSmena(): SmenaKonteksti | null {
  return useContext(Kontekst)
}

/** Navbatdagi bo'lakni qayta yuborishdan oldingi kutish: 5 s, 10 s, 20 s … 10 daqiqagacha. */
const kutish = (urinish: number) => Math.min(10 * 60_000, 5_000 * 2 ** Math.min(urinish, 10))

/** Tuzatib bo'lmaydigan javoblar — bo'lakni qayta yuborishning foydasi yo'q. */
const QAYTARILMAS = new Set([400, 403, 404, 410, 413, 415, 422])

/**
 * Smena boshlangan/tugagan joy — ixtiyoriy, tugmani 2,5 s dan ortiq ushlab
 * turmaydi. `maximumAge` atayin katta: LokatsiyaKuzatuv `watchPosition` ni
 * doim yoqib turadi, kuzatuvchi bor paytda brauzer yangi so'rovni keshdan
 * bermasa keyingi joy o'zgarishini kutadi — joyidan qimirlamagan kuryerda
 * u kelmaydi va tugash joyi yozilmay qolardi. Kuzatuvchi ishlab turganda
 * keshdagi joy shu paytgacha haqiqiy joy hisoblanadi.
 */
function joyOl(): Promise<{ lat: number; lng: number } | null> {
  return new Promise(res => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { res(null); return }
    const taymer = setTimeout(() => res(null), 2_500)
    navigator.geolocation.getCurrentPosition(
      p => { clearTimeout(taymer); res({ lat: p.coords.latitude, lng: p.coords.longitude }) },
      () => { clearTimeout(taymer); res(null) },
      { maximumAge: 5 * 60_000, timeout: 2_500, enableHighAccuracy: false },
    )
  })
}

/**
 * Sinov uchun qisqartirilgan oraliqlar (faqat rivojlanishda, productionda
 * kod umuman ishlamaydi): localStorage `ovoz-bolak-ms`, `ovoz-puls-ms`.
 */
function sinovOraligi(kalit: string, standart: number): number {
  if (process.env.NODE_ENV === 'production') return standart
  try {
    const n = Number(localStorage.getItem(kalit))
    return n >= 3_000 ? n : standart
  } catch {
    return standart
  }
}
const bolakUzunligi = () => sinovOraligi('ovoz-bolak-ms', BOLAK_MS)
/** Telefon navbatining chegarasi (bayt) — sinovda kichraytiriladi: `ovoz-navbat-max`. */
const navbatChegarasi = () => sinovOraligi('ovoz-navbat-max', NAVBAT_MAX_BAYT)

export default function SmenaProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const kuryer = status === 'authenticated' && smenaRolimi((session?.user as { rol?: string } | undefined)?.rol)

  const [server, setServer] = useState<SmenaServerHolati | null>(null)
  const [yozuv, setYozuv] = useState<{ holat: YozuvKorinishi; xato?: string }>({ holat: 'toxtatilgan' })
  const [daraja, setDaraja] = useState(0)
  const [navbat, setNavbat] = useState({ soni: 0, hajm: 0 })
  const [yuborildi, setYuborildi] = useState(0)
  const [rad, setRad] = useState(0)
  const [band, setBand] = useState(false)
  const [onlayn, setOnlayn] = useState(true)
  const [ekranYoniq, setEkranYoniq] = useState(false)

  const yozgichRef = useRef<OvozYozgich | null>(null)
  const holatRef = useRef<YozuvKorinishi>('toxtatilgan')
  const offsetRef = useRef(0)
  const yuborishRef = useRef(false)
  const darajaVaqtRef = useRef(0)
  const smenaIdRef = useRef<string | null>(null)

  const vaqt = useCallback(() => Date.now() + offsetRef.current, [])

  const holatniOrnat = useCallback((holat: YozuvKorinishi, xato?: string) => {
    holatRef.current = holat
    setYozuv({ holat, xato })
  }, [])

  const serverniOrnat = useCallback((j: SmenaServerHolati) => {
    offsetRef.current = j.serverVaqti - Date.now()
    smenaIdRef.current = j.smena?.id ?? null
    setServer(j)
  }, [])

  const navbatniYangila = useCallback(async () => {
    try { setNavbat(await navbatHolati()) } catch { /* IndexedDB yo'q (maxfiy rejim) */ }
  }, [])

  // ── Yozgichni boshqarish ──

  const yozishniToxtat = useCallback(async () => {
    const y = yozgichRef.current
    yozgichRef.current = null
    if (y) await y.toxtat()
    setEkranYoniq(false)
    setDaraja(0)
    holatniOrnat('toxtatilgan')
  }, [holatniOrnat])

  const yozishniBoshla = useCallback(async (smenaId: string, oqim?: MediaStream) => {
    if (yozgichRef.current) { oqim?.getTracks().forEach(t => t.stop()); return }
    // Navbat to'lgan bo'lsa (ombor uzoq sozlanmagan yoki kunlab internet yo'q)
    // eng eski bo'laklar bo'shatiladi — yozuv hech qachon shu sababli to'xtamaydi
    await navbatniQisqart(navbatChegarasi()).catch(() => 0)
    const y = new OvozYozgich(smenaId, {
      bolakMs: bolakUzunligi(), qismMs: QISM_MS, maxBayt: BOLAK_MAX_BAYT, bitreyt: BITREYT, vaqt,
    }, {
      holat: (h, xato) => holatniOrnat(h, xato),
      daraja: d => {
        // Ko'rsatkich 4 marta/soniya yangilanadi — butun daraxtni qayta chizmaslik uchun 2 tagacha
        const t = Date.now()
        if (t - darajaVaqtRef.current < 450 && d > 0) return
        darajaVaqtRef.current = t
        setDaraja(d)
      },
      bolakTayyor: () => { void navbatniYuborRef.current() },
    })
    yozgichRef.current = y
    holatniOrnat('boshlanmoqda')
    await y.boshla(oqim)
    setEkranYoniq(y.ekranYoniq)
  }, [holatniOrnat, vaqt])

  // ── Navbatni yuborish ──

  const navbatniYubor = useCallback(async () => {
    if (yuborishRef.current) return
    yuborishRef.current = true
    try {
      const segmentlar = await barchaSegmentlar()
      for (const s of segmentlar) {
        if (s.holat !== 'tayyor' || s.keyingiUrinish > Date.now()) continue
        if (typeof navigator !== 'undefined' && navigator.onLine === false) break
        const fayl = await segmentFayli(s)
        if (fayl.size === 0) { await segmentniOchir(s.segId); continue }
        const fd = new FormData()
        fd.append('smenaId', s.smenaId)
        fd.append('boshlandi', String(s.boshlandi))
        fd.append('tugadi', String(s.tugadi))
        fd.append('hozir', String(vaqt()))
        if (s.darajaSoni) fd.append('daraja', String(s.darajaYigindi / s.darajaSoni))
        fd.append('audio', fayl, `bolak.${kengaytma(s.mimeType)}`)
        let r: Response
        try {
          r = await fetch('/api/smena/yozuv', { method: 'POST', body: fd })
        } catch {
          await urinishniBelgila(s.segId, Date.now() + kutish(s.urinish), 'tarmoq')
          break
        }
        if (r.ok) {
          await segmentniOchir(s.segId)
          setYuborildi(n => n + 1)
          continue
        }
        if (QAYTARILMAS.has(r.status)) {
          console.warn('[ovoz] bo‘lak rad etildi', r.status, await r.text().catch(() => ''))
          await segmentniOchir(s.segId)
          setRad(n => n + 1)
          continue
        }
        // 401 (sessiya yangilanmoqda), 503 (ombor sozlanmagan), 5xx — keyinroq
        await urinishniBelgila(s.segId, Date.now() + kutish(s.urinish), String(r.status))
        break
      }
    } catch (e) {
      console.warn('[ovoz] navbat yuborilmadi', e)
    } finally {
      yuborishRef.current = false
      await navbatniQisqart(navbatChegarasi()).catch(() => 0)
      await navbatniYangila()
    }
  }, [navbatniYangila, vaqt])

  const navbatniYuborRef = useRef(navbatniYubor)
  useEffect(() => { navbatniYuborRef.current = navbatniYubor }, [navbatniYubor])

  // ── Boshlang'ich yuklash ──

  useEffect(() => {
    if (!kuryer) return
    let bekor = false
    void (async () => {
      // Oldingi safar to'satdan yopilgan ilovaning bo'laklari — yuborishga tayyorlanadi
      await yetimlarniYop().catch(() => {})
      const r = await fetch('/api/smena', { cache: 'no-store' }).catch(() => null)
      const j = r?.ok ? await r.json().catch(() => null) : null
      if (bekor || !j?.mavjud) return
      serverniOrnat(j)
      // Sahifa yangilangan yoki ilova qayta ochilgan — smena ochiq bo'lsa yozuv davom etadi
      if (j.smena) await yozishniBoshla(j.smena.id)
      void navbatniYuborRef.current()
    })()
    return () => {
      bekor = true
      void yozgichRef.current?.toxtat()
      yozgichRef.current = null
    }
  }, [kuryer, serverniOrnat, yozishniBoshla])

  // ── Davriy: puls, navbat, ekran holati ──

  const smenaId = server?.smena?.id ?? null
  useEffect(() => {
    if (!kuryer || !smenaId) return
    const puls = setInterval(async () => {
      const r = await fetch('/api/smena', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amal: 'puls', yozuvHolati: holatRef.current }),
      }).catch(() => null)
      const j = r?.ok ? await r.json().catch(() => null) as SmenaServerHolati | null : null
      if (!j) return
      serverniOrnat(j)
      // Administrator smenani yopgan (yoki boshqa qurilmada tugatilgan)
      if (!j.smena || j.smena.id !== smenaId) {
        await yozishniToxtat()
        toast.info('Smenangiz yakunlandi — ovoz yozish to‘xtadi')
      }
    }, sinovOraligi('ovoz-puls-ms', PULS_MS))
    const ekran = setInterval(() => setEkranYoniq(!!yozgichRef.current?.ekranYoniq), 5_000)
    return () => { clearInterval(puls); clearInterval(ekran) }
  }, [kuryer, smenaId, serverniOrnat, yozishniToxtat])

  useEffect(() => {
    if (!kuryer) return
    const yubor = () => { void navbatniYuborRef.current() }
    const tarmoq = () => {
      setOnlayn(navigator.onLine)
      if (navigator.onLine) yubor()
    }
    const korinish = () => { if (document.visibilityState === 'visible') yubor() }
    setOnlayn(navigator.onLine)
    const taymer = setInterval(yubor, 30_000)
    window.addEventListener('online', tarmoq)
    window.addEventListener('offline', tarmoq)
    document.addEventListener('visibilitychange', korinish)
    return () => {
      clearInterval(taymer)
      window.removeEventListener('online', tarmoq)
      window.removeEventListener('offline', tarmoq)
      document.removeEventListener('visibilitychange', korinish)
    }
  }, [kuryer])

  // Ish davomida sahifa tasodifan yopilmasin — yopilsa yozuv to'xtaydi
  useEffect(() => {
    if (!smenaId) return
    const ogohlantir = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', ogohlantir)
    return () => window.removeEventListener('beforeunload', ogohlantir)
  }, [smenaId])

  // ── Amallar ──

  const amal = useCallback(async (tana: Record<string, unknown>): Promise<SmenaServerHolati | null> => {
    const r = await fetch('/api/smena', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tana),
    }).catch(() => null)
    if (!r) { toast.error('Internet yo‘q — qayta urinib ko‘ring'); return null }
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { toast.error(j.xato || 'Amal bajarilmadi'); return null }
    serverniOrnat(j)
    return j
  }, [serverniOrnat])

  const rozilikBer = useCallback(async () => !!(await amal({ amal: 'rozilik' })), [amal])

  const boshla = useCallback(async () => {
    if (band) return
    if (!yozishQollanadimi()) {
      holatniOrnat('qollanmaydi', 'Bu brauzer ovoz yozishni qo‘llamaydi')
      toast.error('Bu brauzerda ovoz yozib bo‘lmaydi — Chrome yoki Safari’ning yangi versiyasida oching')
      return
    }
    setBand(true)
    try {
      // Mikrofon AVVAL — tugma bosilgan lahzada (iOS faqat shunda ruxsat so'raydi).
      // Ruxsat bo'lmasa smena ochilmaydi: ish vaqtida yozuv majburiy.
      let oqim: MediaStream
      try {
        oqim = await mikrofonniOch()
      } catch (e) {
        const x = mikrofonXatosi(e)
        holatniOrnat(x.holat, x.xato)
        toast.error(x.holat === 'ruxsat_yoq'
          ? 'Mikrofonga ruxsat bering — brauzer manzil satridagi qulf belgisi orqali'
          : x.xato)
        return
      }
      const joy = await joyOl()
      const j = await amal({ amal: 'boshlash', ...joy })
      if (!j?.smena) { oqim.getTracks().forEach(t => t.stop()); return }
      await yozishniBoshla(j.smena.id, oqim)
      toast.success('Ish boshlandi — ovoz yozilmoqda')
    } finally {
      setBand(false)
    }
  }, [amal, band, holatniOrnat, yozishniBoshla])

  const tugat = useCallback(async () => {
    if (band) return
    setBand(true)
    try {
      const joy = await joyOl()
      // Avval serverda yopamiz: internet bo'lmasa smena ham, yozuv ham davom etadi
      const j = await amal({ amal: 'tugatish', ...joy })
      if (!j) return
      await yozishniToxtat()
      void navbatniYuborRef.current()
      toast.success('Ish tugallandi')
    } finally {
      setBand(false)
    }
  }, [amal, band, yozishniToxtat])

  const qaytaUlan = useCallback(async () => {
    const y = yozgichRef.current
    if (y) { await y.qaytaUlan(); setEkranYoniq(y.ekranYoniq); return }
    if (smenaIdRef.current) await yozishniBoshla(smenaIdRef.current)
  }, [yozishniBoshla])

  return (
    <Kontekst.Provider value={{
      mavjud: kuryer, server, yozuv, daraja, navbat, yuborildi, rad, band, onlayn, ekranYoniq,
      vaqt, boshla, tugat, rozilikBer, qaytaUlan,
    }}>
      {children}
    </Kontekst.Provider>
  )
}
