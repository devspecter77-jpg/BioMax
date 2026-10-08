'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  AlertTriangle, CloudUpload, Loader2, Mic, MicOff, Play, RefreshCw, ShieldCheck, Smartphone, Square, WifiOff,
} from 'lucide-react'
import { useSmena } from './SmenaProvider'
import Modal, { ModalAsosiy, ModalBekor } from '@/components/ui/modal'
import { useConfirm } from '@/components/ConfirmProvider'
import { davomiylikMatni, hajmMatni, soatMatni, taymerMatni } from '@/lib/smena'

/** Har soniyada qayta chizadi — taymer uchun. */
export function useSoniya(faol: boolean): void {
  const [, setT] = useState(0)
  useEffect(() => {
    if (!faol) return
    const i = setInterval(() => setT(t => t + 1), 1_000)
    return () => clearInterval(i)
  }, [faol])
}

/** Ovoz balandligi — 5 ta ustuncha. Mikrofon haqiqatan eshitayotganini ko'rsatadi. */
export function DarajaKorsatkichi({ daraja, faol }: { daraja: number; faol: boolean }) {
  const chegaralar = [0.02, 0.06, 0.12, 0.2, 0.32]
  return (
    <span className="flex items-end gap-0.5 h-4" aria-hidden>
      {chegaralar.map((c, i) => (
        <span
          key={c}
          className={`w-1 rounded-full transition-[height,background-color] duration-200 ${
            faol && daraja >= c ? 'bg-red-500' : 'bg-red-200 dark:bg-red-900/60'
          }`}
          style={{ height: `${6 + i * 2.5}px` }}
        />
      ))}
    </span>
  )
}

