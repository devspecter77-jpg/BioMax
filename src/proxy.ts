import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { barchaRuxsatKalitlari } from '@/lib/ruxsat-katalogi'

export default auth((req) => {
  const { pathname } = req.nextUrl

  // Login sahifasi va API auth — ochiq
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  // Tizimga kirmaganlar — login sahifasiga
  if (!req.auth) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // API so'rovlari va bosh sahifa — har doim ochiq (API'lar o'zi tekshiradi,
  // bosh sahifa hamma rolga ruxsat)
  if (pathname.startsWith('/api/') || pathname === '/') {
    return NextResponse.next()
  }

  // Ruxsatlar bo'yicha tekshiruv — ADMIN cheklanmaydi
  const rol = (req.auth.user as any)?.rol
  if (rol && rol !== 'ADMIN') {
    const ruxsatlar: string[] = (req.auth.user as any)?.ruxsatlar || []
    const bolimKalit = pathname.slice(1).split('/')[0]
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
