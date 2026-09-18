'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle, Check, Download, FileImage, Loader2, Pencil, Printer, QrCode, RefreshCw, ShieldCheck, Smartphone,
} from 'lucide-react'
import { useRuxsat } from '@/hooks/useRuxsat'

// Ilova QR kodi — do'kon uchun.
//
// Mijoz kodni skanerlaydi → saytdagi "Ilovani o'rnatish" sahifasi ochiladi →
// bitta tugma bosadi → telefon ruxsat so'raydi va ilova o'rnatiladi.
// (QR kodning o'zi hech qachon dastur o'rnata olmaydi — hech bir telefon
// bunga yo'l qo'ymaydi.)
//
// Kod SVG — vektor: telefonda ham, katta ekranda ham, A5 plakatda ham
// bir xil aniq chiqadi. Yuklab olish PNG ga aylantirish brauzerda bajariladi.

interface Javob {
  manzil: string
  qisqa?: string
  standart: string
  dokon: string
  qr?: string
  plakat?: string
  xabar?: string
}

interface Tekshiruv {
  ok: boolean
  xabar: string
  /** Har bir bo'g'in alohida: sayt, ERP kaliti, sayt ↔ ERP aloqasi */
  qadamlar?: { nomi: string; ok: boolean; xabar: string }[]
}

