'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

// ─── Turlar ──────────────────────────────────────────────────────────────────

interface ChekData {
  chekRaqami: string
  sana: string
  jamiSumma: number
  chegirma: number
  yakuniySumma: number
  tolovUsuli: string
  naqdTolangan: number
  kartaTolangan: number
  kassir: string
  mijoz: { ism: string } | null
  tarkiblar: {
    tovar: string
    birlik: string
    miqdor: number
    birlikNarxi: number
    chegirma: number
    jami: number
  }[]
  nasiya: {
    jamiQarz: number
    tolangan: number
    qoldiq: number
    holati: string
    muddat: string | null
  } | null
  dokon: {
    nomi: string
    manzil: string
    telefon: string
    chekMatn: string
  }
}

// ─── Yordamchi ───────────────────────────────────────────────────────────────

function fSum(n: number | string) {
  const v = typeof n === 'string' ? parseFloat(n) : n
  return new Intl.NumberFormat('ru-RU').format(Math.round(v)) + ' UZS'
}

function fSana(s: string) {
  const d = new Date(s)
  return d.toLocaleString('uz-UZ', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fSanaQisqa(s: string) {
  const d = new Date(s)
  return d.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const TOLOV_NOMLARI: Record<string, string> = {
  NAQD: 'Naqd',
  KARTA: 'Karta',
  ARALASH: 'Aralash',
  NASIYA: 'Nasiya',
  SHERIK: 'Sherik',
}

const BIRLIK_NOMLARI: Record<string, string> = {
  DONA: 'dona',
  KG: 'kg',
  LITR: 'litr',
  METR: 'metr',
}

const NASIYA_HOLATI: Record<string, { rang: string; nom: string }> = {
  OCHIQ: { rang: 'text-orange-600', nom: 'Ochiq' },
  YOPILGAN: { rang: 'text-green-600', nom: 'Yopilgan' },
  MUDDATI_OTGAN: { rang: 'text-red-600', nom: "Muddati o'tgan" },
}

// ─── Sahifa ──────────────────────────────────────────────────────────────────

export default function PublicChekPage() {
  const params = useParams()
  const chekRaqami = decodeURIComponent(params.chekRaqami as string)
  const [data, setData] = useState<ChekData | null>(null)
  const [xato, setXato] = useState('')
  const [yuklanmoqda, setYuklanmoqda] = useState(true)

  useEffect(() => {
    fetch(`/api/public/chek/${encodeURIComponent(chekRaqami)}`)
      .then(r => r.json())
      .then(d => {
        if (d.xato) setXato(d.xato)
        else setData(d)
      })
      .catch(() => setXato('Tarmoq xatosi'))
      .finally(() => setYuklanmoqda(false))
  }, [chekRaqami])

  // Yuklanmoqda
  if (yuklanmoqda) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-red-200 border-t-red-600 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Chek yuklanmoqda...</p>
        </div>
      </div>
    )
  }

  // Xato
  if (xato || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Chek topilmadi</h1>
          <p className="text-gray-500 text-sm">Bu chek mavjud emas yoki bekor qilingan</p>
        </div>
      </div>
    )
  }

  const nasiyaInfo = data.nasiya ? NASIYA_HOLATI[data.nasiya.holati] || { rang: '', nom: data.nasiya.holati } : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-6 px-4">
      <div className="max-w-md mx-auto">

        {/* ─── Chek kartasi ──────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">

          {/* Header */}
          <div className="bg-gradient-to-r from-red-600 to-red-500 text-white px-5 py-5">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-xl font-bold tracking-tight">{data.dokon.nomi}</h1>
              <span className="bg-white/20 px-2.5 py-0.5 rounded-lg text-xs font-medium backdrop-blur-sm">
                {TOLOV_NOMLARI[data.tolovUsuli] || data.tolovUsuli}
              </span>
            </div>
            {data.dokon.manzil && (
              <p className="text-white/80 text-xs mb-1">{data.dokon.manzil}</p>
            )}
            {data.dokon.telefon && (
              <a href={`tel:${data.dokon.telefon.replace(/\s/g, '')}`} className="text-white/80 text-xs hover:text-white">
                {data.dokon.telefon}
              </a>
            )}
          </div>

          {/* Chek info */}
          <div className="px-5 py-4 border-b border-dashed border-gray-200 flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs">Chek raqami</p>
              <p className="text-gray-900 font-bold text-sm font-mono">{data.chekRaqami}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-500 text-xs">Sana</p>
              <p className="text-gray-900 text-sm font-medium">{fSana(data.sana)}</p>
            </div>
          </div>

          {/* Mijoz */}
          {data.mijoz && (
            <div className="px-5 py-3 border-b border-dashed border-gray-200 flex items-center gap-3">
              <div className="w-9 h-9 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                {data.mijoz.ism.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-gray-500 text-xs">Mijoz</p>
                <p className="text-gray-900 font-semibold text-sm">{data.mijoz.ism}</p>
              </div>
            </div>
          )}

          {/* ─── Mahsulotlar ─────────────────────────────────────── */}
          <div className="px-5 py-4 border-b border-dashed border-gray-200">
            <p className="text-gray-500 text-xs font-medium mb-3 uppercase tracking-wider">Mahsulotlar</p>
            <div className="space-y-3">
              {data.tarkiblar.map((t, i) => {
                const birlik = BIRLIK_NOMLARI[t.birlik] || t.birlik.toLowerCase()
                const bonusmi = Number(t.birlikNarxi) === 0
                return (
                  <div key={i} className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 text-sm font-medium leading-snug flex items-center gap-1.5">
                        {t.tovar}
                        {bonusmi && (
                          <span className="text-[10px] font-semibold bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-full shrink-0">Bonus</span>
                        )}
                      </p>
                      {!bonusmi && (
                        <p className="text-gray-400 text-xs mt-0.5">
                          {Number(t.miqdor)} {birlik} &times; {fSum(Number(t.birlikNarxi))}
                          {Number(t.chegirma) > 0 && (
                            <span className="text-red-500 ml-1">-{fSum(Number(t.chegirma))}</span>
                          )}
                        </p>
                      )}
                      {bonusmi && (
                        <p className="text-violet-500 text-xs mt-0.5">{Number(t.miqdor)} {birlik} &times; Bepul</p>
                      )}
                    </div>
                    <p className={`text-sm font-semibold whitespace-nowrap ${bonusmi ? 'text-violet-500' : 'text-gray-900'}`}>
                      {bonusmi ? 'Bepul' : fSum(Number(t.jami))}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ─── Hisob ───────────────────────────────────────────── */}
          <div className="px-5 py-4 space-y-2">
            {data.tarkiblar.length > 1 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Jami ({data.tarkiblar.length} ta)</span>
                <span className="text-gray-700">{fSum(Number(data.jamiSumma))}</span>
              </div>
            )}

            {Number(data.chegirma) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-red-500">Chegirma</span>
                <span className="text-red-500 font-medium">-{fSum(Number(data.chegirma))}</span>
              </div>
            )}

            <div className="flex justify-between items-center pt-2 border-t border-gray-100">
              <span className="text-gray-900 font-bold">Yakuniy summa</span>
              <span className="text-red-600 font-bold text-lg">{fSum(Number(data.yakuniySumma))}</span>
            </div>

            {/* To'lov tafsilotlari */}
            {data.tolovUsuli === 'ARALASH' && (
              <div className="pt-2 space-y-1">
                {Number(data.naqdTolangan) > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Naqd to'langan</span>
                    <span className="text-gray-600">{fSum(Number(data.naqdTolangan))}</span>
                  </div>
                )}
                {Number(data.kartaTolangan) > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Karta to'langan</span>
                    <span className="text-gray-600">{fSum(Number(data.kartaTolangan))}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ─── Nasiya bo'limi ──────────────────────────────────── */}
          {data.nasiya && nasiyaInfo && (
            <div className="mx-5 mb-4 p-4 bg-orange-50 border border-orange-200 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <p className="text-orange-800 text-xs font-semibold uppercase tracking-wider">Nasiya ma'lumotlari</p>
                <span className={`text-xs font-bold ${nasiyaInfo.rang}`}>{nasiyaInfo.nom}</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-orange-700/70">Jami qarz</span>
                  <span className="text-orange-900 font-medium">{fSum(Number(data.nasiya.jamiQarz))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-orange-700/70">To'langan</span>
                  <span className="text-green-600 font-medium">{fSum(Number(data.nasiya.tolangan))}</span>
                </div>
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-orange-700/70">Qoldiq</span>
                  <span className="text-orange-900">{fSum(Number(data.nasiya.qoldiq))}</span>
                </div>
                {data.nasiya.muddat && (
                  <div className="flex justify-between text-sm">
                    <span className="text-orange-700/70">Muddat</span>
                    <span className="text-orange-900 font-medium">{fSanaQisqa(data.nasiya.muddat)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── Kassir ──────────────────────────────────────────── */}
          <div className="px-5 py-3 border-t border-dashed border-gray-200 flex justify-between text-xs text-gray-400">
            <span>Kassir: {data.kassir}</span>
          </div>

          {/* ─── Footer ──────────────────────────────────────────── */}
          {data.dokon.chekMatn && (
            <div className="px-5 py-3 bg-gray-50 text-center">
              <p className="text-gray-500 text-xs">{data.dokon.chekMatn}</p>
            </div>
          )}

          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-center">
            <p className="text-gray-400 text-[10px]">BioMax — Do'kon boshqaruv tizimi</p>
          </div>
        </div>
      </div>
    </div>
  )
}
