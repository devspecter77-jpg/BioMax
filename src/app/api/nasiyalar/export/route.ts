import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { sessionFilialId } from '@/lib/filial-scope'
import { formatPhone } from '@/lib/utils'

const HOLATI_LABEL: Record<string, string> = {
  OCHIQ: 'Ochiq', YOPILGAN: 'Yopilgan', MUDDATI_OTGAN: "Muddati o'tgan",
}

export async function GET(_req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    const filialId = sessionFilialId(session)

    const nasiyalar = await prisma.nasiya.findMany({
      where: { ochirilgan: false, ...(filialId ? { mijoz: { filialId } } : {}) },
      include: {
        mijoz: { select: { ism: true, telefon: true } },
        sotuv: { select: { chekRaqami: true } },
      },
      orderBy: { sana: 'desc' },
    })

    const rows = nasiyalar.map(n => ({
      'Mijoz': n.mijoz.ism,
      'Telefon': n.mijoz.telefon ? formatPhone(n.mijoz.telefon) : '',
      'Chek': n.sotuv?.chekRaqami || '',
      'Jami qarz': Number(n.jamiQarz),
      "To'langan": Number(n.tolangan),
      'Qoldiq': Number(n.qoldiq),
      'Muddat': n.muddat ? n.muddat.toISOString().slice(0, 10) : '',
      'Holati': HOLATI_LABEL[n.holati] || n.holati,
      'Sana': n.sana.toISOString().slice(0, 10),
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 24 }, { wch: 18 }, { wch: 16 }, { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 12 }, { wch: 14 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Nasiyalar')
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="nasiyalar.xlsx"',
      },
    })
  } catch (e) {
    console.error('[/api/nasiyalar/export]', e)
    return NextResponse.json({ xato: 'Eksport muvaffaqiyatsiz' }, { status: 500 })
  }
}
