'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { formatSum, formatSanaVaVaqt, formatPhone, playBeep, uzSearch } from '@/lib/utils'
import { MUROJAAT_TEL, buildChekHtml, chekChopEtish as printChek, chekHolati, type ChekData, type ChekDokonInfo, type ChekTarkib } from '@/lib/chek-print'
import { chekA4niKorsat, chekniA4ChopEt, type ChekA4Malumot } from '@/lib/chek-a4'
import { kodniAjrat } from '@/lib/qr-kod'
import { toast } from 'sonner'
import type { Html5Qrcode } from 'html5-qrcode'
import { Search, ShoppingCart, Trash2, CheckCircle, Printer, Download, RotateCcw, Clock, X, Loader2, AlertTriangle, Pencil, Pause, Play, Archive, Languages, ScanLine, LayoutGrid, Link2, Share2, Package, Plus, Minus, Gift, Percent, MapPin, Send, FileImage } from 'lucide-react'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import Modal, { ModalAsosiy, ModalBekor } from '@/components/ui/modal'
import { jsPDF } from 'jspdf'
import Combobox from '@/components/ui/combobox'
import MoneyInput from '@/components/ui/money-input'
import PhoneInput from '@/components/ui/phone-input'
import TovarNarxPaneli from '@/components/TovarNarxPaneli'
import ChipRow from '@/components/ui/chip-row'
import { useRuxsat } from '@/hooks/useRuxsat'
import { minNarxSomda } from '@/lib/ruxsat-amallar'
import {
  SODIQLIK_STANDART, sarflashniHisobla, ballSarflanadimi, formatBall, sotuvdanToplanadi,
  type SodiqlikSozlama, type SodiqlikQoida,
} from '@/lib/sodiqlik'
import {
  birlikKasrlimi, birlikMatni, chekQatori, miqdorMatni as oramdaYoz, oramlarniOqi, oramlarTartibda, sotuvBirliklari, sotuvBirligi,
} from '@/lib/birlik'
import { nomKaliti } from '@/lib/utils'
import {
  POS_TOLOV_USULLARI, KANAL_USULLARI, TOLOV_MALUMOTI,
  tolovLabel, tolovQisqa, tolovBadge, tolovTaqsimoti, tolovKanallari,
  aralashJami, aralashTekshir,
  type KanalUsuli, type AralashKiritma,
} from '@/lib/tolov-usullari'

interface Tovar {
  id: string; nomi: string; sotishNarxi: number; kelishNarxi: number | null
  optomNarxi?: number | null; bolishNarxi?: number | null
  birlik: string; qoldiq: number; shtrixKod: string | null
  rasmlar?: string[]; valyuta?: string; kategoriya?: { id: string; nomi: string }
  /** Qo'shimcha birliklar (karobka = 24 dona) — JSON */
  oramlar?: unknown
}
interface Kategoriya { id: string; nomi: string; ombor?: { id: string; nomi: string; faol: boolean } | null }

type NarxTuri = 'sotish' | 'optom' | 'bolish'
const NARX_TURI_LABEL: Record<NarxTuri, string> = { sotish: 'Chakana', optom: 'Optom', bolish: "Bo'lish" }

/** Server qaytargan sotuv — chek, oxirgi sotuv va qaytarish oynalari uchun */
interface SotuvTarkibi extends ChekTarkib {
  id: string
  tovarId: string
  tovar?: { nomi: string; birlik?: string } | null
}
interface SotuvYozuvi extends ChekData {
  id: string
  tarkiblar: SotuvTarkibi[]
}

// Tanlangan narx turi bo'yicha narx — sotilayotgan birlikniki (1 dona yoki
// 1 blok, lib/birlik.ts). O'sha tur uchun narx bo'lmasa — o'sha birlikning
// oddiy sotish (chakana) narxi.
function narxTuriBoyicha(tovar: Tovar, turi: NarxTuri, kursi: number, oramNomi?: string | null): number {
  const b = sotuvBirligi(tovar, oramNomi)
  const narx = b[amaldagiNarxTuri(tovar, turi, oramNomi)] ?? b.sotish ?? tovar.sotishNarxi
  return tovar.valyuta === 'USD' ? Math.round(narx * kursi) : narx
}

/**
 * Amalda qo'llanadigan narx turi: mahsulotda (shu birlikda) tanlangan tur
 * uchun narx kiritilmagan bo'lsa, chakana narx olinadi. Savat qatoridagi
 * "Optom" belgisi shu bilan to'g'ri chiqadi — narx chakana bo'lib, belgi
 * "Optom" deb turmaydi.
 */
function amaldagiNarxTuri(tovar: Tovar, turi: NarxTuri, oramNomi?: string | null): NarxTuri {
  if (turi === 'sotish') return turi
  return sotuvBirligi(tovar, oramNomi)[turi] === null ? 'sotish' : turi
}

// API narxlarni Prisma Decimal sifatida — satr ko'rinishida ("12000.00")
// qaytaradi. Kassada ular hisob-kitobga kiradi, shuning uchun yuklanganda
// bir marta songa aylantiriladi.
const sonYokiNull = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v))
function tovarniMeyorla(x: Record<string, unknown>): Tovar {
  return {
    ...(x as unknown as Tovar),
    sotishNarxi: Number(x.sotishNarxi ?? 0),
    kelishNarxi: sonYokiNull(x.kelishNarxi),
    optomNarxi: sonYokiNull(x.optomNarxi),
    bolishNarxi: sonYokiNull(x.bolishNarxi),
    qoldiq: Number(x.qoldiq ?? 0),
  }
}

/** Kassa katalogi. `sotuvUchun=1` — qulflangan mahsulotlar serverda chiqarib tashlanadi. */
async function sotuvTovarlariniOl(): Promise<Tovar[]> {
  const r = await fetch('/api/tovarlar?sotuvUchun=1')
  if (!r.ok) {
    const errBody = await r.json().catch(() => ({}))
    throw new Error(errBody.xato || `Server xatosi (${r.status})`)
  }
  const tv = await r.json()
  return Array.isArray(tv.tovarlar) ? tv.tovarlar.map(tovarniMeyorla) : []
}
interface Mijoz { id: string; ism: string; telefon: string | null; telefon2?: string | null; qoshimchaTelefonlar?: string[]; manzil?: string | null; lokatsiyaLat?: number | null; lokatsiyaLng?: number | null }
interface SavatItem {
  /** `miqdor` va `birlikNarxi` — qator birligida (2 blok × 75 000); `mavjudQoldiq` — asosiy birlikda */
  tovarId: string; nomi: string; birlikNarxi: number; miqdor: number; birlik: string; chegirma: number; jami: number; mavjudQoldiq: number; bonus?: boolean
  narxTuri?: NarxTuri
  /** Qaysi birlikda sotilmoqda: o'ram (1 blok = 60 dona); yo'q bo'lsa — asosiy birlikda (dona) */
  oram?: { nomi: string; miqdor: number }
}

/** Qator miqdori asosiy birlikda: 2 blok → 120 dona (qoldiq, hisobot shunga qaraydi) */
const asosiyda = (s: { miqdor: number; oram?: { miqdor: number } }) => Math.round(s.miqdor * (s.oram?.miqdor ?? 1) * 1000) / 1000
/** Savat qatori kaliti: bir mahsulot har xil birlikda (dona, blok) va bonus bo'lib alohida qatorda turadi */
const qatorKaliti = (s: { tovarId: string; oram?: { nomi: string }; bonus?: boolean }) => `${s.tovarId}|${s.oram?.nomi ?? ''}|${s.bonus ? 'b' : ''}`
// Saqlab qo'yilgan zakaz — serverda (Buyurtma jadvali). Brauzer
// xotirasida emas: boshqa kassir yoki qurilmadan ham ochilsin.
interface SaqlanganZakaz {
  id: string
  jamiSumma: number | string
  izoh: string | null
  yaratilgan: string
  mijoz: { id: string; ism: string; telefon: string | null } | null
  sotuvchi: { id: string; ism: string } | null
  tarkiblar: Array<{
    id: string
    tovarId: string
    /** Asosiy birlikda (o'ramda saqlangan bo'lsa ham: 2 blok → 120) */
    miqdor: number | string
    birlikNarxi: number | string
    jami?: number | string
    oramNomi?: string | null
    oramMiqdori?: number | string | null
    tovar: { id: string; nomi: string; birlik: string }
  }>
}

function MiqdorInput({ miqdor, max, onChange }: { miqdor: number; max: number; onChange: (v: number) => void }) {
  const [matn, setMatn] = useState(String(miqdor))

  useEffect(() => {
    setMatn(String(miqdor))
  }, [miqdor])

  return (
    <input
      type="text"
      inputMode="decimal"
      value={matn}
      onChange={e => {
        // Faqat raqam va nuqta
        const v = e.target.value.replace(/[^0-9.]/g, '')
        const num = parseFloat(v)
        // Mavjud qoldiqdan oshib yozib bo'lmaydi — darhol maksimalga cheklanadi
        if (!isNaN(num) && num > max) {
          setMatn(String(max))
          onChange(max)
          return
        }
        setMatn(v)
        if (!isNaN(num) && num > 0) onChange(num)
      }}
      onFocus={e => e.target.select()}
      onBlur={() => {
        const num = parseFloat(matn)
        if (isNaN(num) || num <= 0) setMatn(String(miqdor))
      }}
      onWheel={e => e.currentTarget.blur()}
      className="w-14 h-7 text-center text-sm font-medium text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-pos shrink-0"
    />
  )
}

// Kasr miqdor faqat o'lchanadigan birliklarda (1.5 kg); dona, pachka va
// quti — butun son.
// Kasrli birlik (kg, litr, metr) — lib/birlik.ts; o'zi qo'shilgan birliklar butun son
const kasrliBirlikmi = birlikKasrlimi
// 0.1 + 0.2 kabi suzuvchi nuqta qoldiqlari savatga tushmasin — bazada
// miqdor 3 xonali kasr bilan saqlanadi.
const miqdorYaxlitla = (n: number) => Math.round(n * 1000) / 1000
const miqdorniOqi = (matn: string) => parseFloat(matn.replace(',', '.'))

/**
 * Skanerlangan miqdor savatga sig'adimi; sig'masa — kassirga ko'rsatiladigan sabab.
 * `savatda` — asosiy birlikda (barcha qatorlar); `miqdor` va xabar — tanlangan
 * birlikda ("Omborda faqat 3 blok bor"). `hajm` — 1 birlikda nechta asosiy birlik.
 */
function skanMiqdorXatosi(miqdor: number, tovar: Tovar, savatda: number, hajm = 1, birlik = tovar.birlik.toLowerCase()): string | null {
  const qolganAsosiy = miqdorYaxlitla(tovar.qoldiq - savatda)
  const qolgan = hajm === 1 ? qolganAsosiy : Math.floor(qolganAsosiy / hajm + 1e-9)
  if (!Number.isFinite(miqdor) || miqdor <= 0) return 'Miqdorni kiriting'
  if ((hajm !== 1 || !kasrliBirlikmi(tovar.birlik)) && !Number.isInteger(miqdor)) return 'Butun son kiriting'
  if (miqdor > qolgan) {
    return savatda > 0
      ? `Savatda ${savatda} ${tovar.birlik.toLowerCase()} bor — yana faqat ${qolgan} ${birlik} qo'shish mumkin`
      : `Omborda faqat ${qolgan} ${birlik} bor`
  }
  return null
}

/**
 * Qaytarish uchun sotuv qatorlari mahsulot bo'yicha jamlanadi: bir mahsulot
 * "2 blok" va "5 dona" bo'lib ikki qatorda sotilgan bo'lishi mumkin. Miqdor —
 * asosiy birlikda, narx — o'rtacha (to'langan summa / miqdor).
 */
function qaytarishQatorlari(tarkiblar: SotuvTarkibi[]) {
  const m = new Map<string, { tovarId: string; nomi: string; miqdor: number; jami: number; birlikNarxi: number; qismlar: string[]; oramli: boolean }>()
  for (const t of tarkiblar) {
    const q = chekQatori(t)
    const qism = q.oram ? `${q.soni} ${q.oram}` : `${Number(t.miqdor)} ${birlikMatni(t.tovar?.birlik)}`
    const e = m.get(t.tovarId)
    if (e) {
      e.miqdor = miqdorYaxlitla(e.miqdor + Number(t.miqdor))
      e.jami += Number(t.jami)
      e.birlikNarxi = e.miqdor > 0 ? Math.round(e.jami / e.miqdor * 100) / 100 : 0
      e.qismlar.push(qism)
      e.oramli ||= !!q.oram
    } else {
      m.set(t.tovarId, {
        tovarId: t.tovarId, nomi: t.tovar?.nomi || '—', miqdor: Number(t.miqdor), jami: Number(t.jami),
        birlikNarxi: Number(t.birlikNarxi), qismlar: [qism], oramli: !!q.oram,
      })
    }
  }
  return [...m.values()]
}

interface SkanMiqdorProps {
  tovar: Tovar
  bonus: boolean
  /** Qaysi birliklarda sotiladi va 1 birlik narxi, so'mda (bonusda 0): dona, blok… Birinchisi — asosiy birlik */
  birliklar: { nomi: string; miqdor: number; narx: number }[]
  /** Oyna ochilganda tanlangan birlik ('' — asosiy) */
  boshlangichBirlik: string
  /** Qaysi narx: "Chakana" / "Optom" / "Bo'lish" */
  narxYorligi: string
  /** Savatdagi shu mahsulot — asosiy birlikda, barcha qatorlari */
  savatda: number
  /** Oyna ochilgandagi miqdor */
  boshlangich: string
  onTasdiq: (miqdor: number, birlik: string) => void
  onYop: () => void
  /**
   * Oyna ochiq turganda USB skaner yangi kod o'qidi. `true` — xuddi shu
   * mahsulot (miqdor +1 bo'ladi).
   */
  onSkan: (oldingiMatn: string, kod: string, birlik: string) => Promise<boolean>
}

/**
 * Skaner o'qigan mahsulot uchun miqdor so'raydi: Enter — savatga qo'shadi,
 * Esc — bekor qiladi. Mahsulot blok/karobkada ham sotilsa — tepada birlik
 * tanlanadi, miqdor va narx o'sha birlikda (2 blok × 75 000).
 *
 * USB skaner klaviatura kabi yozadi: oyna ochiq paytda keyingi mahsulot
 * skanerlansa, uning 13 xonali kodi shu maydonga "miqdor" bo'lib tushardi.
 * Skaner belgilarni odamdan ancha tez yozadi (o'rtacha 50 ms dan kam; odam —
 * 100 ms dan ortiq): shunday kamida 6 belgili ketma-ketlik va Enter yangi skan
 * deb olinadi, miqdor esa skandan oldingi qiymatiga qaytariladi. Bitta-yarimta
 * sekin bo'shliq (brauzer band bo'lgan lahza) skanni buzmasligi uchun har bir
 * bo'shliq emas, o'rtacha tezlik o'lchanadi.
 */
function SkanMiqdorOynasi({ tovar, bonus, birliklar, boshlangichBirlik, narxYorligi, savatda, boshlangich, onTasdiq, onYop, onSkan }: SkanMiqdorProps) {
  // Matn shu yerda saqlanadi, sahifada emas: har tugma bosilishi butun
  // kassani qayta chizmasin — og'ir render skaner belgilarini sekinlashtirib,
  // ularni odam yozuvidan ajratib bo'lmay qolardi.
  const [matn, setMatn] = useState(boshlangich)
  const [birlikNomi, setBirlikNomi] = useState(boshlangichBirlik)
  const inputRef = useRef<HTMLInputElement>(null)
  const tezYozuv = useRef({ oldingi: '', kod: '', boshi: 0, vaqt: 0 })
  const tanlangan = birliklar.find(b => b.nomi === birlikNomi) ?? birliklar[0]
  const hajm = tanlangan.miqdor
  const asosiyMatn = birlikMatni(tovar.birlik)
  const birlik = tanlangan.nomi || asosiyMatn
  const narx = tanlangan.narx
  const kasrli = hajm === 1 && kasrliBirlikmi(tovar.birlik)
  const qolganAsosiy = miqdorYaxlitla(tovar.qoldiq - savatda)
  const qolgan = hajm === 1 ? qolganAsosiy : Math.floor(qolganAsosiy / hajm + 1e-9)
  // Asosiy birlikda kiritilganda o'ramlarda ko'rinishi: "2 karobka 5 dona"
  const oramlar = oramlarTartibda(oramlarniOqi(tovar.oramlar))
  const miqdor = miqdorniOqi(matn)
  const xato = skanMiqdorXatosi(miqdor, tovar, savatda, hajm, birlik)
  const tezTanlov = kasrli ? [0.5, 1, 2, 5] : [1, 2, 5, 10]

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  // Tugmalar bosilganda fokus maydonda qoladi — keyingi skan ham, Enter ham
  // shu yerga tushadi.
  const fokusniSaqla = (e: React.MouseEvent) => e.preventDefault()
  const qadam = (farq: number) => {
    const joriy = Number.isFinite(miqdor) ? miqdor : 0
    setMatn(String(Math.max(0, miqdorYaxlitla(joriy + farq))))
  }

  return (
    <Modal
      olcham="sm"
      onYopish={onYop}
      belgi={bonus ? <Gift size={18} className="text-violet-500" /> : <ScanLine size={18} className="text-pos" />}
      sarlavha={<span className="line-clamp-2">{tovar.nomi}</span>}
      tavsif={bonus ? 'Bonusga nechta qo‘shilsin?' : 'Savatga nechta qo‘shilsin?'}
      footer={<>
        <ModalBekor onClick={onYop} />
        <ModalAsosiy
          type="button"
          keng
          rang={bonus ? 'binafsha' : 'pos'}
          onClick={() => { if (!xato) onTasdiq(miqdor, tanlangan.nomi) }}
          disabled={!!xato}
        >
          {xato ? 'Qo‘shish' : `${miqdor} ${birlik} qo‘shish`}
        </ModalAsosiy>
      </>}
    >
        <div className="space-y-3">
          {/* Qaysi birlikda sotiladi: dona yoki o'ram — har biri o'z narxida */}
          {birliklar.length > 1 && (
            <div role="radiogroup" aria-label="Qaysi birlikda sotiladi" className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {birliklar.map(b => {
                const faol = b.nomi === tanlangan.nomi
                return (
                  <button
                    key={b.nomi || 'asosiy'}
                    type="button"
                    role="radio"
                    aria-checked={faol}
                    onMouseDown={fokusniSaqla}
                    onClick={() => setBirlikNomi(b.nomi)}
                    disabled={b.miqdor > qolganAsosiy}
                    className={`px-2.5 py-2 rounded-xl text-left transition disabled:opacity-40 ${faol ? 'bg-pos text-white' : 'bg-gray-100 dark:bg-neutral-800 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-neutral-700'}`}
                  >
                    <span className="block text-sm font-semibold">1 {b.nomi || asosiyMatn}</span>
                    {!bonus && <span className="block text-xs tabular-nums opacity-90">{formatSum(b.narx)}</span>}
                    {b.miqdor > 1 && <span className="block text-[11px] tabular-nums opacity-75">{b.miqdor} {asosiyMatn}</span>}
                  </button>
                )
              })}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 text-sm tabular-nums">
            <span className="text-gray-900 dark:text-gray-100 font-medium">
              {bonus ? 'Bonus — bepul' : (
                <>
                  <span className="text-xs font-semibold text-pos mr-1.5">{narxYorligi}</span>
                  {formatSum(narx)} / {birlik}
                </>
              )}
            </span>
            <span className="text-gray-500 dark:text-gray-400 text-right">
              Qoldiq: {qolgan} {birlik}
              {hajm > 1 && <span className="block text-xs">{qolganAsosiy} {asosiyMatn}</span>}
              {savatda > 0 && <span className="block text-xs">savatda {savatda} {asosiyMatn}</span>}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onMouseDown={fokusniSaqla}
              onClick={() => qadam(-1)}
              disabled={!Number.isFinite(miqdor) || miqdor <= 1}
              aria-label="Kamaytirish"
              className="h-12 w-12 shrink-0 flex items-center justify-center rounded-xl border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-40 transition"
            >
              <Minus size={18} />
            </button>
            <input
              ref={inputRef}
              id="skan-miqdor"
              type="text"
              inputMode={kasrli ? 'decimal' : 'numeric'}
              autoComplete="off"
              aria-label={`Miqdor, ${birlik}`}
              aria-invalid={!!xato}
              value={matn}
              onChange={e => {
                const v = kasrli
                  ? e.target.value.replace(',', '.').replace(/[^0-9.]/g, '')
                  : e.target.value.replace(/\D/g, '')
                // Bitta nuqta va 3 xonagacha kasr; aks holda o'zgarish rad etiladi
                if (kasrli && !/^\d*\.?\d{0,3}$/.test(v)) return
                setMatn(v)
              }}
              onKeyDown={e => {
                const t = tezYozuv.current
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const skanmi = t.kod.length >= 6
                    && e.timeStamp - t.vaqt < 150
                    && (t.vaqt - t.boshi) / (t.kod.length - 1) < 50
                  if (skanmi) {
                    const { oldingi, kod } = t
                    tezYozuv.current = { oldingi: '', kod: '', boshi: 0, vaqt: 0 }
                    // Skaner raqamlari maydonga tushib qolgan — oldingi miqdorga qaytamiz
                    setMatn(oldingi)
                    onSkan(oldingi, kod, tanlangan.nomi).then(birXil => {
                      if (!birXil) return
                      setMatn(m => {
                        const joriy = miqdorniOqi(m)
                        return String(miqdorYaxlitla((Number.isFinite(joriy) ? joriy : 0) + 1))
                      })
                    })
                    return
                  }
                  if (!xato) onTasdiq(miqdor, tanlangan.nomi)
                  return
                }
                if (e.key.length !== 1) return
                // 150 ms dan uzoq to'xtalish — yangi ketma-ketlik boshlanadi
                if (t.kod && e.timeStamp - t.vaqt < 150) t.kod += e.key
                else tezYozuv.current = { oldingi: matn, kod: e.key, boshi: e.timeStamp, vaqt: 0 }
                tezYozuv.current.vaqt = e.timeStamp
              }}
              onFocus={e => e.target.select()}
              className={`h-12 min-w-0 flex-1 text-center text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-100 bg-white dark:bg-neutral-900 border rounded-xl focus:outline-none focus:ring-2 ${xato && matn ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 dark:border-neutral-700 focus:ring-pos'}`}
            />
            <button
              type="button"
              onMouseDown={fokusniSaqla}
              onClick={() => qadam(1)}
              disabled={Number.isFinite(miqdor) && miqdor + 1 > qolgan}
              aria-label="Oshirish"
              className="h-12 w-12 shrink-0 flex items-center justify-center rounded-xl border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-40 transition"
            >
              <Plus size={18} />
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {tezTanlov.map(q => (
              <button
                key={q}
                type="button"
                onMouseDown={fokusniSaqla}
                onClick={() => setMatn(String(q))}
                disabled={q > qolgan}
                aria-pressed={miqdor === q}
                className={`py-2 rounded-lg text-sm font-medium tabular-nums transition disabled:opacity-40 ${miqdor === q ? 'bg-pos text-white' : 'bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-neutral-700'}`}
              >
                {q}
              </button>
            ))}
          </div>

          <p className={`min-h-5 text-sm ${xato && matn ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`} aria-live="polite">
            {xato ? (matn ? xato : '') : [
              bonus ? '' : `Jami: ${formatSum(Math.round(narx * miqdor))}`,
              hajm > 1 && miqdor > 0
                ? `${miqdorYaxlitla(miqdor * hajm)} ${asosiyMatn}`
                : oramlar.length > 0 && miqdor > 0 && oramdaYoz(miqdor, tovar.birlik, oramlar) !== `${miqdor} ${asosiyMatn}` ? oramdaYoz(miqdor, tovar.birlik, oramlar) : '',
            ].filter(Boolean).join(' · ')}
          </p>
        </div>

    </Modal>
  )
}

const inputCls = 'w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-pos transition text-sm'

// Lotin → Kirill transliteratsiya
const lotinKirill: Record<string, string> = {
  'Sh':'Ш','sh':'ш','Ch':'Ч','ch':'ч','Ng':'Нг','ng':'нг',
  "O'":'Ў',"o'":'ў',"G'":'Ғ',"g'":'ғ',
  'Yo':'Ё','yo':'ё','Yu':'Ю','yu':'ю','Ya':'Я','ya':'я',
  'Ye':'Е','ye':'е','Ts':'Ц','ts':'ц',
  'A':'А','a':'а','B':'Б','b':'б','D':'Д','d':'д','E':'Э','e':'э',
  'F':'Ф','f':'ф','G':'Г','g':'г','H':'Ҳ','h':'ҳ','I':'И','i':'и',
  'J':'Ж','j':'ж','K':'К','k':'к','L':'Л','l':'л','M':'М','m':'м',
  'N':'Н','n':'н','O':'О','o':'о','P':'П','p':'п','Q':'Қ','q':'қ',
  'R':'Р','r':'р','S':'С','s':'с','T':'Т','t':'т','U':'У','u':'у',
  'V':'В','v':'в','X':'Х','x':'х','Y':'Й','y':'й','Z':'З','z':'з',
}
function kirill(text: string): string {
  let result = text
  // Avval ko'p harflilarni almashtirish (uzunroqlarini birinchi)
  const keys = Object.keys(lotinKirill).sort((a, b) => b.length - a.length)
  for (const lat of keys) {
    result = result.split(lat).join(lotinKirill[lat])
  }
  return result
}

/**
 * Chek ko'rinishi (oynada): to'lovdan keyin — "TO'LANGAN" (nasiyada
 * "NASIYA"), to'lovdan oldingi hisobda — "TO'LANMAGAN": raqamsiz va to'lov
 * usulisiz. Chop etiladigan chek (lib/chek-print.ts) bilan bir xil tartib.
 */
function ChekKorinishi({ s, dokonInfo, til }: { s: SotuvYozuvi; dokonInfo: ChekDokonInfo; til: 'lotin' | 'kirill' }) {
  const t = (text: string) => til === 'kirill' ? kirill(text) : text
  const dokonNomi = t(dokonInfo.dokon_nomi || "Do'kon")
  const manzil = t(dokonInfo.manzil || '')
  const tel = dokonInfo.telefon || ''
  const chekMatn = t(dokonInfo.chek_matn || '')
  const kassirTel = s.kassir?.telefon || ''
  const holat = chekHolati(s)
  const tolanmagan = holat.tur === 'tolanmagan'
  const rang = holat.tur === 'tolangan' ? '#15803d' : holat.tur === 'qarz' ? '#b45309' : '#b91c1c'
  return (
    <div className="chek-print bg-white flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ fontFamily: "'Courier New', Consolas, monospace", fontSize: 12, color: '#000', width: '100%', padding: '12px 16px' }}>
      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 14, marginBottom: 2 }}>{dokonNomi}</div>
      {manzil && <div style={{ textAlign: 'center', fontSize: 11, marginBottom: 1 }}>{manzil}</div>}
      {tel && <div style={{ textAlign: 'center', fontSize: 11 }}>Tel: {tel}</div>}
      <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
      <div data-chek-holati={holat.tur} style={{ border: `2px solid ${rang}`, color: rang, borderRadius: 4, textAlign: 'center', fontWeight: 'bold', fontSize: 15, letterSpacing: 2, padding: '2px 0', margin: '4px 0' }}>
        {t(holat.matn)}
      </div>
      {tolanmagan ? <div>{t("To'lovdan oldingi hisob")}</div> : <div>{t('Chek')}: {s.chekRaqami}</div>}
      <div>{t('Sana')}: {formatSanaVaVaqt(s.sana)}</div>
      {kassirTel && <div>{t('Kassir tel')}: {kassirTel}</div>}
      <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
      {s.tarkiblar?.map(item => {
        const bonusmi = Number(item.birlikNarxi) === 0
        // O'ramda sotilgan qator — "2 blok × 75 000"
        const q = chekQatori(item)
        const soni = q.oram ? `${q.soni} ${t(q.oram)}` : q.soni
        return (
        <div key={item.id} style={{ marginBottom: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ flex: 1 }}>
              {t(item.tovar?.nomi || '—')}
              {bonusmi && <span style={{ fontSize: 10, fontWeight: 'normal', color: '#8b5cf6', marginLeft: 4 }}>({t('Bonus')})</span>}
            </span>
          </div>
          {bonusmi ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8b5cf6' }}>
              <span>{soni} × {t('Bepul')}</span>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#555' }}>{soni} × {formatSum(q.narx)}</span>
              <span style={{ fontWeight: 'bold' }}>{formatSum(item.jami)}</span>
            </div>
          )}
        </div>
        )
      })}
      <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
      {Number(s.chegirma) > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{t('Chegirma')} ({Math.round((Number(s.chegirma) / (Number(s.chegirma) + Number(s.yakuniySumma))) * 100)}%):</span><span>-{formatSum(s.chegirma)}</span>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: 13 }}>
        <span>{t(tolanmagan ? "TO'LANADI" : 'JAMI')}:</span><span>{formatSum(s.yakuniySumma)}</span>
      </div>
      <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
      {tolanmagan ? (
        <div style={{ textAlign: 'center', fontSize: 11 }}>{t("Bu chek to'lovni tasdiqlamaydi")}</div>
      ) : s.tolovUsuli === 'ARALASH' ? (
        <>
          {tolovKanallari(s).map(kanal => (
            <div key={kanal.usul} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{tolovQisqa(kanal.usul, til)}:</span><span>{formatSum(kanal.summa)}</span>
            </div>
          ))}
        </>
      ) : s.tolovUsuli === 'NASIYA' ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t("To'lov")}:</span><span>{t('Nasiya')}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Mijoz')}:</span><span>{t(s.mijoz?.ism || '—')}</span></div>
        </>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{t("To'lov")}:</span><span>{tolovLabel(s.tolovUsuli, til)}</span>
        </div>
      )}
      {chekMatn && (
        <>
          <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
          <div style={{ textAlign: 'center', fontSize: 11 }}>{chekMatn}</div>
        </>
      )}
      <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
      <div style={{ textAlign: 'center', fontWeight: 700 }}>{t('Murojaat uchun')}: {MUROJAAT_TEL}</div>
      <div style={{ textAlign: 'center', fontSize: 11 }}>{t('Rahmat')}!</div>
    </div>
  )
}

