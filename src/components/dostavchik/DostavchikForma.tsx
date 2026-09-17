'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, X } from 'lucide-react'
import PhoneInput from '@/components/ui/phone-input'
import LokatsiyaTanlash from '@/components/LokatsiyaTanlash'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { MAX_TELEFON } from '@/lib/mijoz-telefon'
import { TRANSPORT_TURLARI, type DostavchikQisqa, type TransportTuri } from '@/lib/dostavchik'

// Dostavchik qo'shish yoki tahrirlash. Yaratishda tizimga kirish uchun login
// va parol so'raladi; tahrirlashda parol ixtiyoriy (bo'sh — o'zgarmaydi).

const inputCls =
  'w-full px-3 py-2.5 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500'

type Tahrir = Pick<
  DostavchikQisqa,
  'id' | 'ism' | 'login' | 'faol' | 'telefon' | 'qoshimchaTelefonlar' | 'transportTuri' | 'transportNomi' | 'davlatRaqami' | 'manzil' | 'manzilLat' | 'manzilLng'
> & { izoh?: string | null }

export default function DostavchikForma({ tahrir, onYopish, onSaqlandi }: {
  /** Berilsa — tahrirlash rejimi */
  tahrir?: Tahrir | null
  onYopish: () => void
  onSaqlandi: (id: string) => void
}) {
  useBodyScrollLock(true)
  const [ism, setIsm] = useState(tahrir?.ism ?? '')
  const [login, setLogin] = useState(tahrir?.login ?? '')
  const [parol, setParol] = useState('')
  const [telefon, setTelefon] = useState(tahrir?.telefon ?? '')
  // Qo'shimcha raqamlar: yaratishda bitta bo'sh maydon tayyor turadi
  const [qoshimcha, setQoshimcha] = useState<string[]>(tahrir ? tahrir.qoshimchaTelefonlar : [''])
  const [transportTuri, setTransportTuri] = useState<TransportTuri>(tahrir?.transportTuri ?? 'AVTOMOBIL')
  const [transportNomi, setTransportNomi] = useState(tahrir?.transportNomi ?? '')
  const [davlatRaqami, setDavlatRaqami] = useState(tahrir?.davlatRaqami ?? '')
  const [manzil, setManzil] = useState(tahrir?.manzil ?? '')
  const [nuqta, setNuqta] = useState<{ lat: number | null; lng: number | null }>({
    lat: tahrir?.manzilLat ?? null,
    lng: tahrir?.manzilLng ?? null,
  })
  const [izoh, setIzoh] = useState(tahrir?.izoh ?? '')
  const [faol, setFaol] = useState(tahrir?.faol ?? true)
  const [band, setBand] = useState(false)

  const mashinali = transportTuri !== 'PIYODA'
  const raqamli = transportTuri !== 'PIYODA' && transportTuri !== 'VELOSIPED'
  const raqamlarSoni = 1 + qoshimcha.length

  async function saqla(e: React.FormEvent) {
    e.preventDefault()
    setBand(true)
    try {
      const j = await fetch(tahrir ? `/api/namuna-tovar/dostavchiklar/${tahrir.id}` : '/api/namuna-tovar/dostavchiklar', {
        method: tahrir ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ism, telefon, qoshimchaTelefonlar: qoshimcha, transportTuri, transportNomi, davlatRaqami, izoh,
          manzil, manzilLat: nuqta.lat, manzilLng: nuqta.lng,
          ...(tahrir ? { faol, parol: parol || undefined } : { login, parol }),
        }),
      })
      const d = await j.json().catch(() => ({}))
      if (!j.ok) {
        toast.error(d.xato ?? 'Saqlanmadi')
        return
      }
      toast.success(tahrir ? 'Dostavchik ma’lumotlari saqlandi' : `${d.ism} qo‘shildi — «${d.login}» bilan kira oladi`)
      onSaqlandi(tahrir?.id ?? d.id)
    } catch {
      toast.error('Internet aloqasini tekshiring')
    } finally {
      setBand(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-[60] p-0 sm:p-4" onClick={() => !band && onYopish()}>
      <form
        onSubmit={saqla}
        onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-neutral-900 rounded-t-2xl sm:rounded-2xl shadow-xl dark:border dark:border-neutral-800 w-full max-w-lg max-h-[92dvh] flex flex-col"
      >
        <div className="p-4 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
          <h3 className="text-gray-900 dark:text-gray-100 font-semibold">{tahrir ? 'Dostavchikni tahrirlash' : 'Yangi dostavchik'}</h3>
          <button type="button" onClick={onYopish} aria-label="Yopish"
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <Maydon label="Ism familiya *" htmlFor="d-ism">
            <input id="d-ism" value={ism} onChange={e => setIsm(e.target.value)} required minLength={2} maxLength={80}
              placeholder="Aziz Karimov" className={inputCls} />
          </Maydon>

          {!tahrir && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Maydon label="Login *" izoh="tizimga kirish uchun" htmlFor="d-login">
                <input id="d-login" value={login} onChange={e => setLogin(e.target.value.replace(/\s/g, ''))} required minLength={3} maxLength={40}
                  autoComplete="off" placeholder="aziz" className={inputCls} />
              </Maydon>
              <Maydon label="Parol *" izoh="kamida 6 belgi" htmlFor="d-parol">
                <input id="d-parol" type="text" value={parol} onChange={e => setParol(e.target.value)} required minLength={6}
                  autoComplete="new-password" placeholder="••••••" className={inputCls} />
              </Maydon>
            </div>
          )}

          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Telefon raqamlari *</legend>
            <PhoneInput value={telefon} onChange={setTelefon} required />
            {qoshimcha.map((t, i) => (
              <div key={i} className="flex gap-2">
                <div className="flex-1">
                  <PhoneInput value={t} onChange={v => setQoshimcha(q => q.map((x, j) => (j === i ? v : x)))}
                    placeholder="Qo‘shimcha raqam" />
                </div>
                <button type="button" onClick={() => setQoshimcha(q => q.filter((_, j) => j !== i))}
                  aria-label="Raqamni olib tashlash"
                  className="shrink-0 w-10 flex items-center justify-center rounded-xl border border-gray-200 dark:border-neutral-700 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {raqamlarSoni < MAX_TELEFON && (
              <button type="button" onClick={() => setQoshimcha(q => [...q, ''])}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                <Plus size={15} /> Yana raqam qo‘shish
              </button>
            )}
          </fieldset>

          <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 p-3 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Nima haydaydi</p>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Transport turi">
              {TRANSPORT_TURLARI.map(t => (
                <button key={t.qiymat} type="button" role="radio" aria-checked={transportTuri === t.qiymat}
                  onClick={() => setTransportTuri(t.qiymat)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                    transportTuri === t.qiymat
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800'
                  }`}>
                  {t.nomi}
                </button>
              ))}
            </div>
            {mashinali && (
              <div className={`grid gap-3 ${raqamli ? 'sm:grid-cols-[1fr_10rem]' : ''}`}>
                <Maydon label="Rusumi va rangi" htmlFor="d-transport">
                  <input id="d-transport" value={transportNomi} onChange={e => setTransportNomi(e.target.value)} maxLength={80}
                    placeholder={transportTuri === 'VELOSIPED' ? 'Stels, qora' : 'Chevrolet Damas, oq'} className={inputCls} />
                </Maydon>
                {raqamli && (
                  <Maydon label="Davlat raqami" htmlFor="d-raqam">
                    <input id="d-raqam" value={davlatRaqami} onChange={e => setDavlatRaqami(e.target.value.toUpperCase())} maxLength={20}
                      placeholder="01 A 123 BC" className={`${inputCls} font-mono uppercase`} />
                  </Maydon>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 p-3 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Manzili</p>
            <Maydon label="Yashash yoki ish manzili" izoh="ixtiyoriy" htmlFor="d-manzil">
              <input id="d-manzil" value={manzil} onChange={e => setManzil(e.target.value)} maxLength={200}
                placeholder="Chilonzor tumani, Bunyodkor 12, 4-uy" className={inputCls} />
            </Maydon>
            {/* Joylashuvni belgilash: joriy GPS, xaritadan bosish yoki Google/Yandex havolasi */}
            <LokatsiyaTanlash
              lat={nuqta.lat}
              lng={nuqta.lng}
              onChange={(lat, lng) => setNuqta({ lat, lng })}
              nomi={ism.trim() || 'Dostavchik manzili'}
              turi="xodim"
            />
            <p className="text-[11.5px] text-gray-500 dark:text-gray-400">
              Bu — doimiy manzil. Dostavchikning <b>hozirgi</b> joylashuvi esa u ilovani telefonida ochganda o‘zi yangilanadi.
            </p>
          </div>

          <Maydon label="Izoh" htmlFor="d-izoh">
            <input id="d-izoh" value={izoh} onChange={e => setIzoh(e.target.value)} maxLength={300}
              placeholder="Qaysi hududlarga boradi, ish vaqti…" className={inputCls} />
          </Maydon>

          {tahrir && (
            <>
              <Maydon label="Yangi parol" izoh="bo‘sh qoldirilsa o‘zgarmaydi" htmlFor="d-yangi-parol">
                <input id="d-yangi-parol" type="text" value={parol} onChange={e => setParol(e.target.value)} minLength={6}
                  autoComplete="new-password" placeholder="••••••" className={inputCls} />
              </Maydon>
              <label className="flex items-start gap-3 rounded-xl border border-gray-200 dark:border-neutral-800 p-3 cursor-pointer">
                <input type="checkbox" checked={faol} onChange={e => setFaol(e.target.checked)} className="mt-0.5 h-4 w-4 accent-red-600" />
                <span className="text-sm">
                  <span className="font-medium text-gray-900 dark:text-gray-100">Faol</span>
                  <span className="block text-gray-500 dark:text-gray-400">O‘chirilsa tizimga kira olmaydi va unga buyurtma biriktirilmaydi. Tarixi saqlanadi.</span>
                </span>
              </label>
            </>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-neutral-800 flex gap-2">
          <button type="button" onClick={onYopish} disabled={band}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800">
            Bekor qilish
          </button>
          <button type="submit" disabled={band}
            className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
            {band && <Loader2 size={15} className="animate-spin" />} {tahrir ? 'Saqlash' : 'Dostavchik qo‘shish'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Maydon({ label, izoh, htmlFor, children }: { label: string; izoh?: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="flex items-baseline justify-between gap-2 text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
        <span>{label}</span>
        {izoh && <span className="font-normal text-gray-400">{izoh}</span>}
      </label>
      {children}
    </div>
  )
}
