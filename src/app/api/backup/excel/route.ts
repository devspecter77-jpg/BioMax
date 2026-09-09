import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import * as XLSX from 'xlsx'
import { tolovQisqa } from '@/lib/tolov-usullari'

export async function GET() {
  try {
    const session = await auth()
    const user = session?.user as { rol?: string } | undefined
    if (!session || user?.rol !== 'ADMIN') {
      return NextResponse.json({ xato: 'Faqat admin' }, { status: 403 })
    }

    const [tovarlar, sotuvlar, nasiyalar, xarajatlar, mijozlar] = await Promise.all([
      prisma.tovar.findMany({ include: { kategoriya: { select: { nomi: true } } }, orderBy: { nomi: 'asc' } }),
      prisma.sotuv.findMany({
        include: {
          tarkiblar: { include: { tovar: { select: { nomi: true } } } },
          kassir: { select: { ism: true } },
          mijoz: { select: { ism: true } },
        },
        orderBy: { sana: 'desc' },
      }),
      prisma.nasiya.findMany({
        include: { mijoz: { select: { ism: true, telefon: true, manzil: true } } },
        orderBy: { sana: 'desc' },
      }),
      prisma.xarajat.findMany({ orderBy: { sana: 'desc' } }),
      prisma.mijoz.findMany({ orderBy: { ism: 'asc' } }),
    ])

    const wb = XLSX.utils.book_new()

    // 1. Tovarlar
    const tovarData = tovarlar.map(t => ({
      'Nomi': t.nomi,
      'Kategoriya': t.kategoriya?.nomi || '',
      'Birlik': t.birlik,
      'Kelish narxi': Number(t.kelishNarxi),
      'Sotish narxi': Number(t.sotishNarxi),
      'Minimal qoldiq': t.minimalQoldiq,
      'Keltirilgan manzil': t.keltirilganManzil || '',
      'Holati': t.holati,
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tovarData), 'Tovarlar')

    // 2. Sotuvlar
    const sotuvData = sotuvlar.map(s => ({
      'Chek raqami': s.chekRaqami,
      'Sana': new Date(s.sana).toLocaleString('uz-UZ'),
      'Kassir': s.kassir?.ism || '',
      "To'lov usuli": tolovQisqa(s.tolovUsuli),
      'Jami summa': Number(s.yakuniySumma),
      'Chegirma': Number(s.chegirma),
      'Naqd': Number(s.naqdTolangan),
      'Karta': Number(s.kartaTolangan),
      'Click': Number(s.clickTolangan),
      "Bank o'tkazmasi": Number(s.bankTolangan),
      'Mijoz': s.mijoz?.ism || '',
      'Tovarlar': s.tarkiblar.map(t => `${t.tovar?.nomi} x${Number(t.miqdor)}`).join(', '),
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sotuvData), 'Sotuvlar')

    // 3. Nasiyalar
    const nasiyaData = nasiyalar.map(n => ({
      'Mijoz': n.mijoz?.ism || '',
      'Telefon': n.mijoz?.telefon || '',
      'Manzil': n.mijoz?.manzil || '',
      'Jami qarz': Number(n.jamiQarz),
      "To'langan": Number(n.tolangan),
      'Qoldiq': Number(n.qoldiq),
      'Holati': n.holati,
      'Sana': new Date(n.sana).toLocaleString('uz-UZ'),
      'Muddat': n.muddat ? new Date(n.muddat).toLocaleDateString('uz-UZ') : '',
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(nasiyaData), 'Nasiyalar')

    // 4. Xarajatlar
    const xarajatData = xarajatlar.map(x => ({
      'Kategoriya': x.kategoriya,
      'Summa': Number(x.summa),
      'Sana': new Date(x.sana).toLocaleString('uz-UZ'),
      'Izoh': x.izoh || '',
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(xarajatData), 'Xarajatlar')

    // 5. Mijozlar
    const mijozData = mijozlar.map(m => ({
      'Ism': m.ism,
      'Telefon': m.telefon || '',
      'Manzil': m.manzil || '',
      'Yaratilgan': new Date(m.yaratilgan).toLocaleString('uz-UZ'),
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mijozData), 'Mijozlar')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const filename = `erp_hisobot_${new Date().toISOString().split('T')[0]}.xlsx`

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (e) {
    console.error('[backup/excel] Error:', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
