'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Bike, Car, Footprints, Loader2, MapPin, Package, PackageOpen, Phone, Plus, Search, Truck, UserRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useJonli } from '@/hooks/useJonli'
import { vaqtMatni, yangilikAniqla } from '@/lib/lokatsiya-vaqt'
import { YETKAZISH_NOMI, masofaMatni, transportNomi, type DostavchikQisqa, type TransportTuri } from '@/lib/dostavchik'
import DostavchikForma from '@/components/dostavchik/DostavchikForma'
import DostavchikOynasi, { YETKAZISH_RANGI } from '@/components/dostavchik/DostavchikOynasi'

// Namuna tovar — dostavchiklar bo'limi.
//
// Har bir dostavchik: hozir qayerda (jonli), qaysi buyurtmaga ketyapti yoki
// qaysi mijoz oldida turibdi, bugun nechta topshirdi va qo'lida qancha
// namuna bor. Sahifa o'zi yangilanadi — qisqa belgi 3 soniyada so'raladi,
// o'zgarish bo'lsagina ro'yxat qayta yuklanadi.

interface Javob {
  dostavchiklar: DostavchikQisqa[]
  belgi: string
  ruxsat: { berish: boolean; dostavchik: boolean }
}

const TRANSPORT_BELGISI: Record<TransportTuri, LucideIcon> = {
  AVTOMOBIL: Car, YUK_AVTOMOBILI: Truck, MOTOTSIKL: Bike, SKUTER: Bike, VELOSIPED: Bike, PIYODA: Footprints, BOSHQA: Car,
}

const telMatni = (t: string | null) => {
  const r = String(t ?? '').replace(/\D/g, '').slice(-9)
  return r.length === 9 ? `+998 ${r.slice(0, 2)} ${r.slice(2, 5)} ${r.slice(5, 7)} ${r.slice(7)}` : '—'
}

