'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { signalBer } from '@/lib/signal'
import {
  OvozYozgich, mikrofonXatosi, mikrofonlar as mikrofonlarniOl, mikrofonniOch, yozishQollanadimi, type Mikrofon,
} from '@/lib/ovoz-yozgich'
import {
  barchaSegmentlar, navbatHolati, navbatniQisqart, ozimnikimi, segmentFayli, segmentniOchir, urinishniBelgila, yetimlarniYop,
} from '@/lib/ovoz-navbat'
import {
  BITREYT, BOLAK_MAX_BAYT, BOLAK_MS, JONLI_BOLAK_MS, JONLI_TEKSHIR_MS, NAVBAT_MAX_BAYT, PULS_MS, QISM_MS,
  kengaytma, ovozYozilsinmi, smenaKerakmi, smenaRolimi, type YozuvHolati,
} from '@/lib/smena'

// Xodimning ish smenasi va ovoz yozuvi — butun panel darajasida.
//
// Layout'da turadi: xodim sahifalar orasida o'tganda ham yozuv uzilmaydi
// (sahifaga bog'lansa har o'tishda to'xtardi). Smena kuryerda — har doim,
// boshqa xodimda — «Ish vaqtida ovoz yozish» ruxsati ochiq bo'lsa. Kuryerga
// ovoz yozish yopilgan bo'lsa smena mikrofonsiz yuradi (buyurtmalar uchun).
// Administrator va ruxsati yo'q xodim uchun hech narsa qilmaydi.

export interface SmenaServerHolati {
  mavjud: true
  /** Ish vaqtida ovoz yoziladimi (Ruxsatlar). `false` — smena mikrofonsiz (faqat kuryerda) */
  ovoz: boolean
  rozilik: boolean
  omborTayyor: boolean
  /** Administrator hozir smenani jonli tinglayapti */
  jonliKuzatuv?: boolean
  saqlashKun: number
  serverVaqti: number
  smena: { id: string; boshlandi: string } | null
  bugun: { id: string; boshlandi: string; tugadi: string | null; yozilganMs: number; smenaMs: number }[]
}

export type YozuvKorinishi = YozuvHolati | 'toxtatilgan' | 'boshlanmoqda'

interface SmenaKonteksti {
  /** Foydalanuvchi smena yuritadi (kuryer yoki ovoz yozish ruxsati ochiq xodim) */
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
  /** Administrator hozir jonli tinglayapti (xodimga ochiq ko'rsatiladi) */
  jonliKuzatuv: boolean
  /** Qurilmadagi mikrofonlar (kompyuterda bir nechta bo'lishi mumkin) */
  mikrofonlar: Mikrofon[]
  /** Tanlangan mikrofon; `null` — tizim standarti */
  mikrofon: string | null
  mikrofonniTanla: (id: string | null) => Promise<void>
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
/** Boshqa xodimning (egasi yozilmagan eski) bo'lagi — keyinroq yana urinib ko'riladi. */
const BEGONA_KUTISH_MS = 60 * 60_000

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
/** Kuryer tanlagan mikrofon shu qurilmada eslab qolinadi */
const MIKROFON_KALITI = 'ovoz-mikrofon'
function saqlanganMikrofon(): string | null {
  try { return localStorage.getItem(MIKROFON_KALITI) || null } catch { return null }
}
/** Telefon navbatining chegarasi (bayt) — sinovda kichraytiriladi: `ovoz-navbat-max`. */
const navbatChegarasi = () => sinovOraligi('ovoz-navbat-max', NAVBAT_MAX_BAYT)

export default function SmenaProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const u = session?.user as { id?: string; rol?: string; ruxsatlar?: string[] | null } | undefined
  const meningId = status === 'authenticated' ? u?.id ?? null : null
  // Sessiyadagi ruxsatlar ~30 soniyada yangilanadi; aniq holatni server beradi
  const smenali = status === 'authenticated' && smenaKerakmi(u?.rol, u?.ruxsatlar)
  const ovozSessiyada = status === 'authenticated' && ovozYozilsinmi(u?.rol, u?.ruxsatlar)
  const kuryer = status === 'authenticated' && smenaRolimi(u?.rol)
  // Server "smena sizga yopilgan" desa sessiya eskicha bo'lsa ham to'xtaymiz. Sessiya
  // o'zgarsa (masalan ruxsat qayta ochildi) kalit ham o'zgaradi — yana tekshiriladi
  const sessiyaKaliti = `${meningId}:${smenali}:${ovozSessiyada}`
  const [yopilganKalit, setYopilganKalit] = useState<string | null>(null)
  const mavjud = smenali && yopilganKalit !== sessiyaKaliti
  // Qurilmada qolgan bo'laklar smenasi yopilgan xodimdan ham yuboriladi — ular ruxsat ochiq paytda yozilgan
  const yuboruvchi = !!meningId && u?.rol !== 'ADMIN'
  const sessiyaKalitiRef = useRef(sessiyaKaliti)
  const meningIdRef = useRef(meningId)
  useEffect(() => { sessiyaKalitiRef.current = sessiyaKaliti; meningIdRef.current = meningId }, [sessiyaKaliti, meningId])
  const yopildi = useCallback(() => setYopilganKalit(sessiyaKalitiRef.current), [])

