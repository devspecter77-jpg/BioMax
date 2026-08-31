import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { sessionFilialId, sessionEgaId } from '@/lib/filial-scope'
import { formatPhone } from '@/lib/utils'

export async function GET(_req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    const filialId = sessionFilialId(session)

    const mijozlar = await prisma.mijoz.findMany({
      where: filialId ? { filialId } : { egaId: sessionEgaId(session) },
      include: {
        _count: { select: { sotuvlar: true } },
        nasiyalar: { where: { holati: { in: ['OCHIQ', 'MUDDATI_OTGAN'] } }, select: { qoldiq: true } },
      },
      orderBy: { ism: 'asc' },
    })

    const rows = mijozlar.map(m => ({
      'Ism': m.ism,
      'Telefon': m.telefon ? formatPhone(m.telefon) : '',
      'Manzil': m.manzil || '',
      'Maxsus kod': m.maxsus_kod || '',
      'Jami sotuv': m._count.sotuvlar,
      'Jami qarz': m.nasiyalar.reduce((s, n) => s + Number(n.qoldiq), 0),
      'Ro\'yxatga olingan': m.yaratilgan.toISOString().slice(0, 10),
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 24 }, { wch: 18 }, { wch: 28 }, { wch: 14 }, { wch: 11 }, { wch: 13 }, { wch: 16 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Mijozlar')
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="mijozlar.xlsx"',
      },
    })
  } catch (e) {
    console.error('[/api/mijozlar/export]', e)
    return NextResponse.json({ xato: 'Eksport muvaffaqiyatsiz' }, { status: 500 })
  }
}
