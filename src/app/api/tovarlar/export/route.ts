import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { sessionFilialId } from '@/lib/filial-scope'
import { getStockMap } from '@/lib/stock'

export async function GET(_req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    const filialId = sessionFilialId(session)

    const tovarlar = await prisma.tovar.findMany({
      where: filialId ? { filialId } : {},
      include: { kategoriya: true },
      orderBy: { nomi: 'asc' },
    })
    const stockMap = await getStockMap(tovarlar.map(t => t.id))

    const rows = tovarlar.map(t => {
      const stock = stockMap.get(t.id)
      return {
        'Nomi': t.nomi,
        'Kategoriya': t.kategoriya.nomi,
        'Shtrix-kod': t.shtrixKod || '',
        'Kelish narxi': Number(t.kelishNarxi),
        'Sotish narxi': Number(t.sotishNarxi),
        'Birlik': t.birlik,
        'Ombordagi soni': stock?.omborQoldiq ?? 0,
        'Holati': t.holati,
      }
    })

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 14 }, { wch: 13 }, { wch: 13 }, { wch: 8 }, { wch: 14 }, { wch: 12 }]
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