  const [server, setServer] = useState<SmenaServerHolati | null>(null)
  const [yozuv, setYozuv] = useState<{ holat: YozuvKorinishi; xato?: string }>({ holat: 'toxtatilgan' })
  const [daraja, setDaraja] = useState(0)
  const [navbat, setNavbat] = useState({ soni: 0, hajm: 0 })
  const [yuborildi, setYuborildi] = useState(0)
  const [rad, setRad] = useState(0)
  const [band, setBand] = useState(false)
  const [onlayn, setOnlayn] = useState(true)
  const [ekranYoniq, setEkranYoniq] = useState(false)
  const [mikrofonlar, setMikrofonlar] = useState<Mikrofon[]>([])
  const [mikrofon, setMikrofon] = useState<string | null>(null)
  const mikrofonRef = useRef<string | null>(null)
  useEffect(() => { mikrofonRef.current = saqlanganMikrofon(); setMikrofon(mikrofonRef.current) }, [])

  const yozgichRef = useRef<OvozYozgich | null>(null)
  /** Jonli tinglash — yozgich bo'lak uzunligini shundan o'qiydi */
  const jonliRef = useRef(false)
  /** Oxirgi ko'rilgan biriktirish vaqti (null — hali bilinmaydi): yangisi kelsa bildiriladi */
  const buyurtmaRef = useRef<number | null>(null)
  const holatRef = useRef<YozuvKorinishi>('toxtatilgan')
  const offsetRef = useRef(0)
  const yuborishRef = useRef(false)
  /** Yuborish band paytida yangi bo'lak tayyor bo'ldi — tugagach yana aylanadi */
  const yanaYuborRef = useRef(false)
  /** Holat o'zgarishini serverga darhol bildirish (pastda e'lon qilinadi) */
  const pulsRef = useRef<() => void>(() => {})
  const darajaVaqtRef = useRef(0)
  const smenaIdRef = useRef<string | null>(null)
  /** Yozgich ishga tushirilmoqda (navbat tozalanmoqda) — ikkinchisi ochilmasin */
  const boshlanmoqdaRef = useRef(false)
  /** Har to'xtatishda oshadi: ishga tushayotgan yozgich shu orada to'xtatilgan bo'lsa ochilmaydi */
  const avlodRef = useRef(0)

  const vaqt = useCallback(() => Date.now() + offsetRef.current, [])