export default function NamunaTovarPage() {
  const [javob, setJavob] = useState<Javob | null>(null)
  const [xato, setXato] = useState<string | null>(null)
  const [qidiruv, setQidiruv] = useState('')
  const [nofaollar, setNofaollar] = useState(false)
  const [tanlangan, setTanlangan] = useState<string | null>(null)
  const [yangiOchiq, setYangiOchiq] = useState(false)
  const [yangilanish, setYangilanish] = useState(0)
  const [oxirgiYangilanish, setOxirgiYangilanish] = useState<Date | null>(null)
  const [, setSoat] = useState(0)

  const yukla = useCallback(async () => {
    try {
      const j = await fetch('/api/namuna-tovar', { cache: 'no-store' })
      const d = await j.json().catch(() => ({}))
      if (!j.ok) { setXato(d.xato ?? 'Ma’lumot yuklanmadi'); return }
      setXato(null)
      setJavob(d)
      setOxirgiYangilanish(new Date())
    } catch {
      setXato('Internet aloqasini tekshiring')
    }
  }, [])

  // Birinchi yuklash — keyingilarini jonli belgi boshqaradi
  useEffect(() => {
    const t = setTimeout(() => { void yukla() }, 0)
    return () => clearTimeout(t)
  }, [yukla])

  // Jonli: dostavchik joylashuvi, yetkazish bosqichi yoki namuna o'zgarsa
  useJonli('/api/namuna-tovar/belgi', () => {
    void yukla()
    setYangilanish(x => x + 1)
  }, 3_000)

  // "2 daqiqa oldin" matnlari eskirib qolmasin
  useEffect(() => {
    const s = setInterval(() => setSoat(x => x + 1), 30_000)
    return () => clearInterval(s)
  }, [])

  const royxat = useMemo(() => {
    const q = qidiruv.trim().toLowerCase()
    const raqam = q.replace(/\D/g, '')
    return (javob?.dostavchiklar ?? []).filter(d =>
      (nofaollar || d.faol) &&
      (!q || d.ism.toLowerCase().includes(q) || d.login.toLowerCase().includes(q) || (d.davlatRaqami ?? '').toLowerCase().includes(q)
        || (raqam.length >= 3 && [d.telefon, ...d.qoshimchaTelefonlar].some(t => t?.includes(raqam)))))
  }, [javob, qidiruv, nofaollar])

  const faollar = javob?.dostavchiklar.filter(d => d.faol) ?? []
  const xulosa = {
    faol: faollar.length,
    yolda: faollar.filter(d => d.joriy && d.joriy.holati !== 'TAYINLANGAN').length,
    bugun: faollar.reduce((s, d) => s + d.bugunTopshirgan, 0),
    namuna: (javob?.dostavchiklar ?? []).reduce((s, d) => s + d.qolganNamuna, 0),
  }
  const nofaolSoni = (javob?.dostavchiklar.length ?? 0) - faollar.length

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <PackageOpen size={22} className="text-primary" />
            Namuna tovar
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
            Dostavchiklar, ularga berilgan namunalar, jonli joylashuvi va yetkazayotgan buyurtmalari.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400" title="Sahifa o‘zi yangilanadi">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60 animate-ping motion-reduce:animate-none" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Jonli{oxirgiYangilanish && ` · ${oxirgiYangilanish.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}
          </span>
          {javob?.ruxsat.dostavchik && (
            <button onClick={() => setYangiOchiq(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-semibold transition">
              <Plus size={16} /> Dostavchik qo‘shish
            </button>
          )}
        </div>
      </div>

      {javob && javob.dostavchiklar.length > 0 && (
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <Xulosa nomi="Faol dostavchik" qiymat={xulosa.faol} />
          <Xulosa nomi="Hozir yo‘lda yoki manzilda" qiymat={xulosa.yolda} urgu={xulosa.yolda > 0} />
          <Xulosa nomi="Bugun topshirildi" qiymat={xulosa.bugun} />
          <Xulosa nomi="Dostavchiklardagi namuna" qiymat={xulosa.namuna} />
        </dl>
      )}

      {javob && javob.dostavchiklar.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <label className="relative sm:w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={qidiruv} onChange={e => setQidiruv(e.target.value)} id="dostavchik-qidiruv"
              placeholder="Ism, telefon yoki davlat raqami" suppressHydrationWarning
              className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500" />
          </label>
          {nofaolSoni > 0 && (
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
              <input type="checkbox" checked={nofaollar} onChange={e => setNofaollar(e.target.checked)} className="h-4 w-4 accent-red-600" />
              Faol emaslarni ham ko‘rsatish ({nofaolSoni})
            </label>
          )}
        </div>
      )}

      {xato ? (
        <div className="rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50/60 dark:bg-red-950/10 p-6 text-center">
          <AlertTriangle size={26} className="mx-auto text-red-500" />
          <p className="mt-2 font-medium text-red-700 dark:text-red-400">{xato}</p>
          <button onClick={() => void yukla()} className="mt-3 text-sm font-semibold text-primary">Qayta urinish</button>
        </div>
      ) : !javob ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-primary" /></div>
      ) : javob.dostavchiklar.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-neutral-700 py-14 px-6 text-center">
          <UserRound size={34} className="mx-auto text-gray-300 dark:text-neutral-700" />
          <p className="mt-3 font-semibold text-gray-900 dark:text-gray-100">Hali dostavchik yo‘q</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Dostavchik qo‘shing: u o‘z login-paroli bilan telefonidan kiradi, unga faqat «Onlayn buyurtmalar» ko‘rinadi.
            Namuna berish, joylashuv va yetkazishlar shu yerda kuzatiladi.
          </p>
          {javob.ruxsat.dostavchik && (
            <button onClick={() => setYangiOchiq(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-semibold">
              <Plus size={16} /> Birinchi dostavchikni qo‘shish
            </button>
          )}
        </div>
      ) : royxat.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500">Hech kim topilmadi</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {royxat.map(d => <DostavchikKartasi key={d.id} d={d} onOch={() => setTanlangan(d.id)} />)}
        </div>
      )}

      {tanlangan && javob && (
        <DostavchikOynasi
          id={tanlangan}
          yangilanish={yangilanish}
          ruxsat={javob.ruxsat}
          onYopish={() => setTanlangan(null)}
          onOzgardi={() => void yukla()}
        />
      )}
      {yangiOchiq && (
        <DostavchikForma
          onYopish={() => setYangiOchiq(false)}
          onSaqlandi={id => { setYangiOchiq(false); void yukla(); setTanlangan(id) }}
        />
      )}
    </div>
  )
}

function Xulosa({ nomi, qiymat, urgu }: { nomi: string; qiymat: number; urgu?: boolean }) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3">
      <dd className={`text-2xl font-bold tabular-nums ${urgu ? 'text-violet-600 dark:text-violet-400' : 'text-gray-900 dark:text-gray-100'}`}>{qiymat}</dd>
      <dt className="text-xs text-gray-500 dark:text-gray-400">{nomi}</dt>
    </div>
  )
}

function DostavchikKartasi({ d, onOch }: { d: DostavchikQisqa; onOch: () => void }) {
  const Transport = d.transportTuri ? TRANSPORT_BELGISI[d.transportTuri] : Car
  const yangilik = d.lokatsiya ? yangilikAniqla(d.lokatsiya.yangilangan) : null
  const nuqtaRangi = yangilik === 'jonli' ? 'bg-emerald-500' : yangilik === 'yaqin' ? 'bg-lime-500' : 'bg-gray-300 dark:bg-neutral-600'
  const j = d.joriy
  const masofa = masofaMatni(j?.masofaM)
  // Joriy buyurtmaning o'zi navbatdagisi bo'lsa, u "yana navbatda" deb sanalmaydi
  const navbat = d.navbatda - (j?.holati === 'TAYINLANGAN' ? 1 : 0)

  return (
    <button onClick={onOch}
      className={`text-left rounded-2xl border bg-white dark:bg-neutral-900 p-4 transition hover:border-gray-300 dark:hover:border-neutral-700 hover:shadow-sm ${
        d.faol ? 'border-gray-200 dark:border-neutral-800' : 'border-gray-200 dark:border-neutral-800 opacity-60'
      }`}>
      <div className="flex items-start gap-3">
        <span className="relative shrink-0 h-11 w-11 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center text-base font-bold text-gray-700 dark:text-gray-300">
          {d.ism.trim()[0]?.toUpperCase() ?? '?'}
          <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-neutral-900 ${nuqtaRangi}`} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{d.ism}{!d.faol && <span className="ml-1.5 text-xs font-medium text-gray-500">· faol emas</span>}</p>
          <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 min-w-0">
            <Transport size={13} className="shrink-0" />
            <span className="truncate">{d.transportNomi ?? transportNomi(d.transportTuri)}{d.davlatRaqami && ` · ${d.davlatRaqami}`}</span>
          </p>
          <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            <Phone size={12} className="shrink-0" /><span className="font-mono">{telMatni(d.telefon)}</span>
            {d.qoshimchaTelefonlar.length > 0 && <span>+{d.qoshimchaTelefonlar.length}</span>}
          </p>
        </div>
      </div>

      <div className="mt-3">
        {j ? (
          <div className={`rounded-xl px-3 py-2 ${YETKAZISH_RANGI[j.holati]}`}>
            <p className="text-xs font-semibold">
              {j.holati === 'YETIB_KELDI' ? 'Mijoz manzilida' : j.holati === 'YOLDA' ? 'Yo‘lda' : YETKAZISH_NOMI[j.holati]}
              {' · '}<span className="font-mono">{j.raqam}</span>
              {masofa && j.holati === 'YOLDA' && <> · {masofa}</>}
            </p>
            <p className="text-xs opacity-80 truncate">{j.aloqaIsm ?? 'Mijoz'} · {j.manzilMatni ?? 'manzil ko‘rsatilmagan'}</p>
          </div>
        ) : (
          <div className="rounded-xl px-3 py-2 bg-gray-50 dark:bg-neutral-800/40 text-xs text-gray-500 dark:text-gray-400">Bo‘sh — biriktirilgan buyurtma yo‘q</div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1 min-w-0">
          <MapPin size={12} className="shrink-0" />
          <span className="truncate">{d.lokatsiya ? vaqtMatni(d.lokatsiya.yangilangan) : 'Joylashuv yo‘q'}</span>
        </span>
        <span className="flex items-center gap-2.5 shrink-0 tabular-nums">
          {navbat > 0 && <span title="Navbatdagi buyurtmalar">+{navbat} navbatda</span>}
          <span title="Bugun topshirgan">bugun {d.bugunTopshirgan}</span>
          <span className={`flex items-center gap-0.5 ${d.qolganNamuna > 0 ? 'font-semibold text-amber-700 dark:text-amber-400' : ''}`} title="Qo‘lidagi namunalar">
            <Package size={12} />{d.qolganNamuna}
          </span>
        </span>
      </div>
    </button>
  )
}
