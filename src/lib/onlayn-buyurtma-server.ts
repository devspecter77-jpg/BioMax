import { NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import { auth } from '@/lib/auth'
import { amalRuxsatiBormi } from '@/lib/ruxsat-server'
import { sessionFilialId } from '@/lib/filial-scope'

export const ONLAYN_BOLIM = 'onlayn-buyurtmalar'

/**
 * Onlayn buyurtmalar paneli ruxsati.
 *
 * Onlayn do'kon markaziy (bosh do'kon) buyurtmalarini qabul qiladi — filialga
 * bog'langan xodim ularni ko'rmaydi va boshqarmaydi. Qolganlar Ruxsatlar
 * bo'limidagi `onlayn-buyurtmalar` bo'yicha.
 */
export async function onlaynRuxsat(kalit: string = ONLAYN_BOLIM): Promise<{ ok: true; session: Session } | { ok: false; javob: NextResponse }> {
  const session = await auth()
  if (!session) return { ok: false, javob: NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 }) }
  // Jonli tekshiruv (bazadan, 15 s kesh): ruxsat hozirgina yopilgan bo'lsa ham darhol kuchga kiradi,
  // baza javob bermasa esa ochiq qolib ketmaydi
  if (sessionFilialId(session) || !(await amalRuxsatiBormi(session, kalit))) {
    return { ok: false, javob: NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 }) }
  }
  return { ok: true, session }
}
