import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { egaFilialWhere } from '@/lib/filial-scope'
import { mijozDoirasi, yangiMijozEgaligi } from '@/lib/mijoz-doirasi'
import { telefonBoyichaSharti } from '@/lib/mijoz-telefon-server'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ xato: 'Fayl topilmadi' }, { status: 400 })

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

    const normalizeManzil = (m: string) => m.trim().toLowerCase().replace(/\s+/g, ' ')

    let qoshildi = 0, xatolar = 0
    // Faqat import qiluvchi ko'radigan mijozlarga yoziladi; yangilari unga biriktiriladi
    const doira = await mijozDoirasi(session)
    const egalik = yangiMijozEgaligi(session)

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
            where: { AND: [{ ism: { equals: ism, mode: 'insensitive' } }, doira] },
          })
          mijoz = nomzodlar.find(c => c.manzil && normalizeManzil(c.manzil) === normalizeManzil(manzil)) || null
        }
        const tel = telefonBoyichaSharti(finalPhone)
        if (!mijoz && tel) {
          mijoz = await prisma.mijoz.findFirst({ where: { AND: [tel, doira] } })
          // Raqam boshqa xodimning mijozida — qator o'tkazib yuboriladi
          if (!mijoz && await prisma.mijoz.count({ where: { AND: [tel, egaFilialWhere(session)] } })) {
            xatolar++
            continue
          }
        }
        if (!mijoz) {
          mijoz = await prisma.mijoz.create({ data: { ism, manzil, telefon: finalPhone, ...egaFilialWhere(session), ...egalik } })
        }

        const muddatQiymati = row['Muddat'] ? new Date(row['Muddat'] as string | number) : null
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