export default function SmenaPaneli() {
  const s = useSmena()
  const confirm = useConfirm()
  const [rozilikOchiq, setRozilikOchiq] = useState(false)
  const smena = s?.server?.smena ?? null
  useSoniya(!!smena)

  if (!s?.mavjud) return null

  if (!s.server) {
    return (
      <section className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 animate-pulse">
        <div className="h-4 w-32 bg-gray-200 dark:bg-neutral-800 rounded" />
        <div className="mt-4 h-14 bg-gray-100 dark:bg-neutral-800 rounded-xl" />
      </section>
    )
  }

  const { server, yozuv, navbat } = s
  const bugungiTugagan = server.bugun.filter(b => b.tugadi)
  const bugungiMs = bugungiTugagan.reduce((a, b) => a + b.smenaMs, 0)

  async function boshlashniBos() {
    if (!s) return
    if (!s.server?.rozilik) { setRozilikOchiq(true); return }
    await s.boshla()
  }

  async function tugatishniBos() {
    if (!s || !smena) return
    const ishlagan = s.vaqt() - new Date(smena.boshlandi).getTime()
    const ok = await confirm({
      title: 'Ishni tugallaysizmi?',
      message: `Bugungi smena ${soatMatni(smena.boshlandi)} da boshlangan, ${davomiylikMatni(ishlagan)} ishladingiz. Tugallasangiz ovoz yozish to‘xtaydi.`,
      confirmText: 'Ishni tugallash',
      danger: false,
    })
    if (ok) await s.tugat()
  }

  return (
    <section
      aria-labelledby="smena-sarlavha"
      className={`rounded-2xl border bg-white dark:bg-neutral-900 overflow-hidden ${
        smena ? 'border-emerald-300 dark:border-emerald-800' : 'border-gray-200 dark:border-neutral-800'
      }`}
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 id="smena-sarlavha" className="text-base font-semibold text-gray-900 dark:text-gray-100">Ish smenasi</h2>
          {smena ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Ishda
            </span>
          ) : (
            <span className="rounded-full bg-gray-100 dark:bg-neutral-800 px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-400">
              Ish boshlanmagan
            </span>
          )}
        </div>

        {smena ? (
          <>
            <p className="mt-3 font-mono tabular-nums text-4xl sm:text-5xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
              {taymerMatni(s.vaqt() - new Date(smena.boshlandi).getTime())}
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{soatMatni(smena.boshlandi)} dan beri ishlayapsiz</p>

            <YozuvHolatiQatori />

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
              {s.ekranYoniq && (
                <span className="inline-flex items-center gap-1"><Smartphone size={13} aria-hidden /> Ekran yoniq turadi</span>
              )}
              {s.yuborildi > 0 && (
                <span className="inline-flex items-center gap-1"><CloudUpload size={13} aria-hidden /> {s.yuborildi} ta bo‘lak yuborildi</span>
              )}
              {navbat.soni > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Loader2 size={13} className="animate-spin" aria-hidden /> {navbat.soni} ta navbatda ({hajmMatni(navbat.hajm)})
                </span>
              )}
              {!s.onlayn && (
                <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                  <WifiOff size={13} aria-hidden /> Internet yo‘q — yozuv telefonda saqlanmoqda
                </span>
              )}
            </div>
            {!server.omborTayyor && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                Server ombori hali sozlanmagan — yozuvlar telefonda saqlanib turibdi, sozlangach o‘zi yuboriladi.
              </p>
            )}
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Ishga chiqqanda bosing — ish vaqti hisoblanadi va ovoz yozila boshlaydi.
            </p>
            {bugungiTugagan.length > 0 && (
              <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                Bugun: {bugungiTugagan.map(b => `${soatMatni(b.boshlandi)}–${soatMatni(b.tugadi!)}`).join(', ')}
                <span className="text-gray-500 dark:text-gray-400"> · {davomiylikMatni(bugungiMs)}</span>
              </p>
            )}
            {(yozuv.holat === 'ruxsat_yoq' || yozuv.holat === 'qollanmaydi') && <YozuvHolatiQatori />}
            {navbat.soni > 0 && (
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <Loader2 size={13} className="animate-spin" aria-hidden />
                Oxirgi yozuvlar yuborilmoqda ({navbat.soni} ta) — ilovani yopmang
              </p>
            )}
          </>
        )}
      </div>

      <div className="px-4 sm:px-5 pb-4 sm:pb-5">
        {smena ? (
          <button
            type="button"
            onClick={() => void tugatishniBos()}
            disabled={s.band}
            className="w-full min-h-12 rounded-xl border-2 border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-400 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-60 transition"
          >
            {s.band ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Square size={16} aria-hidden />}
            Ishni tugallash
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void boshlashniBos()}
              disabled={s.band}
              className="w-full min-h-14 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-base flex items-center justify-center gap-2 disabled:opacity-60 transition shadow-sm"
            >
              {s.band ? <Loader2 size={20} className="animate-spin" aria-hidden /> : <Play size={20} aria-hidden />}
              {s.band ? 'Mikrofon ulanmoqda…' : 'Ishni boshlash'}
            </button>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <Mic size={13} aria-hidden /> Ish vaqtida mikrofon yoqiq bo‘ladi
            </p>
          </>
        )}
      </div>

      {rozilikOchiq && (
        <Modal
          olcham="sm"
          belgi={<ShieldCheck size={18} />}
          sarlavha="Ish vaqtida ovoz yozilishi"
          onYopish={() => setRozilikOchiq(false)}
          footer={<>
            <ModalBekor onClick={() => setRozilikOchiq(false)} />
            <ModalAsosiy
              type="button"
              rang="yashil"
              keng
              yuklanmoqda={s.band}
              onClick={async () => {
                if (!(await s.rozilikBer())) return
                setRozilikOchiq(false)
                await s.boshla()
              }}
            >
              Roziman — ishni boshlash
            </ModalAsosiy>
          </>}
        >
          <ul className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
            <li className="flex gap-2.5"><Mic size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden />
              Ish boshlanganidan tugaguncha telefon mikrofoni yoqiq bo‘ladi: atrofdagi barcha ovozlar, jumladan mijozlar bilan suhbatlar yozib olinadi.</li>
            <li className="flex gap-2.5"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden />
              Yozuvlarni faqat rahbariyat tinglaydi. Ular {server.saqlashKun} kun saqlanadi, keyin avtomatik o‘chiriladi.</li>
            <li className="flex gap-2.5"><Smartphone size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden />
              Yozuv ketayotgani ekranda doim ko‘rinib turadi. Ish vaqtida ilovani yopmang va ekranni qulflamang — aks holda yozuv uzilishi mumkin.</li>
            <li className="flex gap-2.5"><Square size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden />
              «Ishni tugallash»ni bosganingizda yozuv to‘xtaydi.</li>
          </ul>
        </Modal>
      )}
    </section>
  )
}

