'use client'

import { useEffect, useState } from 'react'
import {
  X, Package, Warehouse, Store, Boxes, Loader2, Pencil, Barcode, Tag,
  Calendar, Truck, History, Building, AlertTriangle, TrendingUp, Clock, MapPin, DollarSign, Lock, Unlock, QrCode, Printer,
} from 'lucide-react'
import { formatNarx, formatSum, formatSana, formatSanaVaVaqt } from '@/lib/utils'
import { harakatMalumoti, joyLabel } from '@/lib/harakat-turlari'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { yorliqlarHtml } from '@/lib/qr-kod'
import { chekChopEtish } from '@/lib/chek-print'

// Mahsulot ustiga bosilganda ochiladigan to'liq karta:
// qayerda turgani (ombor/do'kon), qachon va kimdan kelgani, butun tarixi.
// Tovarlar va Ombor sahifalarida bir xil ishlatiladi.

interface Harakat {
  id: string
  turi: string
  joy: string
  ishora: 1 | -1
  miqdor: number
  narx: number | null
  sana: string
  izoh: string | null
  taminotchi: string | null
  xodim: string | null
  chekRaqami: string | null
  manbaFilial: string | null
  qabulFilial: string | null
}

interface Tafsilot {
  tovar: {
    id: string; nomi: string
    kategoriya: { id: string; nomi: string } | null
    taminotchi: { id: string; nomi: string; telefon: string | null } | null
    filial: { id: string; nomi: string } | null
    shtrixKod: string | null; birlik: string; valyuta: string; holati: string
    keltirilganManzil: string | null
    yaratilganKursi: number | string | null
    qulflangan: boolean
    kelishNarxi: number | null; sotishNarxi: number | null
    optomNarxi: number | null; bolishNarxi: number | null
    minimalQoldiq: number; rasmlar: string[]
    yaroqlilikMuddati: string | null; yaratilgan: string; yangilangan: string
  }
  qoldiq: { ombor: number; dokon: number; jami: number; kamQolgan: boolean }
  kirim: {
    birinchiSana: string | null; oxirgiSana: string | null
    marta: number; jamiMiqdor: number; jamiSumma: number | null
  }
  chiqim: { jamiMiqdor: number }
  sotuv: {
    jamiMiqdor: number; jamiSumma: number; marta: number
    oxirgiSana: string | null; oxirgiChek: string | null
  }
  joriyKursi: number | null
  harakatlar: Harakat[]
  harakatJami: number
  harakatLimiti: number
}

function miqdorMatni(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
}

// Server yashirilgan maydon uchun null qaytaradi — "0 UZS" deb
// noto'g'ri o'qilmasligi uchun aniq "—" ko'rsatiladi.
function narxMatni(narx: number | null, valyuta?: string) {
  if (narx === null || narx === undefined) return '—'
  return formatNarx(narx, valyuta)
}

