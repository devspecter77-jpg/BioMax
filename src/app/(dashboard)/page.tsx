'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatSum } from '@/lib/utils'
import { TrendingUp, TrendingDown, Receipt, ShoppingBag, Loader2 } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

interface HisobotData {
  jamiSotuv: number
  jamiXarajat: number
  jamiDaromad: number
  soFoyda: number
  sotuvSoni: number
  topTovarlar: { nomi: string; jami_miqdor: number; jami_summa: number }[]
  grafikData: { sana: string; sotuv: number; sotuvSoni: number }[]
}

function StatCard({
  icon: Icon, sarlavha, qiymat, rang, iconBg, qoshimcha, href,
}: {
  icon: React.ElementType
  sarlavha: string
  qiymat: string
  rang: string
  iconBg: string
  qoshimcha?: string
  href?: string
}) {
  const body = (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-gray-500 dark:text-gray-500 text-[10px] sm:text-xs font-mono uppercase tracking-wide truncate">{sarlavha}</p>
        <p className={`text-lg sm:text-2xl font-bold mt-1 sm:mt-1.5 font-mono tabular-nums truncate ${rang}`}>{qiymat}</p>
        {qoshimcha && <p className="text-gray-400 dark:text-gray-600 text-[10px] sm:text-xs mt-0.5 sm:mt-1 truncate">{qoshimcha}</p>}
      </div>
      <div className={`w-8 h-8 sm:w-11 sm:h-11 ${iconBg} rounded-lg sm:rounded-xl flex items-center justify-center shrink-0`}>
        <Icon size={16} className="text-white sm:hidden" />
        <Icon size={20} className="text-white hidden sm:block" />
      </div>
    </div>
  )

  const className = `bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 dark:border-l-[3px] dark:border-l-[#2E9B6B] rounded-xl sm:rounded-2xl p-3.5 sm:p-5 transition ${
    href ? 'hover:shadow-md hover:ring-2 hover:ring-primary/30 cursor-pointer' : 'hover:shadow-md'
  }`

  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    )
  }
  return <div className={className}>{body}</div>
}

export default function DashboardPage() {
  const [data, setData] = useState<HisobotData | null>(null)
  const [yuklanmoqda, setYuklanmoqda] = useState(true)

  useEffect(() => {
    async function yuklash() {
      try {
        const res = await fetch('/api/hisobotlar?tur=haftalik')
        const json = await res.json()
        setData(json)
      } finally {
        setYuklanmoqda(false)
      }
    }
    yuklash()
  }, [])

  if (yuklanmoqda) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 dark:text-gray-600 flex items-center gap-3">
          <Loader2 className="animate-spin w-6 h-6 text-primary" />
          <span>Yuklanmoqda...</span>
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      {/* Stat kartalar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <StatCard
          icon={ShoppingBag}
          sarlavha="Sotuv"
          qiymat={formatSum(data.jamiSotuv)}
          rang="text-gray-900 dark:text-gray-100"
          iconBg="bg-primary"
          qoshimcha={`${data.sotuvSoni} ta sotuv`}
          href="/xaridlar"
        />
        <StatCard
          icon={TrendingUp}
          sarlavha="Daromad"
          qiymat={formatSum(data.jamiDaromad)}
          rang="text-green-600"
          iconBg="bg-green-500"
        />
        <StatCard
          icon={TrendingDown}
          sarlavha="Xarajatlar"
          qiymat={formatSum(data.jamiXarajat)}
          rang="text-red-600"
          iconBg="bg-orange-500"
        />
        <StatCard
          icon={Receipt}
          sarlavha="Sof foyda"
          qiymat={formatSum(data.soFoyda)}
          rang={data.soFoyda >= 0 ? 'text-green-600' : 'text-red-600'}
          iconBg={data.soFoyda >= 0 ? 'bg-green-500' : 'bg-red-500'}
        />
      </div>

      {/* Grafik */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
        <h2 className="text-gray-900 dark:text-gray-100 font-semibold mb-4">Oxirgi 7 kunlik sotuv</h2>
        <div className="h-48 sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.grafikData || []} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
              <defs>
                <linearGradient id="sotuvGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2E9B6B" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2E9B6B" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#435046" />
              <XAxis dataKey="sana" stroke="#748577" tick={{ fontSize: 12, fill: '#97A89D' }} />
              <YAxis
                stroke="#748577"
                tick={{ fontSize: 11, fill: '#97A89D' }}
                tickFormatter={(v) => (v / 1000000).toFixed(1) + 'M'}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1A211C', border: '1px solid #313B34', borderRadius: '12px', color: '#EDF2EF' }}
                labelStyle={{ color: '#97A89D', fontSize: 12 }}
                formatter={(value: number | undefined) => [formatSum(value ?? 0), 'Sotuv']}
              />
              <Area
                type="monotone"
                dataKey="sotuv"
                stroke="#0F5C3E"
                strokeWidth={2}
                fill="url(#sotuvGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top tovarlar */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
        <h2 className="text-gray-900 dark:text-gray-100 font-semibold mb-4">Top sotilgan tovarlar</h2>
        {!data.topTovarlar || data.topTovarlar.length === 0 ? (
          <p className="text-gray-400 dark:text-gray-600 text-center py-8">Hali sotuv yo&apos;q</p>
        ) : (
          <div className="space-y-3">
            {data.topTovarlar.map((tovar, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-6 h-6 bg-primary-light dark:bg-[#132B20] text-primary dark:text-[#2E9B6B] rounded-lg flex items-center justify-center text-xs font-bold font-mono shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-800 dark:text-gray-200 text-sm font-medium truncate">{tovar.nomi}</p>
                  <p className="text-gray-400 dark:text-gray-600 text-xs">{tovar.jami_miqdor} dona sotildi</p>
                </div>
                <span className="text-green-600 text-sm font-semibold shrink-0">
                  {formatSum(tovar.jami_summa)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
