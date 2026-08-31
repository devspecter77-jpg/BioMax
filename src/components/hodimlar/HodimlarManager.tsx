'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Users, Plus, Pencil, Trash2, Eye, EyeOff,
  Check, X, ToggleLeft, ToggleRight, Save,
} from 'lucide-react'
import SearchBar from '@/components/ui/search-bar'
import Combobox from '@/components/ui/combobox'
import { useConfirm } from '@/components/ConfirmProvider'

const inputCls =
  'w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary transition'
const cardCls =
  'bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-6'
const labelCls = 'text-gray-700 dark:text-gray-300 text-sm mb-1 block font-medium'
const primaryBtn =
  'flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-medium transition'
const outlineBtn =
  'flex items-center gap-2 px-5 py-2.5 border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition font-medium'

type Rol = 'ADMIN' | 'KASSIR' | 'OMBORCHI' | 'SOTUVCHI'

interface Foydalanuvchi {
  id: string
  ism: string
  login: string
  rol: Rol
  faol: boolean
  telefon: string | null
  yaratilgan: string
  filialId: string | null
  filial: { id: string; nomi: string } | null
}

const ROL_MAP: Record<Rol, string> = {
  ADMIN: 'Administrator',
  KASSIR: 'Kassir',
  SOTUVCHI: 'Sotuvchi',
  OMBORCHI: 'Omborchi',
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4 pb-24 sm:pb-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl dark:border dark:border-neutral-800 w-full max-w-md max-h-[90vh] overflow-y-auto">
        {children}
      </div>
    </div>
  )
}

interface Props {
  /** Berilsa — faqat shu filial xodimlari ko'rsatiladi, yangi xodim shu filialga biriktiriladi. */
  filialId?: string
}

