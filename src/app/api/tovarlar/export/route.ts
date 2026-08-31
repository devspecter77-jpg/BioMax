import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { sessionFilialId, sessionEgaId, sessionIsRealEga } from '@/lib/filial-scope'
import { getStockMap } from '@/lib/stock'
import { foydalanuvchiYashirilganMaydonlari } from '@/lib/maydon-yashirish'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    const ownFilialId = sessionFilialId(session)
    const foydalanuvchiId = (session.user as any).id
    const { searchParams } = new URL(req.url)
    const isRealEga = sessionIsRealEga(session)
    const filialId = ownFilialId || (isRealEga ? searchParams.get('filialId') : null) || null

    const [tovarlar, yashirilganMaydonlar] = await Promise.all([
      prisma.tovar.findMany({
        where: { filialId, ...(filialId ? {} : { egaId: sessionEgaId(session) }) },
        include: { kategoriya: true },
        orderBy: { nomi: 'asc' },
      }),
      foydalanuvchiYashirilganMaydonlari(foydalanuvchiId),
    ])
    const stockMap = await getStockMap(tovarlar.map(t => t.id))
    const kelishYashirin = yashirilganMaydonlar.has('kelishNarxi')
    const sotishYashirin = yashirilganMaydonlar.has('sotishNarxi')
    const qoldiqYashirin = yashirilganMaydonlar.has('qoldiq')

    const rows = tovarlar.map(t => {
      const stock = stockMap.get(t.id)
      return {
        'Nomi': t.nomi,
        'Kategoriya': t.kategoriya.nomi,
        'Shtrix-kod': t.shtrixKod || '',
        'Valyuta': t.valyuta,
        'Kelish narxi': kelishYashirin ? '' : Number(t.kelishNarxi),
        'Sotish narxi': sotishYashirin ? '' : Number(t.sotishNarxi),
        'Birlik': t.birlik,
        'Miqdori': qoldiqYashirin ? '' : (stock?.dokonQoldiq ?? 0),
        'Yaroqlilik muddati': t.yaroqlilikMuddati ? t.yaroqlilikMuddati.toISOString().slice(0, 10) : '',
        'Holati': t.holati,
      }
    })

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 14 }, { wch: 9 }, { wch: 13 }, { wch: 13 }, { wch: 8 }, { wch: 14 }, { wch: 16 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Tovarlar')
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="tovarlar.xlsx"',
      },
    })
  } catch (e) {
    console.error('[/api/tovarlar/export]', e)
    return NextResponse.json({ xato: 'Eksport muvaffaqiyatsiz' }, { status: 500 })
  }
}
