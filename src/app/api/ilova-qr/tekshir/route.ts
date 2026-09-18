import { NextResponse } from 'next/server'
import { qrRuxsat, saqlanganManzil } from '@/lib/ilova-qr-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

interface Qadam {
  nomi: string
  ok: boolean
  xabar: string
}

/**
 * Onlayn do'kon to'liq ishlayaptimi — chop etishdan oldin tekshirish.
 *
 * Uchta bo'g'in tekshiriladi, chunki mijozga ulardan biri yetmasa ham
 * "ishlamayapti" bo'lib ko'rinadi:
 *   1. Sayt ochiladimi va yangi versiyasi turibdimi (o'rnatish sahifasi,
 *      ilova sozlamasi) — aks holda QR 404 ga olib boradi.
 *   2. ERP'da marketplace kaliti (MP_HMAC_SECRET) bormi — busiz ERP saytning
 *      har bir so'rovini rad etadi: katalog bo'sh, kirish kodi ketmaydi.
 *   3. Sayt ERP'ga haqiqatan ulana oladimi — saytning salomatlik javobidan.
 * (2026-09-18 da jonli saytda 1 va 2 bir vaqtda buzuq edi.)
 */
export async function POST() {
  const r = await qrRuxsat()
  if (!r.ok) return r.javob

  const manzil = await saqlanganManzil()
  if (!manzil) return NextResponse.json({ ok: false, xabar: 'Avval sayt manzilini kiriting', qadamlar: [] })

  const qadamlar: Qadam[] = []
  let asos: string
  try {
    asos = new URL(manzil).origin
  } catch {
    return NextResponse.json({ ok: false, xabar: 'Saqlangan manzil noto‘g‘ri', qadamlar: [] })
  }

  // 1. Sayt va o'rnatish sahifasi
  try {
    const javob = await fetch(manzil, { redirect: 'follow', signal: AbortSignal.timeout(12_000), cache: 'no-store' })
    const matn = javob.ok ? (await javob.text()).slice(0, 200_000) : ''
    if (!javob.ok) {
      qadamlar.push({
        nomi: 'Sayt va o‘rnatish sahifasi',
        ok: false,
        xabar: javob.status === 404
          ? 'Sayt ochildi, lekin «/ilova» sahifasi topilmadi — saytning yangi versiyasi serverga chiqarilmagan (Vercel’da Redeploy kerak).'
          : `Sayt ${javob.status} javob qaytardi.`,
      })
    } else if (!/rel="manifest"|manifest\.webmanifest/i.test(matn)) {
      qadamlar.push({ nomi: 'Sayt va o‘rnatish sahifasi', ok: false, xabar: 'Sahifa ochildi, lekin ilova sozlamasi (manifest) yo‘q — eski versiya turibdi, saytni qayta deploy qiling.' })
    } else {
      qadamlar.push({ nomi: 'Sayt va o‘rnatish sahifasi', ok: true, xabar: 'QR o‘rnatish sahifasini ochadi.' })
    }
  } catch (e) {
    qadamlar.push({
      nomi: 'Sayt va o‘rnatish sahifasi',
      ok: false,
      xabar: (e as Error)?.name === 'TimeoutError' ? 'Sayt 12 soniyada javob bermadi.' : 'Saytga ulanib bo‘lmadi — domenni tekshiring.',
    })
  }

  // 2. ERP'ning o'z kaliti — sayt so'rovlarini imzo bilan tekshirish uchun
  const kalit = process.env.MP_HMAC_SECRET ?? ''
  qadamlar.push(kalit.length >= 32
    ? { nomi: 'ERP’dagi marketplace kaliti', ok: true, xabar: 'MP_HMAC_SECRET o‘rnatilgan.' }
    : {
        nomi: 'ERP’dagi marketplace kaliti',
        ok: false,
        xabar: 'ERP serverida MP_HMAC_SECRET yo‘q (yoki 32 belgidan qisqa). Busiz sayt ERP’ga ulana olmaydi: katalog bo‘sh, kirish kodi Telegram’ga ketmaydi. ERP’ning Vercel sozlamalariga qo‘shing — qiymati saytdagi ERP_HMAC_SECRET bilan bir xil bo‘lsin.',
      })

  // 3. Sayt ERP'ga ulana oladimi (saytning salomatlik javobidan)
  try {
    const javob = await fetch(`${asos}/api/salomatlik`, { signal: AbortSignal.timeout(15_000), cache: 'no-store' })
    const s = await javob.json().catch(() => null) as { erp?: { ok?: boolean; sabab?: string; izoh?: string } } | null
    if (s?.erp?.ok) {
      qadamlar.push({ nomi: 'Sayt ↔ ERP aloqasi', ok: true, xabar: 'Sayt ERP’ga ulanyapti — katalog va kirish kodi ishlaydi.' })
    } else {
      qadamlar.push({
        nomi: 'Sayt ↔ ERP aloqasi',
        ok: false,
        xabar: s?.erp?.izoh
          ? `Sayt ERP’ga ulana olmayapti: ${s.erp.izoh}.`
          : 'Sayt ERP’ga ulana olmayapti. Sayt sozlamalarida ERP_BASE_URL va ERP_HMAC_SECRET ni tekshiring.',
      })
    }
  } catch {
    qadamlar.push({ nomi: 'Sayt ↔ ERP aloqasi', ok: false, xabar: 'Saytning salomatlik tekshiruvi javob bermadi.' })
  }

  const hammasi = qadamlar.every(q => q.ok)
  return NextResponse.json({
    ok: hammasi,
    xabar: hammasi ? 'Hammasi joyida: QR ishlaydi, mijozlar kirib buyurtma bera oladi.' : 'Quyidagilarni tuzatish kerak:',
    qadamlar,
  })
}
