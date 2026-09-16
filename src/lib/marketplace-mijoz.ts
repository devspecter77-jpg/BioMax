import { imzoYarat } from '@/lib/marketplace-imzo'

// ERP → marketplace mijozi (onlayn buyurtmalarni boshqarish).
//
// Marketplace bazasi to'g'ridan-to'g'ri O'QILMAYDI: buyurtma qoidalari
// (qaysi holatdan qaysisiga o'tish mumkin) marketplace'da yashaydi va
// ERP ularni faqat shu imzolangan API orqali ishlatadi.

const KUTISH_MS = 10_000

export type MpJavob<T> =
  | { ok: true; qiymat: T }
  | { ok: false; holat: number; kod: string; xato: string }

export async function mpSorov<T>(usul: 'GET' | 'POST', yol: string, tanaObj?: unknown): Promise<MpJavob<T>> {
  const asos = process.env.MARKETPLACE_URL
  if (!asos) return { ok: false, holat: 503, kod: 'sozlanmagan', xato: 'MARKETPLACE_URL sozlanmagan' }

  const tana = tanaObj === undefined ? '' : JSON.stringify(tanaObj)
  const imzo = imzoYarat(yol, tana)
  if (!imzo) return { ok: false, holat: 503, kod: 'kalit_sozlanmagan', xato: 'MP_HMAC_SECRET sozlanmagan' }

  const boshqaruv = new AbortController()
  const soat = setTimeout(() => boshqaruv.abort(), KUTISH_MS)
  try {
    const j = await fetch(asos.replace(/\/$/, '') + yol, {
      method: usul,
      cache: 'no-store',
      signal: boshqaruv.signal,
      headers: { 'Content-Type': 'application/json', 'X-MP-Timestamp': imzo.vaqt, 'X-MP-Signature': imzo.imzo },
      body: usul === 'GET' ? undefined : tana,
    })
    const d = await j.json().catch(() => ({})) as Record<string, unknown>
    if (!j.ok) {
      return {
        ok: false, holat: j.status,
        kod: typeof d.kod === 'string' ? d.kod : 'xato',
        xato: typeof d.xato === 'string' ? d.xato : 'Onlayn do‘kon so‘rovni rad etdi',
      }
    }
    return { ok: true, qiymat: d as T }
  } catch (e) {
    const vaqt = e instanceof Error && e.name === 'AbortError'
    console.error('[mp-mijoz]', yol, vaqt ? 'vaqt tugadi' : e)
    return { ok: false, holat: 503, kod: 'ulanmadi', xato: 'Onlayn do‘kon serveriga ulanib bo‘lmadi' }
  } finally {
    clearTimeout(soat)
  }
}
