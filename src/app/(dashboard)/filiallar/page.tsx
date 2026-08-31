'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatPhone } from '@/lib/utils'
import { toast } from 'sonner'
import { Phone, MapPin, Building, X, Users, Check, UserPlus, Eye, EyeOff, Pencil, Trash2, Loader2, ToggleLeft, ToggleRight, Save } from 'lucide-react'
import PhoneInput from '@/components/ui/phone-input'
import SearchBar from '@/components/ui/search-bar'
import { useConfirm } from '@/components/ConfirmProvider'
import TelegramUlash from '@/components/TelegramUlash'

interface Filial {
  id: string
  nomi: string
  manzil: string | null
  telefon: string | null
  faol: boolean
  yaratilgan: string
  _count: { xodimlar: number }
}

const inputCls = 'w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary transition'

export default function FiliallarPage() {
  const router = useRouter()
  const confirm = useConfirm()
  const [filiallar, setFiliallar] = useState<Filial[]>([])
  const [yuklanmoqda, setYuklanmoqda] = useState(true)
  const [modal, setModal] = useState(false)
  const [saqlanmoqda, setSaqlanmoqda] = useState(false)
  const [parolKorinsin, setParolKorinsin] = useState(false)
  const emptyForm = { nomi: '', manzil: '', telefon: '', egaIsm: '', egaLogin: '', egaParol: '' }
  const [form, setForm] = useState(emptyForm)
  const [qidiruv, setQidiruv] = useState('')
  const [ochirilayotganId, setOchirilayotganId] = useState<string | null>(null)

  const [tahrirModal, setTahrirModal] = useState(false)
  const [tahrirId, setTahrirId] = useState<string | null>(null)
  const [tahrirSaqlanmoqda, setTahrirSaqlanmoqda] = useState(false)
  const emptyTahrirForm = { nomi: '', manzil: '', telefon: '', faol: true }
  const [tahrirForm, setTahrirForm] = useState(emptyTahrirForm)

  async function yuklash() {
    setYuklanmoqda(true)
    const data = await fetch('/api/filiallar').then(r => r.json())
    setFiliallar(Array.isArray(data) ? data : [])
    setYuklanmoqda(false)
  }

  useEffect(() => { yuklash() }, [])

  async function saqlash(e: React.FormEvent) {
    e.preventDefault()
    setSaqlanmoqda(true)
    try {
      const filialRes = await fetch('/api/filiallar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomi: form.nomi, manzil: form.manzil, telefon: form.telefon }),
      })
      if (!filialRes.ok) {
        const err = await filialRes.json()
        toast.error(err.xato || 'Filial yaratilmadi')
        return
      }
      const filial = await filialRes.json()

      const egaRes = await fetch('/api/foydalanuvchilar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ism: form.egaIsm, login: form.egaLogin, parol: form.egaParol,
          rol: 'ADMIN', filialId: filial.id,
        }),
      })
      if (!egaRes.ok) {
        const err = await egaRes.json()
        toast.error("Filial yaratildi, lekin ega qo'shilmadi: " + (err.xato || 'Xatolik'))
        setModal(false)
        setForm(emptyForm)
        yuklash()
        return
      }

      toast.success('Filial va uning egasi qo\'shildi')
      setModal(false)
      setForm(emptyForm)
      yuklash()
    } finally {
      setSaqlanmoqda(false)
    }
  }

  function tahrirlashOch(f: Filial) {
    setTahrirId(f.id)
    setTahrirForm({ nomi: f.nomi, manzil: f.manzil || '', telefon: f.telefon || '', faol: f.faol })
    setTahrirModal(true)
  }

  async function tahrirlashSaqlash(e: React.FormEvent) {
    e.preventDefault()
    if (!tahrirId) return
    setTahrirSaqlanmoqda(true)
    try {
      const res = await fetch(`/api/filiallar/${tahrirId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tahrirForm),
      })
      if (res.ok) {
        toast.success('Filial yangilandi')
        setTahrirModal(false)
        yuklash()
      } else {
        const err = await res.json()
        toast.error(err.xato || 'Xatolik yuz berdi')
      }
    } finally {
      setTahrirSaqlanmoqda(false)
    }
  }

  async function ochirish(f: Filial) {
    if (!(await confirm(`"${f.nomi}" filialni o'chirasizmi?`))) return
    setOchirilayotganId(f.id)
    try {
      const res = await fetch(`/api/filiallar/${f.id}`, { method: 'DELETE' })
      if (res.ok) { toast.success("Filial o'chirildi"); yuklash() }
      else {
        const err = await res.json()
        toast.error(err.xato || "O'chirishda xatolik")
      }
    } finally {
      setOchirilayotganId(null)
    }
  }

  const filtered = filiallar.filter(f =>
    !qidiruv || f.nomi.toLowerCase().includes(qidiruv.toLowerCase()) || (f.manzil?.toLowerCase().includes(qidiruv.toLowerCase()))
  )

  return (
    <div className="space-y-4">
      <TelegramUlash />

      <SearchBar value={qidiruv} onChange={setQidiruv} placeholder="Filial nomi yoki manzil bo'yicha qidirish..." debounceMs={0} />

      <div className="flex justify-end">
        <button onClick={() => setModal(true)} className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-medium transition">
          <UserPlus size={16} />
          Filial egasini qo&apos;shish
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {yuklanmoqda ? (
          <p className="text-gray-400 dark:text-gray-600 col-span-3 text-center py-12">Yuklanmoqda...</p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-400 dark:text-gray-600 col-span-3 text-center py-12">Hech narsa topilmadi</p>
        ) : filtered.map(f => (
          <div
            key={f.id}
            onClick={() => router.push(`/filiallar/${f.id}`)}
            className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 hover:shadow-md hover:border-primary/30 transition-shadow cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-gray-900 dark:text-gray-100 font-semibold">{f.nomi}</p>
                  {f.faol ? (
                    <span className="inline-flex items-center gap-1 text-xs bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-lg font-medium">
                      <Check size={11} /> Faol
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-gray-500 px-2 py-0.5 rounded-lg font-medium">
                      <X size={11} /> Nofaol
                    </span>
                  )}
                </div>
                {f.manzil && (
                  <p className="text-gray-400 dark:text-gray-600 text-sm mt-1 flex items-center gap-1">
                    <MapPin size={12} /> {f.manzil}
                  </p>
                )}
                {f.telefon && (
                  <p className="text-blue-500 text-sm flex items-center gap-1 mt-0.5">
                    <Phone size={12} /> {formatPhone(f.telefon)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <button
                  onClick={e => { e.stopPropagation(); tahrirlashOch(f) }}
                  className="p-2 text-gray-400 dark:text-gray-600 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition"
                  title="Tahrirlash"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); ochirish(f) }}
                  disabled={ochirilayotganId === f.id}
                  className="p-2 text-gray-400 dark:text-gray-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition disabled:opacity-50"
                  title="O'chirish"
                >
                  {ochirilayotganId === f.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                </button>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-neutral-800 flex items-center gap-1.5 text-gray-500 dark:text-gray-500 text-sm">
              <Users size={13} />
              {f._count.xodimlar} ta xodim
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4 pb-24 sm:pb-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl dark:shadow-none dark:border dark:border-neutral-800 w-full max-w-md">
            <div className="p-5 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-gray-900 dark:text-gray-100 font-semibold">Filial va uning egasi</h3>
              <button onClick={() => setModal(false)} className="p-1.5 text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={saqlash} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-500 text-xs font-semibold uppercase tracking-wide">
                <Building size={13} /> Filial ma&apos;lumotlari
              </div>
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Filial nomi *</label>
                <input required value={form.nomi} onChange={e => setForm(p => ({ ...p, nomi: e.target.value }))} placeholder="Masalan: Chilonzor filiali" className={inputCls} />
              </div>
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Manzil</label>
                <input value={form.manzil} onChange={e => setForm(p => ({ ...p, manzil: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Filial telefoni</label>
                <PhoneInput value={form.telefon} onChange={v => setForm(p => ({ ...p, telefon: v }))} />
              </div>

              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-500 text-xs font-semibold uppercase tracking-wide pt-2 border-t border-gray-100 dark:border-neutral-800">
                <UserPlus size={13} /> Filial egasi
              </div>
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Ega ismi *</label>
                <input required value={form.egaIsm} onChange={e => setForm(p => ({ ...p, egaIsm: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Telefon raqami (login) *</label>
                <PhoneInput required value={form.egaLogin} onChange={v => setForm(p => ({ ...p, egaLogin: v }))} />
              </div>
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Parol *</label>
                <div className="relative">
                  <input
                    required
                    type={parolKorinsin ? 'text' : 'password'}
                    value={form.egaParol}
                    onChange={e => setForm(p => ({ ...p, egaParol: e.target.value }))}
                    className={inputCls + ' pr-10'}
                  />
                  <button
                    type="button"
                    onClick={() => setParolKorinsin(v => !v)}
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {parolKorinsin ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setModal(false)} className="flex-1 py-2.5 border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition font-medium">Bekor</button>
                <button type="submit" disabled={saqlanmoqda} className="flex-1 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-60 text-white rounded-xl font-medium transition">
                  {saqlanmoqda ? 'Saqlanmoqda...' : "Qo'shish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {tahrirModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4 pb-24 sm:pb-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl dark:shadow-none dark:border dark:border-neutral-800 w-full max-w-md">
            <div className="p-5 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-gray-900 dark:text-gray-100 font-semibold">Filialni tahrirlash</h3>
              <button onClick={() => setTahrirModal(false)} className="p-1.5 text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={tahrirlashSaqlash} className="p-5 space-y-4">
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Filial nomi *</label>
                <input required value={tahrirForm.nomi} onChange={e => setTahrirForm(p => ({ ...p, nomi: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Manzil</label>
                <input value={tahrirForm.manzil} onChange={e => setTahrirForm(p => ({ ...p, manzil: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Telefon</label>
                <PhoneInput value={tahrirForm.telefon} onChange={v => setTahrirForm(p => ({ ...p, telefon: v }))} />
              </div>
              <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-neutral-800 rounded-xl">
                <span className="text-gray-700 dark:text-gray-300 text-sm font-medium">Faollik holati</span>
                <button type="button" onClick={() => setTahrirForm(f => ({ ...f, faol: !f.faol }))} className={`transition ${tahrirForm.faol ? 'text-green-500' : 'text-gray-400 dark:text-gray-600'}`}>
                  {tahrirForm.faol ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                </button>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setTahrirModal(false)} className="flex-1 py-2.5 border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition font-medium">Bekor</button>
                <button type="submit" disabled={tahrirSaqlanmoqda} className="flex-1 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-60 text-white rounded-xl font-medium transition flex items-center justify-center gap-2">
                  {tahrirSaqlanmoqda ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {tahrirSaqlanmoqda ? 'Saqlanmoqda...' : 'Saqlash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
