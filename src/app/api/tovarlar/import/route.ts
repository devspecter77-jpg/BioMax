import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import * as XLSX from 'xlsx'
import { sessionFilialId, sessionEgaId, sessionIsRealEga } from '@/lib/filial-scope'
import { tovarYozishRuxsatlari } from '@/lib/tovar-ruxsat'

const BIRLIKLAR = new Set(['DONA', 'KG', 'LITR', 'METR', 'PACHKA', 'QUTI'])
const HOLATLAR = new Set(['FAOL', 'ARXIVLANGAN'])

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    const ownFilialId = sessionFilialId(session)
    const isRealEga = sessionIsRealEga(session)

    const { tahrirlashMumkin } = await tovarYozishRuxsatlari(session)
    if (!ownFilialId && !tahrirlashMumkin) {
      return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ xato: 'Fayl topilmadi' }, { status: 400 })
    // Faqat haqiqiy Ega (filialsiz, ulashilgan admin emas) ixtiyoriy ravishda
    // muayyan filialga import qila oladi — filialga bog'langan foydalanuvchi
    // har doim faqat o'z filialiga qulflangan.
    const filialId = ownFilialId || (isRealEga ? (formData.get('filialId') as string | null) : null) || null
    const egaId = filialId ? null : sessionEgaId(session)

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

    if (rows.length === 0) {
      return NextResponse.json({ xato: "Faylda mahsulot ma'lumoti topilmadi" }, { status: 400 })
    }

    const kategoriyaMap = new Map<string, string>()
    const mavjudKategoriyalar = await prisma.kategoriya.findMany({ where: { filialId }, select: { id: true, nomi: true } })
    for (const k of mavjudKategoriyalar) kategoriyaMap.set(k.nomi.toLowerCase().trim(), k.id)

    let qoshildi = 0, yangilandi = 0, xatolar = 0

    for (const row of rows) {
      const nomi = String(row['Nomi'] || '').trim()
      if (!nomi) continue

      try {
        const kategoriyaNomi = String(row['Kategoriya'] || '').trim() || 'Umumiy'
        const kategoriyaKalit = kategoriyaNomi.toLowerCase()
        let kategoriyaId = kategoriyaMap.get(kategoriyaKalit)
        if (!kategoriyaId) {
          const yangiKat = await prisma.kategoriya.create({ data: { nomi: kategoriyaNomi, filialId } })
          kategoriyaId = yangiKat.id
          kategoriyaMap.set(kategoriyaKalit, kategoriyaId)
        }

        const shtrixKod = String(row['Shtrix-kod'] || '').trim() || null
        const valyuta = String(row['Valyuta'] || 'UZS').trim().toUpperCase() === 'USD' ? 'USD' : 'UZS'
        const kelishNarxi = parseFloat(String(row['Kelish narxi'] || '0').replace(/[^\d.]/g, '')) || 0
        const sotishNarxi = parseFloat(String(row['Sotish narxi'] || '0').replace(/[^\d.]/g, '')) || 0
        const birlikRaw = String(row['Birlik'] || 'DONA').trim().toUpperCase()
        const birlik = (BIRLIKLAR.has(birlikRaw) ? birlikRaw : 'DONA') as any
        const holatiRaw = String(row['Holati'] || 'FAOL').trim().toUpperCase()
        const holati = (HOLATLAR.has(holatiRaw) ? holatiRaw : 'FAOL') as any
        const qoldiq = parseFloat(String(row['Miqdori'] || '0').replace(/[^\d.]/g, '')) || 0
        const muddatRaw = row['Yaroqlilik muddati']
        let yaroqlilikMuddati: Date | null = null
        if (muddatRaw instanceof Date && !isNaN(muddatRaw.getTime())) {
          yaroqlilikMuddati = muddatRaw
        } else if (typeof muddatRaw === 'string' && muddatRaw.trim()) {
          const parsed = new Date(muddatRaw.trim())
          if (!isNaN(parsed.getTime())) yaroqlilikMuddati = parsed
        }

        const mavjud = await prisma.tovar.findFirst({
          where: { nomi: { equals: nomi, mode: 'insensitive' }, filialId, ...(filialId ? {} : { egaId }) },
        })

        if (mavjud) {
          await prisma.tovar.update({
            where: { id: mavjud.id },
            data: { kategoriyaId, shtrixKod, valyuta, kelishNarxi, sotishNarxi, birlik, holati, yaroqlilikMuddati },
          })

          // Miqdorini faylga moslash — farqni ombor harakati bilan tuzatish (do'kon zaxirasi)
          const { getStockMap } = await import('@/lib/stock')
          const stockMap = await getStockMap([mavjud.id])
          const hozirgiQoldiq = stockMap.get(mavjud.id)?.dokonQoldiq ?? 0
          const farq = qoldiq - hozirgiQoldiq
          if (Math.abs(farq) > 0.0001) {
            await prisma.omborHarakati.create({
              data: {
                tovarId: mavjud.id,
                turi: farq > 0 ? 'KIRIM' : 'CHIQIM',
                joy: 'DOKON',
                miqdor: Math.abs(farq),
                narx: kelishNarxi,
                izoh: 'Excel import orqali miqdor moslashtirildi',
                foydalanuvchiId: (session.user as any).id,
              },
            })
          }
          yangilandi++
        } else {
          const yangiTovar = await prisma.tovar.create({
            data: { nomi, kategoriyaId, shtrixKod, valyuta, kelishNarxi, sotishNarxi, birlik, holati, filialId, egaId, yaroqlilikMuddati },
          })
          if (qoldiq > 0) {
            await prisma.omborHarakati.create({
              data: {
                tovarId: yangiTovar.id,
                turi: 'KIRIM',
                joy: 'DOKON',
                miqdor: qoldiq,
                narx: kelishNarxi,
                izoh: 'Excel import',
                foydalanuvchiId: (session.user as any).id,
              },
            })
          }
          qoshildi++
        }
      } catch {
        xatolar++
      }
    }

    return NextResponse.json({ muvaffaqiyat: true, qoshildi, yangilandi, xatolar, jami: rows.length })
  } catch (e) {
    console.error('Import xatosi:', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