  const holatniOrnat = useCallback((holat: YozuvKorinishi, xato?: string) => {
    const oldingi = holatRef.current
    holatRef.current = holat
    setYozuv({ holat, xato })
    // Mikrofon jim qolsa (yoki tiklansa) — administrator bir daqiqa kutmasin
    if (oldingi !== holat && (holat === 'ovoz_yoq' || oldingi === 'ovoz_yoq')) pulsRef.current()
    if (holat === 'ovoz_yoq' && oldingi !== 'ovoz_yoq') {
      toast.error('Mikrofon ovoz bermayapti — yozuvlar jim chiqadi. Bosh sahifadagi ko‘rsatmaga qarang', { duration: 10_000 })
    }
  }, [])

  const serverniOrnat = useCallback((j: SmenaServerHolati) => {
    offsetRef.current = j.serverVaqti - Date.now()
    smenaIdRef.current = j.smena?.id ?? null
    // Jonli holatni FAQAT yengil tekshiruv halqasi boshqaradi: puls javobi
    // sekinroq keladi va eskirgan bo'lishi mumkin — ikki manba bo'lsa yozgich
    // qisqa/uzun rejim orasida tebranib, bo'lak o'rtasida uzilish paydo bo'ladi
    setServer(oldin => ({ ...j, jonliKuzatuv: oldin?.jonliKuzatuv ?? j.jonliKuzatuv }))
  }, [])

  const navbatniYangila = useCallback(async () => {
    try {
      const n = await navbatHolati(meningIdRef.current)
      setNavbat(o => (o.soni === n.soni && o.hajm === n.hajm ? o : n))
    } catch { /* IndexedDB yo'q (maxfiy rejim) */ }
  }, [])

  // ── Yozgichni boshqarish ──

  const yozishniToxtat = useCallback(async () => {
    avlodRef.current++
    const y = yozgichRef.current
    yozgichRef.current = null
    if (y) await y.toxtat()
    setEkranYoniq(false)
    setDaraja(0)
    holatniOrnat('toxtatilgan')
  }, [holatniOrnat])

