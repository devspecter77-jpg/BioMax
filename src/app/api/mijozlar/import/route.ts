import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { sessionFilialId, sessionEgaId } from '@/lib/filial-scope'

async function generateUniqueKod(): Promise<string> {
  while (true) {
    const n = Math.floor(100000000 + Math.random() * 900000000).toString()
    const kod = `${n.slice(0, 3)}-${n.slice(3, 6)}-${n.slice(6, 9)}`
    const exists = await prisma.mijoz.findUnique({ where: { maxsus_kod: kod } })
    if (!exists) return kod
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    const filialId = sessionFilialId(session)
    const egaId = filialId ? null : sessionEgaId(session)

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ xato: 'Fayl topilmadi' }, { status: 400 })

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

    let qoshildi = 0, yangilandi = 0, xatolar = 0

    for (const row of rows) {
      const ism = String(row['Ism'] || '').trim()
      if (!ism) continue
      const telefonToza = String(row['Telefon'] || '').replace(/\D/g, '')
      const manzil = String(row['Manzil'] || '').trim() || null

      try {
        let mavjud = telefonToza
          ? await prisma.mijoz.findFirst({
              where: { telefon: { endsWith: telefonToza.slice(-9) }, ...(filialId ? { filialId } : { egaId }) },
            })
          : null

        if (mavjud) {
          await prisma.mijoz.update({
            where: { id: mavjud.id },
            data: { ism, manzil: manzil ?? mavjud.manzil },
          })
          yangilandi++
        } else {
          const maxsus_kod = await generateUniqueKod()
          await prisma.mijoz.create({
            data: { ism, telefon: telefonToza || null, manzil, maxsus_kod, filialId, egaId },
          })
          qoshildi++
        }
      } catch {
        xatolar++
      }
    }

    return NextResponse.json({ muvaffaqiyat: true, qoshildi, yangilandi, xatolar, jami: rows.length })
  } catch (e) {
    console.error('[/api/mijozlar/import]', e)
    return NextResponse.json({ xato: 'Import muvaffaqiyatsiz' }, { status: 500 })
  }
}
