'use client'

import { use, useEffect, useState } from 'react'
import { Package, Loader2, Check, X, Barcode } from 'lucide-react'

// QR skanerlanganda ochiladigan OCHIQ sahifa.
// Telefon kamerasi QR'ni o'qib shu manzilni ochadi — mijoz mahsulot
// nomini va narxini darhol ko'radi. Tizimga kirish talab qilinmaydi.

interface Malumot {
  dokonNomi: string
  tovar: {
    nomi: string
    kategoriya: string | null
    shtrixKod: string | null
    birlik: string
    valyuta: string
    narx: number
    rasm: string | null
    mavjud: boolean
  }
}

function narxMatni(narx: number, valyuta: string): string {
  const son = new Intl.NumberFormat('uz-UZ').format(narx)
  return valyuta === 'USD' ? `$${son}` : `${son} so'm`
}

export default function QrSahifa({ params }: { params: Promise<{ kod: string }> }) {
  const { kod } = use(params)
  const [data, setData] = useState<Malumot | null>(null)
  const [yuklanmoqda, setYuklanmoqda] = useState(true)
  const [xato, setXato] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/public/tovar/${encodeURIComponent(kod)}`)
      .then(async r => {
        const j = await r.json().catch(() => ({}))
        if (!r.ok) { setXato(j.xato || 'Mahsulot topilmadi'); return }
        setData(j)
      })
      .catch(() => setXato('Tarmoq xatosi'))
      .finally(() => setYuklanmoqda(false))
  }, [kod])

  return (
    <div className="min-h-dvh bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {yuklanmoqda ? (
          <div className="flex justify-center py-24">
            <Loader2 size={28} className="animate-spin text-red-600" />
          </div>
        ) : xato || !data ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <X size={24} className="text-gray-400" />
            </div>
            <p className="text-gray-900 font-semibold">{xato ?? 'Topilmadi'}</p>
            <p className="text-gray-500 text-sm mt-1">
              Bu kod bo&apos;yicha mahsulot topilmadi
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 text-center">
              <p className="text-gray-500 text-xs uppercase tracking-wide">{data.dokonNomi}</p>
            </div>

            {data.tovar.rasm ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.tovar.rasm} alt={data.tovar.nomi}
                className="w-full aspect-square object-cover" />
            ) : (
              <div className="aspect-[4/3] bg-gradient-to-br from-red-50 to-white flex items-center justify-center">
                <Package size={64} className="text-red-500" strokeWidth={1.5} />
              </div>
            )}

            <div className="p-5 text-center">
              {data.tovar.kategoriya && (
                <span className="inline-block text-xs bg-red-50 text-red-600 px-2.5 py-1 rounded-full font-medium">
                  {data.tovar.kategoriya}
                </span>
              )}
              <h1 className="text-gray-900 font-bold text-lg mt-2 leading-snug">
                {data.tovar.nomi}
              </h1>

              <p className="text-3xl font-bold text-red-600 mt-3 tabular-nums">
                {narxMatni(data.tovar.narx, data.tovar.valyuta)}
              </p>
              <p className="text-gray-400 text-xs mt-0.5">
                1 {data.tovar.birlik.toLowerCase()} uchun
              </p>

              <div className={`mt-4 inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full font-medium ${
                data.tovar.mavjud ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {data.tovar.mavjud ? <Check size={14} /> : <X size={14} />}
                {data.tovar.mavjud ? 'Sotuvda bor' : 'Hozircha yo‘q'}
              </div>

              {data.tovar.shtrixKod && (
                <p className="text-gray-400 text-xs mt-4 flex items-center justify-center gap-1.5 font-mono">
                  <Barcode size={12} />{data.tovar.shtrixKod}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
