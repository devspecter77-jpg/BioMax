import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { barchaRuxsatKalitlari } from '@/lib/ruxsat-katalogi'
import { apiQoidasi, apiRuxsatBormi } from '@/lib/api-ruxsat-xaritasi'

const FAQAT_ADMIN_SAHIFALAR = new Set(['ruxsatlar', 'filiallar', 'otkazmalar', 'xarita'])

export default auth((req) => {
  const { pathname } = req.nextUrl

  // Login sahifasi va API auth — ochiq
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  // OCHIQ sahifalar — sessiyasiz ko'riladi:
  //   /qr/<kod>          — mahsulot QR'i skanerlanganda (nomi va narxi)
  //   /chek/<raqam>      — mijozga berilgan chek havolasi
  //   /api/public/...    — shu ikkalasining ma'lumot manbai
  // Bu marshrutlar ATAYLAB faqat mijozga ko'rsatish mumkin bo'lgan
  // maydonlarni qaytaradi: kelish narxi, qoldiq soni va foyda chiqmaydi.
  if (
    pathname.startsWith('/qr/') ||
    pathname.startsWith('/chek/') ||
    pathname.startsWith('/api/public/')
  ) {
    return NextResponse.next()
  }

  // Cron marshrutlari — sessiya bilan emas, CRON_SECRET bilan himoyalangan.
  // Bu tekshiruv quyidagi `!req.auth` shartidan OLDIN turishi shart: Vercel
  // Cron so'rovida cookie bo'lmaydi, aks holda so'rov /login ga yo'naltirilib
  // marshrutga umuman yetib bormaydi (cron jimgina ishlamay qoladi).
  if (pathname.startsWith('/api/cron/')) {
    return NextResponse.next()
  }

  // Marketplace shartnomasi — sessiya bilan emas, HMAC imzo bilan
  // himoyalangan (`lib/marketplace-imzo.ts`). Cron kabi, bu ham
  // `!req.auth` dan OLDIN turishi shart: marketplace serveri cookie
  // yubormaydi va so'rov /login ga yo'naltirilib ketardi.
  if (pathname.startsWith('/api/marketplace/')) {
    return NextResponse.next()
  }

  // Tizimga kirmaganlar — login sahifasiga
  if (!req.auth) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // API ruxsatlari — markaziy jadval bo'yicha (`lib/api-ruxsat-xaritasi.ts`).
  // Sahifa yopiq bo'lsa ham API'ni to'g'ridan-to'g'ri chaqirib bo'lmasin:
  // ilgari menyu yashirilardi, lekin so'rov baribir o'tardi.
  if (pathname.startsWith('/api/')) {
    const u = req.auth.user as { rol?: string; ruxsatlar?: string[] | null }
    const qoida = apiQoidasi(pathname, req.method)
    if (!apiRuxsatBormi(qoida, u?.rol, u?.ruxsatlar)) {
      return NextResponse.json(
        { xato: `Bu amalga ruxsatingiz yo‘q: «${qoida!.nomi}». Administratorga murojaat qiling.`, kod: 'ruxsat_yoq' },
        { status: 403 },
      )
    }
    return NextResponse.next()
  }

  // Bosh sahifa hamma rolga ochiq (ko'rsatkichlar alohida ruxsat bilan)
  if (pathname === '/') {
    return NextResponse.next()
  }

  // Ruxsatlar bo'yicha tekshiruv — ADMIN cheklanmaydi
  const rol = (req.auth.user as any)?.rol
  const birinchiBolak = pathname.slice(1).split('/')[0]
  // Katalogda yo'q, faqat administratorga tegishli sahifalar. Ilgari faqat
  // menyudan yashirilardi — manzilni qo'lda yozgan xodim sahifani ochardi.
  if (FAQAT_ADMIN_SAHIFALAR.has(birinchiBolak) && rol !== 'ADMIN') {
    return NextResponse.redirect(new URL('/', req.url))
  }
  if (rol && rol !== 'ADMIN') {
    const ruxsatlar: string[] = (req.auth.user as any)?.ruxsatlar || []
    const bolimKalit = birinchiBolak
    const katalogdaBorMi = barchaRuxsatKalitlari.includes(bolimKalit)
    if (katalogdaBorMi && !ruxsatlar.includes(bolimKalit)) {
      return NextResponse.redirect(new URL('/', req.url))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.png|.*\\.ico|.*\\.svg|.*\\.jpg|.*\\.webp|manifest\\.json|sw\\.js|robots\\.txt).*)'],
}
