import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import * as XLSX from 'xlsx'
import { sessionFilialId } from '@/lib/filial-scope'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    const filialId = sessionFilialId(session)

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    // rejim: 'tozalash' (arxivlab ustiga) | 'ustiga' (dublikat o'tkazib)
    const rejim = (formData.get('rejim') as string) || 'tozalash'

    if (!file) return NextResponse.json({ xato: 'Fayl topilmadi' }, { status: 400 })

    // Excel faylni o'qish
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

    // Sarlavha qatorini topish
    let dataStartIndex = 0
    for (let i = 0; i < Math.min(rows.length, 5); i++) {
      const row = rows[i]
      const hasHeader = row.some(
        (cell: any) =>
          typeof cell === 'string' &&
          (cell.toLowerCase().includes('mahsulot') || cell.toLowerCase().includes('nomi'))
      )
      if (hasHeader) { dataStartIndex = i + 1; break }
    }

    const dataRows = rows.slice(dataStartIndex).filter((row) => {
      const nomi = String(row[1] || '').trim()
      return nomi.length > 0
    })

    if (dataRows.length === 0) {
      return NextResponse.json({ xato: "Faylda mahsulot ma'lumoti topilmadi" }, { status: 400 })
    }

    // Kategoriyalarni yuklash (faqat shu filialga tegishli)
    const mavjudKategoriyalar = await prisma.kategoriya.findMany({
      where: { filialId },
      select: { id: true, nomi: true },
    })
    const kategoriyaMap = new Map<string, string>()
    for (const k of mavjudKategoriyalar) {
      kategoriyaMap.set(k.nomi.toLowerCase().trim(), k.id)
    }

    // Rejim: tozalash — mavjud FAOL tovarlarni arxivlash (faqat shu filialda)
    if (rejim === 'tozalash') {
      await prisma.tovar.updateMany({
        where: { holati: 'FAOL', filialId },
        data: { holati: 'ARXIVLANGAN' },
      })
    }

    // Rejim: ustiga — mavjud tovar nomlarini map ga olish (deduplication uchun)
    const mavjudNomlar = new Set<string>()
    if (rejim === 'ustiga') {
      const faolTovarlar = await prisma.tovar.findMany({
        where: { holati: 'FAOL', filialId },
        select: { nomi: true },
      })
      for (const t of faolTovarlar) {
        mavjudNomlar.add(t.nomi.toLowerCase().trim())
      }
    }

    let qoshildi = 0
    let duplikat = 0
    let xatolar = 0

    for (const row of dataRows) {
      const nomi = String(row[1] || '').trim()
      const kategoriyaNomi = String(row[2] || '').trim()
      if (!nomi) continue

      // Ustiga rejimda: bir xil nom bo'lsa o'tkazib yuborish
      if (rejim === 'ustiga' && mavjudNomlar.has(nomi.toLowerCase().trim())) {
        duplikat++
        continue
      }

      // Kategoriyani topish yoki yaratish
      let kategoriyaId: string
      const normalKey = kategoriyaNomi.toLowerCase().trim()
      if (normalKey && kategoriyaMap.has(normalKey)) {
        kategoriyaId = kategoriyaMap.get(normalKey)!
      } else if (normalKey) {
        const yangiKat = await prisma.kategoriya.create({ data: { nomi: kategoriyaNomi, filialId } })
        kategoriyaId = yangiKat.id
        kategoriyaMap.set(normalKey, kategoriyaId)
      } else {
        // Umumiy kategoriya
        if (!kategoriyaMap.has('__umumiy__')) {
          const umumiy = await prisma.kategoriya.findFirst({ where: { nomi: 'Umumiy', filialId } })
            ?? await prisma.kategoriya.create({ data: { nomi: 'Umumiy', filialId } })
          kategoriyaMap.set('__umumiy__', umumiy.id)
        }
        kategoriyaId = kategoriyaMap.get('__umumiy__')!
      }

      try {
        await prisma.tovar.create({
          data: { nomi, kategoriyaId, filialId, kelishNarxi: 0, sotishNarxi: 0, birlik: 'DONA', minimalQoldiq: 5 },
        })
        if (rejim === 'ustiga') mavjudNomlar.add(nomi.toLowerCase().trim())
        qoshildi++
      } catch {
        xatolar++
      }
    }

    return NextResponse.json({ muvaffaqiyat: true, qoshildi, duplikat, xatolar, jami: dataRows.length })
  } catch (e) {
    console.error('Import xatosi:', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