/** Yozuv holati va muammo bo'lsa — nima qilish kerakligi. */
function YozuvHolatiQatori() {
  const s = useSmena()
  if (!s) return null
  const { holat, xato } = s.yozuv

  if (holat === 'yozilmoqda' || holat === 'boshlanmoqda') {
    return (
      <div role="status" className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-red-50 dark:bg-red-950/30 px-3.5 py-3">
        <span className="flex items-center gap-2.5 text-sm font-medium text-red-700 dark:text-red-400">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600" />
          </span>
          {holat === 'boshlanmoqda' ? 'Mikrofon ulanmoqda…' : 'Ovoz yozilmoqda'}
        </span>
        <DarajaKorsatkichi daraja={s.daraja} faol={holat === 'yozilmoqda'} />
      </div>
    )
  }

  const yoriqnoma: Record<string, { sarlavha: string; matn: string; tugma?: string; xavfli?: boolean }> = {
    uzilgan: {
      sarlavha: 'Yozuv uzildi',
      matn: `${xato ? xato + '. ' : ''}Qo‘ng‘iroq tugagach yoki ilovaga qaytganingizda o‘zi qayta ulanadi.`,
      tugma: 'Hozir qayta ulash',
    },
    ruxsat_yoq: {
      sarlavha: 'Mikrofonga ruxsat yo‘q',
      matn: 'Brauzer manzil satridagi qulf (🔒) belgisini bosing → «Mikrofon» → «Ruxsat berish», so‘ng «Qayta ulash»ni bosing.',
      tugma: 'Qayta ulash',
      xavfli: true,
    },
    qollanmaydi: {
      sarlavha: 'Bu brauzer ovoz yozolmaydi',
      matn: 'Saytni Google Chrome (Android) yoki Safari’ning yangi versiyasida (iPhone) oching.',
      xavfli: true,
    },
    joy_yoq: {
      sarlavha: 'Telefonda joy tugayapti',
      matn: 'Yuborilmagan yozuvlar juda ko‘p. Internetga ulaning — yuborilgach yozuv davom etadi.',
      tugma: 'Qayta urinish',
    },
    toxtatilgan: {
      sarlavha: 'Yozuv to‘xtagan',
      matn: 'Ish davom etmoqda, lekin ovoz yozilmayapti.',
      tugma: 'Yozishni davom ettirish',
    },
  }
  const y = yoriqnoma[holat] ?? yoriqnoma.toxtatilgan

  return (
    <div
      role="alert"
      className={`mt-4 rounded-xl px-3.5 py-3 ${y.xavfli
        ? 'bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300'
        : 'bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-300'}`}
    >
      <p className="flex items-center gap-2 text-sm font-semibold">
        {holat === 'ruxsat_yoq' ? <MicOff size={16} aria-hidden /> : <AlertTriangle size={16} aria-hidden />}
        {y.sarlavha}
      </p>
      <p className="mt-1 text-xs leading-relaxed">{y.matn}</p>
      {y.tugma && s.server?.smena && (
        <button
          type="button"
          onClick={() => void s.qaytaUlan()}
          className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-white/80 dark:bg-neutral-900/60 border border-current/20 px-3 py-2 text-xs font-semibold"
        >
          <RefreshCw size={13} aria-hidden /> {y.tugma}
        </button>
      )}
    </div>
  )
}

/**
 * Boshqa sahifalarda ham yozuv ketayotgani ko'rinib tursin — sarlavha ostida
 * ingichka chiziq. Bosh sahifada (to'liq panel bor) ko'rsatilmaydi.
 */
export function SmenaIndikator() {
  const s = useSmena()
  const yol = usePathname()
  const smena = s?.server?.smena ?? null
  useSoniya(!!smena)
  if (!s?.mavjud || !smena || yol === '/') return null
  const muammo = s.yozuv.holat !== 'yozilmoqda' && s.yozuv.holat !== 'boshlanmoqda'
  return (
    <Link
      href="/"
      role="status"
      className={`shrink-0 flex items-center justify-between gap-3 px-4 lg:px-6 py-2 text-xs font-medium border-b transition ${
        muammo
          ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-300'
          : 'bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-950 text-red-700 dark:text-red-400'
      }`}
    >
      <span className="flex items-center gap-2 min-w-0">
        {muammo ? <AlertTriangle size={14} className="shrink-0" aria-hidden /> : (
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
          </span>
        )}
        <span className="truncate">
          {muammo ? 'Ovoz yozuvi to‘xtagan — tuzatish uchun bosing' : 'Ovoz yozilmoqda'}
        </span>
      </span>
      <span className="shrink-0 font-mono tabular-nums">
        Ishda {taymerMatni(s.vaqt() - new Date(smena.boshlandi).getTime())}
      </span>
    </Link>
  )
}
