'use client'

import { useState } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Loader2, Eye, EyeOff, Lock, AlertCircle } from 'lucide-react'
import PhoneInput from '@/components/ui/phone-input'

export default function LoginForm() {
  const router = useRouter()
  const [login, setLogin] = useState('')
  const [parol, setParol] = useState('')
  const [xato, setXato] = useState('')
  const [yuklanmoqda, setYuklanmoqda] = useState(false)
  const [parolKorinsin, setParolKorinsin] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setXato('')
    setYuklanmoqda(true)

    const natija = await signIn('credentials', {
      login,
      parol,
      redirect: false,
    })

    setYuklanmoqda(false)

    if (natija?.error) {
      setXato("Login yoki parol noto'g'ri!")
    } else {
      await getSession()
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl shadow-black/5 dark:shadow-none border border-gray-100 dark:border-neutral-800 p-8">

      <div className="mb-7">
        <h2 className="text-xl font-bold text-primary">Tizimga kirish</h2>
        <p className="text-gray-500 dark:text-gray-500 text-sm mt-1">Hisobingizga kiring</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Telefon raqam input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Telefon raqam
          </label>
          <PhoneInput
            value={login}
            onChange={setLogin}
            required
            className="py-3 rounded-xl bg-gray-50 dark:bg-neutral-800 focus-within:ring-primary"
          />
        </div>

        {/* Parol input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Parol
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Lock size={16} className="text-gray-400 dark:text-gray-500" />
            </div>
            <input
              type={parolKorinsin ? 'text' : 'password'}
              value={parol}
              onChange={(e) => setParol(e.target.value)}
              placeholder="Parolni kiriting"
              required
              autoComplete="current-password"
              className="w-full pl-10 pr-11 py-3 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent focus:bg-white dark:focus:bg-neutral-800 transition-all text-sm"
            />
            <button
              type="button"
              onClick={() => setParolKorinsin(!parolKorinsin)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              tabIndex={-1}
              aria-label={parolKorinsin ? 'Parolni yashirish' : 'Parolni ko\'rish'}
            >
              {parolKorinsin ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Xato xabari */}
        {xato && (
          <div className="flex items-center gap-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl px-4 py-3">
            <AlertCircle size={15} className="text-red-500 shrink-0" />
            <p className="text-red-600 dark:text-red-400 text-sm">{xato}</p>
          </div>
        )}

        {/* Kirish tugmasi */}
        <button
          type="submit"
          disabled={yuklanmoqda || !login || !parol}
          className="w-full py-3 bg-primary hover:bg-primary-hover active:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-150 shadow-md shadow-primary/25 mt-2"
        >
          {yuklanmoqda ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="animate-spin w-4 h-4" />
              Kirmoqda...
            </span>
          ) : 'Kirish'}
        </button>
      </form>

      <p className="text-gray-400 dark:text-gray-600 text-xs text-center mt-6">
        Muammo bo&apos;lsa, administrator bilan bog&apos;laning
      </p>
    </div>
  )
}
