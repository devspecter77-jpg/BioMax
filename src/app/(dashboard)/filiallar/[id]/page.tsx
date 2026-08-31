'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { formatPhone } from '@/lib/utils'
import { toast } from 'sonner'
import { ArrowLeft, Building, MapPin, Phone, Pencil, X, ToggleLeft, ToggleRight, Save, Check, Package, Users, CreditCard } from 'lucide-react'
import PhoneInput from '@/components/ui/phone-input'
import HodimlarManager from '@/components/hodimlar/HodimlarManager'

interface Filial {
  id: string
  nomi: string
  manzil: string | null
  telefon: string | null
  faol: boolean
  yaratilgan: string
  _count: { xodimlar: number }
  tovarSoni: number
  mijozSoni: number
  qarzdorSoni: number
}

const inputCls = 'w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary transition'

export default function FilialDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [filial, setFilial] = useState<Filial | null>(null)
  const [yuklanmoqda, setYuklanmoqda] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ nomi: '', manzil: '', telefon: '', faol: true })

  async function yuklash() {
    setYuklanmoqda(true)
    const res = await fetch(`/api/filiallar/${id}`)
    if (res.ok) {
      const data = await res.json()
      setFilial(data)
    } else {
      toast.error('Filial topilmadi')
      router.push('/filiallar')
    }
    setYuklanmoqda(false)
  }

  useEffect(() => { yuklash() }, [id])

  function ochModal() {
    if (!filial) return
    setForm({ nomi: filial.nomi, manzil: filial.manzil || '', telefon: filial.telefon || '', faol: filial.faol })
    setModal(true)
  }

  async function saqlash(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch(`/api/filiallar/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      toast.success('Filial yangilandi')
      setModal(false)
      yuklash()
    } else {
      const err = await res.json()
      toast.error(err.xato || 'Xatolik yuz berdi')
    }
  }

  if (yuklanmoqda) {
    return <p className="text-gray-400 dark:text-gray-600 text-center py-12">Yuklanmoqda...</p>
  }
  if (!filial) return null

  return (
    <div className="space-y-4">
      <button
        onClick={() => router.push('/filiallar')}
        className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 text-sm font-medium transition"
      >
        <ArrowLeft size={16} />
        Filiallar
      </button>

      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-12 h-12 bg-primary-light dark:bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0">
            <Building size={22} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-gray-900 dark:text-gray-100 font-semibold text-lg">{filial.nomi}</h1>
              {filial.faol ? (
                <span className="inline-flex items-center gap-1 text-xs bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-lg font-medium">
                  <Check size={11} /> Faol
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-gray-500 px-2 py-0.5 rounded-lg font-medium">
                  <X size={11} /> Nofaol
                </span>
              )}
            </div>
            {filial.manzil && (
              <p className="text-gray-400 dark:text-gray-600 text-sm mt-1 flex items-center gap-1">
                <MapPin size={12} /> {filial.manzil}
              </p>
            )}
            {filial.telefon && (
              <p className="text-blue-500 text-sm flex items-center gap-1 mt-0.5">
                <Phone size={12} /> {formatPhone(filial.telefon)}
              </p>
            )}
          </div>
        </div>
        <button onClick={ochModal} className="p-2 text-gray-400 dark:text-gray-600 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg transition shrink-0" title="Tahrirlash">
          <Pencil size={16} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-gray-400 dark:text-gray-600 text-xs mb-1">
            <Package size={13} /> Tovarlar
          </div>
          <p className="text-gray-900 dark:text-gray-100 font-bold text-xl">{filial.tovarSoni} ta</p>
        </div>
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-gray-400 dark:text-gray-600 text-xs mb-1">
            <Users size={13} /> Mijozlar
          </div>
          <p className="text-gray-900 dark:text-gray-100 font-bold text-xl">{filial.mijozSoni} ta</p>
        </div>
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-gray-400 dark:text-gray-600 text-xs mb-1">
            <CreditCard size={13} /> Qarzdorlar
          </div>
          <p className={`font-bold text-xl ${filial.qarzdorSoni > 0 ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'}`}>{filial.qarzdorSoni} ta</p>
        </div>
      </div>

      <HodimlarManager filialId={filial.id} />

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4 pb-24 sm:pb-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl dark:shadow-none dark:border dark:border-neutral-800 w-full max-w-md">
            <div className="p-5 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-gray-900 dark:text-gray-100 font-semibold">Filialni tahrirlash</h3>
              <button onClick={() => setModal(false)} className="p-1.5 text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={saqlash} className="p-5 space-y-4">
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Filial nomi *</label>
                <input required value={form.nomi} onChange={e => setForm(p => ({ ...p, nomi: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Manzil</label>
                <input value={form.manzil} onChange={e => setForm(p => ({ ...p, manzil: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium">Telefon</label>
                <PhoneInput value={form.telefon} onChange={v => setForm(p => ({ ...p, telefon: v }))} />
              </div>
              <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-neutral-800 rounded-xl">
                <span className="text-gray-700 dark:text-gray-300 text-sm font-medium">Faollik holati</span>
                <button type="button" onClick={() => setForm(f => ({ ...f, faol: !f.faol }))} className={`transition ${form.faol ? 'text-green-500' : 'text-gray-400 dark:text-gray-600'}`}>
                  {form.faol ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                </button>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setModal(false)} className="flex-1 py-2.5 border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition font-medium">Bekor</button>
                <button type="submit" className="flex-1 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-medium transition flex items-center justify-center gap-2">
                  <Save size={16} />
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