  const yozishniBoshla = useCallback(async (smenaId: string, oqim?: MediaStream) => {
    if (yozgichRef.current || boshlanmoqdaRef.current) { oqim?.getTracks().forEach(t => t.stop()); return }
    const avlod = avlodRef.current
    boshlanmoqdaRef.current = true
    try {
      // Navbat to'lgan bo'lsa (ombor uzoq sozlanmagan yoki kunlab internet yo'q)
      // eng eski bo'laklar bo'shatiladi — yozuv hech qachon shu sababli to'xtamaydi
      await navbatniQisqart(navbatChegarasi()).catch(() => 0)
    } finally {
      boshlanmoqdaRef.current = false
    }
    // Shu orada to'xtatildi (ovoz yozish o'chirildi, smena yopildi) — ochilmaydi
    if (avlod !== avlodRef.current || yozgichRef.current) { oqim?.getTracks().forEach(t => t.stop()); return }
    const y = new OvozYozgich(smenaId, {
      // Jonli tinglanayotganda qisqa bo'lak: ovoz ~15 soniyada adminga yetadi
      bolakMs: () => (jonliRef.current ? JONLI_BOLAK_MS : bolakUzunligi()),
      qismMs: QISM_MS, maxBayt: BOLAK_MAX_BAYT, bitreyt: BITREYT, vaqt,
      qurilma: () => mikrofonRef.current,
      xodimId: meningIdRef.current ?? undefined,
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
    y.jonliRejim(jonliRef.current)
    holatniOrnat('boshlanmoqda')
    await y.boshla(oqim)
    setEkranYoniq(y.ekranYoniq)
    // Ruxsatdan keyin mikrofon nomlari ko'rinadi — tanlash ro'yxati uchun
    void mikrofonlarniOl().then(setMikrofonlar)
  }, [holatniOrnat, vaqt])

  /** Yozgichni darhol uzadi (effekt tozalanganda) — ishga tushayotgani ham ochilmaydi. */
  const yozgichniUz = useCallback(() => {
    avlodRef.current++
    void yozgichRef.current?.toxtat()
    yozgichRef.current = null
  }, [])

  /** Server holatini qayta so'raydi — ruxsat o'zgarganda. */
  const holatniYangila = useCallback(async () => {
    const r = await fetch('/api/smena', { cache: 'no-store' }).catch(() => null)
    const j = r?.ok ? await r.json().catch(() => null) : null
    if (!j) return
    if (j.mavjud === false) { await yozishniToxtat(); yopildi(); return }
    if (j.mavjud) serverniOrnat(j)
  }, [serverniOrnat, yozishniToxtat, yopildi])

  // ── Navbatni yuborish ──

  const navbatniYubor = useCallback(async (): Promise<void> => {
    // Band bo'lsa — joriy aylanish tugagach yana bir marta (oxirgi bo'lak kutib qolmasin)
    if (yuborishRef.current) { yanaYuborRef.current = true; return }
    yuborishRef.current = true
    yanaYuborRef.current = false
    try {
      const segmentlar = await barchaSegmentlar()
      for (const s of segmentlar) {
        if (s.holat !== 'tayyor' || s.keyingiUrinish > Date.now()) continue
        // Umumiy kompyuterda boshqa xodimning bo'lagi — egasi kirganda yuboriladi
        if (!ozimnikimi(s, meningIdRef.current)) continue
        if (typeof navigator !== 'undefined' && navigator.onLine === false) break
        const fayl = await segmentFayli(s)
        if (fayl.size === 0) { await segmentniOchir(s.segId); continue }
        const fd = new FormData()
        fd.append('smenaId', s.smenaId)
        fd.append('boshlandi', String(s.boshlandi))
        fd.append('tugadi', String(s.tugadi))
        fd.append('hozir', String(vaqt()))
        if (s.darajaSoni) fd.append('daraja', String(s.darajaYigindi / s.darajaSoni))
        if (typeof s.darajaMax === 'number') fd.append('darajaMax', String(s.darajaMax))
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
        if (r.status === 409) {
          const x = await r.json().catch(() => null) as { kod?: string } | null
          if (x?.kod === 'boshqa_xodim') {
            await urinishniBelgila(s.segId, Date.now() + BEGONA_KUTISH_MS, 'boshqa_xodim')
            continue
          }
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
    if (yanaYuborRef.current) void navbatniYuborRef.current()
  }, [navbatniYangila, vaqt])

  const navbatniYuborRef = useRef(navbatniYubor)
  useEffect(() => { navbatniYuborRef.current = navbatniYubor }, [navbatniYubor])

  // ── Boshlang'ich yuklash ──

  useEffect(() => {
    if (!mavjud) return
    let bekor = false
    void (async () => {
      // Oldingi safar to'satdan yopilgan ilovaning bo'laklari — yuborishga tayyorlanadi
      await yetimlarniYop().catch(() => {})
      const r = await fetch('/api/smena', { cache: 'no-store' }).catch(() => null)
      const j = r?.ok ? await r.json().catch(() => null) : null
      if (bekor || !j) return
      // Server: smena yuritish huquqi yo'q (sessiya hali yangilanmagan)
      if (j.mavjud === false) { yopildi(); return }
      if (!j.mavjud) return
      serverniOrnat(j)
      // Sahifa yangilangan yoki ilova qayta ochilgan — smena ochiq bo'lsa yozuv davom etadi
      // (ovoz yozish o'chirilgan yoki rozilik hali berilmagan bo'lsa — yo'q)
      if (j.smena && j.ovoz && j.rozilik) await yozishniBoshla(j.smena.id)
      void navbatniYuborRef.current()
    })()
    return () => {
      bekor = true
      yozgichniUz()
    }
  }, [mavjud, serverniOrnat, yozishniBoshla, yopildi, yozgichniUz])

  // ── Davriy: puls, navbat, ekran holati ──

  const smenaId = server?.smena?.id ?? null
  const jonliKuzatuv = !!server?.jonliKuzatuv && !!smenaId
  useEffect(() => {
    if (!mavjud || !smenaId) { pulsRef.current = () => {}; return }
    const pulsYubor = async () => {
      const r = await fetch('/api/smena', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amal: 'puls', yozuvHolati: holatRef.current }),
      }).catch(() => null)
      // Ega ovoz yozishni yopdi (kuryer bo'lmagan xodim) — server smenani yopdi
      if (r?.status === 403) {
        const x = await r.json().catch(() => null) as { kod?: string } | null
        if (x?.kod !== 'smena_yopiq') return
        await yozishniToxtat()
        yopildi()
        toast.info('Rahbariyat ish vaqtida ovoz yozishni o‘chirdi — smena yakunlandi', { id: 'smena-yopildi' })
        return
      }
      const j = r?.ok ? await r.json().catch(() => null) as SmenaServerHolati | null : null
      if (!j) return
      serverniOrnat(j)
      // Administrator smenani yopgan (yoki boshqa qurilmada tugatilgan)
      if (!j.smena || j.smena.id !== smenaId) {
        await yozishniToxtat()
        toast.info(j.ovoz ? 'Smenangiz yakunlandi — ovoz yozish to‘xtadi' : 'Smenangiz yakunlandi')
      }
    }
    pulsRef.current = () => { void pulsYubor() }
    const puls = setInterval(() => { void pulsYubor() }, sinovOraligi('ovoz-puls-ms', PULS_MS))
    const ekran = setInterval(() => setEkranYoniq(!!yozgichRef.current?.ekranYoniq), 5_000)
    return () => { clearInterval(puls); clearInterval(ekran); pulsRef.current = () => {} }
  }, [mavjud, smenaId, serverniOrnat, yozishniToxtat, yopildi])

  // "Meni hozir tinglashyaptimi?" — yengil va tez-tez: admin tugmani
  // bosgach ovoz bir daqiqa emas, ~15 soniyada boshlanadi
  useEffect(() => {
    if (!mavjud || !smenaId) return
    let toxtadi = false
    const tekshir = async () => {
      if (toxtadi || document.visibilityState !== 'visible') return
      const r = await fetch('/api/smena', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amal: 'jonli' }),
      }).catch(() => null)
      const j = r?.ok
        ? await r.json().catch(() => null) as { jonli?: boolean; ovoz?: boolean; oxirgiBuyurtma?: { raqam: string; vaqt: number } | null } | null
        : null
      if (toxtadi || !j) return
      // Ega ovoz yozishni yoqdi yoki o'chirdi — yozgich pastdagi effektda moslanadi
      if (typeof j.ovoz === 'boolean') {
        const ovoz = j.ovoz
        setServer(oldin => (oldin && oldin.ovoz !== ovoz ? { ...oldin, ovoz } : oldin))
      }
      // Navbat bilan yangi buyurtma tushdi — qaysi sahifada bo'lmasin bildiriladi
      // (buyurtmalar sahifasi o'zi bildiradi, u yerda takrorlanmaydi)
      const ob = j.oxirgiBuyurtma ?? null
      const oldingi = buyurtmaRef.current
      buyurtmaRef.current = Math.max(oldingi ?? 0, ob?.vaqt ?? 0)
      if (ob && oldingi !== null && ob.vaqt > oldingi && !window.location.pathname.startsWith('/onlayn-buyurtmalar')) {
        signalBer()
        navigator.vibrate?.([200, 100, 200])
        toast.info(`Sizga yangi buyurtma: ${ob.raqam}`, {
          action: { label: 'Ochish', onClick: () => router.push(`/onlayn-buyurtmalar?raqam=${encodeURIComponent(ob.raqam)}`) },
          duration: 15_000,
        })
      }
      const yangi = !!j.jonli
      if (yangi === jonliRef.current) return
      jonliRef.current = yangi
      yozgichRef.current?.jonliRejim(yangi)
      setServer(oldin => (oldin ? { ...oldin, jonliKuzatuv: yangi } : oldin))
    }
    const i = setInterval(() => { void tekshir() }, sinovOraligi('ovoz-jonli-ms', JONLI_TEKSHIR_MS))
    void tekshir()
    return () => { toxtadi = true; clearInterval(i) }
  }, [mavjud, smenaId, router])

  // Kuryerga ovoz yozish yoqildi yoki o'chirildi — sessiya yangilanganda holat
  // qayta so'raladi (smena ochiq bo'lmasa puls yo'q; ochiq bo'lsa bir daqiqa
  // kutilmasin). Boshqa xodimda smenaning o'zi paydo bo'ladi yoki yo'qoladi
  const ovozSessiyaRef = useRef<boolean | null>(null)
  useEffect(() => {
    if (status !== 'authenticated') return
    const oldingi = ovozSessiyaRef.current
    ovozSessiyaRef.current = ovozSessiyada
    if (oldingi === null || oldingi === ovozSessiyada) return
    if (mavjud && kuryer) void holatniYangila()
  }, [status, ovozSessiyada, mavjud, kuryer, holatniYangila])

  // Smena yuritish huquqi olib qo'yildi (ovoz yozish o'chirildi) — xodim
  // nima bo'lganini bilsin. Chiqish (logout) bunga kirmaydi
  const mavjudOldingiRef = useRef(mavjud)
  useEffect(() => {
    const oldingi = mavjudOldingiRef.current
    mavjudOldingiRef.current = mavjud
    if (oldingi && !mavjud && status === 'authenticated' && smenaIdRef.current) {
      toast.info('Rahbariyat ish vaqtida ovoz yozishni o‘chirdi — smena yakunlandi', { id: 'smena-yopildi' })
    }
  }, [mavjud, status])

  // Smena davomida ovoz yozish yoqildi/o'chirildi — yozgich shunga moslanadi.
  // Rozilik berilmagan bo'lsa yozuv o'zi boshlanmaydi: panel rozilik so'raydi
  const ovozKerak = !!server?.ovoz
  const rozilikBor = !!server?.rozilik
  const ovozOldingiRef = useRef<boolean | null>(null)
  useEffect(() => {
    const oldingi = ovozOldingiRef.current
    ovozOldingiRef.current = server ? ovozKerak : null
    if (!mavjud || !smenaId || oldingi === null || oldingi === ovozKerak) return
    if (!ovozKerak) {
      void yozishniToxtat().then(() => pulsRef.current())
      toast.info('Rahbariyat ish vaqtida ovoz yozishni o‘chirdi — smenangiz davom etmoqda')
    } else if (rozilikBor) {
      void yozishniBoshla(smenaId)
      toast.info('Rahbariyat ish vaqtida ovoz yozishni yoqdi — ovoz yozilmoqda')
    }
  }, [server, ovozKerak, rozilikBor, mavjud, smenaId, yozishniBoshla, yozishniToxtat])

  // Smenasi yo'q (ovoz yozish yopilgan) xodim: avval yozilib qurilmada qolgan
  // bo'laklar ham egasiga yetsin — to'satdan uzilgan bo'lak avval yopiladi
  useEffect(() => {
    if (!yuboruvchi || mavjud) return
    void (async () => {
      await yetimlarniYop().catch(() => {})
      void navbatniYuborRef.current()
    })()
  }, [yuboruvchi, mavjud])

  const yuborishKerak = yuboruvchi && (mavjud || navbat.soni > 0)
  useEffect(() => {
    if (!yuborishKerak) return
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
  }, [yuborishKerak])

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
    if (!r.ok) {
      toast.error(j.xato || 'Amal bajarilmadi')
      // Ruxsat shu orada o'zgargan: ovoz yoqildi (rozilik kerak) yoki smena yopildi
      if (j.kod === 'rozilik_kerak') void holatniYangila()
      if (j.kod === 'smena_yopiq') yopildi()
      return null
    }
    serverniOrnat(j)
    return j
  }, [serverniOrnat, holatniYangila, yopildi])

  const rozilikBer = useCallback(async () => !!(await amal({ amal: 'rozilik' })), [amal])

  const ovozYoqilgan = !!server?.ovoz
  const boshla = useCallback(async () => {
    if (band) return
    // Ovoz yozish o'chirilgan kuryer — smena mikrofonsiz ochiladi
    if (ovozYoqilgan && !yozishQollanadimi()) {
      holatniOrnat('qollanmaydi', 'Bu brauzer ovoz yozishni qo‘llamaydi')
      toast.error('Bu brauzerda ovoz yozib bo‘lmaydi — Chrome yoki Safari’ning yangi versiyasida oching')
      return
    }
    setBand(true)
    try {
      // Mikrofon AVVAL — tugma bosilgan lahzada (iOS faqat shunda ruxsat so'raydi).
      // Ruxsat bo'lmasa smena ochilmaydi: ovoz yoziladigan smenada yozuv majburiy.
      let oqim: MediaStream | undefined
      if (ovozYoqilgan) {
        try {
          oqim = await mikrofonniOch(mikrofonRef.current)
        } catch (e) {
          const x = mikrofonXatosi(e)
          holatniOrnat(x.holat, x.xato)
          toast.error(x.holat === 'ruxsat_yoq'
            ? 'Mikrofonga ruxsat bering — brauzer manzil satridagi qulf belgisi orqali'
            : x.xato)
          return
        }
      }
      const joy = await joyOl()
      const ochiqSmena = smenaIdRef.current
      const j = await amal({ amal: 'boshlash', ...joy })
      if (!j?.smena) { oqim?.getTracks().forEach(t => t.stop()); return }
      if (j.ovoz) {
        await yozishniBoshla(j.smena.id, oqim)
        // Smena davomida rozilik berildi — ish allaqachon boshlangan edi
        toast.success(ochiqSmena === j.smena.id ? 'Ovoz yozish boshlandi' : 'Ish boshlandi — ovoz yozilmoqda')
      } else {
        oqim?.getTracks().forEach(t => t.stop())
        toast.success('Ish boshlandi')
      }
    } finally {
      setBand(false)
    }
  }, [amal, band, holatniOrnat, ovozYoqilgan, yozishniBoshla])

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

  // Mikrofon har safar YANGIDAN ochiladi: jim qolgan yoki boshqa qurilma
  // tanlangan bo'lsa ham (joriy bo'lak saqlanib qoladi)
  const qaytaUlan = useCallback(async () => {
    const y = yozgichRef.current
    if (y) { await y.qaytaUlan(true); setEkranYoniq(y.ekranYoniq); return }
    if (smenaIdRef.current) await yozishniBoshla(smenaIdRef.current)
  }, [yozishniBoshla])

  const mikrofonniTanla = useCallback(async (id: string | null) => {
    mikrofonRef.current = id
    setMikrofon(id)
    try {
      if (id) localStorage.setItem(MIKROFON_KALITI, id)
      else localStorage.removeItem(MIKROFON_KALITI)
    } catch { /* maxfiy rejim — faqat shu safar */ }
    await qaytaUlan()
  }, [qaytaUlan])

  return (
    <Kontekst.Provider value={{
      mavjud, server, yozuv, daraja, navbat, yuborildi, rad, band, onlayn, ekranYoniq,
      vaqt, boshla, tugat, rozilikBer, qaytaUlan, jonliKuzatuv, mikrofonlar, mikrofon, mikrofonniTanla,
    }}>
      {children}
    </Kontekst.Provider>
  )
}