export default function IlovaQrPage() {
  const ruxsat = useRuxsat()
  const [d, setD] = useState<Javob | null>(null)
  const [xato, setXato] = useState<string | null>(null)
  const [tahrir, setTahrir] = useState(false)
  const [manzil, setManzil] = useState('')
  const [band, setBand] = useState(false)
  const [tekshiruv, setTekshiruv] = useState<Tekshiruv | null>(null)
  const [tekshirilmoqda, setTekshirilmoqda] = useState(false)

  const yukla = useCallback(async () => {
    try {
      const j = await fetch('/api/ilova-qr', { cache: 'no-store' })
      const x = await j.json().catch(() => ({}))
      if (!j.ok) { setXato(x.xato ?? 'QR kod yuklanmadi'); return }
      setXato(null)
      setD(x)
      setManzil(x.manzil || x.standart || '')
      setTahrir(!x.manzil)
    } catch {
      setXato('Internet aloqasini tekshiring')
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => { void yukla() }, 0)
    return () => clearTimeout(t)
  }, [yukla])

  async function saqla() {
    setBand(true)
    try {
      const j = await fetch('/api/ilova-qr', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ manzil }),
      })
      const x = await j.json().catch(() => ({}))
      if (!j.ok) { toast.error(x.xato ?? 'Saqlanmadi'); return }
      toast.success('Manzil saqlandi — QR kod yangilandi')
      setTahrir(false)
      setTekshiruv(null)
      await yukla()
    } catch {
      toast.error('Internet aloqasini tekshiring')
    } finally {
      setBand(false)
    }
  }

  async function tekshir() {
    setTekshirilmoqda(true)
    try {
      const j = await fetch('/api/ilova-qr/tekshir', { method: 'POST' })
      const x = await j.json().catch(() => ({}))
      setTekshiruv(j.ok ? x : { ok: false, xabar: x.xato ?? 'Tekshirib bo‘lmadi' })
    } catch {
      setTekshiruv({ ok: false, xabar: 'Internet aloqasini tekshiring' })
    } finally {
      setTekshirilmoqda(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <QrCode size={22} className="text-primary" /> Ilova QR kodi
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5 max-w-2xl">
            Mijoz kodni skanerlaydi, saytdagi o‘rnatish sahifasi ochiladi va telefon ruxsat so‘raydi —
            shundan keyin do‘kon ilovasi bosh ekranga qo‘shiladi.
          </p>
        </div>
        <button
          onClick={() => void yukla()}
          aria-label="Yangilash"
          className="p-2.5 border border-gray-200 dark:border-neutral-700 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800"
        >
          <RefreshCw size={16} className={!d && !xato ? 'animate-spin' : ''} />
        </button>
      </div>

      {xato ? (
        <div className="rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50/60 dark:bg-red-950/10 p-6 text-center">
          <AlertTriangle size={26} className="mx-auto text-red-500" />
          <p className="mt-2 font-medium text-red-700 dark:text-red-400">{xato}</p>
          <button onClick={() => void yukla()} className="mt-3 text-sm font-semibold text-primary">Qayta urinish</button>
        </div>
      ) : !d ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-primary" /></div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] items-start">
          {/* QR va amallar */}
          <section className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 sm:p-6">
            {d.qr ? (
              <div className="flex flex-col items-center gap-4">
                <div
                  className="w-full max-w-[280px] sm:max-w-[340px] aspect-square rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white p-3 [&>svg]:h-full [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: d.qr }}
                />
                <p className="font-mono text-sm text-gray-700 dark:text-gray-300 break-all text-center">{d.qisqa}</p>
                <div className="grid w-full grid-cols-2 gap-2 sm:max-w-md">
                  <Tugma onClick={() => pngYuklab(d.qr!, 'biomax-qr.png', 1024, 1024)} birinchi>
                    <Download size={16} /> QR — PNG
                  </Tugma>
                  <Tugma onClick={() => svgYuklab(d.qr!, 'biomax-qr.svg')}>
                    <FileImage size={16} /> QR — SVG
                  </Tugma>
                  <Tugma onClick={() => pngYuklab(d.plakat!, 'biomax-plakat-a5.png', 1748, 2480)}>
                    <Download size={16} /> Plakat — PNG
                  </Tugma>
                  <Tugma onClick={() => plakatChop(d.plakat!)}>
                    <Printer size={16} /> Chop etish
                  </Tugma>
                </div>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                {d.xabar ?? 'Sayt manzili kiritilmagan.'}
              </p>
            )}
          </section>

          {/* Sozlama va tekshiruv */}
          <div className="space-y-4">
            <section className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Sayt manzili</p>
              {tahrir ? (
                <div className="space-y-2">
                  <input
                    value={manzil}
                    onChange={e => setManzil(e.target.value)}
                    placeholder="https://biomaxmarketplace.store/ilova?manba=qr"
                    suppressHydrationWarning
                    className="w-full px-3 py-2.5 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Manzil «https://» bilan boshlanishi shart — ilova faqat himoyalangan ulanishda o‘rnatiladi.
                  </p>
                  <div className="flex gap-2">
                    {d.manzil && (
                      <button onClick={() => { setTahrir(false); setManzil(d.manzil) }} disabled={band}
                        className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-medium">
                        Bekor qilish
                      </button>
                    )}
                    <button onClick={() => void saqla()} disabled={band || !ruxsat.bor('ilova-qr.manzil')}
                      className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                      {band && <Loader2 size={15} className="animate-spin" />} Saqlash
                    </button>
                  </div>
                  {!ruxsat.bor('ilova-qr.manzil') && (
                    <p className="text-xs text-amber-700 dark:text-amber-500">Manzilni o‘zgartirishga ruxsatingiz yo‘q.</p>
                  )}
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <p className="font-mono text-sm text-gray-900 dark:text-gray-100 break-all">{d.manzil}</p>
                  {ruxsat.bor('ilova-qr.manzil') && (
                    <button onClick={() => setTahrir(true)} className="shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                      <Pencil size={14} /> O‘zgartirish
                    </button>
                  )}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Chop etishdan oldin</p>
              <button onClick={() => void tekshir()} disabled={tekshirilmoqda || !d.manzil}
                className="w-full py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-60 flex items-center justify-center gap-2">
                {tekshirilmoqda ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                Onlayn do‘konni tekshirish
              </button>
              {tekshiruv && (
                <div className="mt-2.5 space-y-2" role="status">
                  <p className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm font-medium ${
                    tekshiruv.ok
                      ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400'
                      : 'bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400'
                  }`}>
                    {tekshiruv.ok ? <Check size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
                    <span>{tekshiruv.xabar}</span>
                  </p>
                  {tekshiruv.qadamlar && tekshiruv.qadamlar.length > 0 && (
                    <ul className="divide-y divide-gray-100 dark:divide-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-800">
                      {tekshiruv.qadamlar.map(q => (
                        <li key={q.nomi} className="flex items-start gap-2.5 px-3 py-2.5 text-sm">
                          <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                            q.ok ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                          }`}>
                            {q.ok ? <Check size={12} /> : <AlertTriangle size={11} />}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-semibold text-gray-900 dark:text-gray-100">{q.nomi}</span>
                            <span className="block text-gray-600 dark:text-gray-400">{q.xabar}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Uch narsa tekshiriladi: sayt ochiladimi, ERP’da sayt kaliti bormi va sayt ERP’ga ulanyaptimi.
              </p>
            </section>

            <section className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-gray-50/60 dark:bg-neutral-800/30 p-4 text-sm text-gray-600 dark:text-gray-400 space-y-2">
              <p className="flex items-start gap-2">
                <Smartphone size={16} className="mt-0.5 shrink-0 text-gray-400" />
                <span>
                  <b className="text-gray-900 dark:text-gray-100">Android:</b> bitta tugma — telefon o‘zi so‘raydi.{' '}
                  <b className="text-gray-900 dark:text-gray-100">iPhone:</b> «Ulashish → Bosh ekranga qo‘shish»
                  (Apple boshqa yo‘l bermaydi, sahifa buni ko‘rsatib turadi).
                </span>
              </p>
              <p className="flex items-start gap-2">
                <QrCode size={16} className="mt-0.5 shrink-0 text-gray-400" />
                <span>Kodni kassaga, eshikka yoki chekka joylashtiring. Eng kichik o‘lcham — 2×2 sm.</span>
              </p>
            </section>
          </div>

          {/* Plakat: ekranda ko'rinish, chop etishda esa butun sahifa */}
          {d.plakat && (
            <section className="lg:col-span-2 rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 sm:p-6">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-3">A5 plakat (chop etishga tayyor)</p>
              <div
                className="mx-auto w-full max-w-[320px] aspect-[1748/2480] overflow-hidden rounded-xl border border-gray-200 dark:border-neutral-800 [&>svg]:h-full [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: d.plakat }}
              />
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function Tugma({ onClick, birinchi, children }: { onClick: () => void; birinchi?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition ${
        birinchi
          ? 'bg-primary hover:bg-primary-hover text-white'
          : 'border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800'
      }`}
    >
      {children}
    </button>
  )
}

// ─── Yuklab olish ────────────────────────────────────────────────────────────

function saqlab(url: string, nomi: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = nomi
  document.body.appendChild(a)
  a.click()
  a.remove()
}

function svgYuklab(svg: string, nomi: string) {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  saqlab(url, nomi)
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/**
 * Plakatni chop etish — ALOHIDA oynada.
 *
 * ERP'ning chop etish uslublari chek uchun 80 mm qog'ozga sozlangan; plakat
 * esa A5. Alohida oyna ikkalasini chalkashtirmaydi va bosma aniq chiqadi.
 */
function plakatChop(svg: string) {
  const oyna = window.open('', '_blank', 'width=760,height=1040')
  if (!oyna) {
    toast.error('Brauzer yangi oynani to‘sdi — plakatni PNG qilib yuklab oling')
    return
  }
  oyna.document.write(
    `<!doctype html><html lang="uz"><head><meta charset="utf-8"><title>Ilova QR — plakat</title>`
    + `<style>@page{size:A5;margin:0}html,body{margin:0;padding:0;background:#fff}svg{display:block;width:100%;height:auto}</style>`
    + `</head><body>${svg}</body></html>`,
  )
  oyna.document.close()
  oyna.focus()
  // Rasm chizilishiga ulgursin
  setTimeout(() => oyna.print(), 400)
}

/** SVG → PNG: brauzerning o'zida chiziladi, serverga rasm kutubxonasi kerak emas. */
async function pngYuklab(svg: string, nomi: string, en: number, boy: number) {
  // `width="100%"` bilan rasm canvas'da o'lchamsiz chiqadi — aniq piksel beriladi
  const olchamli = svg.replace('width="100%" height="100%"', `width="${en}" height="${boy}"`)
  const url = URL.createObjectURL(new Blob([olchamli], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const rasm = new Image()
    rasm.decoding = 'sync'
    await new Promise<void>((bajarildi, xato) => {
      rasm.onload = () => bajarildi()
      rasm.onerror = () => xato(new Error('rasm yuklanmadi'))
      rasm.src = url
    })
    const kanvas = document.createElement('canvas')
    kanvas.width = en
    kanvas.height = boy
    const ctx = kanvas.getContext('2d')
    if (!ctx) throw new Error('canvas yo‘q')
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, en, boy)
    ctx.drawImage(rasm, 0, 0, en, boy)
    const blob = await new Promise<Blob | null>(b => kanvas.toBlob(b, 'image/png'))
    if (!blob) throw new Error('png yasalmadi')
    const pngUrl = URL.createObjectURL(blob)
    saqlab(pngUrl, nomi)
    setTimeout(() => URL.revokeObjectURL(pngUrl), 10_000)
  } catch {
    toast.error('PNG yasalmadi — SVG ni yuklab oling')
  } finally {
    URL.revokeObjectURL(url)
  }
}
