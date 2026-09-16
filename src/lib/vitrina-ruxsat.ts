import { NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import { auth } from '@/lib/auth'
import { bolimRuxsatiBormi } from '@/lib/ruxsat-server'
import { sessionEgaId, sessionFilialId } from '@/lib/filial-scope'

export const VITRINA_BOLIM = 'onlayn-vitrina'

/**
 * Onlayn vitrina ruxsati. Sayt markaziy do'kon katalogini ko'rsatadi —
 * filialga bog'langan xodim unga tegmaydi. Tovarlar doirasi Ega bo'yicha
 * (tovarlar ro'yxatidagi bilan bir xil).
 */
export async function vitrinaRuxsat(): Promise<
  { ok: true; session: Session; admin: boolean; doira: { filialId: null; egaId: string | null } }
  | { ok: false; javob: NextResponse }
> {
  const session = await auth()
  if (!session) return { ok: false, javob: NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 }) }
  if (!bolimRuxsatiBormi(session, VITRINA_BOLIM) || sessionFilialId(session)) {
    return { ok: false, javob: NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 }) }
  }
  return {
    ok: true,
    session,
    admin: (session.user as { rol?: string }).rol === 'ADMIN',
    doira: { filialId: null, egaId: sessionEgaId(session) },
  }
}
