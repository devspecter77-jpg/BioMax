'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Check, Loader2, Pencil, Plus, Trash2, Users } from 'lucide-react'
import Modal from '@/components/ui/modal'
import { ROL_NOMI } from '@/lib/rollar'
import { useConfirm } from '@/components/ConfirmProvider'
import {
  RANGLAR, RANG_NOMI, rangKlassi,
  type KategoriyaQatori, type KategoriyaRangi, type KategoriyalarJavobi,
} from '@/lib/mijoz-kategoriya'

// Mijozlar kategoriyalari — administrator uchun: yaratish, nomlash, rang va
// KIMGA KO'RINISHI (barcha xodimlarga yoki tanlanganlarga). Xodim o'zi
// kiritgan mijozlarni doim ko'radi — bu yerda faqat qo'shimcha ochiladi.


interface Forma { nomi: string; rang: KategoriyaRangi; hammaga: boolean; xodimIdlar: string[] }
const BOSH_FORMA: Forma = { nomi: '', rang: 'kok', hammaga: false, xodimIdlar: [] }

export default function KategoriyalarOynasi({ malumot, onYopish, onOzgardi }: {
  malumot: KategoriyalarJavobi
  onYopish: () => void
  onOzgardi: () => void
}) {
  const confirm = useConfirm()
  /** Tahrirlanayotgan kategoriya id si yoki 'yangi' */
  const [tahrir, setTahrir] = useState<string | null>(malumot.kategoriyalar.length === 0 ? 'yangi' : null)
  const [forma, setForma] = useState<Forma>(BOSH_FORMA)
  const [band, setBand] = useState(false)

  function ochish(k: KategoriyaQatori | null) {
    setTahrir(k ? k.id : 'yangi')
    setForma(k
      ? { nomi: k.nomi, rang: (RANGLAR as readonly string[]).includes(k.rang) ? k.rang as KategoriyaRangi : 'kulrang', hammaga: k.hammaga, xodimIdlar: k.xodimIdlar ?? [] }
      : BOSH_FORMA)
  }

  async function saqla() {
    if (forma.nomi.trim().length < 2) { toast.error('Kategoriya nomini yozing'); return }
    setBand(true)
    try {
      const yangi = tahrir === 'yangi'
      const r = await fetch(yangi ? '/api/mijoz-kategoriyalar' : `/api/mijoz-kategoriyalar/${tahrir}`, {
        method: yangi ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...forma, nomi: forma.nomi.trim(), xodimIdlar: forma.hammaga ? [] : forma.xodimIdlar }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.xato ?? 'Saqlanmadi'); return }
      toast.success(yangi ? 'Kategoriya yaratildi' : 'Kategoriya saqlandi')
      setTahrir(null)
      onOzgardi()
    } catch {
      toast.error('Internet aloqasini tekshiring')
    } finally {
      setBand(false)
    }
  }

  async function ochir(k: KategoriyaQatori) {
    const ok = await confirm({
      title: 'Kategoriyani o‘chirish',
      message: `«${k.nomi}» o‘chiriladi. ${k.mijozlar ? `Undagi ${k.mijozlar} ta mijoz o‘chmaydi — kategoriyasiz qoladi.` : ''} Xodimlarga bu kategoriya orqali berilgan ko‘rinish ham yopiladi.`,
      confirmText: 'O‘chirish', danger: true,
    })
    if (!ok) return
    setBand(true)
    try {
      const r = await fetch(`/api/mijoz-kategoriyalar/${k.id}`, { method: 'DELETE' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.xato ?? 'O‘chirilmadi'); return }
      toast.success('Kategoriya o‘chirildi')
      if (tahrir === k.id) setTahrir(null)
      onOzgardi()
    } catch {
      toast.error('Internet aloqasini tekshiring')
    } finally {
      setBand(false)
    }
  }

  const xodimNomi = new Map(malumot.xodimlar.map(x => [x.id, x.ism]))
  const kimga = (k: KategoriyaQatori) => {
    if (k.hammaga) return 'Barcha xodimlarga'
    const n = k.xodimIdlar?.length ?? 0
    if (n === 0) return 'Faqat administratorlarga'
    if (n <= 2) return (k.xodimIdlar ?? []).map(id => xodimNomi.get(id) ?? '—').join(', ')
    return `${n} ta xodimga`
  }

  const formaKorinishi = (
    <div className="space-y-3 rounded-2xl border border-primary/30 bg-primary/[0.03] p-3.5">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Nomi</span>
        <input
          value={forma.nomi} onChange={e => setForma({ ...forma, nomi: e.target.value })} maxLength={40} autoFocus
          placeholder="Masalan: Ulgurji, Do‘konlar, Umumiy"
          className="w-full px-3 py-2.5 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
          suppressHydrationWarning
        />
      </label>
      <div className="space-y-1.5">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Rang</span>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Rang">
          {RANGLAR.map(r => (
            <button
              key={r} type="button" role="radio" aria-checked={forma.rang === r} aria-label={RANG_NOMI[r]} title={RANG_NOMI[r]}
              onClick={() => setForma({ ...forma, rang: r })}
              style={{ minWidth: 32, minHeight: 32 }}
              className={`grid place-items-center rounded-full border-2 transition ${forma.rang === r ? 'border-gray-900 dark:border-gray-100' : 'border-transparent'}`}
            >
              <span className={`grid h-6 w-6 place-items-center rounded-full ${rangKlassi(r).nuqta}`}>
                {forma.rang === r && <Check size={13} className="text-white" />}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Barcha xodimlarga ko‘rinadi</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Masalan umumiy mijozlar uchun. Yopiq bo‘lsa — faqat tanlangan xodimlarga</p>
        </div>
        <button
          type="button" role="switch" aria-checked={forma.hammaga} aria-label="Barcha xodimlarga ko‘rinadi"
          onClick={() => setForma({ ...forma, hammaga: !forma.hammaga })}
          className={`relative shrink-0 w-11 h-6 rounded-full transition ${forma.hammaga ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-neutral-700'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition ${forma.hammaga ? 'translate-x-5' : ''}`} />
        </button>
      </div>

      {!forma.hammaga && (
        <div className="space-y-1.5">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Qaysi xodimlarga ko‘rinadi</span>
          {malumot.xodimlar.length === 0 ? (
            <p className="text-xs text-gray-500">Xodim yo‘q — faqat administratorlar ko‘radi.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {malumot.xodimlar.map(x => {
                const tanlangan = forma.xodimIdlar.includes(x.id)
                return (
                  <button
                    key={x.id} type="button" aria-pressed={tanlangan}
                    onClick={() => setForma({ ...forma, xodimIdlar: tanlangan ? forma.xodimIdlar.filter(i => i !== x.id) : [...forma.xodimIdlar, x.id] })}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      tanlangan
                        ? 'border-primary bg-primary text-white'
                        : 'border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:border-primary/60'
                    } ${x.faol ? '' : 'opacity-60'}`}
                  >
                    {tanlangan && <Check size={12} aria-hidden />}
                    {x.ism}
                    <span className={tanlangan ? 'text-white/75' : 'text-gray-400'}>· {ROL_NOMI[x.rol] ?? x.rol}</span>
                  </button>
                )
              })}
            </div>
          )}
          <p className="text-[11px] text-gray-500 dark:text-gray-400">Xodimga kategoriyani «Ruxsatlar» bo‘limidan ham ochish mumkin.</p>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={() => setTahrir(null)} disabled={band}
          className="flex-1 min-h-10 rounded-xl border border-gray-300 dark:border-neutral-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-50">
          Bekor
        </button>
        <button type="button" onClick={() => void saqla()} disabled={band}
          className="flex-[2] min-h-10 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
          {band && <Loader2 size={15} className="animate-spin" />} {tahrir === 'yangi' ? 'Yaratish' : 'Saqlash'}
        </button>
      </div>
    </div>
  )

  return (
    <Modal
      sarlavha="Mijozlar kategoriyalari"
      belgi={<Users size={18} />}
      tavsif="Mijozlarni guruhlang va har bir guruh qaysi xodimlarga ko‘rinishini belgilang. Xodim o‘zi kiritgan mijozlarni doim ko‘radi, boshqalarnikini — yo‘q."
      onYopish={onYopish}
      yopishMumkin={!band}
      olcham="lg"
    >
      <div className="space-y-3">
        {malumot.faqatAdmin > 0 && (
          <p className="flex gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/20 px-3 py-2.5 text-sm text-amber-900 dark:text-amber-300">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>
              <b>{malumot.faqatAdmin} ta mijoz</b> faqat administratorlarga ko‘rinadi — ularga mas’ul xodim biriktiring
              yoki xodimlarga ochiq kategoriyaga o‘tkazing (ro‘yxatda «Tanlash» orqali birdaniga).
            </span>
          </p>
        )}

        {tahrir === 'yangi' ? formaKorinishi : (
          <button type="button" onClick={() => ochish(null)}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 dark:border-neutral-700 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:border-primary hover:text-primary transition">
            <Plus size={16} /> Yangi kategoriya
          </button>
        )}

        {malumot.kategoriyalar.length > 0 && (
          <ul className="divide-y divide-gray-100 dark:divide-neutral-800 rounded-2xl border border-gray-200 dark:border-neutral-800">
            {malumot.kategoriyalar.map(k => (
              <li key={k.id} className="p-3">
                {tahrir === k.id ? formaKorinishi : (
                  <div className="flex items-center gap-3">
                    <span className={`h-3 w-3 shrink-0 rounded-full ${rangKlassi(k.rang).nuqta}`} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{k.nomi}</p>
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">{k.mijozlar} ta mijoz · {kimga(k)}</p>
                    </div>
                    <button type="button" onClick={() => ochish(k)} disabled={band} title="Tahrirlash" aria-label={`${k.nomi} — tahrirlash`}
                      className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-primary dark:hover:bg-neutral-800">
                      <Pencil size={15} />
                    </button>
                    <button type="button" onClick={() => void ochir(k)} disabled={band} title="O‘chirish" aria-label={`${k.nomi} — o‘chirish`}
                      className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30">
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