export default function SotuvPage() {
  const [tovarlar, setTovarlar] = useState<Tovar[]>([])
  const [kursi, setKursi] = useState<number>(12700)
  // Xodim ruxsatlari — server ham har bir sotuvda tekshiradi (chegirma, nasiya)
  const ruxsat = useRuxsat()
  const chegirmaRuxsat = ruxsat.bor('sotuv.chegirma')
  const nasiyaRuxsat = ruxsat.bor('sotuv.nasiya')
  const qaytarishRuxsat = ruxsat.bor('sotuv.qaytarish')
  const saqlashRuxsat = ruxsat.bor('sotuv.saqlash')
  const [tovarlarYuklanmoqda, setTovarlarYuklanmoqda] = useState(true)
  const [tovarlarXato, setTovarlarXato] = useState<string | null>(null)
  const [mijozlar, setMijozlar] = useState<Mijoz[]>([])
  const [savat, setSavat] = useState<SavatItem[]>([])
  const [qidiruv, setQidiruv] = useState('')
  const [kategoriyalar, setKategoriyalar] = useState<Kategoriya[]>([])
  // Ombor — kategoriyalarning ustki guruhi. POS ikki bosqichli
  // filtr beradi: avval ombor, so'ng uning ichidagi kategoriya.
  const [aktifOmbor, setAktifOmbor] = useState<string | null>(null)

  // kategoriyaId -> omborId. Mahsulotda ombor yo'q, faqat kategoriya bor,
  // shuning uchun ombor bo'yicha filtrlash uchun shu xarita kerak.
  const kategoriyaOmbori = useMemo(() => {
    const m = new Map<string, string>()
    for (const k of kategoriyalar) if (k.ombor) m.set(k.id, k.ombor.id)
    return m
  }, [kategoriyalar])

  // Omborlar ro'yxati — kategoriyalardan yig'iladi, alohida so'rov shart emas
  const omborlar = useMemo(() => {
    const m = new Map<string, string>()
    // Nofaol ombor yorliq bermaydi — lekin uning kategoriyalari va
    // tovarlari "Hammasi" ostida ko'rinaveradi, ya'ni zaxira
    // kassirdan yashirilmaydi.
    for (const k of kategoriyalar) if (k.ombor?.faol) m.set(k.ombor.id, k.ombor.nomi)
    return [...m].map(([id, nomi]) => ({ id, nomi }))
  }, [kategoriyalar])

  // Tanlangan omborga tegishli kategoriyalar
  const korinadiganKategoriyalar = useMemo(
    () => aktifOmbor ? kategoriyalar.filter(k => k.ombor?.id === aktifOmbor) : kategoriyalar,
    [kategoriyalar, aktifOmbor],
  )
  // Bo'limlar varag'i — kategoriya ko'p bo'lganda qidirib tanlash uchun
  const [kategoriyaVaraq, setKategoriyaVaraq] = useState(false)
  const [kategoriyaQidiruv, setKategoriyaQidiruv] = useState('')
  const [aktifKategoriya, setAktifKategoriya] = useState<string | null>(null)
  const [tolovUsuli, setTolovUsuli] = useState('NAQD')
  // ARALASH: har bir kanal uchun kassir qo'lda kiritadigan summa.
  // Oldin faqat "naqd qism" so'ralib, qolgani bitta kanalga yozilardi —
  // shuning uchun chekda pul qaysi kanaldan kelgani noaniq qolardi.
  const [aralashSummalar, setAralashSummalar] = useState<Record<KanalUsuli, string>>(
    { NAQD: '', KARTA: '', CLICK: '', BANK: '' }
  )
  // ── Sodiqlik (ballar va keshbeklar) ──
  // Qoida do'kon bo'yicha umumiy, balans esa tanlangan mijozniki.
  // Balans har sotuvdan keyin o'zgargani uchun mijoz tanlanganda
  // har safar yangidan olinadi (ro'yxatdagi eskirgan qiymatga tayanmaydi).
  const [sodiqlikSozlama, setSodiqlikSozlama] = useState<SodiqlikSozlama>(SODIQLIK_STANDART)
  // Qo'shimcha qoidalar (chek summasi, mahsulot, kategoriya) — to'planadiganini oldindan ko'rsatish uchun
  const [sodiqlikQoidalari, setSodiqlikQoidalari] = useState<SodiqlikQoida[]>([])
  const [mijozBalans, setMijozBalans] = useState<{ ball: number; keshbek: number } | null>(null)
  const [sarfBall, setSarfBall] = useState('')
  const [sarfKeshbek, setSarfKeshbek] = useState('')
  const aralashBoshlangich: Record<KanalUsuli, string> = { NAQD: '', KARTA: '', CLICK: '', BANK: '' }
  const [qolBilanSumma, setQolBilanSumma] = useState('')
  const [chegirmaFoizOchiq, setChegirmaFoizOchiq] = useState(false)
  const [chegirmaFoiz, setChegirmaFoiz] = useState('')
  const [bonusTanlashRejimi, setBonusTanlashRejimi] = useState(false)
  // Qaysi narx bilan sotilyapti — chakana/optom/bo'lish. Savatga yangi
  // qo'shilayotgan mahsulotlar shu tur bo'yicha narxlanadi.
  const [narxTuri, setNarxTuri] = useState<NarxTuri>('sotish')
  const [mijozId, setMijozId] = useState('')
  const [nasiyaMuddat, setNasiyaMuddat] = useState('')
  const [yuklanmoqda, setYuklanmoqda] = useState(false)
  const [chekModal, setChekModal] = useState(false)
  const [oxirgiSotuv, setOxirgiSotuv] = useState<SotuvYozuvi | null>(null)
  // Chek Telegramga ATAYLAB avtomatik ketmaydi — kassir o'zi qaror qiladi.
  // 'yuborildi' bo'lgach tugma holatini o'zgartiramiz, ikki marta
  // bosib mijozga bir xil xabar ikki marta ketmasin.
  const [chekYuborish, setChekYuborish] = useState<'tayyor' | 'ketmoqda' | 'yuborildi'>('tayyor')
  /** A4 rasmli chek tayyorlanmoqda (rasmlar serverdan keladi) */
  const [a4Band, setA4Band] = useState(false)
  // To'lovdan oldingi (to'lanmagan) chek oynasi — savatdan, hech qayerga yozilmaydi
  const [hisobOyna, setHisobOyna] = useState(false)
  const [dokonInfo, setDokonInfo] = useState<Record<string, string>>({})
  const [editNarx, setEditNarx] = useState<{ kalit: string; val: string } | null>(null)
  const [mobileTab, setMobileTab] = useState<'tovarlar' | 'savat'>('tovarlar')
  // Kassa oynasi: mahsulot qidirib pastga tushilganda savat ustuni
  // ko'rinmay qoladi — shunda suzuvchi tugma chiqadi va kassa shu yerda ochiladi.
  const [kassaOchiq, setKassaOchiq] = useState(false)
  const [savatKorinmayapti, setSavatKorinmayapti] = useState(false)
  const savatUstuniRef = useRef<HTMLDivElement>(null)

  // Yopishgan (sticky) asboblar paneli ekran tepasiga tegib turibdimi.
  // Tegib turgandagina soya va ajratuvchi chiziq chiqadi — shundagina
  // panel "ustidagi qatlam"dek o'qiladi va ostidan sirg'alib o'tayotgan
  // kartalar nosozlikdek emas, ataylab shunday qilingandek ko'rinadi.
  const asboblarRef = useRef<HTMLDivElement>(null)
  const [asboblarYopishgan, setAsboblarYopishgan] = useState(false)

  // Mijoz ma'lumotlari (har bir sotuvda so'raladi)
  const [mijozModal, setMijozModal] = useState(false)
  const [mijozTelefon, setMijozTelefon] = useState('')
  const [mijozIsmi, setMijozIsmi] = useState('')
  const [mijozManzil, setMijozManzil] = useState('')
  // Mavjud mijoz tanlanganda uning saqlangan GPS joylashuvi (bo'lsa) shu yerda
  // ko'rsatiladi — telefon/ism qo'lda o'zgartirilsa avtomatik tozalanadi.
  const [mijozLokatsiya, setMijozLokatsiya] = useState<{ lat: number; lng: number } | null>(null)
  const [mijozAniqlanmoqda, setMijozAniqlanmoqda] = useState(false)
  const [telefonTaklifOchiq, setTelefonTaklifOchiq] = useState(false)
  const [ismTaklifOchiq, setIsmTaklifOchiq] = useState(false)

  // Qaytarish
  const [qaytarishModal, setQaytarishModal] = useState(false)
  const [qaytarishSotuv, setQaytarishSotuv] = useState<SotuvYozuvi | null>(null)
  const [qaytarishTanlangan, setQaytarishTanlangan] = useState<Record<string, { miqdor: number; birlikNarxi: number; checked: boolean }>>({})
  const [qaytarishSabab, setQaytarishSabab] = useState('')
  const [qaytarishYuklanmoqda, setQaytarishYuklanmoqda] = useState(false)
  const [sotuvlarRoyxati, setSotuvlarRoyxati] = useState<SotuvYozuvi[]>([])
  const [sotuvlarYuklanmoqda, setSotuvlarYuklanmoqda] = useState(false)
  const [sotuvQidiruv, setSotuvQidiruv] = useState('')

  // Til (lotin / kirill)
  const [til, setTil] = useState<'lotin' | 'kirill'>('lotin')

  // Barcode skaner
  const [skanerOchiq, setSkanerOchiq] = useState(false)
  const skanerRef = useRef<Html5Qrcode | null>(null)
  const oxirgiSkanRef = useRef({ kod: '', vaqt: 0 })
  // Har doim oxirgi tovarlar ro'yxatini olish uchun ref
  const tovarlarRef = useRef<Tovar[]>([])
  const kameraSkanRef = useRef<(kod: string) => void>(() => {})
  // Skaner o'qigan mahsulot — miqdor so'rash oynasi (null — yopiq).
  // `klaviatura`: USB skaner qidiruv maydoniga yozgan — oyna yopilgach
  // fokus o'sha maydonga qaytadi, keyingi skan ham shu yerga tushsin.
  const [skanOyna, setSkanOyna] = useState<{ tovar: Tovar; boshlangich: string; klaviatura: boolean; birlik: string } | null>(null)
  const skanOynaOchiqRef = useRef(false)
  const qidiruvInputRef = useRef<HTMLInputElement>(null)

  const skanerniYopish = useCallback(() => {
    const s = skanerRef.current
    if (s) {
      if (s.isScanning) s.stop().then(() => s.clear()).catch(() => {})
      skanerRef.current = null
    }
    oxirgiSkanRef.current = { kod: '', vaqt: 0 }
    setSkanerOchiq(false)
  }, [])

  // Shtrix-kod bo'yicha tovar topish — bir nechta strategiya bilan
  function tovarniTopish(kod: string): Tovar | undefined {
    const n = kod.trim()
    if (!n) return undefined
    const list = tovarlarRef.current
    // Bir xil kod bir nechta mahsulotda bo'lishi mumkin: omborlararo
    // o'tkazma qabul omborida mahsulot nusxasini (kodi bilan) yaratadi.
    // Unda tanlangan ombordagisi, keyin sotiladigan qoldig'i ko'pi olinadi.
    const eng = (mos: Tovar[]): Tovar | undefined => {
      if (mos.length <= 1) return mos[0]
      const ball = (t: Tovar) =>
        (aktifOmbor && kategoriyaOmbori.get(t.kategoriya?.id ?? '') === aktifOmbor ? 1e12 : 0)
        + Math.max(0, t.qoldiq)
      return mos.reduce((a, b) => (ball(b) > ball(a) ? b : a))
    }
    const nNoZero = n.replace(/^0+/, '')
    const bosqichlar: Array<(kodi: string) => boolean> = [
      // 1) Aynan mos keladigan
      kodi => kodi === n,
      // 2) Trim qilingan
      kodi => kodi.trim() === n,
      // 3) Boshidagi 0 ni olib tashlab taqqoslash (EAN-13 vs UPC-A)
      kodi => kodi.trim().replace(/^0+/, '') === nNoZero,
      // 4) Nol bilan to'ldirib taqqoslash (UPC-A → EAN-13)
      kodi => kodi.trim() === '0' + n,
    ]
    for (const mosmi of bosqichlar) {
      const topilgan = eng(list.filter(t => mosmi(t.shtrixKod || '')))
      if (topilgan) return topilgan
    }
    return undefined
  }

  // Local cache'da topilmasa API'dan to'g'ridan-to'g'ri qidirish.
  // Tovarlar yuklanmagan/eskirgan bo'lsa ham skaner ishlaydi.
  async function tovarniApidanTopish(kod: string): Promise<Tovar | null> {
    // Skaner QR ham o'qiydi — QR ichida to'liq manzil bo'ladi.
    // `kodniAjrat` ikkalasini ham bir xil kodga keltiradi.
    const n = kodniAjrat(kod)
    if (!n) return null
    try {
      const r = await fetch(`/api/tovarlar/by-shtrix/${encodeURIComponent(n)}`)
      if (!r.ok) return null
      const data = await r.json()
      if (!data || !data.id) return null
      // Optom va bo'lish narxlari ham olinadi — aks holda skaner orqali
      // topilgan mahsulot "Optom" rejimida ham chakana narxda tushardi.
      const tovar = tovarniMeyorla({
        ...data,
        shtrixKod: data.shtrixKod ?? null,
        rasmlar: data.rasmlar ?? [],
      })
      // Topilgan tovarni local cache'ga qo'shamiz — keyingi skanlar tezlashadi
      setTovarlar(prev => prev.some(t => t.id === tovar.id) ? prev : [tovar, ...prev])
      return tovar
    } catch {
      return null
    }
  }

  const skanerniOchish = useCallback(async () => {
    setSkanerOchiq(true)
    oxirgiSkanRef.current = { kod: '', vaqt: 0 }
    setTimeout(async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        const scanner = new Html5Qrcode('skaner-reader')
        skanerRef.current = scanner
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 15, qrbox: { width: 280, height: 160 } },
          (kod) => {
            const n = kod.trim()
            if (!n) return
            // Kamera mahsulot ustida turganda uni sekundiga bir necha marta
            // o'qiydi. Bir xil kod faqat 2 s ko'rinmay turgandan keyin qayta
            // qabul qilinadi — aks holda miqdor tasdiqlangan zahoti
            // (mahsulot hali kamera oldida) oyna yana ochilib ketardi.
            const hozir = Date.now()
            const oxirgi = oxirgiSkanRef.current
            if (oxirgi.kod === n && hozir - oxirgi.vaqt < 2000) {
              oxirgi.vaqt = hozir
              return
            }
            // Miqdor oynasi ochiq — kassir avval uni tasdiqlasin
            if (skanOynaOchiqRef.current) return
            oxirgiSkanRef.current = { kod: n, vaqt: hozir }

            playBeep()
            kameraSkanRef.current(n)
          },
          () => {}
        )
      } catch {
        toast.error('Kamera ochilmadi')
        setSkanerOchiq(false)
      }
    }, 100)
  }, [])

  // Saqlangan savatlar
  const [saqlanganiSavatlar, setSaqlanganiSavatlar] = useState<SaqlanganZakaz[]>([])
  const [saqlanganiModal, setSaqlanganiModal] = useState(false)
  // Saqlash oynasi — mijoz va izoh shu yerda so'raladi
  const [saqlashModal, setSaqlashModal] = useState(false)
  const [zakazIzoh, setZakazIzoh] = useState('')
  const [zakazMijozId, setZakazMijozId] = useState('')
  const [zakazSaqlanmoqda, setZakazSaqlanmoqda] = useState(false)
  const [zakazlarYuklanmoqda, setZakazlarYuklanmoqda] = useState(false)
  useBodyScrollLock(mijozModal || chekModal || saqlanganiModal || saqlashModal || qaytarishModal || kategoriyaVaraq)

  const tovarlarniYuklash = useCallback(async () => {
    setTovarlarYuklanmoqda(true)
    setTovarlarXato(null)
    try {
      setTovarlar(await sotuvTovarlariniOl())
    } catch (e) {
      const xabar = e instanceof Error ? e.message : ''
      setTovarlarXato(xabar || 'Tovarlarni yuklashda xato')
      toast.error(xabar || 'Tovarlarni yuklab bo\'lmadi')
    } finally {
      setTovarlarYuklanmoqda(false)
    }
  }, [])

  useEffect(() => {
    // Sahifa yangilanganda tiklanadigan savat va uning mijozi — URL'dagi mijoz
    // bilan solishtirish uchun, ular state'ga yozilishidan OLDIN o'qib olinadi
    const tiklanganSavatSoni = (() => {
      try { const x = JSON.parse(localStorage.getItem('aktiv-savat') || '[]'); return Array.isArray(x) ? x.length : 0 } catch { return 0 }
    })()
    const tiklanganMijozId: string = (() => {
      try { return JSON.parse(localStorage.getItem('aktiv-tolov') || 'null')?.mijozId || '' } catch { return '' }
    })()

    async function yuklashQoshimcha() {
      try {
        const [mj, sz, kt, sd, sq] = await Promise.all([
          fetch('/api/mijozlar').then(r => r.json()).catch(() => []),
          fetch('/api/sozlamalar').then(r => r.json()).catch(() => ({})),
          fetch('/api/kategoriyalar').then(r => r.json()).catch(() => []),
          fetch('/api/sodiqlik/sozlamalar').then(r => r.json()).catch(() => null),
          fetch('/api/sodiqlik/qoidalar').then(r => r.json()).catch(() => []),
        ])
        setSodiqlikQoidalari(Array.isArray(sq) ? (sq as SodiqlikQoida[]).filter(q => q.faol) : [])
        setMijozlar(Array.isArray(mj) ? mj : [])
        setDokonInfo(sz && typeof sz === 'object' ? sz : {})
        setKategoriyalar(Array.isArray(kt) ? kt : [])
        if (sd && typeof sd === 'object' && !sd.xato) setSodiqlikSozlama(sd as SodiqlikSozlama)
        const royxat: Mijoz[] = Array.isArray(mj) ? mj : []
        // Mijoz kartasidagi savatcha ("Sotuvni boshlash") orqali kelingan bo'lsa —
        // mijoz shu zahoti tanlanadi va to'lashda qayta so'ralmaydi.
        const boshlanguvchiMijozId = new URLSearchParams(window.location.search).get('mijozId')
        if (boshlanguvchiMijozId) {
          const topilgan = royxat.find(m => m.id === boshlanguvchiMijozId)
          if (topilgan) {
            mijozTanlash(topilgan)
            if (tiklanganSavatSoni > 0 && tiklanganMijozId !== topilgan.id) {
              // Oldingi (boshqa mijoz yoki mijozsiz) yig'ilgan savat tiklandi — kassir bilmasdan unga sotib yubormasin
              toast.warning(`Savatda avval yig‘ilgan ${tiklanganSavatSoni} ta tovar bor — ular ham ${topilgan.ism} ga sotiladi`, {
                duration: 12_000,
                action: { label: 'Savatni tozalash', onClick: () => { setSavat([]); setAralashSummalar(aralashBoshlangich); setSarfBall(''); setSarfKeshbek('') } },
              })
            } else {
              toast.success(`${topilgan.ism} uchun savdo — tovarlarni tanlang`)
            }
          } else {
            toast.error('Mijoz topilmadi — u o‘chirilgan yoki boshqa filialga tegishli')
            urlMijozniOlibTashla()
          }
        } else if (tiklanganMijozId) {
          // Tiklangan savatning mijozi hali bormi — yo'q bo'lsa jimgina unga bog'lanib qolmasin
          const tiklangan = royxat.find(m => m.id === tiklanganMijozId)
          if (tiklangan) mijozTanlash(tiklangan)
          else setMijozId('')
        }
      } catch {
        // qo'shimcha ma'lumotlar muhim emas — sotuv ishlay beradi
      }
    }
    tovarlarniYuklash()
    yuklashQoshimcha()
    fetch('/api/kurs').then(r => r.json()).then(d => { if (d.kursi) setKursi(d.kursi) }).catch(() => {})
    // Oxirgi sotuv localStorage dan yuklash
    const saved = localStorage.getItem('oxirgi-sotuv')
    if (saved) { try { setOxirgiSotuv(JSON.parse(saved)) } catch {} }
    // Saqlangan savatlarni yuklash
    void zakazlarniYuklash()
    // Aktiv savat (refresh/navigatsiya'dan keyin tiklash)
    const aktiv = localStorage.getItem('aktiv-savat')
    if (aktiv) {
      try {
        const parsed = JSON.parse(aktiv)
        if (Array.isArray(parsed) && parsed.length > 0) setSavat(parsed)
      } catch {}
    }
    // Aktiv to'lov ma'lumotlarini tiklash
    const aktivPay = localStorage.getItem('aktiv-tolov')
    if (aktivPay) {
      try {
        const p = JSON.parse(aktivPay)
        if (p.tolovUsuli) setTolovUsuli(p.tolovUsuli)
        if (p.mijozId) setMijozId(p.mijozId)
        if (p.aralashSummalar) setAralashSummalar({ NAQD: '', KARTA: '', CLICK: '', BANK: '', ...p.aralashSummalar })
        if (p.qolBilanSumma) setQolBilanSumma(p.qolBilanSumma)
        if (p.nasiyaMuddat) setNasiyaMuddat(p.nasiyaMuddat)
        // Optom savdo o'rtasida sahifa yangilansa, keyingi qo'shilgan
        // mahsulot ham optom narxida tushsin
        if (p.narxTuri === 'optom' || p.narxTuri === 'bolish') setNarxTuri(p.narxTuri)
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Aktiv savatni har o'zgarishda localStorage'ga yozish
  useEffect(() => {
    if (savat.length > 0) {
      localStorage.setItem('aktiv-savat', JSON.stringify(savat))
    } else {
      localStorage.removeItem('aktiv-savat')
    }
  }, [savat])

  // Aktiv to'lov ma'lumotlarini saqlash
  useEffect(() => {
    if (savat.length > 0) {
      localStorage.setItem('aktiv-tolov', JSON.stringify({
        tolovUsuli, mijozId, aralashSummalar, qolBilanSumma, nasiyaMuddat, narxTuri,
      }))
    } else {
      localStorage.removeItem('aktiv-tolov')
    }
  }, [savat.length, tolovUsuli, mijozId, aralashSummalar, qolBilanSumma, nasiyaMuddat, narxTuri])

  // Tovarlar yuklangach savatdagi mavjud qoldiqni yangilash (stale data oldini olish)
  useEffect(() => {
    if (tovarlar.length === 0 || savat.length === 0) return
    setSavat(prev => {
      let changed = false
      const updated = prev.map(item => {
        const tovar = tovarlar.find(t => t.id === item.tovarId)
        if (tovar && tovar.qoldiq !== item.mavjudQoldiq) {
          changed = true
          const maks = item.oram ? Math.floor(tovar.qoldiq / item.oram.miqdor + 1e-9) : tovar.qoldiq
          const yangiMiqdor = Math.min(item.miqdor, maks)
          return { ...item, mavjudQoldiq: tovar.qoldiq, miqdor: yangiMiqdor, jami: yangiMiqdor * item.birlikNarxi }
        }
        return item
      })
      return changed ? updated : prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tovarlar])

  const filteredTovarlar = tovarlar.filter(t =>
    (!aktifOmbor || kategoriyaOmbori.get(t.kategoriya?.id ?? '') === aktifOmbor) &&
    (!aktifKategoriya || t.kategoriya?.id === aktifKategoriya) &&
    (uzSearch(t.nomi, qidiruv) || (t.shtrixKod && t.shtrixKod.includes(qidiruv)))
  )
  const korsatiladiganTovarlar = filteredTovarlar

  /**
   * Qatorga ko'pi bilan qancha sig'adi — o'z birligida (blok). Shu mahsulotning
   * boshqa qatorlari ham (dona, bonus) qoldiqdan oladi.
   */
  function qatorMaksimum(item: SavatItem, royxat: SavatItem[] = savat): number {
    const boshqa = royxat
      .filter(s => s.tovarId === item.tovarId && qatorKaliti(s) !== qatorKaliti(item))
      .reduce((x, s) => x + asosiyda(s), 0)
    const qoldi = Math.max(0, item.mavjudQoldiq - boshqa)
    return item.oram ? Math.floor(qoldi / item.oram.miqdor + 1e-9) : miqdorYaxlitla(qoldi)
  }

  /**
   * Savatga `miqdor` qo'shadi — tanlangan birlikda (dona yoki o'ram, `oramNomi`);
   * narx — o'sha birlikniki. Qoldiq yetmasa rad etib `false` qaytaradi.
   */
  function savatQosh(tovar: Tovar, miqdor = 1, oramNomi = ''): boolean {
    if (tovar.qoldiq <= 0) {
      toast.error(`${tovar.nomi}: qoldiq yo'q`)
      return false
    }
    const qoldiqYetmaydi = () => {
      toast.error(`${tovar.nomi}: omborda faqat ${tovar.qoldiq} ${tovar.birlik.toLowerCase()}`)
      return false
    }
    // Shu mahsulotning savatdagi barcha qatorlari (dona, blok, bonus) qoldiqdan oladi
    const band = savatdagiAsosiy(tovar.id)
    if (bonusTanlashRejimi) {
      // Bonus xuddi shu mahsulotdan ham bo'lishi mumkin (masalan 5ta sotib
      // olib, 1tasi bonusga xuddi o'shanidan) — shuning uchun tovarId bir xil
      // bo'lgan oddiy (pullik) qator borligi to'sqinlik qilmaydi, faqat
      // ALLAQACHON bonus qatori bo'lsa, shunga miqdor qo'shiladi (dublikat
      // qator ochilmaydi). Bonus — asosiy birlikda.
      if (band + miqdor > tovar.qoldiq + 1e-9) return qoldiqYetmaydi()
      const mavjudBonus = savat.find(s => s.tovarId === tovar.id && s.bonus)
      if (mavjudBonus) {
        setSavat(prev => prev.map(s => (s.tovarId === tovar.id && s.bonus)
          ? { ...s, miqdor: Math.min(miqdorYaxlitla(s.miqdor + miqdor), tovar.qoldiq) }
          : s))
        setBonusTanlashRejimi(false)
        setMobileTab('savat')
        toast.success(`${tovar.nomi} bonus miqdori oshirildi`)
        return true
      }
      setSavat(prev => [{
        tovarId: tovar.id, nomi: tovar.nomi, birlikNarxi: 0,
        miqdor, birlik: tovar.birlik, chegirma: 0,
        jami: 0, mavjudQoldiq: tovar.qoldiq, bonus: true,
      }, ...prev])
      setBonusTanlashRejimi(false)
      setMobileTab('savat')
      toast.success(`${tovar.nomi} bonus sifatida qo'shildi`)
      return true
    }
    // Sotiladigan birlik: dona yoki o'ram (1 blok = 60 dona) — narx o'sha
    // birlikniki, joriy narx turi (chakana/optom/bo'lish) bo'yicha
    const b = sotuvBirligi(tovar, oramNomi)
    const oram = b.nomi ? { nomi: b.nomi, miqdor: b.miqdor } : undefined
    if (band + miqdor * b.miqdor > tovar.qoldiq + 1e-9) return qoldiqYetmaydi()
    const narxSomda = narxTuriBoyicha(tovar, narxTuri, kursi, oram?.nomi)
    const kalit = qatorKaliti({ tovarId: tovar.id, oram })
    // `savat` state'idan (setSavat ichidagi `prev`dan emas — u yangilanish
    // React tomonidan keyinroq bajarilishi mumkin) — shu mahsulot savatda
    // birinchi marta qo'shilayotganini oldindan bilib olamiz.
    const yangiQator = !savat.some(s => s.tovarId === tovar.id && !s.bonus)
    setSavat(prev => {
      // Xuddi shu birlikdagi oddiy qator bilan birlashtiriladi — narxi (va
      // turi) o'zgartirilmaydi, faqat miqdor qo'shiladi.
      const mavjud = prev.find(s => qatorKaliti(s) === kalit)
      if (mavjud) {
        // Qoldiq yuqorida `savat` bo'yicha tekshirildi; bu yerdagi cheklov —
        // bir hodisada ketma-ket ikki qo'shish (state hali yangilanmagan)
        // qoldiqdan oshirib yubormasligi uchun.
        const yangiMiqdor = Math.min(miqdorYaxlitla(mavjud.miqdor + miqdor), qatorMaksimum(mavjud, prev))
        const yangilangan = { ...mavjud, miqdor: yangiMiqdor, jami: yangiMiqdor * mavjud.birlikNarxi }
        return [yangilangan, ...prev.filter(s => qatorKaliti(s) !== kalit)]
      }
      return [{
        tovarId: tovar.id, nomi: tovar.nomi, birlikNarxi: narxSomda,
        miqdor, birlik: tovar.birlik, chegirma: 0,
        jami: narxSomda * miqdor, mavjudQoldiq: tovar.qoldiq,
        narxTuri: amaldagiNarxTuri(tovar, narxTuri, oram?.nomi),
        oram,
      }, ...prev]
    })
    // Mijoz allaqachon tanlangan bo'lsa — bu mahsulot birinchi marta
    // savatga qo'shilayotganda (miqdor oshirilayotganda emas) darhol
    // eslatma tekshiriladi, keshlangan tarix orqali (yangi so'rovsiz).
    if (yangiQator && mijozId && mijozTarixi[tovar.id]) {
      eslatmaKorsat([{
        tovarId: tovar.id, nomi: tovar.nomi, birlikNarxi: narxSomda,
        miqdor, birlik: tovar.birlik, chegirma: 0, jami: narxSomda * miqdor, mavjudQoldiq: tovar.qoldiq,
      }], mijozTarixi, mijozIsmi)
    }
    return true
  }

  // ── Skanerdan miqdor bilan qo'shish ──
  // Skanerlangan mahsulot darhol 1 dona qo'shilmaydi: avval nechta
  // kerakligi so'raladi (5 kiritilsa — 5 dona).

  /** Savatdagi shu mahsulot — asosiy birlikda, barcha qatorlari (dona, blok, bonus) */
  function savatdagiAsosiy(tovarId: string) {
    return miqdorYaxlitla(savat.filter(s => s.tovarId === tovarId).reduce((x, s) => x + asosiyda(s), 0))
  }

  function miqdorSorash(tovar: Tovar, klaviatura: boolean) {
    const qolgan = miqdorYaxlitla(tovar.qoldiq - savatdagiAsosiy(tovar.id))
    if (qolgan <= 0) {
      toast.error(tovar.qoldiq <= 0
        ? `${tovar.nomi}: qoldiq yo'q`
        : `${tovar.nomi}: omborda faqat ${tovar.qoldiq} ${tovar.birlik.toLowerCase()} — hammasi savatda`)
      return
    }
    // Savatda shu mahsulot blokda sotilayotgan bo'lsa — oyna o'sha birlikda ochiladi
    const birlik = bonusTanlashRejimi ? '' : (savat.find(s => s.tovarId === tovar.id && !s.bonus)?.oram?.nomi ?? '')
    // Kasrli birlikda 1 dan kam qolgan bo'lishi mumkin (0.4 kg) — borini taklif qiladi
    setSkanOyna({ tovar, boshlangich: String(Math.min(1, qolgan)), klaviatura, birlik })
  }

  /** Skaner o'qigan kod bo'yicha mahsulot — avval yuklangan ro'yxatdan, bo'lmasa API'dan. */
  async function kodBoyichaTop(kod: string): Promise<Tovar | null> {
    return tovarniTopish(kodniAjrat(kod)) ?? await tovarniApidanTopish(kod)
  }

  async function kameradanSkan(kod: string) {
    const tovar = await kodBoyichaTop(kod)
    if (tovar) miqdorSorash(tovar, false)
    else {
      setQidiruv(kod)
      toast.error(`Tovar topilmadi: ${kod}`)
    }
  }

  // USB skaner kodni qidiruv maydoniga yozib Enter bosadi. Kod topilmasa-yu,
  // qidiruvdan bitta mahsulot qolgan bo'lsa — o'sha tanlanadi (klaviaturadan
  // nom yozib Enter bosish ham shunday ishlaydi).
  async function qidiruvdaEnter() {
    const matn = qidiruv.trim()
    if (!matn) return
    const yagona = korsatiladiganTovarlar.length === 1 ? korsatiladiganTovarlar[0] : null
    const tovar = tovarniTopish(kodniAjrat(matn))
      ?? yagona
      ?? (korsatiladiganTovarlar.length === 0 ? await tovarniApidanTopish(matn) : null)
    if (tovar) {
      setQidiruv('')
      miqdorSorash(tovar, true)
    } else if (korsatiladiganTovarlar.length === 0) {
      toast.error(`Tovar topilmadi: ${matn}`)
    }
  }

  function skanOynaniYop() {
    const klaviatura = skanOyna?.klaviatura
    setSkanOyna(null)
    if (klaviatura) qidiruvInputRef.current?.focus()
  }

  function skanMiqdorniTasdiqla(miqdor: number, birlik: string) {
    if (!skanOyna) return
    const { tovar } = skanOyna
    const bonus = bonusTanlashRejimi
    if (!savatQosh(tovar, miqdor, birlik)) return
    // Bonus rejimida savatQosh o'zi xabar beradi
    if (!bonus) toast.success(`${tovar.nomi}: ${miqdor} ${birlik || tovar.birlik.toLowerCase()} qo'shildi`)
    skanOynaniYop()
  }

  // Oyna ochiq turganda USB skaner yana kod o'qidi. Xuddi shu mahsulot
  // bo'lsa — `true` (oyna miqdorni +1 qiladi). Boshqa mahsulot bo'lsa —
  // joriysi skandan oldingi miqdor bilan savatga tushadi va yangisi uchun
  // oyna ochiladi.
  async function oynadaSkan(oldingiMatn: string, kod: string, birlik: string): Promise<boolean> {
    const joriy = skanOyna
    if (!joriy) return false
    playBeep()
    const yangi = await kodBoyichaTop(kod)
    if (!yangi) {
      toast.error(`Tovar topilmadi: ${kodniAjrat(kod)}`)
      return false
    }
    if (yangi.id === joriy.tovar.id) return true
    const oldingi = miqdorniOqi(oldingiMatn)
    // Joriy miqdor noto'g'ri bo'lsa hech narsa jim tashlab yuborilmaydi:
    // oyna o'z joyida qoladi, kassir tuzatib, keyingisini qayta skanerlaydi.
    const hajm = bonusTanlashRejimi ? 1 : sotuvBirligi(joriy.tovar, birlik).miqdor
    const xato = skanMiqdorXatosi(oldingi, joriy.tovar, savatdagiAsosiy(joriy.tovar.id), hajm, birlik || undefined)
    if (xato) {
      toast.error(`${joriy.tovar.nomi}: ${xato.toLowerCase()} — ${yangi.nomi} qo'shilmadi`)
      return false
    }
    const bonus = bonusTanlashRejimi
    if (!savatQosh(joriy.tovar, oldingi, birlik)) return false
    if (!bonus) toast.success(`${joriy.tovar.nomi}: ${oldingi} ${birlik || joriy.tovar.birlik.toLowerCase()} qo'shildi`)
    miqdorSorash(yangi, joriy.klaviatura)
    return false
  }

  // Skaner uchun har doim eng so'nggi tovarlar va savatQosh funksiyasi
  // Savat ustuni ekranda ko'rinyaptimi — suzuvchi tugma AYNAN shunga
  // qarab chiqadi. Scroll hodisasini sanashdan ko'ra ishonchli: mobil
  // tabda yashiringan bo'lsa ham, desktopda pastga tushilsa ham to'g'ri
  // ishlaydi va tartib (layout) o'zgarsa moslashib ketadi.
  useEffect(() => {
    const el = savatUstuniRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const kuzatuvchi = new IntersectionObserver(
      ([yozuv]) => setSavatKorinmayapti(!yozuv.isIntersecting),
      { threshold: 0.12 },
    )
    kuzatuvchi.observe(el)
    return () => kuzatuvchi.disconnect()
  }, [])

  // Asboblar paneli yopishgan holatga o'tganini aniqlash.
  // IntersectionObserver o'rniga scroll: sentinel element qo'shilsa
  // ota `flex gap-4` unga ham bo'shliq berib, panelni pastga surib
  // qo'yardi. `requestAnimationFrame` bilan kadrga bir marta hisoblanadi.
  useEffect(() => {
    const el = asboblarRef.current
    const konteyner = el?.closest('main')
    if (!el || !konteyner) return
    let kadr = 0
    const tekshir = () => {
      kadr = 0
      // `scrollTop > 0` sharti muhim: desktopda panel manfiy margin tufayli
      // scroll boshida ham AYNAN yuqori chetda turadi, ya'ni faqat
      // koordinataga qarab "yopishgan" deb bo'lmaydi — soya sahifa
      // qimirlamasdan turib chiqib qolardi.
      const yopishgan = konteyner.scrollTop > 0
        && el.getBoundingClientRect().top <= konteyner.getBoundingClientRect().top + 1
      setAsboblarYopishgan(oldingi => (oldingi === yopishgan ? oldingi : yopishgan))
    }
    const surildi = () => { if (!kadr) kadr = requestAnimationFrame(tekshir) }
    konteyner.addEventListener('scroll', surildi, { passive: true })
    tekshir()
    return () => {
      konteyner.removeEventListener('scroll', surildi)
      if (kadr) cancelAnimationFrame(kadr)
    }
  }, [])

  // Kassa oynasi ochiq bo'lsa orqa fon scroll bo'lmasin
  useBodyScrollLock(kassaOchiq)

  // Escape — kassa oynasini yopadi (klaviaturali kassada qo'l tezroq)
  useEffect(() => {
    if (!kassaOchiq && !kategoriyaVaraq) return
    const bosildi = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      // Ustidagi oyna avval yopiladi
      if (kategoriyaVaraq) setKategoriyaVaraq(false)
      else setKassaOchiq(false)
    }
    window.addEventListener('keydown', bosildi)
    return () => window.removeEventListener('keydown', bosildi)
  }, [kassaOchiq, kategoriyaVaraq])

  useEffect(() => { tovarlarRef.current = tovarlar }, [tovarlar])
  useEffect(() => { kameraSkanRef.current = kameradanSkan })
  useEffect(() => { skanOynaOchiqRef.current = skanOyna !== null }, [skanOyna])
  useBodyScrollLock(skanOyna !== null)

  // Bitta mahsulotdan bir vaqtda bir nechta qator bo'lishi mumkin: oddiy va
  // bonus, dona va blok (tovarId bir xil) — shuning uchun qator doim o'z
  // kaliti bilan ko'rsatiladi (`qatorKaliti`), aks holda hammasi o'zgarib qolardi.
  function miqdorOzgartir(kalit: string, yangiMiqdor: number) {
    if (yangiMiqdor <= 0) {
      setSavat(prev => prev.filter(s => qatorKaliti(s) !== kalit))
      return
    }
    setSavat(prev => prev.map(s => {
      if (qatorKaliti(s) !== kalit) return s
      // O'ram butun sonda sotiladi (1,5 blok emas)
      const soni = s.oram ? Math.max(1, Math.floor(yangiMiqdor)) : yangiMiqdor
      const cheklangan = Math.min(soni, qatorMaksimum(s, prev))
      return { ...s, miqdor: cheklangan, jami: cheklangan * s.birlikNarxi }
    }))
  }

  function narxiOzgartir(kalit: string, yangiNarx: number) {
    if (yangiNarx <= 0) return
    setSavat(prev => prev.map(s => (qatorKaliti(s) === kalit && !s.bonus)
      ? { ...s, birlikNarxi: yangiNarx, jami: s.miqdor * yangiNarx }
      : s
    ))
  }

  function narxTasdiqla(kalit: string) {
    if (!editNarx) return
    const val = parseFloat(editNarx.val.replace(/\s/g, ''))
    if (!isNaN(val) && val > 0) {
      // Chegirma ruxsati yo'q xodim narxni ro'yxatdagi eng past narxdan tushira
      // olmaydi — qator birligida (1 blokning eng past narxi)
      const qator = savat.find(s => qatorKaliti(s) === kalit)
      const tovar = qator && tovarlar.find(t => t.id === qator.tovarId)
      const m = tovar ? minNarxSomda(tovar, kursi) : null
      const min = qator?.oram ? m?.oramlar?.get(nomKaliti(qator.oram.nomi))?.somda : m?.somda
      if (!chegirmaRuxsat && min && min > 0 && val < min) {
        toast.error(`Narxni ${formatSum(min)} dan pasaytirishga ruxsatingiz yo‘q`)
      } else {
        narxiOzgartir(kalit, val)
      }
    }
    setEditNarx(null)
  }

  // Savatdagi bitta qator uchun narx turini (chakana/optom/bo'lish) tanlash —
  // narxni o'sha tovarning shu birlikdagi mos narxiga o'zgartiradi va turini eslab qoladi.
  function savatNarxTuriTanlash(kalit: string, turi: NarxTuri) {
    const qator = savat.find(s => qatorKaliti(s) === kalit)
    const tovar = qator && tovarlar.find(t => t.id === qator.tovarId)
    if (!qator || !tovar) return
    const narx = narxTuriBoyicha(tovar, turi, kursi, qator.oram?.nomi)
    setSavat(prev => prev.map(s => (qatorKaliti(s) === kalit && !s.bonus)
      ? { ...s, birlikNarxi: narx, jami: s.miqdor * narx, narxTuri: amaldagiNarxTuri(tovar, turi, qator.oram?.nomi) }
      : s
    ))
  }

  /**
   * Savat qatorini boshqa birlikka o'tkazish (dona ↔ blok): soni o'sha qoladi,
   * narx — yangi birlikniki (qatorning narx turi bo'yicha). Shu birlikda qator
   * allaqachon bo'lsa — birlashadi. Qoldiq yetmasa — o'tkazilmaydi.
   */
  function birlikniAlmashtir(kalit: string, oramNomi: string) {
    const qator = savat.find(s => qatorKaliti(s) === kalit)
    const tovar = qator && tovarlar.find(t => t.id === qator.tovarId)
    if (!qator || !tovar || qator.bonus) return
    const b = sotuvBirligi(tovar, oramNomi)
    const oram = b.nomi ? { nomi: b.nomi, miqdor: b.miqdor } : undefined
    const turi = qator.narxTuri ?? narxTuri
    const yangiKalit = qatorKaliti({ tovarId: qator.tovarId, oram })
    if (yangiKalit === kalit) return
    const ustma = savat.find(s => qatorKaliti(s) === yangiKalit)
    const narx = ustma ? ustma.birlikNarxi : narxTuriBoyicha(tovar, turi, kursi, oram?.nomi)
    const asos: SavatItem = ustma ?? { ...qator, oram, birlikNarxi: narx, narxTuri: amaldagiNarxTuri(tovar, turi, oram?.nomi) }
    const boshqalar = savat.filter(s => qatorKaliti(s) !== kalit && qatorKaliti(s) !== yangiKalit)
    const kerak = miqdorYaxlitla((ustma?.miqdor ?? 0) + (oram ? Math.max(1, Math.floor(qator.miqdor)) : qator.miqdor))
    const miqdor = Math.min(kerak, qatorMaksimum({ ...asos, miqdor: kerak }, boshqalar))
    if (miqdor <= 0) {
      toast.error(`${tovar.nomi}: 1 ${b.nomi || birlikMatni(tovar.birlik)} uchun qoldiq yetmaydi`)
      return
    }
    const yangi = { ...asos, miqdor, jami: miqdor * asos.birlikNarxi }
    setSavat(prev => {
      const i = prev.findIndex(s => qatorKaliti(s) === kalit)
      const natija = prev.filter(s => qatorKaliti(s) !== kalit && qatorKaliti(s) !== yangiKalit)
      natija.splice(Math.max(0, Math.min(i, natija.length)), 0, yangi)
      return natija
    })
  }

  // Yuqoridagi Chakana / Optom / Bo'lish tugmasi. Ilgari u faqat savatga
  // KEYIN qo'shiladigan mahsulotga ta'sir qilardi — savatdagilar eski narxda
  // qolib, kassir "tugma ishlamayapti" deb o'ylardi. Endi savatdagi barcha
  // qatorlar ham shu zahoti tanlangan narxga o'tadi (bonus qatorlari
  // tegilmaydi). Alohida qatorni boshqa narxda sotish kerak bo'lsa —
  // savatdagi qatorning o'z tugmalari bor.
  function narxTuriniTanlash(turi: NarxTuri) {
    if (turi === narxTuri) return
    setNarxTuri(turi)
    const qatorlar = savat.filter(s => !s.bonus)
    if (qatorlar.length === 0) return

    let narxiYoq = 0
    // Har bir qator o'z birligida: 1 blok optom narxi — blokniki
    const yangiNarx = new Map<string, { narx: number; tur: NarxTuri }>()
    for (const s of qatorlar) {
      const tovar = tovarlar.find(t => t.id === s.tovarId)
      if (!tovar) continue
      const tur = amaldagiNarxTuri(tovar, turi, s.oram?.nomi)
      if (tur !== turi) narxiYoq++
      yangiNarx.set(qatorKaliti(s), { narx: narxTuriBoyicha(tovar, turi, kursi, s.oram?.nomi), tur })
    }
    setSavat(prev => prev.map(s => {
      const y = !s.bonus && yangiNarx.get(qatorKaliti(s))
      return y ? { ...s, birlikNarxi: y.narx, jami: s.miqdor * y.narx, narxTuri: y.tur } : s
    }))

    const nomi = NARX_TURI_LABEL[turi].toLowerCase()
    if (narxiYoq > 0) {
      toast.warning(`Savat ${nomi} narxiga o'tkazildi. ${narxiYoq} ta mahsulotda ${nomi} narxi kiritilmagan — chakana narxda qoldi`)
    } else {
      toast.success(`Savat ${nomi} narxiga o'tkazildi`)
    }
  }

  const jamiSumma = savat.reduce((s, i) => s + i.miqdor * i.birlikNarxi, 0)
  const qolBilan = qolBilanSumma ? parseFloat(qolBilanSumma.replace(/\s/g, '')) : NaN
  // Chegirmadan keyingi, LEKIN ball/keshbek sarflashdan OLDINGI summa.
  // Sodiqlik hisob-kitobi ham, serverdagi tekshiruv ham shu songa tayanadi.
  const chekSummasi = (!isNaN(qolBilan) && qolBilan >= 0) ? Math.min(jamiSumma, qolBilan) : jamiSumma
  const chegirma = jamiSumma - chekSummasi

  // Ball/keshbek sarflash — server bilan AYNAN bir xil funksiya orqali,
  // shuning uchun kassada ko'ringan summa bazaga yozilgani bilan bir xil.
  const sodiqlikNatija = sarflashniHisobla({
    chekSummasi,
    ballBalans: mijozBalans?.ball ?? 0,
    keshbekBalans: mijozBalans?.keshbek ?? 0,
    soralgan: {
      ball: parseFloat(sarfBall.replace(/\s/g, '')) || 0,
      keshbek: parseFloat(sarfKeshbek.replace(/\s/g, '')) || 0,
    },
    sozlama: sodiqlikSozlama,
  })

  // To'lov kanallari bilan yopiladigan yakuniy summa
  const yakuniySumma = chekSummasi - sodiqlikNatija.jamiChegirma

  // Shu xariddan to'planadigan ball/keshbek — serverdagi bilan AYNAN bir xil
  // funksiya, kassir mijozga oldindan ayta oladi ("bu xariddan +5 ball").
  // Kategoriya qoidasi bo'lsagina mahsulotlar kategoriyasi kerak.
  const kategoriyaKerak = sodiqlikQoidalari.some(q => q.turi === 'KATEGORIYA')
  const tovarKategoriyasi = kategoriyaKerak && mijozId
    ? new Map(tovarlar.map(t => [t.id, t.kategoriya?.id ?? null]))
    : null
  const toplanadiOldindan = mijozId && sodiqlikSozlama.faol && savat.length > 0
    ? sotuvdanToplanadi({
      tolangan: yakuniySumma,
      tolovUsuli,
      sozlama: sodiqlikSozlama,
      qatorlar: savat.map(i => ({
        tovarId: i.tovarId, kategoriyaId: tovarKategoriyasi?.get(i.tovarId) ?? null, miqdor: asosiyda(i), jami: i.jami,
      })),
      qoidalar: sodiqlikQoidalari,
    })
    : null

  // Stock yetishmaydigan itemlarni tekshirish — bitta mahsulotdan oddiy va
  // bonus qatori bo'lishi mumkin, shuning uchun ikkalasi QO'SHIB tekshiriladi
  // (har biri alohida qoldiqdan oshmasa ham, birgalikda oshib ketishi mumkin).
  // Asosiy birlikda: 2 blok + 5 dona = 125 dona
  const jamiTalabMap = new Map<string, number>()
  for (const s of savat) jamiTalabMap.set(s.tovarId, (jamiTalabMap.get(s.tovarId) || 0) + asosiyda(s))
  const ortiqchaTovarIdlar = new Set(
    savat.filter(s => (jamiTalabMap.get(s.tovarId) || 0) > s.mavjudQoldiq).map(s => s.tovarId)
  )
  const ortiqchaItemlar = savat.filter(s => ortiqchaTovarIdlar.has(s.tovarId))

  // Aralash to'lovda kiritilgan kanal summalari holati — tugmani bloklash
  // va qolgan/ortiqcha summani ko‘rsatish uchun.
  const aralashKiritilgan = aralashJami(aralashSummalar as AralashKiritma)
  const aralashQoldi = yakuniySumma - aralashKiritilgan
  const aralashNatija = aralashTekshir(aralashSummalar as AralashKiritma, yakuniySumma)
  const aralashXato = tolovUsuli === 'ARALASH' && !aralashNatija.ok ? aralashNatija.xato : null

  // Tanlangan mijoz — faqat ro'yxatda haqiqatda bor bo'lsa (eskirgan id hisobga olinmaydi)
  const tanlanganMijoz = mijozId ? mijozlar.find(m => m.id === mijozId) ?? null : null

  /** `?mijozId=` URL'dan olib tashlanadi — sotuvdan keyin sahifa yangilansa o'sha mijoz qayta tanlanmasin */
  function urlMijozniOlibTashla() {
    const url = new URL(window.location.href)
    if (!url.searchParams.has('mijozId')) return
    url.searchParams.delete('mijozId')
    window.history.replaceState(null, '', url)
  }

  function mijozniOlibTashla() {
    setMijozId('')
    setMijozTelefon('')
    setMijozIsmi('')
    setMijozManzil('')
    setMijozLokatsiya(null)
    urlMijozniOlibTashla()
  }

  async function sotuvYakunla() {
    if (yuklanmoqda) return
    if (savat.length === 0) { toast.error('Savat bo\'sh!'); return }

    if (ortiqchaItemlar.length > 0) {
      const nomlar = Array.from(new Set(ortiqchaItemlar.map(i => i.nomi)))
      toast.error('Zaxira yetarli emas: ' + nomlar.join(', '))
      return
    }

    // Aralash to'lov to'liq taqsimlanmagan bo'lsa — sotuvga o'tkazmaymiz.
    // Jimgina “to'g'rilab” qo'yish kassirning xatosini yashirardi.
    if (aralashXato) { toast.error(aralashXato); return }

    // Mijoz allaqachon tanlangan (kartadagi savatcha, saqlangan zakaz yoki
    // tiklangan savat) — ma'lumotlar qayta so'ralmaydi, sotuv shu mijozga yoziladi
    if (tanlanganMijoz) {
      await sotuvYuborish(tanlanganMijoz.id)
      return
    }

    setMijozTelefon('')
    setMijozIsmi('')
    setMijozManzil('')
    setMijozLokatsiya(null)
    setMijozModal(true)
  }

  // Telefon yoki ism bo'yicha mavjud mijozlarni filtrlab, tanlash uchun taklif ro'yxati.
  // Hech narsa kiritilmagan bo'lsa ham (default holat) mavjud mijozlar ko'rsatiladi.
  const telefonTaklifi = mijozTelefon.length >= 2
    ? mijozlar.filter(m => [m.telefon, m.telefon2, ...(m.qoshimchaTelefonlar ?? [])].some(x => x && x.replace(/\D/g, '').includes(mijozTelefon))).slice(0, 5)
    : mijozlar.slice(0, 8)
  const ismTaklifi = mijozIsmi.trim().length >= 1
    ? mijozlar.filter(m => uzSearch(m.ism, mijozIsmi)).slice(0, 5)
    : mijozlar.slice(0, 8)

  function mijozTanlash(m: Mijoz) {
    const digits = (m.telefon || '').replace(/\D/g, '')
    setMijozTelefon(digits.length === 12 && digits.startsWith('998') ? digits.slice(3) : digits.slice(0, 9))
    setMijozIsmi(m.ism)
    setMijozManzil(m.manzil || '')
    setMijozLokatsiya(m.lokatsiyaLat != null && m.lokatsiyaLng != null ? { lat: m.lokatsiyaLat, lng: m.lokatsiyaLng } : null)
    setTelefonTaklifOchiq(false)
    setIsmTaklifOchiq(false)
    // Mijozning haqiqiy id'sini shu zahoti bilamiz — to'lov tugashini
    // kutmasdan darhol o'rnatamiz, shunda quyidagi useEffect (tarix
    // yuklash + eslatma) va savatga qo'shishdagi eslatma ham ishlay oladi.
    setMijozId(m.id)
  }

  // Mijoz avval nimalarni sotib olganini (mahsulot -> {narx, sana}) keshlab
  // qo'yamiz — mijoz tanlanganda BIR marta yuklanadi, keyin savatga har bir
  // mahsulot qo'shilganda qayta so'rovsiz tekshiriladi.
  const [mijozTarixi, setMijozTarixi] = useState<Record<string, { narx: number; sana: string }>>({})

  // Bir yoki bir nechta savat qatorini mijozning oldingi xaridlari bilan
  // solishtirib, mos kelsa eslatma ko'rsatadi (X tugmasi bosilmaguncha
  // ochiq turadi). Sotuvga xalaqit bermaydi — sof, sinxron tekshiruv.
  function eslatmaKorsat(itemlar: SavatItem[], tarix: Record<string, { narx: number; sana: string }>, mijozIsm: string) {
    const mosKelganlar = itemlar.filter(item => tarix[item.tovarId] && !item.bonus)
    if (mosKelganlar.length === 0) return

    const matn = mosKelganlar.length === 1
      ? `${mijozIsm} avval "${mosKelganlar[0].nomi}"ni ${formatSum(tarix[mosKelganlar[0].tovarId].narx)}dan sotib olgan edi`
      : `${mijozIsm} avval bu mahsulotlarni ham olgan: ${mosKelganlar.slice(0, 3).map(i => i.nomi).join(', ')}${mosKelganlar.length > 3 ? ` va yana ${mosKelganlar.length - 3} ta` : ''}`

    toast(matn, { icon: '🔔', duration: Infinity, closeButton: true })
  }

  // Mijoz o'rnatilganda (tanlanganda yoki mijoz kartasidan "Sotuvni
  // boshlash" bilan kelinganda) — tarixni bir marta yuklab keshlaymiz va
  // hozircha savatda bor mahsulotlarni shu zahoti tekshiramiz.
  useEffect(() => {
    if (!mijozId) {
      setMijozTarixi({})
      setMijozBalans(null)
      setSarfBall('')
      setSarfKeshbek('')
      return
    }
    // Balans — har safar yangidan (oldingi sotuv uni o'zgartirgan bo'lishi mumkin)
    fetch(`/api/sodiqlik/mijoz/${mijozId}`)
      .then(r => r.ok ? r.json() : null)
      .then(b => { if (b && !b.xato) setMijozBalans({ ball: b.ball, keshbek: b.keshbek }) })
      .catch(() => {})
    let bekor = false
    fetch(`/api/mijozlar/${mijozId}/tarix`).then(r => r.json()).then(tarix => {
      if (bekor) return
      setMijozTarixi(tarix)
      eslatmaKorsat(savat, tarix, mijozlar.find(m => m.id === mijozId)?.ism || mijozIsmi)
    }).catch(() => {})
    return () => { bekor = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mijozId])

  async function mijozTasdiqlaVaYubor(e: React.FormEvent) {
    e.preventDefault()
    if (mijozTelefon.length < 9) { toast.error("To'liq telefon raqam kiriting!"); return }
    if (!mijozIsmi.trim()) { toast.error('Mijoz ismini kiriting!'); return }

    setMijozAniqlanmoqda(true)
    try {
      // Server telefon bo'yicha mavjud mijozni topib qaytaradi — qayta yaratmaydi
      const res = await fetch('/api/mijozlar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ism: mijozIsmi, telefon: mijozTelefon, manzil: mijozManzil || null, manba: 'kassa' }),
      })
      if (!res.ok) {
        // Masalan: raqam boshqa xodimning mijozida — server sababini aytadi
        const j = await res.json().catch(() => ({}))
        toast.error(j.xato || "Mijoz qo'shilmadi")
        return
      }
      const natija = await res.json()
      if (!mijozlar.some(m => m.id === natija.id)) {
        setMijozlar(prev => [...prev, natija])
      }

      setMijozId(natija.id)
      setMijozModal(false)
      await sotuvYuborish(natija.id)
    } finally {
      setMijozAniqlanmoqda(false)
    }
  }

  async function sotuvYuborish(aniqMijozId?: string) {
    setYuklanmoqda(true)
    // Kanal summalari server bilan AYNAN bir xil funksiyadan hisoblanadi
    // (server baribir qayta hisoblaydi — bu yerdagisi optimistik ko'rinish uchun).
    const kanalSummalari = tolovTaqsimoti({
      tolovUsuli,
      yakuniySumma,
      aralash: aralashSummalar as AralashKiritma,
    })

    const body = {
      mijozId: aniqMijozId || mijozId || null,
      jamiSumma,
      chegirma,
      yakuniySumma,
      tolovUsuli,
      ...kanalSummalari,
      aralash: aralashSummalar,
      // Server bu qiymatlarni mijozning haqiqiy balansidan QAYTA hisoblaydi
      // va yakuniy summa mos kelmasa sotuvni rad etadi.
      sodiqlikSarf: { ball: sodiqlikNatija.ball, keshbek: sodiqlikNatija.keshbek },
      nasiyaMuddat: tolovUsuli === 'NASIYA' ? nasiyaMuddat : null,
      // Qoldiq, hisobot va foyda asosiy birlikda: 2 blok → 120 dona; summa —
      // aniq (2 × 75 000); qaysi birlikda sotilgani — chek uchun
      tarkiblar: savat.map(s => ({
        tovarId: s.tovarId,
        miqdor: asosiyda(s),
        birlikNarxi: s.oram ? Math.round(s.birlikNarxi / s.oram.miqdor * 100) / 100 : s.birlikNarxi,
        chegirma: 0,
        jami: s.miqdor * s.birlikNarxi,
        oramNomi: s.oram?.nomi ?? null,
      }))
    }

    const res = await fetch('/api/sotuvlar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    setYuklanmoqda(false)

    if (res.ok) {
      const sotuv = await res.json()
      setOxirgiSotuv(sotuv)
      setChekYuborish('tayyor')
      localStorage.setItem('oxirgi-sotuv', JSON.stringify(sotuv))
      // Kassa oynasidan sotilgan bo'lsa — u yopiladi, chek ochiladi
      setKassaOchiq(false)
      setChekModal(true)
      setSavat([])
      setMijozId('')
      urlMijozniOlibTashla()
      setAralashSummalar(aralashBoshlangich)
      setSarfBall('')
      setSarfKeshbek('')
      setMijozBalans(null)
      setQolBilanSumma('')
      setChegirmaFoizOchiq(false)
      setChegirmaFoiz('')
      setBonusTanlashRejimi(false)
      setTolovUsuli('NAQD')
      toast.success(`Sotuv yakunlandi! Chek: ${sotuv.chekRaqami}`)
      // Qoldiqlar yangilanadi. Ilgari bu yerda `sotuvUchun=1` yo'q edi —
      // birinchi sotuvdan keyin qulflangan mahsulotlar ham kassada chiqib qolardi.
      sotuvTovarlariniOl().then(setTovarlar).catch(() => {})
    } else {
      const err = await res.json()
      toast.error(err.xato || 'Sotuv amalga oshmadi')
    }
  }

  // Chekni mijozga Telegram orqali yuborish (chek oynasidagi tugma).
  async function chekniTelegramgaYubor() {
    if (!oxirgiSotuv?.id) return
    setChekYuborish('ketmoqda')
    try {
      const res = await fetch(`/api/sotuvlar/${oxirgiSotuv.id}/chek-yuborish`, { method: 'POST' })
      const d = await res.json()
      if (!res.ok) {
        toast.error(d.xato || 'Yuborilmadi')
        setChekYuborish('tayyor')
        return
      }
      toast.success(
        d.nasiyami
          ? `Nasiya ma'lumoti ${d.mijoz} ga yuborildi`
          : `Chek ${d.mijoz} ga Telegram orqali yuborildi`,
      )
      setChekYuborish('yuborildi')
    } catch {
      toast.error('Tarmoq xatosi')
      setChekYuborish('tayyor')
    }
  }

  async function sotuvlarYuklash() {
    setSotuvlarYuklanmoqda(true)
    const res = await fetch('/api/sotuvlar?limit=50')
    const data = await res.json()
    setSotuvlarRoyxati(data.sotuvlar || [])
    setSotuvlarYuklanmoqda(false)
  }

  function sotuvTanlash(sotuv: SotuvYozuvi) {
    setQaytarishSotuv(sotuv)
    const init: Record<string, { miqdor: number; birlikNarxi: number; checked: boolean }> = {}
    for (const t of qaytarishQatorlari(sotuv.tarkiblar)) {
      init[t.tovarId] = { miqdor: t.miqdor, birlikNarxi: t.birlikNarxi, checked: true }
    }
    setQaytarishTanlangan(init)
  }

  async function qaytarishYuborish() {
    if (!qaytarishSotuv) return
    const tarkiblar = qaytarishQatorlari(qaytarishSotuv.tarkiblar)
      .filter(t => qaytarishTanlangan[t.tovarId]?.checked)
      .map(t => {
        const sel = qaytarishTanlandan(t.tovarId)
        return { tovarId: t.tovarId, miqdor: sel.miqdor, birlikNarxi: sel.birlikNarxi, jami: sel.miqdor * sel.birlikNarxi }
      })
    if (tarkiblar.length === 0) { toast.error('Hech narsa tanlanmadi'); return }
    setQaytarishYuklanmoqda(true)
    const res = await fetch('/api/qaytarish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aslSotuvId: qaytarishSotuv.id, tarkiblar, sabab: qaytarishSabab })
    })
    setQaytarishYuklanmoqda(false)
    if (res.ok) {
      toast.success('Qaytarish amalga oshdi!')
      setQaytarishModal(false)
      setQaytarishSotuv(null)
      setQaytarishSabab('')
      sotuvTovarlariniOl().then(setTovarlar).catch(() => {})
    } else {
      const err = await res.json()
      toast.error(err.xato || 'Xatolik yuz berdi')
    }
  }

  function qaytarishTanlandan(tovarId: string) {
    return qaytarishTanlangan[tovarId] || { miqdor: 0, birlikNarxi: 0, checked: false }
  }

  // Saqlangan zakazlarni serverdan olish (faqat KUTILMOQDA holatdagilar)
  async function zakazlarniYuklash() {
    setZakazlarYuklanmoqda(true)
    try {
      const d = await fetch('/api/buyurtmalar?holati=KUTILMOQDA').then(r => r.ok ? r.json() : [])
      setSaqlanganiSavatlar(Array.isArray(d) ? d : [])
    } catch {
      // Sokin: zakazlar yuklanmasa ham kassa ishlayveradi
    } finally {
      setZakazlarYuklanmoqda(false)
    }
  }

  // "Saqlab qo'yish" tugmasi — avval mijoz va izoh so'raladi
  function saqlashOynasiniOch() {
    if (savat.length === 0) { toast.error("Savat bo'sh!"); return }
    setZakazMijozId(mijozId || '')
    setZakazIzoh('')
    setSaqlashModal(true)
  }

  // Savatni serverga zakaz sifatida saqlash
  async function zakazniSaqlash() {
    if (savat.length === 0) { toast.error("Savat bo'sh!"); return }
    setZakazSaqlanmoqda(true)
    try {
      const res = await fetch('/api/buyurtmalar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mijozId: zakazMijozId || null,
          izoh: zakazIzoh,
          // Qator o'z birligida ("2 blok × 75 000") — server asosiy birlikka o'tkazib saqlaydi
          tarkiblar: savat.map(x => ({
            tovarId: x.tovarId,
            miqdor: x.miqdor,
            birlikNarxi: x.birlikNarxi,
            oramNomi: x.oram?.nomi ?? null,
          })),
        }),
      })
      const d = await res.json()
      if (!res.ok) { toast.error(d.xato || 'Saqlanmadi'); return }

      setSaqlashModal(false)
      savatniTozalash()
      await zakazlarniYuklash()
      toast.success('Zakaz saqlandi')
    } finally {
      setZakazSaqlanmoqda(false)
    }
  }

  // Savat va u bilan bog'liq barcha kiritmalarni tozalash — saqlashdan
  // keyin ham, yangi zakaz yuklashdan oldin ham bir xil ishlaydi.
  function savatniTozalash() {
    setSavat([])
    setMijozId('')
    setAralashSummalar(aralashBoshlangich)
    setSarfBall('')
    setSarfKeshbek('')
    setQolBilanSumma('')
    setChegirmaFoizOchiq(false)
    setChegirmaFoiz('')
    setBonusTanlashRejimi(false)
    setTolovUsuli('NAQD')
  }

  // Saqlangan zakazni savatga qaytarish va savdoni davom ettirish.
  // Narx zakazda yozilganicha qoladi (mijozga aytilgan narx o'zgarmasin),
  // qoldiq esa hozirgi holatga qarab yangilanadi.
  async function zakazniYuklash(zakaz: SaqlanganZakaz) {
    const yangiSavat: SavatItem[] = zakaz.tarkiblar.map(t => {
      const tovar = tovarlar.find(x => x.id === t.tovarId)
      // O'ramda saqlangan qator ("2 blok") — bazada asosiy birlikda (120 dona) turadi
      const q = chekQatori({ miqdor: t.miqdor, birlikNarxi: t.birlikNarxi, jami: t.jami ?? Number(t.miqdor) * Number(t.birlikNarxi), oramNomi: t.oramNomi, oramMiqdori: t.oramMiqdori })
      const oram = q.oram ? { nomi: q.oram, miqdor: Number(t.oramMiqdori) } : undefined
      return {
        tovarId: t.tovarId,
        nomi: tovar?.nomi ?? t.tovar.nomi,
        birlikNarxi: q.narx,
        miqdor: q.soni,
        birlik: tovar?.birlik ?? t.tovar.birlik,
        chegirma: 0,
        jami: q.soni * q.narx,
        mavjudQoldiq: tovar?.qoldiq ?? Number(t.miqdor),
        bonus: Number(t.birlikNarxi) === 0 || undefined,
        oram,
      }
    })

    savatniTozalash()
    setSavat(yangiSavat)
    if (zakaz.mijoz) setMijozId(zakaz.mijoz.id)

    // Zakaz ro'yxatdan chiqadi, lekin tarixda qoladi
    await fetch(`/api/buyurtmalar/${zakaz.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ holati: 'TASDIQLANGAN' }),
    }).catch(() => {})

    setSaqlanganiSavatlar(prev => prev.filter(z => z.id !== zakaz.id))
    setSaqlanganiModal(false)
    setMobileTab('savat')
    toast.success(
      zakaz.mijoz ? `${zakaz.mijoz.ism} uchun zakaz yuklandi` : 'Zakaz yuklandi',
    )
  }

  // O'chirish — yozuv tarixda BEKOR_QILINGAN bo'lib qoladi
  async function zakazniOchirish(id: string) {
    setSaqlanganiSavatlar(prev => prev.filter(z => z.id !== id))
    await fetch(`/api/buyurtmalar/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ holati: 'BEKOR_QILINGAN' }),
    }).catch(() => toast.error("O'chirilmadi"))
  }

  // Til bo'yicha matn tarjima qilish
  const t = (text: string) => til === 'kirill' ? kirill(text) : text

  function chekHtml(s: SotuvYozuvi) {
    return buildChekHtml({
      data: s,
      dokonInfo,
      til,
      fontSize: 11,
    })
  }

  function chekChopEtish(s: SotuvYozuvi) {
    printChek(chekHtml(s))
  }

  // A4 — mahsulot rasmlari bilan. Oyna bosish zahoti ochiladi, rasmlar esa
  // serverdan kichraytirilgan holda keladi
  async function chekA4(s: SotuvYozuvi) {
    if (a4Band) return
    setA4Band(true)
    try {
      await chekniA4ChopEt(s.id, dokonInfo, til)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'A4 chek chiqmadi')
    } finally {
      setA4Band(false)
    }
  }

  /**
   * To'lovdan oldingi hisob — savatdan. Bazaga ham, "oxirgi sotuv"ga ham
   * YOZILMAYDI (sotuvlar ro'yxati va mijoz xaridlariga tushmaydi).
   */
  function hisobCheki(): SotuvYozuvi {
    return {
      id: 'hisob',
      chekRaqami: '',
      sana: new Date().toISOString(),
      tolanmagan: true,
      tarkiblar: savat.map(x => ({
        id: qatorKaliti(x),
        tovarId: x.tovarId,
        tovar: { nomi: x.nomi },
        // Sotuv qatori kabi: miqdor asosiy birlikda, o'ram nomi bilan — chekda "2 blok × 75 000"
        miqdor: asosiyda(x),
        birlikNarxi: x.oram ? Math.round(x.birlikNarxi / x.oram.miqdor * 100) / 100 : x.birlikNarxi,
        jami: x.miqdor * x.birlikNarxi,
        oramNomi: x.oram?.nomi ?? null,
        oramMiqdori: x.oram?.miqdor ?? null,
      })),
      chegirma,
      yakuniySumma,
      tolovUsuli,
      mijoz: tanlanganMijoz ? { ism: tanlanganMijoz.ism } : null,
      kassir: null,
    }
  }

  // To'lanmagan chek — A4, savatdan. Bazaga hech narsa yozilmaydi; faqat
  // mahsulot rasmlari serverdan (kichraytirilgan) olinadi
  async function hisobA4(s: SotuvYozuvi) {
    if (a4Band) return
    setA4Band(true)
    try {
      await chekA4niKorsat(async () => {
      const idlar = [...new Set(s.tarkiblar.map(q => q.tovarId).filter(Boolean))]
      const rasmlar: Record<string, string> = {}
      if (idlar.length > 0) {
        const r = await fetch(`/api/sotuvlar/hisob-rasmlar?idlar=${idlar.map(encodeURIComponent).join(',')}`, { cache: 'no-store' }).catch(() => null)
        // Rasm kelmasa ham chek chiqadi — rasm o'rnida "rasm yo'q"
        const j = r?.ok ? await r.json().catch(() => null) as { rasmlar?: Record<string, string> } | null : null
        Object.assign(rasmlar, j?.rasmlar ?? {})
      }
      const m: ChekA4Malumot = {
        chekRaqami: '',
        sana: String(s.sana),
        holati: 'HISOB',
        tolanmagan: true,
        qatorlar: s.tarkiblar.map(q => {
          const c = chekQatori(q)
          const tv = tovarlar.find(x => x.id === q.tovarId)
          return {
            nomi: q.tovar?.nomi ?? '—', birlik: c.oram ?? tv?.birlik ?? 'DONA', shtrixKod: tv?.shtrixKod ?? null,
            miqdor: c.soni, birlikNarxi: c.narx, jami: Number(q.jami), rasm: rasmlar[q.tovarId] ?? null,
          }
        }),
        jamiSumma,
        chegirma,
        ballIshlatilgan: Math.max(0, sodiqlikNatija.jamiChegirma - sodiqlikNatija.keshbek),
        keshbekIshlatilgan: sodiqlikNatija.keshbek,
        yakuniySumma: Number(s.yakuniySumma),
        yetkazishNarx: 0,
        tolovUsuli: s.tolovUsuli,
        naqdTolangan: 0, kartaTolangan: 0, clickTolangan: 0, bankTolangan: 0,
        mijoz: tanlanganMijoz ? { ism: tanlanganMijoz.ism, telefon: tanlanganMijoz.telefon } : null,
        kassir: null,
        havola: '',
        qr: null,
      }
      return m
      }, dokonInfo, til)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'A4 chek chiqmadi')
    } finally {
      setA4Band(false)
    }
  }

  function chekPdfYuklash(s: SotuvYozuvi) {
    const dokonNomi = t(dokonInfo.dokon_nomi || "Do'kon")
    const manzil = t(dokonInfo.manzil || '')
    const tel = dokonInfo.telefon || ''
    const chekMatn = t(dokonInfo.chek_matn || '')
    const kassirTel = s.kassir?.telefon || ''

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [80, 200] })
    const w = 80
    const mx = 5 // margin x
    const cw = w - mx * 2 // content width
    let y = 8

    // === HEADER ===
    doc.setFillColor(220, 38, 38)
    doc.rect(0, 0, w, 26, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(dokonNomi, w / 2, y + 4, { align: 'center' })
    y += 9
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    if (manzil) { doc.text(manzil, w / 2, y + 2, { align: 'center' }); y += 4 }
    if (tel) { doc.text('Tel: ' + tel, w / 2, y + 2, { align: 'center' }); y += 4 }
    y = 30

    // === TO'LOV BELGISI: TO'LANGAN / TO'LANMAGAN / NASIYA ===
    const holat = chekHolati(s)
    const tolanmagan = holat.tur === 'tolanmagan'
    const holatRang: [number, number, number] = holat.tur === 'tolangan' ? [21, 128, 61] : holat.tur === 'qarz' ? [180, 83, 9] : [185, 28, 28]
    doc.setDrawColor(...holatRang)
    doc.setLineWidth(0.6)
    doc.roundedRect(mx, y - 4, cw, 7, 1, 1, 'S')
    doc.setTextColor(...holatRang)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(t(holat.matn), w / 2, y + 0.8, { align: 'center' })
    y += 7

    // === META ===
    doc.setTextColor(80, 80, 80)
    doc.setFontSize(8)
    if (tolanmagan) {
      doc.setFont('helvetica', 'bold')
      doc.text(t("To'lovdan oldingi hisob"), mx, y)
    } else {
      doc.setFont('helvetica', 'normal')
      doc.text(t('Chek') + ':', mx, y)
      doc.setFont('helvetica', 'bold')
      doc.text(String(s.chekRaqami || ''), w - mx, y, { align: 'right' })
    }
    y += 4
    doc.setFont('helvetica', 'normal')
    doc.text(t('Sana') + ':', mx, y)
    doc.text(formatSanaVaVaqt(s.sana), w - mx, y, { align: 'right' })
    y += 4
    if (kassirTel) {
      doc.text(t('Kassir') + ':', mx, y)
      doc.text(kassirTel, w - mx, y, { align: 'right' })
      y += 4
    }

    // Separator line
    y += 1
    doc.setDrawColor(220, 38, 38)
    doc.setLineWidth(0.5)
    doc.line(mx, y, w - mx, y)
    y += 4

    // === TABLE HEADER ===
    doc.setFillColor(245, 245, 245)
    doc.rect(mx, y - 3, cw, 6, 'F')
    doc.setFontSize(6.5)
    doc.setTextColor(120, 120, 120)
    doc.setFont('helvetica', 'bold')
    doc.text(t('TOVAR'), mx + 1, y)
    doc.text(t('SONI'), mx + 38, y, { align: 'center' })
    doc.text(t('NARX'), mx + 52, y, { align: 'right' })
    doc.text(t('JAMI'), w - mx - 1, y, { align: 'right' })
    y += 5

    // === TABLE ROWS ===
    doc.setTextColor(30, 30, 30)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    const tarkiblar = s.tarkiblar || []
    for (const item of tarkiblar) {
      if (y > 185) {
        doc.addPage([80, 200])
        y = 8
      }
      const bonusmi = Number(item.birlikNarxi) === 0
      const nomi = t(item.tovar?.nomi || '—') + (bonusmi ? ` (${t('Bonus')})` : '')
      // O'ramda sotilgan qator — "2 blok × 75 000"
      const q = chekQatori(item)
      const miqdor = q.oram ? `${q.soni} ${t(q.oram)}` : String(q.soni)
      const narx = bonusmi ? t('Bepul') : formatSum(q.narx)
      const jami = bonusmi ? t('Bepul') : formatSum(item.jami)

      // Truncate long names
      const maxNomiW = 34
      let nomiText = nomi
      while (doc.getTextWidth(nomiText) > maxNomiW && nomiText.length > 3) {
        nomiText = nomiText.slice(0, -1)
      }
      if (nomiText !== nomi) nomiText += '..'

      doc.text(nomiText, mx + 1, y)
      doc.text(miqdor, mx + 38, y, { align: 'center' })
      doc.text(narx, mx + 52, y, { align: 'right' })
      doc.setFont('helvetica', 'bold')
      doc.text(jami, w - mx - 1, y, { align: 'right' })
      doc.setFont('helvetica', 'normal')
      y += 4.5

      // Light row separator
      doc.setDrawColor(240, 240, 240)
      doc.setLineWidth(0.1)
      doc.line(mx, y - 1.5, w - mx, y - 1.5)
    }

    // === CHEGIRMA ===
    if (Number(s.chegirma) > 0) {
      const jamiSummaHisob = Number(s.chegirma) + Number(s.yakuniySumma)
      const chegirmaFoizi = jamiSummaHisob > 0 ? Math.round((Number(s.chegirma) / jamiSummaHisob) * 100) : 0
      y += 1
      doc.setFontSize(7.5)
      doc.setTextColor(100, 100, 100)
      doc.text(`${t('Chegirma')} (${chegirmaFoizi}%):`, mx, y)
      doc.text('-' + formatSum(s.chegirma), w - mx, y, { align: 'right' })
      y += 4
    }

    // === TOTAL ===
    y += 1
    doc.setDrawColor(220, 38, 38)
    doc.setLineWidth(0.7)
    doc.line(mx, y, w - mx, y)
    y += 5
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(220, 38, 38)
    doc.text(t(tolanmagan ? "TO'LANADI" : 'JAMI') + ':', mx, y)
    doc.text(formatSum(s.yakuniySumma), w - mx, y, { align: 'right' })
    y += 6

    // === PAYMENT INFO ===
    doc.setDrawColor(230, 230, 230)
    doc.setLineWidth(0.2)
    doc.line(mx, y, w - mx, y)
    y += 4
    doc.setFontSize(7.5)
    doc.setTextColor(80, 80, 80)
    doc.setFont('helvetica', 'normal')
    if (tolanmagan) {
      doc.text(t("Bu chek to'lovni tasdiqlamaydi"), w / 2, y, { align: 'center' })
      y += 4
    } else if (s.tolovUsuli === 'ARALASH') {
      // Har bir kanal alohida qator — naqd+karta, naqd+Click, naqd+o'tkazma
      for (const kanal of tolovKanallari(s)) {
        doc.text(tolovQisqa(kanal.usul, til) + ':', mx, y)
        doc.text(formatSum(kanal.summa), w - mx, y, { align: 'right' })
        y += 4
      }
    } else if (s.tolovUsuli === 'NASIYA') {
      doc.text(t("To'lov") + ':', mx, y)
      doc.text(t('Nasiya'), w - mx, y, { align: 'right' })
      y += 4
      doc.text(t('Mijoz') + ':', mx, y)
      doc.text(t(s.mijoz?.ism || '—'), w - mx, y, { align: 'right' })
      y += 4
    } else {
      doc.text(t("To'lov") + ':', mx, y)
      doc.text(tolovLabel(s.tolovUsuli, til), w - mx, y, { align: 'right' })
      y += 4
    }

    // === FOOTER ===
    y += 3
    doc.setDrawColor(230, 230, 230)
    doc.setLineWidth(0.2)
    doc.line(mx, y, w - mx, y)
    y += 5
    if (chekMatn) {
      doc.setFontSize(6.5)
      doc.setTextColor(150, 150, 150)
      doc.text(chekMatn, w / 2, y, { align: 'center' })
      y += 4
    }
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 30, 30)
    doc.text(`${t('Murojaat uchun')}: ${MUROJAAT_TEL}`, w / 2, y, { align: 'center' })
    y += 5
    doc.setFontSize(10)
    doc.setTextColor(220, 38, 38)
    doc.text(t('Rahmat') + '!', w / 2, y, { align: 'center' })
    y += 4
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.setFont('helvetica', 'normal')
    doc.text(dokonNomi, w / 2, y, { align: 'center' })

    // Trim page height
    const pageH = y + 10
    doc.internal.pageSize.height = pageH

    // To'lanmagan chek — raqamsiz: fayl nomida mahalliy sana
    const bugun = new Date()
    const sanaNomi = `${bugun.getFullYear()}-${String(bugun.getMonth() + 1).padStart(2, '0')}-${String(bugun.getDate()).padStart(2, '0')}`
    doc.save(tolanmagan ? `tolanmagan-chek-${sanaNomi}.pdf` : `chek-${s.chekRaqami || 'sotuv'}.pdf`)
  }

  // Savat va kassa paneli — BITTA joyda yozilgan, ikki joyda
  // ko‘rsatiladi: odatdagi ustunda yoki "Kassa" oynasida.
  // Nusxa ko‘chirilsa ikkalasi vaqt o‘tib ayrilib ketardi.
  const savatPaneli = (
    <>
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl flex-1 min-h-0">
          <div className="p-3 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart size={16} className="text-gray-500 dark:text-gray-400" />
              <h2 className="text-gray-900 dark:text-gray-100 font-semibold text-sm">Savat ({savat.length})</h2>
            </div>
            <div className="flex items-center gap-1">
              {savat.length > 0 && saqlashRuxsat && (
                <button
                  onClick={saqlashOynasiniOch}
                  className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950 rounded-lg transition"
                  title="Zakazni saqlab qo'yish"
                >
                  <Pause size={15} />
                </button>
              )}
              {/* Ruxsati bor kassirga har doim ko'rinadi — "zakaz bormi?" deb tekshira olsin.
                  Oldin ro'yxat bo'sh bo'lsa tugma umuman yo'q edi. */}
              {saqlashRuxsat && <button
                onClick={() => { setSaqlanganiModal(true); void zakazlarniYuklash() }}
                className="relative p-1.5 text-gray-500 dark:text-gray-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950 rounded-lg transition"
                title="Saqlangan zakazlar"
              >
                <Archive size={15} />
                {saqlanganiSavatlar.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-violet-600 text-white text-[9px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">{saqlanganiSavatlar.length}</span>
                )}
              </button>}
              {oxirgiSotuv && (
                <button
                  onClick={() => setChekModal(true)}
                  className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg transition"
                  title="Oxirgi chek"
                >
                  <Clock size={15} />
                </button>
              )}
              {qaytarishRuxsat && <button
                onClick={() => { setQaytarishModal(true); setQaytarishSotuv(null); setSotuvQidiruv(''); sotuvlarYuklash() }}
                className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950 rounded-lg transition"
                title="Qaytarish"
              >
                <RotateCcw size={15} />
              </button>}
              {savat.length > 0 && (
                <button onClick={() => { setSavat([]); setAralashSummalar(aralashBoshlangich); setSarfBall(''); setSarfKeshbek('') }} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition">
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>

          {/* Tanlangan mijoz — to'lashda qayta so'ralmaydi, shuning uchun kassir aniq ko'rib tursin */}
          {tanlanganMijoz && (
            <div className="px-3 py-2 border-b border-gray-200 dark:border-neutral-800 bg-emerald-50/70 dark:bg-emerald-950/20 flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold" aria-hidden>
                {tanlanganMijoz.ism.trim().charAt(0).toUpperCase() || '?'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium leading-tight text-emerald-700 dark:text-emerald-400">Mijoz uchun savdo</p>
                <p className="text-sm font-semibold leading-tight text-gray-900 dark:text-gray-100 truncate">{tanlanganMijoz.ism}</p>
                {tanlanganMijoz.telefon && <p className="text-xs leading-tight text-gray-500 dark:text-gray-400 truncate">{formatPhone(tanlanganMijoz.telefon)}</p>}
              </div>
              <button
                type="button" onClick={mijozniOlibTashla} disabled={yuklanmoqda}
                title="Mijozni olib tashlash" aria-label="Mijozni olib tashlash"
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition disabled:opacity-50"
              >
                <X size={15} />
              </button>
            </div>
          )}

          {savat.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <ShoppingCart size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">Savat bo&apos;sh</p>
              <p className="text-xs mt-1">Tovar tanlang</p>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-72">
              {savat.map(item => {
                const itemTovar = tovarlar.find(t => t.id === item.tovarId)
                // Qo'lda tahrirlangan narx ko'k bilan ajraladi. Qatorning o'z
                // narx turiga qarab taqqoslanadi — ilgari faqat chakana bilan
                // solishtirilgani uchun har bir optom qatori (va dollardagi
                // har bir mahsulot) "o'zgartirilgan" bo'lib ko'rinardi.
                const kalit = qatorKaliti(item)
                const kutilganNarx = itemTovar ? narxTuriBoyicha(itemTovar, item.narxTuri ?? 'sotish', kursi, item.oram?.nomi) : Number(item.birlikNarxi)
                const isNarxOzgartirilgan = Number(item.birlikNarxi) !== kutilganNarx
                const isEditing = editNarx?.kalit === kalit
                // Faqat narxi bor turlar ko'rsatiladi (shu birlikda) — bo'sh bo'lsa tugma chiqmaydi
                const qatorBirligi = itemTovar ? sotuvBirligi(itemTovar, item.oram?.nomi) : null
                const mavjudTurlar: NarxTuri[] = ['sotish',
                  ...(qatorBirligi?.optom != null ? ['optom' as const] : []),
                  ...(qatorBirligi?.bolish != null ? ['bolish' as const] : []),
                ]
                // Mahsulot blok/karobkada ham sotilsa — qatorda birlik tanlanadi
                const birliklar = itemTovar && !item.bonus ? sotuvBirliklari(itemTovar) : []
                return (
                <div key={kalit} className="px-3 py-2.5 border-b border-gray-100 dark:border-neutral-800 last:border-b-0">
                  {/* Row 1: nomi + delete */}
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <p className="text-gray-900 dark:text-gray-100 text-sm font-medium leading-tight flex-1 truncate flex items-center gap-1.5" title={item.nomi}>
                      {item.nomi}
                      {item.bonus && (
                        <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 px-1.5 py-0.5 rounded-full shrink-0">
                          <Gift size={9} /> Bonus
                        </span>
                      )}
                      {!item.bonus && item.narxTuri && item.narxTuri !== 'sotish' && (
                        <span className="inline-flex items-center text-[11px] font-semibold bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full shrink-0">
                          {NARX_TURI_LABEL[item.narxTuri]}
                        </span>
                      )}
                    </p>
                    <button onClick={() => miqdorOzgartir(kalit, 0)} className="text-gray-300 dark:text-gray-600 hover:text-red-500 transition shrink-0 ml-1">
                      <X size={13} />
                    </button>
                  </div>
                  {/* Row 1.5: narx turi tanlash — mahsulotda optom/bo'lish narxi bo'lsagina chiqadi */}
                  {!item.bonus && mavjudTurlar.length > 1 && (
                    <div className="flex items-center gap-1 mb-1.5">
                      {mavjudTurlar.map(turi => (
                        <button
                          key={turi}
                          type="button"
                          onClick={() => savatNarxTuriTanlash(kalit, turi)}
                          className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition ${
                            (item.narxTuri || 'sotish') === turi
                              ? 'bg-pos text-white'
                              : 'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700'
                          }`}
                        >
                          {NARX_TURI_LABEL[turi]}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Row 1.6: birlik — dona yoki o'ram, har biri o'z narxida */}
                  {birliklar.length > 1 && (
                    <div role="radiogroup" aria-label={`${item.nomi} — birlik`} className="flex flex-wrap items-center gap-1 mb-1.5">
                      {birliklar.map(b => {
                        const faol = (item.oram?.nomi ?? '') === b.nomi
                        return (
                          <button
                            key={b.nomi || 'asosiy'}
                            type="button"
                            role="radio"
                            aria-checked={faol}
                            onClick={() => { if (!faol) birlikniAlmashtir(kalit, b.nomi) }}
                            className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition ${faol
                              ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900'
                              : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700'}`}
                          >
                            {b.nomi || birlikMatni(item.birlik)}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {/* Row 2: [narx input] × [miqdor] = [jami] */}
                  <div className="flex items-center gap-1.5">
                    {item.bonus ? (
                      <span className="flex-1 min-w-0 h-7 flex items-center px-2 text-xs rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 font-medium">
                        Bepul
                      </span>
                    ) : (
                    /* Narx — always editable input */
                    <div className="relative flex-1 min-w-0">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={isEditing ? editNarx.val.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : String(item.birlikNarxi).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
                        onFocus={e => { setEditNarx({ kalit, val: String(item.birlikNarxi) }); e.target.select() }}
                        onChange={e => setEditNarx({ kalit, val: e.target.value.replace(/[^\d]/g, '') })}
                        onBlur={() => narxTasdiqla(kalit)}
                        onKeyDown={e => { if (e.key === 'Enter') { narxTasdiqla(kalit); (e.target as HTMLInputElement).blur() } if (e.key === 'Escape') setEditNarx(null) }}
                        title="Narxni o'zgartirish mumkin"
                        className={`w-full h-7 pl-2 pr-5 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-blue-400 transition
                          ${isNarxOzgartirilgan
                            ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium'
                            : 'border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-600 dark:text-gray-400'
                          }`}
                      />
                      <Pencil size={9} className={`absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none ${isNarxOzgartirilgan ? 'text-blue-400' : 'text-gray-300 dark:text-gray-600'}`} />
                    </div>
                    )}
                    <span className="text-gray-500 dark:text-gray-400 text-xs shrink-0">×</span>
                    <MiqdorInput miqdor={item.miqdor} max={qatorMaksimum(item)} onChange={v => miqdorOzgartir(kalit, v)} />
                    <span className="text-gray-500 dark:text-gray-400 text-xs shrink-0">=</span>
                    <span className={`text-sm font-bold shrink-0 min-w-[65px] text-right ${item.bonus ? 'text-violet-600 dark:text-violet-400' : 'text-green-600'}`}>{item.bonus ? 'Bepul' : formatSum(item.jami)}</span>
                  </div>
                  {/* O'ramda sotilmoqda: "2 blok = 120 dona" (qoldiqdan shuncha kamayadi) */}
                  {item.oram && (
                    <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">
                      {item.miqdor} {item.oram.nomi} = {asosiyda(item)} {birlikMatni(item.birlik)}
                    </p>
                  )}
                  {ortiqchaTovarIdlar.has(item.tovarId) && (
                    <div className="flex items-center gap-1 mt-1.5 text-amber-600 dark:text-amber-400">
                      <AlertTriangle size={11} />
                      <span className="text-[11px]">Qoldiq: {item.mavjudQoldiq} {birlikMatni(item.birlik)}, yetarli emas!</span>
                    </div>
                  )}
                </div>
                )
              })}
            </div>
          )}
        </div>

        {/* To'lov */}
        {savat.length > 0 && (
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>Hisoblangan jami:</span>
              <span className="text-gray-900 dark:text-gray-100 font-medium">{formatSum(jamiSumma)}</span>
            </div>

            {/* Umumiy summa o'zgartirish — chegirma ruxsati bilan */}
            {chegirmaRuxsat && <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">Yakuniy summa:</span>
              <input
                type="text"
                inputMode="numeric"
                value={qolBilanSumma}
                onChange={e => setQolBilanSumma(e.target.value.replace(/[^\d]/g, ''))}
                placeholder={String(Math.round(jamiSumma))}
                className="flex-1 px-2 py-1 text-sm text-right bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-pos text-gray-900 dark:text-gray-100 font-medium"
              />
            </div>}

            {chegirma > 0 && (
              <div className="flex justify-between text-xs text-amber-600 dark:text-amber-400">
                <span>Chegirma:</span><span>-{formatSum(chegirma)}</span>
              </div>
            )}

            {/* Chegirma foizi va bonus mahsulot */}
            <div className="flex items-center gap-3">
              {!chegirmaFoizOchiq ? (
                <button
                  type="button"
                  onClick={() => setChegirmaFoizOchiq(true)}
                  className="flex items-center gap-1 text-xs text-pos hover:underline font-medium"
                >
                  <Plus size={12} /> Chegirma foizi
                </button>
              ) : (
                <div className="flex items-center gap-1.5 flex-1">
                  <Percent size={12} className="text-gray-500 dark:text-gray-400 shrink-0" />
                  <input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    value={chegirmaFoiz}
                    onChange={e => {
                      const v = e.target.value.replace(/[^\d]/g, '')
                      setChegirmaFoiz(v)
                      const foiz = Math.min(100, parseFloat(v) || 0)
                      setQolBilanSumma(v ? String(Math.round(jamiSumma * (1 - foiz / 100))) : '')
                    }}
                    placeholder="foiz"
                    className="w-16 px-2 py-1 text-xs text-right bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-pos text-gray-900 dark:text-gray-100 font-medium"
                  />
                  <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">%</span>
                  <button
                    type="button"
                    onClick={() => { setChegirmaFoizOchiq(false); setChegirmaFoiz(''); setQolBilanSumma('') }}
                    className="text-gray-300 dark:text-gray-600 hover:text-red-500 transition shrink-0 ml-auto"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}
              {!chegirmaRuxsat ? null : !bonusTanlashRejimi ? (
                <button
                  type="button"
                  onClick={() => { setBonusTanlashRejimi(true); setMobileTab('tovarlar') }}
                  className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 hover:underline font-medium shrink-0"
                >
                  <Plus size={12} /> Bonus mahsulot
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setBonusTanlashRejimi(false)}
                  className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 font-medium shrink-0"
                >
                  <Gift size={12} /> Tanlanmoqda... <X size={12} />
                </button>
              )}
            </div>

            {/* ── Ball va keshbek sarflash ──
                Faqat dastur yoqilgan, mijoz tanlangan va balansi bor
                bo'lsa ko'rinadi — bo'sh panel kassirni chalg'itmasin. */}
            {sodiqlikSozlama.faol && mijozBalans
              && (mijozBalans.keshbek > 0 || (ballSarflanadimi(sodiqlikSozlama) && mijozBalans.ball > 0)) && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/10 p-2.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-500 flex items-center gap-1">
                    <Gift size={13} /> Ball va keshbek
                  </span>
                  <span className="text-[11px] text-amber-600 dark:text-amber-500 tabular-nums">
                    {formatBall(mijozBalans.ball)} ball &middot; {formatSum(mijozBalans.keshbek)}
                  </span>
                </div>

                {mijozBalans.keshbek > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 w-14 shrink-0">Keshbek</span>
                    <div className="flex-1 min-w-0">
                      <MoneyInput
                        value={sarfKeshbek}
                        onChange={setSarfKeshbek}
                        max={Math.min(mijozBalans.keshbek, chekSummasi)}
                        min={0}
                        placeholder="0"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setSarfKeshbek(String(Math.floor(Math.min(mijozBalans.keshbek, chekSummasi))))}
                      className="text-[11px] text-amber-700 dark:text-amber-500 hover:underline shrink-0"
                    >
                      hammasi
                    </button>
                  </div>
                )}

                {ballSarflanadimi(sodiqlikSozlama) && mijozBalans.ball > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 w-14 shrink-0">Ball</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={sarfBall}
                      onChange={e => setSarfBall(e.target.value.replace(/[^0-9.]/g, ''))}
                      placeholder="0"
                      className="flex-1 min-w-0 px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-pos"
                    />
                    <button
                      type="button"
                      onClick={() => setSarfBall(formatBall(mijozBalans.ball))}
                      className="text-[11px] text-amber-700 dark:text-amber-500 hover:underline shrink-0"
                    >
                      hammasi
                    </button>
                  </div>
                )}

                {sodiqlikNatija.jamiChegirma > 0 && (
                  <div className="flex justify-between text-xs pt-1 border-t border-amber-200/70 dark:border-amber-900/40">
                    <span className="text-amber-700 dark:text-amber-500">
                      Hisobdan
                      {sodiqlikNatija.ball > 0 && ` (${formatBall(sodiqlikNatija.ball)} ball)`}
                    </span>
                    <span className="font-semibold text-amber-700 dark:text-amber-500 tabular-nums">
                      -{formatSum(sodiqlikNatija.jamiChegirma)}
                    </span>
                  </div>
                )}
                {sodiqlikNatija.ogohlantirish && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-500">{sodiqlikNatija.ogohlantirish}</p>
                )}
              </div>
            )}

            {toplanadiOldindan && (toplanadiOldindan.ball > 0 || toplanadiOldindan.keshbek > 0) && (
              <div className="flex items-center justify-between gap-2 rounded-lg bg-green-50 dark:bg-green-950/20 px-2.5 py-1.5 text-xs text-green-700 dark:text-green-400"
                title={toplanadiOldindan.qollanilgan.length > 0 ? `Qo'shimcha qoidalar: ${toplanadiOldindan.qollanilgan.length} ta` : 'Umumiy qoida bo‘yicha'}>
                <span className="flex items-center gap-1"><Gift size={12} /> Bu xariddan to&apos;planadi</span>
                <span className="font-semibold tabular-nums">
                  {[
                    toplanadiOldindan.ball > 0 && `+${formatBall(toplanadiOldindan.ball)} ball`,
                    toplanadiOldindan.keshbek > 0 && `+${formatSum(toplanadiOldindan.keshbek)}`,
                  ].filter(Boolean).join(' · ')}
                </span>
              </div>
            )}

            <div className="flex justify-between font-bold border-t border-gray-100 dark:border-neutral-800 pt-2">
              <span className="text-gray-900 dark:text-gray-100">To&apos;lov:</span>
              <span className="text-green-600 text-lg">{formatSum(yakuniySumma)}</span>
            </div>

            {/* To'lov usuli */}
            <div className="grid grid-cols-2 gap-1.5">
              {POS_TOLOV_USULLARI.filter(usul => usul !== 'NASIYA' || nasiyaRuxsat).map(usul => (
                <button
                  key={usul}
                  type="button"
                  onClick={() => setTolovUsuli(usul)}
                  className={`py-2 px-3 rounded-xl text-xs font-medium transition ${
                    tolovUsuli === usul
                      ? 'bg-pos text-white'
                      : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  {TOLOV_MALUMOTI[usul].label}
                </button>
              ))}
            </div>

            {tolovUsuli === 'NASIYA' && (
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">Nasiya muddati</p>
                <input type="date" value={nasiyaMuddat} onChange={e => setNasiyaMuddat(e.target.value)} className={inputCls} />
              </div>
            )}

            {tolovUsuli === 'ARALASH' && (
              <div className="space-y-2">
                {/* Har bir kanal uchun alohida input — kassir naqddan
                    qancha, kartadan qancha, Click'dan qancha olganini
                    qo'lda kiritadi. Oldin faqat "naqd qism" so'ralib,
                    qolgani bitta kanalga yozilardi va pul aslida qaysi
                    kanaldan kelgani chekda ko'rinmasdi. */}
                {KANAL_USULLARI.map(kanal => (
                  <div key={kanal} className="flex items-center gap-2">
                    <span className="text-gray-500 dark:text-gray-400 text-xs w-16 shrink-0">
                      {TOLOV_MALUMOTI[kanal].qisqa}
                    </span>
                    <div className="flex-1 min-w-0">
                      <MoneyInput
                        value={aralashSummalar[kanal]}
                        onChange={v => setAralashSummalar(oldingi => ({ ...oldingi, [kanal]: v }))}
                        max={yakuniySumma}
                        min={0}
                        placeholder="0"
                      />
                    </div>
                  </div>
                ))}

                {/* Qolgan/ortiqcha summa — kassir qayerda xato qilganini
                    darhol ko'rsin. Tugma ham shu holatga qarab bloklanadi. */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100 dark:border-neutral-800 text-xs">
                  <span className="text-gray-500 dark:text-gray-400">Kiritildi</span>
                  <span className="text-gray-900 dark:text-gray-100 font-medium tabular-nums">
                    {formatSum(aralashKiritilgan)}
                  </span>
                </div>
                {Math.abs(aralashQoldi) >= 1 && (
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className={aralashQoldi > 0 ? 'text-amber-600' : 'text-red-600'}>
                      {aralashQoldi > 0 ? 'Qoldi' : 'Ortiqcha'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        // Qolgan summani bitta bosishda naqdga yozish —
                        // eng ko'p uchraydigan holat uchun qisqa yo'l.
                        if (aralashQoldi <= 0) return
                        const joriy = parseFloat(aralashSummalar.NAQD || '0') || 0
                        setAralashSummalar(oldingi => ({ ...oldingi, NAQD: String(Math.round(joriy + aralashQoldi)) }))
                      }}
                      disabled={aralashQoldi <= 0}
                      className={`font-semibold tabular-nums ${aralashQoldi > 0 ? 'text-amber-600 hover:underline' : 'text-red-600 cursor-default'}`}
                      title={aralashQoldi > 0 ? "Qolganini naqdga yozish" : undefined}
                    >
                      {formatSum(Math.abs(aralashQoldi))}
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              {/* To'lovdan oldin — mahsulotlar ro'yxati "TO'LANMAGAN" belgisi bilan; sotuv yozilmaydi */}
              <button
                type="button"
                onClick={() => setHisobOyna(true)}
                title="To‘lanmagan chek — to‘lovdan oldin mahsulotlar ro‘yxati. Sotuv yozilmaydi"
                className="px-3 py-3 border border-amber-300 dark:border-amber-800/70 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-xl text-sm font-medium transition flex items-center justify-center gap-1.5 shrink-0"
              >
                <Printer size={16} aria-hidden /> Chek
              </button>
              <button
                onClick={sotuvYakunla}
                disabled={yuklanmoqda || !!aralashXato}
                title={aralashXato ?? undefined}
                className="flex-1 py-3 bg-pos-pay hover:bg-pos-pay-hover disabled:opacity-60 text-white font-bold rounded-xl transition text-sm shadow-md shadow-pos-pay/20 flex items-center justify-center gap-2"
              >
                <CheckCircle size={18} />
                {yuklanmoqda ? 'Amalga oshirilmoqda...' : tanlanganMijoz ? `To'lash · ${tanlanganMijoz.ism.split(' ')[0]}` : "To'lash"}
              </button>
            </div>
          </div>
        )}
    </>
  )

  return (
    // `lg:h-full` OLIB TASHLANDI: u ustun balandligini ekran bilan
    // cheklab qo'yardi va `sticky` qidiruv/kategoriya paneli desktopda
    // ushlanmasdan yuqoriga chiqib ketardi. Tabiiy balandlikda sahifaning
    // o'zi aylanadi — panel ham, suzuvchi "Kassa" tugmasi ham ishlaydi.
    <div className="flex flex-col lg:flex-row gap-4 lg:items-start">
      {/* Mobile tab switcher */}
      <div className="flex lg:hidden border-b border-gray-200 dark:border-neutral-800 mb-0">
        <button
          onClick={() => setMobileTab('tovarlar')}
          className={`flex-1 py-2.5 text-sm font-medium ${mobileTab === 'tovarlar' ? 'text-pos border-b-2 border-pos' : 'text-gray-500 dark:text-gray-400'}`}
        >
          Tovarlar
        </button>
        <button
          onClick={() => setMobileTab('savat')}
          className={`flex-1 py-2.5 text-sm font-medium relative ${mobileTab === 'savat' ? 'text-pos border-b-2 border-pos' : 'text-gray-500 dark:text-gray-400'}`}
        >
          Savat {savat.length > 0 && <span className="ml-1 bg-pos text-white text-xs rounded-full px-1.5">{savat.length}</span>}
        </button>
      </div>

      {/* Chap: Tovarlar */}
      <div className={`flex-1 flex flex-col gap-4 min-w-0 lg:flex ${mobileTab === 'tovarlar' ? 'flex' : 'hidden'}`}>
        {/* ── ASBOBLAR PANELI: ekran tepasida yopishib turadi ──
            Mahsulot ro'yxati uzun. Pastga tushilganda kassirda qidiruv,
            ombor, bo'lim VA narx turi qo'l ostida qolishi shart — narx
            turi savatga qo'shilayotgan tovar qaysi narxda hisoblanishini
            belgilaydi, uni ko'rmasdan bosish noto'g'ri chek demakdir.
            Shu sababli to'rttalasi ham bitta yopishgan qatlamda.

            O'lchamlar nega aynan shunday:
            • `-top-4 lg:-top-6` — `<main>` ning ichki bo'shlig'i (p-4 / lg:p-6).
              `top-0` da panel o'sha bo'shliqning OSTIGA yopishardi va tepada
              16–24px lik tirqish qolardi: mahsulotlar aynan o'sha tirqishdan
              sirg'alib o'tib ko'rinardi. Manfiy `top` panelni scroll
              maydonining eng chetiga bosadi — tirqish yo'qoladi.
            • Chap chet manfiy margin bilan ekran chetigacha cho'ziladi,
              O'NG chet esa `lg` da cho'zilmaydi (`lg:mr-0`): ilgari
              `lg:-mx-6` panelni 24px o'ngga chiqarib, 16px lik ustunlar
              orasidan o'tib savat panelining chap chetiga 8px bosib
              turardi. `lg` da o'ng tomonda hech narsa panel ostiga
              kirmaydi — savat alohida ustun, uni yopish shart emas.
            • `-mt-4 lg:-mt-6` — manfiy `top` uchun qo'shilgan `pt` oddiy
              holatda ikki karra bo'shliq bermasin.
            • Fon shaffofmas va sahifa foni bilan bir xil — ost tomondan
              hech narsa sizib chiqmaydi. */}
        <div
          ref={asboblarRef}
          className={`sticky -top-4 lg:-top-6 z-20 -mx-4 px-4 lg:-ml-6 lg:pl-6 lg:mr-0 lg:pr-0 -mt-4 lg:-mt-6 pt-4 lg:pt-6 pb-3 bg-gray-50 dark:bg-neutral-950 flex flex-col gap-2.5 border-b transition-[box-shadow,border-color] duration-200 ${
            asboblarYopishgan
              // Yopishgan holatda soya + ingichka chiziq. Kartalarning panel
              // ostiga kirib ketishi shundagina "qatlam" bo'lib o'qiladi;
              // busiz ular shunchaki qirqilib qolgandek ko'rinardi.
              // Chegara har doim turadi (faqat rangi almashadi) — aks holda
              // 1px balandlik o'zgarib, panel sakrab ketardi.
              ? 'border-gray-200 dark:border-neutral-800 shadow-[0_10px_22px_-16px_rgba(0,0,0,0.55)]'
              : 'border-transparent'
          }`}
        >
          {/* Qidiruv qatori. `flex-wrap`: joy tor bo'lsa (masalan 1024px
              ekranda savat ustuni 384px olib qo'yganda) narx turi o'z-o'zidan
              pastki qatorga tushadi — qidiruv maydoni hech qachon siqilib
              ketmaydi. Joy yetsa esa bir qatorda turib, yopishgan paneldan
              butun bir qator balandlikni tejaydi. */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={skanerOchiq ? skanerniYopish : skanerniOchish}
              className={`shrink-0 p-2.5 rounded-xl border transition ${skanerOchiq ? 'bg-pos border-pos text-white' : 'bg-white dark:bg-neutral-900 border-gray-300 dark:border-neutral-700 text-gray-500 dark:text-gray-400 hover:border-pos/50 hover:text-pos'}`}
              title="Skaner"
            >
              <ScanLine size={18} />
            </button>
            <div className="relative flex-1 min-w-[11rem]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400" size={16} />
              {/* `suppressHydrationWarning`: parol menejeri / forma to'ldiruvchi
                  kengaytmalar React'dan oldin `fdprocessedid` atributini qo'shadi.
                  Bayroq faqat shu elementga ta'sir qiladi. */}
              <input
                suppressHydrationWarning
                ref={qidiruvInputRef}
                value={qidiruv}
                onChange={e => setQidiruv(e.target.value)}
                onKeyDown={e => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  qidiruvdaEnter()
                }}
                placeholder="Tovar qidirish yoki shtrix-kod..."
                className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-pos"
              />
            </div>
            {/* Narx turi — savatga YANGI qo'shiladigan mahsulot shu narx
                bilan hisoblanadi. Endi yopishgan panel ichida: pastga
                tushib mahsulot bosilganda ham qaysi narx amal qilayotgani
                ko'rinib turadi va bir bosishda almashtiriladi. */}
            <div
              role="group"
              aria-label="Narx turi"
              className="shrink-0 flex items-center gap-1 bg-gray-100 dark:bg-neutral-800 rounded-xl p-1"
            >
              {(['sotish', 'optom', 'bolish'] as NarxTuri[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => narxTuriniTanlash(t)}
                  aria-pressed={narxTuri === t}
                  title={`Kartalar va savat ${NARX_TURI_LABEL[t].toLowerCase()} narxida`}
                  className={`px-3.5 py-2 rounded-lg text-xs whitespace-nowrap transition ${narxTuri === t ? 'bg-white dark:bg-neutral-700 shadow-sm text-pos font-semibold' : 'font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                >
                  {NARX_TURI_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          {/* ── OMBORLAR (katta kategoriya) ──
              Kategoriyalardan yuqorida turadi. Ombor tanlansa quyidagi
              kategoriya chiplari ham, mahsulotlar ham shu ombor ichidagilar
              bilan cheklanadi. */}
          {omborlar.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Ombor
              </span>
              <ChipRow label="Omborlar">
                <button
                  onClick={() => { setAktifOmbor(null); setAktifKategoriya(null) }}
                  aria-pressed={aktifOmbor === null}
                  className={`shrink-0 px-3.5 py-2 rounded-full text-sm font-medium transition whitespace-nowrap ${
                    aktifOmbor === null
                      ? 'bg-gray-800 dark:bg-neutral-200 text-white dark:text-neutral-900'
                      : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  Hammasi
                </button>
                {omborlar.map(o => (
                  <button
                    key={o.id}
                    onClick={() => {
                      // Ombor almashganda eski kategoriya tanlovi mos
                      // kelmasligi mumkin — shuning uchun tozalanadi.
                      setAktifOmbor(o.id)
                      setAktifKategoriya(null)
                    }}
                    aria-pressed={aktifOmbor === o.id}
                    className={`shrink-0 px-3.5 py-2 rounded-full text-sm font-medium transition whitespace-nowrap ${
                      aktifOmbor === o.id
                        ? 'bg-gray-800 dark:bg-neutral-200 text-white dark:text-neutral-900'
                        : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700'
                    }`}
                  >
                    {o.nomi}
                  </button>
                ))}
              </ChipRow>
            </div>
          )}

          {kategoriyalar.length > 0 && (
            <div className="flex items-center gap-2 min-w-0">
              {/* Kategoriya ko'p bo'lsa yonma-yon sig'maydi — bu tugma
                  hammasini varaqda ochadi va qidirib topish imkonini beradi. */}
              {kategoriyalar.length > 4 && (
                <button
                  onClick={() => { setKategoriyaQidiruv(''); setKategoriyaVaraq(true) }}
                  title="Barcha bo'limlar"
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700 transition"
                >
                  <LayoutGrid size={14} />
                  <span className="hidden sm:inline">Bo&apos;limlar</span>
                </button>
              )}
              <ChipRow label="Bo'limlar">
                <button
                  onClick={() => setAktifKategoriya(null)}
                  aria-pressed={aktifKategoriya === null}
                  className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition whitespace-nowrap ${
                    aktifKategoriya === null
                      ? 'bg-pos text-white'
                      : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  Barchasi
                </button>
                {korinadiganKategoriyalar.map(k => (
                  <button
                    key={k.id}
                    onClick={() => setAktifKategoriya(k.id)}
                    aria-pressed={aktifKategoriya === k.id}
                    className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition whitespace-nowrap ${
                      aktifKategoriya === k.id
                        ? 'bg-pos text-white'
                        : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700'
                    }`}
                  >
                    {k.nomi}
                  </button>
                ))}
              </ChipRow>
            </div>
          )}
        </div>
        {skanerOchiq && (
          <div className="bg-black rounded-xl overflow-hidden relative">
            <div id="skaner-reader" style={{ width: '100%' }} />
          </div>
        )}
        {bonusTanlashRejimi && (
          <div className="flex items-center justify-between gap-2 bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 rounded-xl px-4 py-2.5">
            <span className="flex items-center gap-2 text-sm text-violet-700 dark:text-violet-400 font-medium">
              <Gift size={16} /> Bonus uchun mahsulot tanlang
            </span>
            <button type="button" onClick={() => setBonusTanlashRejimi(false)} className="text-violet-400 hover:text-violet-600 transition">
              <X size={16} />
            </button>
          </div>
        )}
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl">
          {tovarlarYuklanmoqda ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="p-3 bg-gray-50 dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 animate-pulse">
                  <div className="h-3.5 bg-gray-200 dark:bg-neutral-700 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-200 dark:bg-neutral-700 rounded w-1/2 mb-1.5" />
                  <div className="h-2.5 bg-gray-200 dark:bg-neutral-700 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : tovarlarXato ? (
            <div className="p-8 text-center">
              <AlertTriangle size={36} className="mx-auto mb-3 text-red-500 opacity-70" />
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Tovarlarni yuklab bo&apos;lmadi</p>
              <p className="text-xs mt-1 text-gray-500 dark:text-gray-400 mb-3">{tovarlarXato}</p>
              <button
                onClick={tovarlarniYuklash}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-pos hover:bg-pos-hover text-white rounded-xl text-sm font-medium transition"
              >
                <RotateCcw size={14} />
                Qayta urinish
              </button>
            </div>
          ) : tovarlar.length === 0 ? (
            <div className="p-8 text-center">
              <ShoppingCart size={36} className="mx-auto mb-3 text-gray-300 dark:text-gray-700" />
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Tovarlar yo&apos;q</p>
              <p className="text-xs mt-1 text-gray-500 dark:text-gray-400 mb-3">Avval Tovarlar bo&apos;limidan mahsulot qo&apos;shing</p>
              <a
                href="/tovarlar"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-pos hover:bg-pos-hover text-white rounded-xl text-sm font-medium transition"
              >
                Tovarlar bo&apos;limiga o&apos;tish
              </a>
            </div>
          ) : korsatiladiganTovarlar.length === 0 ? (
            <div className="p-8 text-center">
              <Search size={36} className="mx-auto mb-3 text-gray-300 dark:text-gray-700" />
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Hech narsa topilmadi</p>
              <p className="text-xs mt-1 text-gray-500 dark:text-gray-400">&laquo;{qidiruv}&raquo; bo&apos;yicha tovar yo&apos;q</p>
            </div>
          ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4 p-4">
            {/* Ustunlar soni EKRAN eniga emas, MAVJUD joyga qarab tanlanadi.
                Ilgari `lg:grid-cols-3` edi va savat paneli joyning uchdan
                birini olgani uchun kartalar 137px gacha siqilardi: kategoriya
                nomi "Z..." ga aylanib, uzun narxlar qirqilardi. `auto-fill`
                bilan ustun faqat sig'sa qo'shiladi, karta esa hech qachon
                180px dan tor bo'lmaydi — bu nishonlar qatori va narxning
                o'qilishi uchun kerak bo'lgan eng kichik en. */}
            {korsatiladiganTovarlar.map(t => {
              // Oddiy va bonus qatorlari birga qo'shiladi — bitta mahsulotdan
              // ikkalasi ham bo'lishi mumkin (masalan 5ta sotuv + 1ta bonus).
              const savatdagi = miqdorYaxlitla(savat.filter(s => s.tovarId === t.id).reduce((sum, s) => sum + asosiyda(s), 0))
              const tugagan = t.qoldiq <= 0
              const kamQoldi = !tugagan && t.qoldiq <= 5
              return (
                <button
                  key={t.id}
                  onClick={() => savatQosh(t)}
                  disabled={tugagan}
                  className="group relative text-left bg-white dark:bg-neutral-800 rounded-2xl border border-gray-200 dark:border-neutral-700 overflow-hidden transition-all hover:border-pos hover:shadow-lg active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:border-gray-200 dark:disabled:hover:border-neutral-700 disabled:hover:shadow-none disabled:active:scale-100"
                >
                  <div className="aspect-[16/10] bg-gradient-to-br from-pos-light to-white dark:from-pos/15 dark:to-neutral-800 flex items-center justify-center relative overflow-hidden">
                    {t.rasmlar?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.rasmlar[0]} alt={t.nomi} className="w-full h-full object-cover" />
                    ) : (
                      <Package size={48} className="text-pos/60 group-hover:text-pos group-hover:scale-110 transition-all" />
                    )}

                    {/* ── NISHONLAR BITTA QATORDA ──
                        Ilgari uchtasi ham mustaqil `absolute` edi va kategoriya
                        `left-9` degan sehrli siljish bilan qo'yilardi. Tor
                        kartada (3 ustunli tarhda ~137px) kategoriya qoldiq
                        nishoni ustiga chiqib ketardi — o'lchov bilan tasdiqlangan.
                        Endi ular bitta flex qatorda: kategoriya qisqaradi
                        (`min-w-0 truncate`), qoldiq esa qisqarmaydi
                        (`shrink-0`), ya'ni to'qnashuv TUZILISH JIHATIDAN
                        imkonsiz — kartaning eni qanday bo'lishidan qat'i nazar. */}
                    <div className="absolute inset-x-2 top-2 z-10 flex items-start justify-between gap-2 pointer-events-none">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {savatdagi > 0 && (
                          <span className="shrink-0 bg-pos text-white text-xs font-bold rounded-full min-w-6 h-6 px-1.5 flex items-center justify-center shadow">
                            {savatdagi}
                          </span>
                        )}
                        {t.kategoriya && (
                          // Kategoriya — MA'LUMOT, savat soni esa HOLAT.
                          // Ilgari ikkalasi ham bir xil qizil edi va bir-biridan
                          // farqlanmasdi; endi kategoriya betaraf shisha chip.
                          <span
                            title={t.kategoriya.nomi}
                            className="min-w-0 truncate text-[11px] bg-white/85 dark:bg-neutral-900/80 text-gray-700 dark:text-gray-200 px-2 py-1 rounded-full font-medium shadow-sm backdrop-blur-sm"
                          >
                            {t.kategoriya.nomi}
                          </span>
                        )}
                      </div>
                      <span className={`shrink-0 text-xs px-2 py-1 rounded-lg font-semibold shadow-sm whitespace-nowrap ${
                        tugagan ? 'bg-red-500 text-white' : kamQoldi ? 'bg-amber-500 text-white' : 'bg-white/90 dark:bg-neutral-900/80 text-gray-600 dark:text-gray-300'
                      }`}>
                        {tugagan ? 'Tugagan' : `${t.qoldiq} ${t.birlik.toLowerCase()}`}
                      </span>
                    </div>
                  </div>

                  <div className="p-3">
                    {/* Ajratilgan joy AYNAN ikki qator: `leading-snug` = 1.375, ya'ni
                        2.75em. Ilgari 2.6em edi — bir qatorli va ikki qatorli
                        nomli kartalar 3px farq qilib, tarh qatorlari tekis
                        chiqmasdi. */}
                    <p className="text-gray-900 dark:text-gray-100 text-base font-semibold leading-snug line-clamp-2 min-h-[2.75em]">{t.nomi}</p>
                    <p className="text-gray-400 dark:text-gray-500 text-[11px] mt-0.5 tabular-nums">
                      #{(t.shtrixKod || '').padStart(3, '0') || '—'}
                    </p>

                    {/* Qoldiq rasm ustidagi nishonda ko'rinadi — panelda
                        takrorlanmaydi: bir xil raqam ikki joyda turishi
                        kartani uzaytirar va foyda bermasdi. */}
                    <TovarNarxPaneli
                      qoldiq={t.qoldiq}
                      birlik={t.birlik}
                      kamQoldi={kamQoldi}
                      kelishNarxi={t.kelishNarxi}
                      sotishNarxi={t.sotishNarxi}
                      // `?? null` — API maydonni umuman qaytarmasa ham qator
                      // o'rnida qolsin ("—"), aks holda kartalar bo'yi
                      // har xil bo'lib tarh qatorlari notekis chiqardi.
                      optomNarxi={t.optomNarxi ?? null}
                      bolishNarxi={t.bolishNarxi ?? null}
                      valyuta={t.valyuta}
                      sotishRangi="text-pos"
                      olcham="keng"
                      miqdorKorsatilsinmi={false}
                      // Karta bosilganda AYNAN qaysi narx bilan tushishi
                      // ajralib turadi: tanlangan tur narxi kiritilmagan
                      // mahsulotda — chakana.
                      aktivNarx={amaldagiNarxTuri(t, narxTuri)}
                      sotishYorligi={NARX_TURI_LABEL.sotish}
                    />
                  </div>
                </button>
              )
            })}
          </div>
          )}
        </div>
      </div>

      {/* O'ng: Savat. Kassa oynasi ochiq bo'lsa panel o'sha yerga ko'chadi —
          shuning uchun bu yerda ko’rsatilmaydi (ikki nusxa bo’lib qolmasin). */}
      <div
        ref={savatUstuniRef}
        className={`lg:w-96 flex flex-col gap-3 lg:flex ${mobileTab === 'savat' ? 'flex' : 'hidden'}`}
      >
        {!kassaOchiq && savatPaneli}
      </div>

      {/* ── Bo'limlar varag'i ──
          Kategoriya ko'p bo'lganda gorizontal tasma bilan qidirish qiyin.
          Bu varaq hammasini bir ekranda ko'rsatadi va qidirish maydoni
          bilan tez tanlash imkonini beradi. */}
      {kategoriyaVaraq && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={() => setKategoriyaVaraq(false)}
        >
          <div
            className="bg-white dark:bg-neutral-900 rounded-t-2xl sm:rounded-2xl shadow-xl dark:border dark:border-neutral-800 w-full max-w-md max-h-[80dvh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between gap-3 shrink-0">
              <h3 className="text-gray-900 dark:text-gray-100 font-semibold flex items-center gap-2">
                <LayoutGrid size={17} className="text-pos" /> Bo&apos;limlar
              </h3>
              <button
                onClick={() => setKategoriyaVaraq(false)}
                className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition"
              >
                <X size={18} />
              </button>
            </div>

            {kategoriyalar.length > 8 && (
              <div className="px-4 pt-3 shrink-0">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={kategoriyaQidiruv}
                    onChange={e => setKategoriyaQidiruv(e.target.value)}
                    placeholder="Bo'lim qidirish..."
                    autoFocus
                    className="w-full pl-9 pr-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-pos"
                  />
                </div>
              </div>
            )}

            <div className="overflow-y-auto flex-1 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3">
              <button
                onClick={() => { setAktifKategoriya(null); setKategoriyaVaraq(false) }}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                  aktifKategoriya === null
                    ? 'bg-pos text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800'
                }`}
              >
                <span>Barchasi</span>
                <span className="text-[11px] tabular-nums opacity-70">{tovarlar.length}</span>
              </button>

              {korinadiganKategoriyalar
                .filter(k => !kategoriyaQidiruv.trim() || uzSearch(k.nomi, kategoriyaQidiruv))
                .map(k => {
                  const soni = tovarlar.filter(t => t.kategoriya?.id === k.id).length
                  return (
                    <button
                      key={k.id}
                      onClick={() => { setAktifKategoriya(k.id); setKategoriyaVaraq(false) }}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition mt-1 ${
                        aktifKategoriya === k.id
                          ? 'bg-pos text-white'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800'
                      }`}
                    >
                      <span className="truncate text-left">{k.nomi}</span>
                      {/* Nechta mahsulot borligi — bo'sh bo'limga kirib ovora bo'lmaslik uchun */}
                      <span className={`text-[11px] tabular-nums shrink-0 ${
                        aktifKategoriya === k.id ? 'opacity-70' : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {soni}
                      </span>
                    </button>
                  )
                })}

              {korinadiganKategoriyalar.length > 0 &&
                korinadiganKategoriyalar.filter(k => !kategoriyaQidiruv.trim() || uzSearch(k.nomi, kategoriyaQidiruv)).length === 0 && (
                <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">Topilmadi</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Suzuvchi "Kassa" tugmasi ──
          Mahsulot qidirib pastga tushilganda savat ustuni ekrandan
          chiqib ketadi. Shunda o'ng pastda dumaloq tugma paydo bo'ladi:
          bosilsa kassa o'sha yerning o'zida ochiladi va boshqa joyga
          qaytmasdan savdo yakunlanadi. */}
      {savatKorinmayapti && !kassaOchiq && (
        <button
          onClick={() => setKassaOchiq(true)}
          className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 lg:bottom-8 lg:right-8 z-30 flex items-center gap-2.5 rounded-full bg-pos-pay hover:bg-pos-pay-hover text-white shadow-lg shadow-pos-pay/30 transition active:scale-95 pl-4 pr-5 py-3.5"
          title="Kassani ochish"
        >
          <div className="relative">
            <ShoppingCart size={20} />
            {savat.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-white text-pos-pay text-[11px] font-bold rounded-full min-w-[17px] h-[17px] px-1 flex items-center justify-center">
                {savat.length}
              </span>
            )}
          </div>
          <div className="text-left leading-tight">
            <span className="block text-[11px] font-medium opacity-90">Kassa</span>
            <span className="block text-sm font-bold tabular-nums whitespace-nowrap">
              {savat.length > 0 ? formatSum(yakuniySumma) : 'Ochish'}
            </span>
          </div>
        </button>
      )}

      {/* ── Kassa oynasi ──
          Savat paneli AYNAN o'sha komponent — bu yerda faqat o'rami
          boshqacha (pastdan chiquvchi varaq / markazdagi oyna). */}
      {kassaOchiq && (
        <div
          /* z-[45]: mobil navbar (z-40) USTIDA, lekin boshqa modallar
             (z-50 — mijoz, chek, qaytarish) OSTIDA. Kassadan ochilgan
             oyna kassaning orqasida qolib ketmasin. */
          className="fixed inset-0 z-[45] flex items-end sm:items-center justify-center bg-black/50 sm:p-4"
          onClick={() => setKassaOchiq(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            /* dvh — mobil brauzerda manzil paneli ochilib-yopilganda
               balandlik sakramasin (vh buni hisobga olmaydi).
               flex-col: sarlavha qotib turadi, faqat tana aylanadi. */
            className="w-full sm:max-w-md flex flex-col max-h-[88dvh] sm:max-h-[88dvh] bg-gray-50 dark:bg-neutral-950 sm:bg-transparent sm:dark:bg-transparent rounded-t-2xl sm:rounded-none shadow-2xl sm:shadow-none"
          >
            {/* Mobil sarlavha + tortish belgisi */}
            <div className="sm:hidden shrink-0 border-b border-gray-200 dark:border-neutral-800">
              <div className="flex justify-center pt-2 pb-1.5">
                <span className="w-9 h-1 rounded-full bg-gray-300 dark:bg-neutral-700" />
              </div>
              <div className="flex items-center justify-between px-4 pb-2">
                <span className="text-gray-700 dark:text-gray-300 text-sm font-semibold">Kassa</span>
                <button
                  onClick={() => setKassaOchiq(false)}
                  className="p-1.5 -mr-1.5 text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-800 rounded-lg transition"
                  aria-label="Yopish"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Aylanadigan tana. Pastki bo'shliq — iPhone'dagi uy
                chizig'i uchun: "To'lash" tugmasi uning ostida qolmasin. */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-0 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-0">
              <div className="flex flex-col gap-3 relative">
                <button
                  onClick={() => setKassaOchiq(false)}
                  className="hidden sm:flex absolute -top-2 -right-2 z-10 w-8 h-8 items-center justify-center rounded-full bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 shadow transition"
                  title="Yopish"
                >
                  <X size={16} />
                </button>
                {savatPaneli}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mijoz ma'lumotlari modal — har bir sotuvda so'raladi */}
      {mijozModal && (
        <Modal
          olcham="sm"
          sarlavha="Mijoz ma'lumotlari"
          tavsif="Telefon yoki ism yozing — mavjud mijoz ro'yxatdan chiqadi"
          onYopish={() => setMijozModal(false)}
          onSubmit={mijozTasdiqlaVaYubor}
          yopishMumkin={!mijozAniqlanmoqda}
          footer={<>
            <ModalBekor onClick={() => setMijozModal(false)} disabled={mijozAniqlanmoqda} />
            <ModalAsosiy rang="tolov" yuklanmoqda={mijozAniqlanmoqda} belgi={<CheckCircle size={16} />}>
              {mijozAniqlanmoqda ? 'Sotilmoqda...' : 'Sotish'}
            </ModalAsosiy>
          </>}
        >
          <div className="space-y-4">
              <div className="relative">
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Telefon raqam *</label>
                <PhoneInput
                  value={mijozTelefon}
                  onChange={v => { setMijozTelefon(v); setMijozLokatsiya(null); setTelefonTaklifOchiq(true) }}
                  onFocus={() => setTelefonTaklifOchiq(true)}
                  onBlur={() => setTimeout(() => setTelefonTaklifOchiq(false), 150)}
                  required
                />
                {telefonTaklifOchiq && telefonTaklifi.length > 0 && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl shadow-lg overflow-hidden">
                    {telefonTaklifi.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onMouseDown={() => mijozTanlash(m)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-neutral-700 transition flex items-center justify-between gap-2"
                      >
                        <span className="text-gray-900 dark:text-gray-100 text-sm font-medium truncate">{m.ism}</span>
                        <span className="text-gray-400 dark:text-gray-500 text-xs shrink-0">{m.telefon}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Ism *</label>
                <input
                  value={mijozIsmi}
                  onChange={e => { setMijozIsmi(e.target.value); setMijozLokatsiya(null); setIsmTaklifOchiq(true) }}
                  onFocus={() => setIsmTaklifOchiq(true)}
                  onBlur={() => setTimeout(() => setIsmTaklifOchiq(false), 150)}
                  required
                  autoFocus={false}
                  className={inputCls}
                />
                {ismTaklifOchiq && ismTaklifi.length > 0 && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl shadow-lg overflow-hidden">
                    {ismTaklifi.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onMouseDown={() => mijozTanlash(m)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-neutral-700 transition flex items-center justify-between gap-2"
                      >
                        <span className="text-gray-900 dark:text-gray-100 text-sm font-medium truncate">{m.ism}</span>
                        <span className="text-gray-400 dark:text-gray-500 text-xs shrink-0">{m.telefon}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Manzil</label>
                <input value={mijozManzil} onChange={e => setMijozManzil(e.target.value)} placeholder="Ixtiyoriy" className={inputCls} />
              </div>
              {mijozLokatsiya && (
                <a
                  href={`https://www.google.com/maps?q=${mijozLokatsiya.lat},${mijozLokatsiya.lng}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 bg-primary-light dark:bg-primary/10 text-primary rounded-xl text-sm font-medium hover:underline w-fit"
                >
                  <MapPin size={14} /> Mijozning GPS joylashuvi — xaritada ko&apos;rish
                </a>
              )}
          </div>
        </Modal>
      )}

      {/* To'lanmagan chek — to'lovdan oldin, savatdan; hech qayerga yozilmaydi */}
      {hisobOyna && savat.length > 0 && (() => {
        const s = hisobCheki()
        return (
          <Modal
            olcham="sm"
            belgi={<Printer size={18} className="text-amber-600" />}
            sarlavha={<>{t('To‘lanmagan chek')}</>}
            tavsif={t('To‘lovdan oldin — mahsulotlar ro‘yxati. Sotuv yozilmaydi')}
            onYopish={() => setHisobOyna(false)}
            footer={<div className="w-full space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => printChek(buildChekHtml({ data: s, dokonInfo, til, fontSize: 11 }))}
                  className="py-2.5 border border-gray-200 dark:border-neutral-700 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-neutral-800 transition flex items-center justify-center gap-1.5 text-gray-700 dark:text-gray-300"
                >
                  <Printer size={15} className="shrink-0" />
                  <span className="truncate">{t('Chek')} (80 mm)</span>
                </button>
                <button
                  type="button"
                  onClick={() => void hisobA4(s)}
                  disabled={a4Band}
                  className="py-2.5 border border-gray-200 dark:border-neutral-700 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-neutral-800 transition flex items-center justify-center gap-1.5 text-gray-700 dark:text-gray-300 disabled:opacity-60"
                >
                  {a4Band ? <Loader2 size={15} className="shrink-0 animate-spin" /> : <FileImage size={15} className="shrink-0" />}
                  <span className="truncate">A4</span>
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => chekPdfYuklash(s)}
                  className="flex-1 py-2 border border-gray-200 dark:border-neutral-700 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-neutral-800 transition flex items-center justify-center gap-1.5 text-gray-600 dark:text-gray-400"
                >
                  <Download size={14} /> PDF
                </button>
                <button
                  type="button"
                  onClick={() => setTil(til === 'lotin' ? 'kirill' : 'lotin')}
                  className="flex-1 py-2 border border-gray-200 dark:border-neutral-700 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-neutral-800 transition flex items-center justify-center gap-1.5 text-gray-600 dark:text-gray-400"
                >
                  <Languages size={14} /> {til === 'lotin' ? 'Кирилл' : 'Lotin'}
                </button>
              </div>
            </div>}
          >
            <div className="-mx-4 sm:-mx-5 -my-4">
              <ChekKorinishi s={s} dokonInfo={dokonInfo} til={til} />
            </div>
          </Modal>
        )
      })()}

      {/* Chek modal */}
      {chekModal && oxirgiSotuv && (() => {
        const s = oxirgiSotuv
        return (
          // Telefonda pastdan varaq; chek matni o'rtada scroll bo'ladi, sarlavha va
          // tugmalar qotib turadi — uzun chekda "Yopish" ekrandan chiqib ketmaydi.
          <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4 animate-qoplama">
            <div role="dialog" aria-modal="true" aria-label="Sotuv amalga oshdi" className="bg-white dark:bg-neutral-900 rounded-t-2xl sm:rounded-2xl shadow-xl dark:border dark:border-neutral-800 w-full sm:max-w-sm overflow-hidden flex flex-col max-h-[calc(100dvh-0.75rem)] sm:max-h-[92dvh] animate-varaq sm:animate-oyna">
              <div className="shrink-0 bg-pos-pay px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-7 h-7 text-white shrink-0" />
                  <div>
                    <p className="text-white font-bold">{t('Sotuv amalga oshdi')}!</p>
                    <p className="text-white/75 text-xs font-mono">{s.chekRaqami}</p>
                  </div>
                </div>
                <button
                  onClick={() => setTil(til === 'lotin' ? 'kirill' : 'lotin')}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-medium transition"
                >
                  <Languages size={14} />
                  {til === 'lotin' ? 'Кирилл' : 'Lotin'}
                </button>
              </div>

              <ChekKorinishi s={s} dokonInfo={dokonInfo} til={til} />

              <div className="shrink-0 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4 space-y-2 border-t border-gray-100 dark:border-neutral-800">
                {/* Chek linki */}
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-neutral-800 rounded-xl">
                  <Link2 size={14} className="text-gray-400 shrink-0" />
                  <input
                    readOnly
                    value={`${window.location.origin}/chek/${encodeURIComponent(s.chekRaqami)}`}
                    className="flex-1 bg-transparent text-xs text-gray-600 dark:text-gray-400 font-mono outline-none select-all"
                    onClick={e => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/chek/${encodeURIComponent(s.chekRaqami)}`
                      navigator.clipboard.writeText(url).then(() => toast.success('Link nusxalandi!'))
                    }}
                    className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg transition font-medium"
                  >
                    Nusxalash
                  </button>
                  {typeof navigator !== 'undefined' && navigator.share && (
                    <button
                      onClick={() => {
                        navigator.share({
                          title: `Chek ${s.chekRaqami}`,
                          url: `${window.location.origin}/chek/${encodeURIComponent(s.chekRaqami)}`,
                        }).catch(() => {})
                      }}
                      className="p-1 text-gray-400 hover:text-blue-600 transition"
                    >
                      <Share2 size={14} />
                    </button>
                  )}
                </div>

                {/* Telegramga yuborish — mijoz bog'langan bo'lsagina.
                    Xabar avtomatik ketmaydi: kassir kerak deb hisoblasa
                    shu tugma bilan o'zi jo'natadi. */}
                {s.mijoz && (
                  <button
                    onClick={chekniTelegramgaYubor}
                    disabled={chekYuborish !== 'tayyor'}
                    className={`w-full py-2.5 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 mb-2 ${
                      chekYuborish === 'yuborildi'
                        ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900/50'
                        : 'bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white'
                    }`}
                  >
                    {chekYuborish === 'ketmoqda' ? (
                      <><Loader2 size={15} className="animate-spin" /> Yuborilmoqda...</>
                    ) : chekYuborish === 'yuborildi' ? (
                      <><CheckCircle size={15} /> {s.mijoz.ism} ga yuborildi</>
                    ) : (
                      <><Send size={15} /> {s.mijoz.ism} ga Telegramga yuborish</>
                    )}
                  </button>
                )}

                {/* Chek formati: 80 mm termal chek yoki A4 — mahsulot rasmlari bilan */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => chekChopEtish(s)}
                    className="py-2.5 border border-gray-200 dark:border-neutral-700 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-neutral-800 transition flex items-center justify-center gap-1.5 text-gray-700 dark:text-gray-300"
                  >
                    <Printer size={15} className="shrink-0" />
                    <span className="truncate">{t('Chek')} (80 mm)</span>
                  </button>
                  <button
                    onClick={() => void chekA4(s)}
                    disabled={a4Band}
                    className="py-2.5 border border-gray-200 dark:border-neutral-700 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-neutral-800 transition flex items-center justify-center gap-1.5 text-gray-700 dark:text-gray-300 disabled:opacity-60"
                  >
                    {a4Band ? <Loader2 size={15} className="shrink-0 animate-spin" /> : <FileImage size={15} className="shrink-0" />}
                    <span className="truncate">A4 ({t('rasmli')})</span>
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => chekPdfYuklash(s)}
                    className="flex-1 py-2 border border-gray-200 dark:border-neutral-700 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-neutral-800 transition flex items-center justify-center gap-1.5 text-gray-600 dark:text-gray-400"
                  >
                    <Download size={14} />
                    PDF
                  </button>
                  <button
                    onClick={() => setChekModal(false)}
                    className="flex-1 py-2 bg-pos-pay hover:bg-pos-pay-hover text-white rounded-xl text-sm transition font-medium"
                  >
                    {t('Yopish')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Skanerlangan mahsulot — nechta qo'shilishi so'raladi */}
      {skanOyna && (() => {
        const tv = skanOyna.tovar
        // Har bir birlik narxi: savatda shu birlikda qator bo'lsa — o'sha narxda
        // (qo'lda o'zgartirilgan bo'lishi mumkin) qo'shiladi
        const birliklar = bonusTanlashRejimi
          ? [{ nomi: '', miqdor: 1, narx: 0 }]
          : sotuvBirliklari(tv).map(b => {
            const q = savat.find(x => x.tovarId === tv.id && !x.bonus && (x.oram?.nomi ?? '') === b.nomi)
            return { nomi: b.nomi, miqdor: b.miqdor, narx: q ? q.birlikNarxi : narxTuriBoyicha(tv, narxTuri, kursi, b.nomi) }
          })
        const qator = savat.find(x => x.tovarId === tv.id && !x.bonus && (x.oram?.nomi ?? '') === skanOyna.birlik)
        return (
        <SkanMiqdorOynasi
          key={tv.id}
          tovar={tv}
          bonus={bonusTanlashRejimi}
          birliklar={birliklar}
          boshlangichBirlik={bonusTanlashRejimi ? '' : skanOyna.birlik}
          narxYorligi={NARX_TURI_LABEL[qator ? (qator.narxTuri ?? 'sotish') : amaldagiNarxTuri(tv, narxTuri, skanOyna.birlik)]}
          savatda={savatdagiAsosiy(tv.id)}
          boshlangich={skanOyna.boshlangich}
          onTasdiq={skanMiqdorniTasdiqla}
          onYop={skanOynaniYop}
          onSkan={oynadaSkan}
        />
        )
      })()}

      {/* Saqlangan savatlar modal */}
      {/* Zakazni saqlash — mijoz va izoh so'raladi */}
      {saqlashModal && (
        <Modal
          olcham="sm"
          belgi={<Archive size={18} className="text-emerald-600" />}
          sarlavha="Zakazni saqlab qo'yish"
          onYopish={() => setSaqlashModal(false)}
          tashqaridanYopish={false}
          yopishMumkin={!zakazSaqlanmoqda}
          footer={<>
            <ModalBekor onClick={() => setSaqlashModal(false)} disabled={zakazSaqlanmoqda} />
            <ModalAsosiy type="button" rang="yashil" onClick={zakazniSaqlash} yuklanmoqda={zakazSaqlanmoqda} belgi={<Archive size={16} />}>
              Saqlash
            </ModalAsosiy>
          </>}
        >
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm bg-gray-50 dark:bg-neutral-800/60 rounded-xl px-3 py-2">
                <span className="text-gray-500 dark:text-gray-400">{savat.length} ta mahsulot</span>
                <span className="text-gray-900 dark:text-gray-100 font-semibold">{formatSum(jamiSumma)}</span>
              </div>

              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">
                  Mijoz <span className="text-gray-400 font-normal">(ixtiyoriy)</span>
                </label>
                <Combobox
                  options={mijozlar.map(m => ({
                    value: m.id,
                    label: m.telefon ? `${m.ism} — ${formatPhone(m.telefon)}` : m.ism,
                  }))}
                  value={zakazMijozId}
                  onChange={setZakazMijozId}
                  placeholder="Mijozni tanlang"
                  searchPlaceholder="Ism yoki telefon..."
                />
              </div>

              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">
                  Izoh <span className="text-gray-400 font-normal">(kimga va nima uchun)</span>
                </label>
                <textarea
                  value={zakazIzoh}
                  onChange={e => setZakazIzoh(e.target.value)}
                  rows={3}
                  autoFocus
                  placeholder="masalan: Aziz akaga to'y uchun, juma kuni oladi"
                  className={`${inputCls} resize-none`}
                />
                <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                  Bu izoh saqlangan zakazlar ro&apos;yxatida ko&apos;rinib turadi.
                </p>
              </div>

            </div>
        </Modal>
      )}

      {saqlanganiModal && (
        <Modal
          belgi={<Archive size={18} className="text-violet-600" />}
          sarlavha="Saqlangan zakazlar"
          onYopish={() => setSaqlanganiModal(false)}
          tanaClassName="p-0!"
        >
            <div>
              {zakazlarYuklanmoqda ? (
                <div className="p-8 flex justify-center"><Loader2 size={20} className="animate-spin text-violet-600" /></div>
              ) : saqlanganiSavatlar.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">Saqlangan zakaz yo&apos;q</div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                  {saqlanganiSavatlar.map(zakaz => (
                    <div key={zakaz.id} className="p-3 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {/* Mijoz — kimga yig'ilgani birinchi o'rinda */}
                          {zakaz.mijoz ? (
                            <p className="text-gray-900 dark:text-gray-100 font-semibold text-sm truncate">
                              {zakaz.mijoz.ism}
                              {zakaz.mijoz.telefon && (
                                <span className="text-gray-500 dark:text-gray-400 font-normal ml-1.5 text-xs">
                                  {formatPhone(zakaz.mijoz.telefon)}
                                </span>
                              )}
                            </p>
                          ) : (
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Mijoz ko&apos;rsatilmagan</p>
                          )}
                          <p className="text-gray-500 dark:text-gray-400 text-[11px] mt-0.5">
                            {formatSanaVaVaqt(zakaz.yaratilgan)}
                            {zakaz.sotuvchi && ` · ${zakaz.sotuvchi.ism}`}
                          </p>
                          <p className="text-green-600 font-bold text-sm mt-0.5">{formatSum(zakaz.jamiSumma)}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => zakazniYuklash(zakaz)}
                            className="px-2.5 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs rounded-lg transition font-medium flex items-center gap-1"
                          >
                            <Play size={12} />
                            Davom ettirish
                          </button>
                          <button
                            onClick={() => zakazniOchirish(zakaz.id)}
                            className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-500 rounded-lg transition"
                            title="O&apos;chirish"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Izoh — nima uchun yig'ilgani. Ko'zga tashlanib tursin. */}
                      {zakaz.izoh && (
                        <p className="mt-2 text-xs text-amber-800 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-lg px-2.5 py-1.5">
                          {zakaz.izoh}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-1 mt-2">
                        {zakaz.tarkiblar.map(item => (
                          <span key={item.id} className="text-[11px] bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded">
                            {(() => {
                              // "2 blok" — o'ramda saqlangan bo'lsa
                              const q = chekQatori({ miqdor: item.miqdor, birlikNarxi: item.birlikNarxi, jami: item.jami ?? 0, oramNomi: item.oramNomi, oramMiqdori: item.oramMiqdori })
                              return `${item.tovar.nomi} ×${q.oram ? `${q.soni} ${q.oram}` : q.soni}`
                            })()}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
        </Modal>
      )}

      {/* Qaytarish modal */}
      {qaytarishModal && (
        <Modal
          olcham="lg"
          belgi={<RotateCcw size={18} className="text-amber-600" />}
          sarlavha="Qaytarish"
          tavsif={qaytarishSotuv ? 'Qaytariladigan mahsulot va miqdorni belgilang' : 'Qaysi chek bo‘yicha qaytariladi?'}
          onYopish={() => setQaytarishModal(false)}
          tashqaridanYopish={false}
          yopishMumkin={!qaytarishYuklanmoqda}
          footer={qaytarishSotuv ? <>
            <ModalBekor onClick={() => setQaytarishModal(false)} disabled={qaytarishYuklanmoqda} />
            <ModalAsosiy type="button" rang="ogohlantirish" onClick={qaytarishYuborish} yuklanmoqda={qaytarishYuklanmoqda} belgi={<RotateCcw size={16} />}>
              Qaytarish
            </ModalAsosiy>
          </> : undefined}
        >
            <div className="space-y-4">
              {/* Chek tanlash */}
              {!qaytarishSotuv && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-gray-700 dark:text-gray-300 text-sm font-medium">Chekni tanlang</label>
                    {sotuvlarYuklanmoqda && <Loader2 size={14} className="animate-spin text-gray-400" />}
                  </div>
                  <input
                    value={sotuvQidiruv}
                    onChange={e => setSotuvQidiruv(e.target.value)}
                    placeholder="Chek raqami yoki mijoz nomi..."
                    className={`${inputCls} mb-2`}
                  />
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {sotuvlarRoyxati
                      .filter(s =>
                        !sotuvQidiruv ||
                        s.chekRaqami.toLowerCase().includes(sotuvQidiruv.toLowerCase()) ||
                        (s.mijoz?.ism?.toLowerCase().includes(sotuvQidiruv.toLowerCase()))
                      )
                      .map(s => (
                        <button
                          key={s.id}
                          onClick={() => sotuvTanlash(s)}
                          className="w-full text-left px-3 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-gray-900 dark:text-gray-100 text-sm font-medium truncate">{s.chekRaqami}</span>
                            <span className="text-green-600 text-sm font-bold shrink-0">{formatSum(s.yakuniySumma)}</span>
                          </div>
                          <div className="flex items-center justify-between mt-1 gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-gray-500 dark:text-gray-400 text-xs truncate">{formatSanaVaVaqt(s.sana)}</span>
                              {s.mijoz && <span className="text-gray-500 dark:text-gray-400 text-xs truncate">• {s.mijoz.ism}</span>}
                            </div>
                            <span className={`text-[11px] px-2 py-0.5 rounded-md shrink-0 ${tolovBadge(s.tolovUsuli)}`}>
                              {tolovQisqa(s.tolovUsuli)}
                            </span>
                          </div>
                        </button>
                      ))
                    }
                    {!sotuvlarYuklanmoqda && sotuvlarRoyxati.length === 0 && (
                      <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">Sotuvlar topilmadi</p>
                    )}
                  </div>
                </div>
              )}

              {/* Tanlangan sotuv */}
              {qaytarishSotuv && (
                <>
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl p-3 text-sm">
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-gray-900 dark:text-gray-100 truncate">{qaytarishSotuv.chekRaqami}</span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-md shrink-0 ${tolovBadge(qaytarishSotuv.tolovUsuli)}`}>
                          {tolovQisqa(qaytarishSotuv.tolovUsuli)}
                        </span>
                      </div>
                      <button
                        onClick={() => setQaytarishSotuv(null)}
                        className="text-xs text-amber-600 hover:text-amber-800 dark:text-amber-400 hover:underline shrink-0"
                      >
                        ← Orqaga
                      </button>
                    </div>
                    <div className="flex justify-between text-gray-500 dark:text-gray-400">
                      <span>Sana:</span><span>{formatSanaVaVaqt(qaytarishSotuv.sana)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500 dark:text-gray-400">
                      <span>Jami:</span><span className="text-green-600 font-bold">{formatSum(qaytarishSotuv.yakuniySumma)}</span>
                    </div>
                    {qaytarishSotuv.tolovUsuli === 'NASIYA' && qaytarishSotuv.mijoz && (
                      <div className="mt-1.5 pt-1.5 border-t border-amber-200 dark:border-amber-800/40 text-red-700 dark:text-red-400 text-xs font-medium">
                        Nasiyaga olingan — mijoz: {qaytarishSotuv.mijoz.ism}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-gray-700 dark:text-gray-300 text-sm font-medium">Qaytariladigan mahsulotlar:</p>
                    {qaytarishQatorlari(qaytarishSotuv.tarkiblar).map(t => {
                      const sel = qaytarishTanlandan(t.tovarId)
                      return (
                        <div key={t.tovarId} className="border border-gray-200 dark:border-neutral-700 rounded-xl p-3">
                          <div className="flex items-center gap-3 mb-2">
                            <input
                              type="checkbox"
                              checked={sel.checked}
                              onChange={e => setQaytarishTanlangan(prev => ({
                                ...prev,
                                [t.tovarId]: { ...sel, checked: e.target.checked }
                              }))}
                              className="w-4 h-4 accent-red-600"
                            />
                            <span className="text-gray-900 dark:text-gray-100 text-sm font-medium flex-1">
                              {t.nomi}
                              {/* "2 blok + 5 dona" — miqdor pastda asosiy birlikda kiritiladi */}
                              {t.oramli && <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">{t.qismlar.join(' + ')}</span>}
                            </span>
                            <span className="text-gray-500 dark:text-gray-400 text-xs">max: {t.miqdor}</span>
                          </div>
                          {sel.checked && (
                            <div className="grid grid-cols-2 gap-2 ml-7">
                              <div>
                                <label className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 block">Miqdor</label>
                                <input
                                  type="number"
                                  min={0.001}
                                  max={t.miqdor}
                                  step="any"
                                  value={sel.miqdor}
                                  onChange={e => setQaytarishTanlangan(prev => ({
                                    ...prev,
                                    [t.tovarId]: { ...sel, miqdor: parseFloat(e.target.value) || 0 }
                                  }))}
                                  onWheel={e => e.currentTarget.blur()}
                                  className={inputCls}
                                />
                              </div>
                              <div>
                                <label className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 block">
                                  Narx (sotuv narxi)
                                </label>
                                <div className="px-3 py-2 bg-gray-50 dark:bg-neutral-800/50 border border-gray-200 dark:border-neutral-700 rounded-xl text-gray-700 dark:text-gray-300 text-sm">
                                  {formatSum(Number(t.birlikNarxi))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <div>
                    <label className="text-gray-700 dark:text-gray-300 text-sm font-medium mb-1 block">Sabab (ixtiyoriy)</label>
                    <input
                      value={qaytarishSabab}
                      onChange={e => setQaytarishSabab(e.target.value)}
                      placeholder="Qaytarish sababi..."
                      className={inputCls}
                    />
                  </div>

                </>
              )}
            </div>
        </Modal>
      )}
    </div>
  )
}
