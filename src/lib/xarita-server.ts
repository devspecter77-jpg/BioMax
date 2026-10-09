import { NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import { auth } from '@/lib/auth'
import { sessionIsRealEga } from '@/lib/filial-scope'

export type XaritaKontekst = { ok: true; session: Session } | { ok: false; javob: NextResponse }

/**
 * Xarita bo'limi — faqat bosh Ega (ADMIN, filialsiz va boshqa Egaga
 * ulanmagan hisob). /api/filiallar dagi bilan bir xil tekshiruv; xarita
 * API'larining hammasi shu bitta qoidadan foydalanadi.
 */
export async function xaritaRuxsati(): Promise<XaritaKontekst> {
  const session = await auth()
  if (!session) return { ok: false, javob: NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 }) }
  const rol = (session.user as { rol?: string } | undefined)?.rol
  if (rol !== 'ADMIN' || !sessionIsRealEga(session as never)) {
    return { ok: false, javob: NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 }) }
  }
  return { ok: true, session }
}