export default function TovarTafsilot({
  tovarId, onYopish, onTahrir, onRasmOch, onQulfTogla,
}: {
  tovarId: string
  onYopish: () => void
  onTahrir?: () => void
  onRasmOch?: (rasmlar: string[], nomi: string, index: number) => void
  /** Qulflash/ochish — berilmasa tugma ko'rsatilmaydi (ruxsat yo'q). */
  onQulfTogla?: (yangiHolat: boolean) => Promise<void> | void
}) {
  const [data, setData] = useState<Tafsilot | null>(null)
  const [yuklanmoqda, setYuklanmoqda] = useState(true)
  const [xato, setXato] = useState<string | null>(null)
  const [qrRasm, setQrRasm] = useState<string | null>(null)
  const [qulfAmalda, setQulfAmalda] = useState(false)

  useBodyScrollLock(true)

  // Chaqiruvchi `key={tovarId}` beradi — boshqa mahsulot tanlansa komponent
  // qaytadan yaratiladi, shuning uchun effekt ichida holatni tiklash shart emas
  // (va sinxron setState keraksiz qayta renderlarni keltirib chiqarardi).
  useEffect(() => {
    let bekor = false
    fetch(`/api/tovarlar/${tovarId}/tafsilot`)
      .then(async r => {
        const j = await r.json().catch(() => ({}))
        if (bekor) return
        if (!r.ok) { setXato(j.xato || "Ma'lumot yuklanmadi"); return }
        setData(j)
      })
      .catch(() => { if (!bekor) setXato('Tarmoq xatosi') })
      .finally(() => { if (!bekor) setYuklanmoqda(false) })
    return () => { bekor = true }
  }, [tovarId])

  // Shtrix-kod ma'lum bo'lgach QR yaratiladi. Rasm brauzerda hosil
  // qilinadi — server yuki ham, tashqi xizmat ham kerak emas.
  useEffect(() => {
    // Shtrix-kod bo'lmasa hech narsa qilinmaydi — `qrRasm` boshlang'ich
    // holatida (null) qoladi. Komponent `key={tovarId}` bilan qayta
    // yaratilgani uchun eski qiymat qolib ketmaydi.
    const kod = data?.tovar.shtrixKod?.trim()
    if (!kod) return
    let bekor = false
    fetch('/api/tovarlar/qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kodlar: [kod], origin: window.location.origin }),
    })
      .then(r => r.json())
      .then(j => { if (!bekor) setQrRasm(j?.rasmlar?.[kod] ?? null) })
      .catch(() => { if (!bekor) setQrRasm(null) })
    return () => { bekor = true }
  }, [data])

  function qrChopEt() {
    if (!qrRasm || !t?.shtrixKod) return
    chekChopEtish(yorliqlarHtml([{
      id: t.id, nomi: t.nomi, shtrixKod: t.shtrixKod,
      narx: narxMatni(t.sotishNarxi, t.valyuta), qrRasm,
    }], { ustunlar: 3, nusxa: 1, dokonNomi: '' }))
  }

  // Esc bilan yopish — modal odatiy xatti-harakati
  useEffect(() => {
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') onYopish() }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [onYopish])

  const t = data?.tovar
  const birlik = t ? t.birlik.toLowerCase() : ''

  // Yaratilgandagi USD kursi va uning bugungi kurs bilan farqi.
  // Eski mahsulotlarda kurs saqlanmagan — o'sha holat aniq aytiladi.
  const kurs = (() => {
    const yaratilgan = t?.yaratilganKursi === null || t?.yaratilganKursi === undefined
      ? null
      : Number(t.yaratilganKursi)
    if (!yaratilgan || !Number.isFinite(yaratilgan)) {
      return { bor: false, matn: 'Saqlanmagan', izoh: undefined as string | undefined }
    }
    const joriy = data?.joriyKursi ?? null
    const qismlar: string[] = []
    if (joriy && Number.isFinite(joriy)) {
      const farq = Math.round(joriy - yaratilgan)
      const farqMatni = new Intl.NumberFormat('uz-UZ').format(Math.abs(farq))
      qismlar.push(
        farq === 0
          ? `hozir ham ${formatSum(joriy)}`
          : `hozir ${formatSum(joriy)} (${farq > 0 ? '+' : '−'}${farqMatni})`,
      )
    }
    // USD'da narxlangan tovar uchun — o'sha kundagi so'mdagi qiymati
    if (t?.valyuta === 'USD' && t.kelishNarxi !== null && t.kelishNarxi !== undefined) {
      const somda = Number(t.kelishNarxi) * yaratilgan
      if (Number.isFinite(somda)) qismlar.push(`o'sha kunda ≈ ${formatSum(somda)}`)
    }
    return { bor: true, matn: formatSum(yaratilgan), izoh: qismlar.join(' · ') || undefined }
  })()

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={onYopish}
    >
      <div
        className="bg-white dark:bg-neutral-900 rounded-t-2xl sm:rounded-2xl shadow-xl dark:border dark:border-neutral-800 w-full max-w-2xl max-h-[92dvh] sm:max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Sarlavha */}
        <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-neutral-800 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h3 className="text-gray-900 dark:text-gray-100 font-semibold flex items-center gap-2">
              <Package size={18} className="text-primary shrink-0" />
              <span className="truncate">{t?.nomi ?? "Mahsulot ma'lumotlari"}</span>
            </h3>
            {t && (
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {t.kategoriya && (
                  <span className="text-xs bg-red-50 dark:bg-red-950/30 text-red-600 px-2.5 py-0.5 rounded-full font-medium">
                    {t.kategoriya.nomi}
                  </span>
                )}
                {t.filial && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <Building size={11} /> {t.filial.nomi}
                  </span>
                )}
                {t.qulflangan && (
                  <span className="text-xs bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                    <Lock size={10} /> Qulflangan — sotuvda ko&apos;rinmaydi
                  </span>
                )}
                {t.holati !== 'FAOL' && (
                  <span className="text-xs bg-gray-100 dark:bg-neutral-800 text-gray-500 px-2 py-0.5 rounded-full">
                    Arxivlangan
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onYopish}
            className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {yuklanmoqda ? (
            <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-primary" /></div>
          ) : xato || !data || !t ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-20 text-sm">{xato ?? 'Topilmadi'}</p>
          ) : (
            <div className="p-4 sm:p-5 space-y-5">
              {/* Rasmlar */}
              {t.rasmlar.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {t.rasmlar.map((rasm, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={rasm}
                      alt={`${t.nomi} ${i + 1}`}
                      className={`aspect-square object-cover rounded-xl border border-gray-200 dark:border-neutral-700 ${onRasmOch ? 'cursor-zoom-in' : ''}`}
                      onClick={() => onRasmOch?.(t.rasmlar, t.nomi, i)}
                    />
                  ))}
                </div>
              )}

              {/* ── Qayerda turibdi ── */}
              <section>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  Qayerda turibdi
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <JoyKarta
                    belgi={<Warehouse size={13} />}
                    sarlavha="Omborda"
                    qiymat={`${miqdorMatni(data.qoldiq.ombor)} ${birlik}`}
                    kuchli={data.qoldiq.ombor > 0}
                  />
                  <JoyKarta
                    belgi={<Store size={13} />}
                    sarlavha="Do'konda"
                    qiymat={`${miqdorMatni(data.qoldiq.dokon)} ${birlik}`}
                    kuchli={data.qoldiq.dokon > 0}
                  />
                  <JoyKarta
                    belgi={<Boxes size={13} />}
                    sarlavha="Jami"
                    qiymat={`${miqdorMatni(data.qoldiq.jami)} ${birlik}`}
                    kuchli
                    rang={data.qoldiq.kamQolgan ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'}
                  />
                </div>
                {data.qoldiq.kamQolgan && (
                  <p className="mt-2 text-xs text-red-600 flex items-center gap-1.5">
                    <AlertTriangle size={12} />
                    {data.qoldiq.jami <= 0
                      ? 'Mahsulot tugagan'
                      : `Minimal chegaradan past (min ${t.minimalQoldiq} ${birlik})`}
                  </p>
                )}
              </section>

              {/* ── Qachon kelgan ── */}
              <section>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  Qachon kiritilgan
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Qator
                    belgi={<Truck size={11} />}
                    label="Birinchi kirim"
                    qiymat={data.kirim.birinchiSana ? formatSanaVaVaqt(data.kirim.birinchiSana) : 'Hali kirim yo‘q'}
                  />
                  <Qator
                    belgi={<Clock size={11} />}
                    label="Oxirgi kirim"
                    qiymat={data.kirim.oxirgiSana ? formatSanaVaVaqt(data.kirim.oxirgiSana) : '—'}
                  />
                  <Qator
                    belgi={<Calendar size={11} />}
                    label="Karta yaratilgan"
                    qiymat={formatSanaVaVaqt(t.yaratilgan)}
                  />
                  <Qator
                    belgi={<DollarSign size={11} />}
                    label="Yaratilgandagi dollar kursi"
                    qiymat={kurs.matn}
                    izoh={kurs.izoh}
                    rang={kurs.bor ? undefined : 'text-gray-500 dark:text-gray-400'}
                  />
                  <Qator
                    belgi={<Truck size={11} />}
                    label="Ta'minotchi"
                    qiymat={t.taminotchi?.nomi ?? 'Belgilanmagan'}
                    izoh={t.taminotchi?.telefon ?? undefined}
                  />
                  <Qator
                    belgi={<MapPin size={11} />}
                    label="Keltirilgan manzil"
                    qiymat={t.keltirilganManzil || 'Kiritilmagan'}
                    rang={t.keltirilganManzil ? undefined : 'text-gray-500 dark:text-gray-400'}
                    toliq
                  />
                  <Qator
                    belgi={<Boxes size={11} />}
                    label={`Jami kirim (${data.kirim.marta} marta)`}
                    qiymat={`${miqdorMatni(data.kirim.jamiMiqdor)} ${birlik}`}
                    izoh={data.kirim.jamiSumma !== null ? formatSum(data.kirim.jamiSumma) : undefined}
                  />
                  <Qator
                    belgi={<TrendingUp size={11} />}
                    label={`Sotilgan (${data.sotuv.marta} marta)`}
                    qiymat={`${miqdorMatni(data.sotuv.jamiMiqdor)} ${birlik}`}
                    izoh={data.sotuv.oxirgiSana ? `oxirgisi ${formatSana(data.sotuv.oxirgiSana)}` : undefined}
                  />
                </div>
              </section>

              {/* ── Narxlar ── */}
              <section>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  Narxlar va belgilar
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Qator belgi={<Tag size={11} />} label="Kelish narxi" qiymat={narxMatni(t.kelishNarxi, t.valyuta)} />
                  <Qator belgi={<Tag size={11} />} label="Sotish narxi" qiymat={narxMatni(t.sotishNarxi, t.valyuta)} rang="text-green-600" />
                  {t.optomNarxi !== null && (
                    <Qator belgi={<Tag size={11} />} label="Optom narxi" qiymat={narxMatni(t.optomNarxi, t.valyuta)} rang="text-blue-600" />
                  )}
                  {t.bolishNarxi !== null && (
                    <Qator belgi={<Tag size={11} />} label="Bo'lish narxi" qiymat={narxMatni(t.bolishNarxi, t.valyuta)} rang="text-amber-600" />
                  )}
                  <Qator belgi={<Barcode size={11} />} label="Shtrix-kod" qiymat={t.shtrixKod || '—'} />
                  <Qator belgi={<Boxes size={11} />} label="O'lchov birligi" qiymat={t.birlik} />
                  <Qator belgi={<AlertTriangle size={11} />} label="Minimal qoldiq" qiymat={`${t.minimalQoldiq} ${birlik}`} />
                  {t.yaroqlilikMuddati && (
                    <Qator belgi={<Calendar size={11} />} label="Yaroqlilik muddati" qiymat={formatSana(t.yaroqlilikMuddati)} />
                  )}
                </div>
              </section>

              {/* ── QR kod ── */}
              {qrRasm && t.shtrixKod && (
                <section>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <QrCode size={12} /> QR kod
                  </p>
                  <div className="bg-gray-50 dark:bg-neutral-800/60 rounded-xl p-4 flex items-center gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrRasm} alt="QR" className="w-24 h-24 rounded-lg bg-white p-1 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-gray-600 dark:text-gray-400 text-xs leading-relaxed">
                        Skanerlanganda mahsulot nomi va narxi chiqadi.
                        Kassa skaneri ham shu QR&apos;ni o&apos;qiydi.
                      </p>
                      <button
                        onClick={qrChopEt}
                        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400 text-xs font-medium hover:border-primary/50 hover:text-primary transition"
                      >
                        <Printer size={13} /> Yorliqni chop etish
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {/* ── Harakatlar tarixi ── */}
              <section>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                    <History size={12} /> Harakatlar tarixi
                  </p>
                  <span className="text-gray-500 dark:text-gray-400 text-xs">
                    {data.harakatJami > data.harakatLimiti
                      ? `oxirgi ${data.harakatLimiti} / ${data.harakatJami} ta`
                      : `${data.harakatJami} ta`}
                  </span>
                </div>
                {data.harakatlar.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6 bg-gray-50 dark:bg-neutral-800/60 rounded-xl">
                    Hali harakat qayd etilmagan
                  </p>
                ) : (
                  <div className="border border-gray-200 dark:border-neutral-800 rounded-xl divide-y divide-gray-100 dark:divide-neutral-800 overflow-hidden">
                    {data.harakatlar.map(h => {
                      const m = harakatMalumoti(h.turi)
                      const tafsilotlar = [
                        h.taminotchi,
                        h.chekRaqami,
                        h.manbaFilial && h.qabulFilial ? `${h.manbaFilial} → ${h.qabulFilial}` : null,
                        h.xodim,
                        h.izoh,
                      ].filter(Boolean)
                      return (
                        <div key={h.id} className="px-3 py-2.5 flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${m.badge}`}>
                                {m.label}
                              </span>
                              <span className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                {h.joy === 'OMBOR' ? <Warehouse size={10} /> : <Store size={10} />}
                                {joyLabel(h.joy)}
                              </span>
                            </div>
                            <p className="text-gray-500 dark:text-gray-400 text-[11px] mt-1">
                              {formatSanaVaVaqt(h.sana)}
                              {tafsilotlar.length > 0 && ` · ${tafsilotlar.join(' · ')}`}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`font-mono tabular-nums text-sm font-semibold ${
                              h.ishora > 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {h.ishora > 0 ? '+' : '−'}{miqdorMatni(h.miqdor)} {birlik}
                            </p>
                            {h.narx !== null && h.narx > 0 && (
                              <p className="text-gray-500 dark:text-gray-400 text-[11px]">
                                {formatSum(h.narx)} / {birlik}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>

        {/* Tugmalar */}
        <div className="p-4 sm:p-5 border-t border-gray-200 dark:border-neutral-800 flex gap-3 shrink-0 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-5">
          {/* Qulflangan mahsulotni aynan shu yerdan ochish mumkin —
              kartani ochgan odam sababini ko'rib, darhol qaytara oladi. */}
          {onQulfTogla && t && (
            <button
              onClick={async () => {
                setQulfAmalda(true)
                try {
                  await onQulfTogla(!t.qulflangan)
                  setData(d => d ? { ...d, tovar: { ...d.tovar, qulflangan: !t.qulflangan } } : d)
                } finally {
                  setQulfAmalda(false)
                }
              }}
              disabled={qulfAmalda}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium transition disabled:opacity-50 ${
                t.qulflangan
                  ? 'bg-amber-500 hover:bg-amber-400 text-white'
                  : 'border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400 hover:border-amber-400 hover:text-amber-600'
              }`}
            >
              {qulfAmalda
                ? <Loader2 size={15} className="animate-spin" />
                : t.qulflangan ? <Unlock size={15} /> : <Lock size={15} />}
              {t.qulflangan ? 'Qulfni ochish' : 'Qulflash'}
            </button>
          )}
          {onTahrir && (
            <button
              onClick={onTahrir}
              className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-medium transition flex items-center justify-center gap-2"
            >
              <Pencil size={15} /> Tahrirlash
            </button>
          )}
          <button
            onClick={onYopish}
            className="flex-1 py-2.5 border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition font-medium"
          >
            Yopish
          </button>
        </div>
      </div>
    </div>
  )
}

function JoyKarta({ belgi, sarlavha, qiymat, kuchli, rang }: {
  belgi: React.ReactNode; sarlavha: string; qiymat: string; kuchli?: boolean; rang?: string
}) {
  return (
    <div className="bg-gray-50 dark:bg-neutral-800/60 rounded-xl p-3">
      <p className="text-gray-500 dark:text-gray-400 text-[11px] flex items-center gap-1">{belgi} {sarlavha}</p>
      <p className={`mt-0.5 font-semibold truncate ${
        rang ?? (kuchli ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400')
      }`}>
        {qiymat}
      </p>
    </div>
  )
}

function Qator({ belgi, label, qiymat, izoh, rang, toliq }: {
  belgi: React.ReactNode; label: string; qiymat: string; izoh?: string
  rang?: string
  /** Ikki ustunni egallaydi — uzun erkin matn qisqarib ketmasin. */
  toliq?: boolean
}) {
  return (
    <div className={`bg-gray-50 dark:bg-neutral-800/60 rounded-xl p-3 min-w-0 ${toliq ? 'col-span-2' : ''}`}>
      <p className="text-gray-500 dark:text-gray-400 text-[11px] flex items-center gap-1 truncate">{belgi} {label}</p>
      <p className={`mt-0.5 font-semibold text-sm ${toliq ? 'break-words' : 'truncate'} ${rang ?? 'text-gray-900 dark:text-gray-100'}`}>{qiymat}</p>
      {izoh && <p className="text-gray-500 dark:text-gray-400 text-[11px] mt-0.5 truncate">{izoh}</p>}
    </div>
  )
}
