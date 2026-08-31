'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Send, Check, X, Loader2, ChevronDown, ChevronUp, Bell, BellOff } from 'lucide-react'

interface Status {
  ulangan: boolean
  telefon: string | null
  foydalanuvchi: string | null
  bildirishnoma: boolean
  ulanganMijozlar: number
}

const inputCls = 'w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary transition text-sm'

export default function TelegramUlash() {
  const [status, setStatus] = useState<Status | null>(null)
  const [yuklanmoqda, setYuklanmoqda] = useState(true)
  const [ochiq, setOchiq] = useState(false)
  const [bosqich, setBosqich] = useState<'ulash' | 'tasdiqlash'>('ulash')
  const [amal, setAmal] = useState(false)

  const [apiId, setApiId] = useState('')
  const [apiHash, setApiHash] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [phoneCodeHash, setPhoneCodeHash] = useState('')
  const [testTelefon, setTestTelefon] = useState('')

  async function yuklash() {
    setYuklanmoqda(true)
    try {
      const data = await fetch('/api/telegram').then(r => r.json())
      setStatus(data)
      if (!data.ulangan) setOchiq(true)
    } catch {
      // jim
    } finally {
      setYuklanmoqda(false)
    }
  }

  useEffect(() => { yuklash() }, [])

  async function ulanish(e: React.FormEvent) {
    e.preventDefault()
    setAmal(true)
    try {
      const res = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect', apiId, apiHash, phone }),
      })
      const data = await res.json()
      if (data.ok) {
        setPhoneCodeHash(data.phoneCodeHash)
        setBosqich('tasdiqlash')
        toast.success('Tasdiqlash kodi yuborildi')
      } else {
        toast.error(data.xato || 'Xatolik yuz berdi')
      }
    } finally {
      setAmal(false)
    }
  }

  async function tasdiqlash(e: React.FormEvent) {
    e.preventDefault()
    setAmal(true)
    try {
      const res = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', apiId, apiHash, phone, code, phoneCodeHash, password: password || undefined }),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('Telegram ulandi')
        setBosqich('ulash')
        setCode(''); setPassword(''); setApiId(''); setApiHash(''); setPhone('')
        yuklash()
      } else {
        toast.error(data.xato || 'Xatolik yuz berdi')
      }
    } finally {
      setAmal(false)
    }
  }

  async function uzish() {
    setAmal(true)
    try {
      await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' }),
      })
      toast.success('Telegram uzildi')
      yuklash()
    } finally {
      setAmal(false)
    }
  }

  async function bildirishnomaToggle() {
    if (!status) return
    const yangi = !status.bildirishnoma
    setStatus({ ...status, bildirishnoma: yangi })
    await fetch('/api/telegram', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegram_bildirishnoma: yangi }),
    })
  }

  async function testYuborish() {
    if (!testTelefon.trim()) return
    setAmal(true)
    try {
      const res = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', telefon: testTelefon }),
      })
      const data = await res.json()
      if (data.ok) toast.success('Test xabar yuborildi')
      else toast.error(data.xato || 'Yuborilmadi')
    } finally {
      setAmal(false)
    }
  }

  if (yuklanmoqda) return null

  return (
    <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOchiq(v => !v)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition"
      >
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${status?.ulangan ? 'bg-green-50 dark:bg-green-950/30 text-green-600' : 'bg-gray-100 dark:bg-neutral-800 text-gray-400'}`}>
            <Send size={16} />
          </div>
          <div className="text-left">
            <p className="text-gray-900 dark:text-gray-100 font-semibold text-sm">Telegram bildirishnomalar</p>
            <p className="text-gray-400 dark:text-gray-600 text-xs">
              {status?.ulangan ? `Ulangan: ${status.foydalanuvchi || status.telefon}` : "Ulanmagan — mijozlarga xabar yuborilmaydi"}
            </p>
          </div>
        </div>
        {ochiq ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {ochiq && (
        <div className="p-4 pt-0 border-t border-gray-100 dark:border-neutral-800">
          {status?.ulangan ? (
            <div className="space-y-3 pt-3">
              <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-neutral-800 rounded-xl">
                <span className="flex items-center gap-2 text-gray-700 dark:text-gray-300 text-sm font-medium">
                  {status.bildirishnoma ? <Bell size={15} className="text-green-500" /> : <BellOff size={15} className="text-gray-400" />}
                  Xabarlar yuborilsin
                </span>
                <button onClick={bildirishnomaToggle} className={`text-xs px-2.5 py-1 rounded-lg font-medium transition ${status.bildirishnoma ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400' : 'bg-gray-200 dark:bg-neutral-700 text-gray-600 dark:text-gray-400'}`}>
                  {status.bildirishnoma ? 'Yoqilgan' : "O'chirilgan"}
                </button>
              </div>

              <div className="flex gap-2">
                <input value={testTelefon} onChange={e => setTestTelefon(e.target.value)} placeholder="+998 90 123 45 67 (test uchun)" className={inputCls} />
                <button onClick={testYuborish} disabled={amal || !testTelefon.trim()} className="px-4 py-2 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 disabled:opacity-50 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium transition whitespace-nowrap">
                  {amal ? <Loader2 size={14} className="animate-spin" /> : 'Test yuborish'}
                </button>
              </div>

              <button onClick={uzish} disabled={amal} className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center gap-1.5">
                <X size={14} /> Ulanishni uzish
              </button>
            </div>
          ) : bosqich === 'ulash' ? (
            <form onSubmit={ulanish} className="space-y-3 pt-3">
              <p className="text-gray-400 dark:text-gray-600 text-xs">
                API ID va API Hash ni <span className="text-blue-500">my.telegram.org</span> saytidan oling. Bu — mijozlarga chek yuboriladigan Telegram akkaunt (bot emas, real telefon raqam).
              </p>
              <input required value={apiId} onChange={e => setApiId(e.target.value)} placeholder="API ID" className={inputCls} />
              <input required value={apiHash} onChange={e => setApiHash(e.target.value)} placeholder="API Hash" className={inputCls} />
              <input required value={phone} onChange={e => setPhone(e.target.value)} placeholder="+998901234567" className={inputCls} />
              <button type="submit" disabled={amal} className="w-full py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-60 text-white rounded-xl font-medium transition flex items-center justify-center gap-2 text-sm">
                {amal ? <Loader2 size={16} className="animate-spin" /> : null}
                {amal ? 'Yuborilmoqda...' : 'Kod yuborish'}
              </button>
            </form>
          ) : (
            <form onSubmit={tasdiqlash} className="space-y-3 pt-3">
              <p className="text-gray-400 dark:text-gray-600 text-xs">Telegram&apos;ga kelgan tasdiqlash kodini kiriting.</p>
              <input required value={code} onChange={e => setCode(e.target.value)} placeholder="Kod" className={inputCls} />
              <input value={password} onChange={e => setPassword(e.target.value)} placeholder="2FA parol (agar yoqilgan bo'lsa)" type="password" className={inputCls} />
              <div className="flex gap-2">
                <button type="button" onClick={() => setBosqich('ulash')} className="flex-1 py-2.5 border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition font-medium text-sm">Orqaga</button>
                <button type="submit" disabled={amal} className="flex-1 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-60 text-white rounded-xl font-medium transition flex items-center justify-center gap-2 text-sm">
                  {amal ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  {amal ? 'Tekshirilmoqda...' : 'Tasdiqlash'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
