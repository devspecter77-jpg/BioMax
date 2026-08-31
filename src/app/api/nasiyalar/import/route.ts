import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { sessionFilialId } from '@/lib/filial-scope'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    const filialId = sessionFilialId(session)

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ xato: 'Fayl topilmadi' }, { status: 400 })

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

    const normalizeManzil = (m: string) => m.trim().toLowerCase().replace(/\s+/g, ' ')

    let qoshildi = 0, xatolar = 0

    for (const row of rows) {
      const ism = String(row['Mijoz'] || '').trim()
      const qarz = parseFloat(String(row['Qoldiq'] ?? row['Jami qarz'] ?? '0').replace(/[^\d.]/g, ''))
      if (!ism || !qarz || qarz <= 0) continue

      try {
        const telefonToza = String(row['Telefon'] || '').replace(/\D/g, '')
        const finalPhone = telefonToza.length >= 9 ? `+${telefonToza}` : null
        const manzil = String(row['Manzil'] || '').trim() || null

        let mijoz = null
        if (manzil) {
          const nomzodlar = await prisma.mijoz.findMany({
            where: { ism: { equals: ism, mode: 'insensitive' }, ...(filialId ? { filialId } : {}) },
          })
          mijoz = nomzodlar.find(c => c.manzil && normalizeManzil(c.manzil) === normalizeManzil(manzil)) || null
        }
        if (!mijoz && finalPhone) {
          mijoz = await prisma.mijoz.findFirst({ where: { telefon: finalPhone, ...(filialId ? { filialId } : {}) } })
        }
        if (!mijoz) {
          mijoz = await prisma.mijoz.create({ data: { ism, manzil, telefon: finalPhone, filialId } })
        }

        const muddatQiymati = row['Muddat'] ? new Date(row['Muddat']) : null
        const muddat = muddatQiymati && !isNaN(muddatQiymati.getTime()) ? muddatQiymati : null

        await prisma.$transaction(async (tx) => {
          const yangi = await tx.nasiya.create({
            data: { mijozId: mijoz!.id, jamiQarz: qarz, qoldiq: qarz, muddat },
          })
          await tx.nasiyaQarzTarixi.create({
            data: { nasiyaId: yangi.id, summa: qarz, izoh: 'Excel orqali import qilindi' },
          })
        })
        qoshildi++
      } catch {
        xatolar++
      }
    }

    return NextResponse.json({ muvaffaqiyat: true, qoshildi, xatolar, jami: rows.length })
  } catch (e) {
    console.error('[/api/nasiyalar/import]', e)
    return NextResponse.json({ xato: 'Import muvaffaqiyatsiz' }, { status: 500 })
  }
}
