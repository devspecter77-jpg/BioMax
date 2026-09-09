// Ta'minotchiga yuboriladigan mahsulot so'rovi — sof mantiq (bazasiz).
//
// Ikki manbadan qator kelishi mumkin:
//   • katalogdan tanlangan tovar (`tovarId` bor)
//   • qo'lda yozilgan satr (`tovarId` yo'q) — katalogda yo'q narsa
// Ikkalasi ham bir xil ko'rinishda xabarga tushadi.

import { birlikQisqa } from './kunlik-hisobot'

export const MAX_QATOR = 100
export const MAX_NOM = 200
export const MAX_IZOH = 1000

export interface SorovQatori {
  tovarId?: string | null
  nomi: string
  miqdor: number
  birlik: string
  izoh?: string | null
}

export interface SorovKiritma {
  qatorlar: SorovQatori[]
  qoshimchaIzoh?: string | null
}

export type TekshirNatija =
  | { ok: true; qatorlar: SorovQatori[]; qoshimchaIzoh: string | null }
  | { ok: false; xato: string }

function matnTozala(qiymat: unknown, maxUzunlik: number): string {
  return String(qiymat ?? '').trim().slice(0, maxUzunlik)
}

/**
 * Kiritmani tekshiradi va normallashtiradi.
 *
 * Bo'sh so'rov yuborilmaydi: hech bo'lmaganda bitta qator YOKI qo'lda
 * yozilgan izoh bo'lishi kerak — aks holda ta'minotchiga bo'sh xabar ketardi.
 */
export function sorovniTekshir(kiritma: SorovKiritma): TekshirNatija {
  const xom = Array.isArray(kiritma.qatorlar) ? kiritma.qatorlar : []
  if (xom.length > MAX_QATOR) {
    return { ok: false, xato: `Bir so'rovda ko'pi bilan ${MAX_QATOR} ta qator bo'lishi mumkin` }
  }

  const qatorlar: SorovQatori[] = []
  for (const q of xom) {
    const nomi = matnTozala(q?.nomi, MAX_NOM)
    if (!nomi) return { ok: false, xato: "Qator nomi bo'sh bo'lishi mumkin emas" }

    const miqdor = Number(q?.miqdor)
    if (!Number.isFinite(miqdor) || miqdor <= 0) {
      return { ok: false, xato: `"${nomi}" uchun miqdor noto'g'ri` }
    }

    qatorlar.push({
      tovarId: q.tovarId || null,
      nomi,
      // Kasrni 3 xonagacha — bazadagi Decimal(12,3) bilan bir xil
      miqdor: Math.round(miqdor * 1000) / 1000,
      birlik: matnTozala(q?.birlik, 20) || 'DONA',
      izoh: matnTozala(q?.izoh, MAX_NOM) || null,
    })
  }

  const qoshimchaIzoh = matnTozala(kiritma.qoshimchaIzoh, MAX_IZOH) || null

  if (qatorlar.length === 0 && !qoshimchaIzoh) {
    return { ok: false, xato: "So'rov bo'sh — mahsulot tanlang yoki izoh yozing" }
  }

  return { ok: true, qatorlar, qoshimchaIzoh }
}

function miqdorMatni(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n).replace(/0+$/, '').replace(/\.$/, '')
}

function sanaMatni(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`
}

export interface XabarParametrlari {
  dokonNomi: string
  taminotchiNomi: string
  /** Ta'minotchidagi aloqa shaxsi — bo'lsa, murojaat shunga qilinadi. */
  kontaktShaxs?: string | null
  qatorlar: SorovQatori[]
  qoshimchaIzoh?: string | null
  /** Do'kon tomonidan aloqa uchun raqam (so'rovni yuborgan xodimniki). */
  aloqaTelefoni?: string | null
  sana?: Date
}

/**
 * Telegram xabari. Oddiy matn — userbot xabarlari `parse_mode`siz
 * yuboriladi, shuning uchun markdown ishlatilmaydi.
 */
export function sorovMatni(p: XabarParametrlari): string {
  const q: string[] = []
  const sana = p.sana ?? new Date()

  q.push(`🧾 Buyurtma — ${p.dokonNomi}`)
  q.push(`📅 ${sanaMatni(sana)}`)
  q.push('')

  const kim = p.kontaktShaxs?.trim() || p.taminotchiNomi
  q.push(`Assalomu alaykum, ${kim}!`)

  if (p.qatorlar.length > 0) {
    q.push('Quyidagi mahsulotlar kerak:')
    q.push('')
    p.qatorlar.forEach((t, i) => {
      const izoh = t.izoh ? ` (${t.izoh})` : ''
      q.push(`${i + 1}. ${t.nomi} — ${miqdorMatni(t.miqdor)} ${birlikQisqa(t.birlik)}${izoh}`)
    })
  }

  if (p.qoshimchaIzoh) {
    if (p.qatorlar.length > 0) q.push('')
    q.push(`📝 ${p.qoshimchaIzoh}`)
  }

  if (p.aloqaTelefoni) {
    q.push('')
    q.push(`☎️ Aloqa: ${p.aloqaTelefoni}`)
  }

  return q.join('\n')
}