export default function HodimlarManager({ filialId: fixedFilialId }: Props) {
  const confirm = useConfirm()
  const [users, setUsers] = useState<Foydalanuvchi[]>([])
  const [filiallar, setFiliallar] = useState<{ id: string; nomi: string }[]>([])
  const [yuklanmoqda, setYuklanmoqda] = useState(true)
  const [modal, setModal] = useState<'new' | 'edit' | null>(null)
  const [tahrirlash, setTahrirlash] = useState<Foydalanuvchi | null>(null)
  const [showParol, setShowParol] = useState(false)
  const [qidiruv, setQidiruv] = useState('')

  const emptyNew = { ism: '', login: '', parol: '', rol: 'KASSIR' as Rol, telefon: '', telefon2: '', filialId: fixedFilialId || '' }
  const [newForm, setNewForm] = useState(emptyNew)

  const emptyEdit = { ism: '', rol: 'KASSIR' as Rol, parol: '', faol: true, telefon: '', telefon2: '', filialId: fixedFilialId || '' }
  const [editForm, setEditForm] = useState(emptyEdit)

  async function yuklash() {
    setYuklanmoqda(true)
    try {
      const url = fixedFilialId ? `/api/foydalanuvchilar?filialId=${fixedFilialId}` : '/api/foydalanuvchilar'
      const res = await fetch(url)
      const data = await res.json()
      setUsers(Array.isArray(data) ? data : [])
    } catch {
      toast.error('Foydalanuvchilarni yuklashda xatolik')
    } finally {
      setYuklanmoqda(false)
    }
  }

  useEffect(() => { yuklash() }, [fixedFilialId])

  useEffect(() => {
    if (fixedFilialId) return
    fetch('/api/filiallar')
      .then(r => r.json())
      .then(data => setFiliallar(Array.isArray(data) ? data.map((f: any) => ({ id: f.id, nomi: f.nomi })) : []))
      .catch(() => {})
  }, [fixedFilialId])

  function ochEditModal(user: Foydalanuvchi) {
    setTahrirlash(user)
    const nums = user.telefon ? user.telefon.split(',').map(t => t.trim()) : []
    setEditForm({
      ism: user.ism, rol: user.rol, parol: '', faol: user.faol,
      telefon: nums[0] || '', telefon2: nums[1] || '',
      filialId: fixedFilialId || user.filialId || '',
    })
    setShowParol(false)
    setModal('edit')
  }

  async function yangiYaratish(e: React.FormEvent) {
    e.preventDefault()
    if (newForm.rol !== 'ADMIN' && !newForm.filialId) { toast.error('Filial tanlang'); return }
    try {
      const telefonStr = [newForm.telefon, newForm.telefon2].filter(t => t.trim()).join(',') || null
      const body = {
        ism: newForm.ism, login: newForm.login, parol: newForm.parol, rol: newForm.rol,
        telefon: telefonStr, filialId: newForm.filialId || null,
      }
      const res = await fetch('/api/foydalanuvchilar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast.success("Xodim qo'shildi!")
        setModal(null)
        setNewForm(emptyNew)
        yuklash()
      } else {
        const err = await res.json()
        toast.error(err.xato || 'Xatolik yuz berdi')
      }
    } catch {
      toast.error('Tarmoq xatosi')
    }
  }

  async function yangilash(e: React.FormEvent) {
    e.preventDefault()
    if (!tahrirlash) return
    if (editForm.rol !== 'ADMIN' && !editForm.filialId) { toast.error('Filial tanlang'); return }
    try {
      const body: Record<string, unknown> = {
        ism: editForm.ism,
        rol: editForm.rol,
        faol: editForm.faol,
        telefon: [editForm.telefon, editForm.telefon2].filter(t => t.trim()).join(',') || null,
        filialId: editForm.filialId || null,
      }
      if (editForm.parol) body.parol = editForm.parol
      const res = await fetch(`/api/foydalanuvchilar/${tahrirlash.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast.success('Xodim yangilandi!')
        setModal(null)
        yuklash()
      } else {
        const err = await res.json()
        toast.error(err.xato || 'Xatolik yuz berdi')
      }
    } catch {
      toast.error('Tarmoq xatosi')
    }
  }

  async function ochirish(user: Foydalanuvchi) {
    if (!(await confirm(`"${user.ism}" xodimini o'chirishni tasdiqlaysizmi?`))) return
    try {
      const res = await fetch(`/api/foydalanuvchilar/${user.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success("Xodim o'chirildi!")
        yuklash()
      } else {
        toast.error("O'chirishda xatolik")
      }
    } catch {
      toast.error('Tarmoq xatosi')
    }
  }

  const filtered = users.filter(u =>
    !qidiruv || u.ism.toLowerCase().includes(qidiruv.toLowerCase()) || u.login.toLowerCase().includes(qidiruv.toLowerCase())
  )

  const filialOptions = filiallar.map(f => ({ value: f.id, label: f.nomi }))

  return (
    <>
      <div className={cardCls}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-primary" />
            <h2 className="text-gray-900 dark:text-gray-100 font-semibold text-lg">Xodimlar</h2>
          </div>
          <button onClick={() => { setModal('new'); setNewForm(emptyNew) }} className={primaryBtn}>
            <Plus size={16} />
            Yangi xodim
          </button>
        </div>

        <div className="mb-4">
          <SearchBar value={qidiruv} onChange={setQidiruv} placeholder="Ism yoki login bo'yicha qidirish..." debounceMs={0} />
        </div>

        <div className="overflow-x-auto -mx-6">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-neutral-800 border-y border-gray-200 dark:border-neutral-800">
                <th className="text-left text-gray-500 dark:text-gray-500 text-xs font-medium px-6 py-3">Ism</th>
                <th className="text-left text-gray-500 dark:text-gray-500 text-xs font-medium px-4 py-3 hidden sm:table-cell">Login</th>
                <th className="text-left text-gray-500 dark:text-gray-500 text-xs font-medium px-4 py-3">Rol</th>
                {!fixedFilialId && (
                  <th className="text-left text-gray-500 dark:text-gray-500 text-xs font-medium px-4 py-3 hidden md:table-cell">Filial</th>
                )}
                <th className="text-left text-gray-500 dark:text-gray-500 text-xs font-medium px-4 py-3">Holati</th>
                <th className="text-right text-gray-500 dark:text-gray-500 text-xs font-medium px-6 py-3">Amal</th>
              </tr>
            </thead>
            <tbody>
              {yuklanmoqda ? (
                <tr><td colSpan={6} className="text-center text-gray-400 dark:text-gray-600 py-10">Yuklanmoqda...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-gray-400 dark:text-gray-600 py-10">Xodimlar topilmadi</td></tr>
              ) : filtered.map(u => (
                <tr key={u.id} className="border-b border-gray-100 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-800 transition">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0">
                        {u.ism[0]?.toUpperCase()}
                      </div>
                      <span className="text-gray-900 dark:text-gray-100 text-sm font-medium">{u.ism}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-gray-500 dark:text-gray-500 text-sm font-mono">{u.login}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-primary-light dark:bg-primary/10 text-primary px-2 py-1 rounded-lg font-medium">
                      {ROL_MAP[u.rol] ?? u.rol}
                    </span>
                  </td>
                  {!fixedFilialId && (
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-gray-500 dark:text-gray-500 text-sm">{u.filial?.nomi || '—'}</span>
                    </td>
                  )}
                  <td className="px-4 py-3">
                    {u.faol ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 px-2 py-1 rounded-lg font-medium">
                        <Check size={12} /> Faol
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-gray-500 px-2 py-1 rounded-lg font-medium">
                        <X size={12} /> Nofaol
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => ochEditModal(u)} className="p-1.5 text-gray-400 dark:text-gray-600 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg transition" title="Tahrirlash">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => ochirish(u)} className="p-1.5 text-gray-400 dark:text-gray-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition" title="O'chirish">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal === 'new' && (
        <Modal onClose={() => setModal(null)}>
          <div className="p-5 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
            <h3 className="text-gray-900 dark:text-gray-100 font-semibold">Yangi xodim</h3>
            <button onClick={() => setModal(null)} className="p-1.5 text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition">
              <X size={18} />
            </button>
          </div>
          <form onSubmit={yangiYaratish} className="p-5 space-y-4">
            <div>
              <label className={labelCls}>Ism *</label>
              <input type="text" value={newForm.ism} onChange={e => setNewForm(f => ({ ...f, ism: e.target.value }))} required placeholder="To'liq ism" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Login *</label>
              <input type="text" value={newForm.login} onChange={e => setNewForm(f => ({ ...f, login: e.target.value }))} required placeholder="login_nomi" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Parol *</label>
              <div className="relative">
                <input type={showParol ? 'text' : 'password'} value={newForm.parol} onChange={e => setNewForm(f => ({ ...f, parol: e.target.value }))} required minLength={6} placeholder="Kamida 6 ta belgi" className={inputCls} />
                <button type="button" onClick={() => setShowParol(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition">
                  {showParol ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className={labelCls}>Rol *</label>
              <select value={newForm.rol} onChange={e => setNewForm(f => ({ ...f, rol: e.target.value as Rol }))} className={inputCls}>
                <option value="KASSIR">Kassir</option>
                <option value="OMBORCHI">Omborchi</option>
                <option value="ADMIN">Administrator</option>
              </select>
            </div>
            {!fixedFilialId && newForm.rol !== 'ADMIN' && (
              <div>
                <label className={labelCls}>Filial *</label>
                <Combobox options={filialOptions} value={newForm.filialId} onChange={v => setNewForm(f => ({ ...f, filialId: v }))} placeholder="Filial tanlang" searchPlaceholder="Filial qidirish..." />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Telefon 1</label>
                <input type="text" value={newForm.telefon} onChange={e => setNewForm(f => ({ ...f, telefon: e.target.value }))} placeholder="+998 90 000 00 00" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Telefon 2</label>
                <input type="text" value={newForm.telefon2} onChange={e => setNewForm(f => ({ ...f, telefon2: e.target.value }))} placeholder="+998 91 000 00 00" className={inputCls} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setModal(null)} className={outlineBtn}>Bekor qilish</button>
              <button type="submit" className={`${primaryBtn} flex-1 justify-center`}>
                <Plus size={16} />
                Qo&apos;shish
              </button>
            </div>
          </form>
        </Modal>
      )}

      {modal === 'edit' && tahrirlash && (
        <Modal onClose={() => setModal(null)}>
          <div className="p-5 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
            <h3 className="text-gray-900 dark:text-gray-100 font-semibold">Tahrirlash — {tahrirlash.ism}</h3>
            <button onClick={() => setModal(null)} className="p-1.5 text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition">
              <X size={18} />
            </button>
          </div>
          <form onSubmit={yangilash} className="p-5 space-y-4">
            <div>
              <label className={labelCls}>Ism *</label>
              <input type="text" value={editForm.ism} onChange={e => setEditForm(f => ({ ...f, ism: e.target.value }))} required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Rol *</label>
              <select value={editForm.rol} onChange={e => setEditForm(f => ({ ...f, rol: e.target.value as Rol }))} className={inputCls}>
                <option value="KASSIR">Kassir</option>
                <option value="OMBORCHI">Omborchi</option>
                <option value="ADMIN">Administrator</option>
              </select>
            </div>
            {!fixedFilialId && editForm.rol !== 'ADMIN' && (
              <div>
                <label className={labelCls}>Filial *</label>
                <Combobox options={filialOptions} value={editForm.filialId} onChange={v => setEditForm(f => ({ ...f, filialId: v }))} placeholder="Filial tanlang" searchPlaceholder="Filial qidirish..." />
              </div>
            )}
            <div>
              <label className={labelCls}>
                Yangi parol <span className="text-gray-400 dark:text-gray-600 font-normal">(ixtiyoriy)</span>
              </label>
              <div className="relative">
                <input type={showParol ? 'text' : 'password'} value={editForm.parol} onChange={e => setEditForm(f => ({ ...f, parol: e.target.value }))} minLength={6} placeholder="O'zgartirmaslik uchun bo'sh qoldiring" className={inputCls} />
                <button type="button" onClick={() => setShowParol(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition">
                  {showParol ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-neutral-800 rounded-xl">
              <span className="text-gray-700 dark:text-gray-300 text-sm font-medium">Faollik holati</span>
              <button type="button" onClick={() => setEditForm(f => ({ ...f, faol: !f.faol }))} className={`transition ${editForm.faol ? 'text-green-500' : 'text-gray-400 dark:text-gray-600'}`}>
                {editForm.faol ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Telefon 1</label>
                <input type="text" value={editForm.telefon} onChange={e => setEditForm(f => ({ ...f, telefon: e.target.value }))} placeholder="+998 90 000 00 00" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Telefon 2</label>
                <input type="text" value={editForm.telefon2} onChange={e => setEditForm(f => ({ ...f, telefon2: e.target.value }))} placeholder="+998 91 000 00 00" className={inputCls} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setModal(null)} className={outlineBtn}>Bekor qilish</button>
              <button type="submit" className={`${primaryBtn} flex-1 justify-center`}>
                <Save size={16} />
                Saqlash
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
