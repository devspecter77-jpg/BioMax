import { NextResponse } from 'next/server'
import { qrRuxsat, saqlanganManzil } from '@/lib/ilova-qr-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 20

/**
 * QR kod ishlayaptimi — chop etishdan oldin tekshirish.
 *
 * Eng ko'p uchraydigan nosozlik: sayt hali yangilanmagan va `/ilova`
 * sahifasi yo'q (404). Bunda chop etilgan plakat foydasiz bo'ladi, shuning
 * uchun tugma bosilganda server saytga o'zi kirib ko'radi va nima
 * yetishmayotganini aytadi (brauzerdan tekshirish CORS'ga urilardi).
 */
export async function POST() {
  const r = await qrRuxsat()
  if (!r.ok) return r.javob

  const manzil = await saqlanganManzil()
  if (!manzil) return NextResponse.json({ ok: false, xabar: 'Avval sayt manzilini kiriting' })

  const boshqaruv = AbortSignal.timeout(12_000)
  try {
    const javob = await fetch(manzil, { redirect: 'follow', signal: boshqaruv, cache: 'no-store' })
    const matn = javob.ok ? (await javob.text()).slice(0, 200_000) : ''
    const ilovaSahifasi = /Ilovani o‘rnatish|Ilovani o'rnatish|ilova/i.test(matn)
    const manifestBor = /rel="manifest"|manifest\.webmanifest/i.test(matn)

    if (!javob.ok) {
      return NextResponse.json({
        ok: false,
        holat: javob.status,
        xabar: javob.status === 404
          ? 'Sayt ochildi, lekin «/ilova» sahifasi topilmadi — saytning yangi versiyasi hali serverga chiqarilmagan (deploy kerak).'
          : `Sayt ${javob.status} javob qaytardi.`,
      })
    }
    if (!manifestBor) {
      return NextResponse.json({
        ok: false,
        holat: 200,
        xabar: 'Sahifa ochildi, lekin ilova sozlamasi (manifest) topilmadi — eski versiya turibdi, saytni yangilang.',
      })
    }
    return NextResponse.json({
      ok: true,
      holat: 200,
      yakuniy: javob.url,
      xabar: ilovaSahifasi
        ? 'Hammasi joyida: QR kod o‘rnatish sahifasini ochadi.'
        : 'Sahifa ochildi va ilova sozlamasi bor.',
    })
  } catch (e) {
    const vaqt = (e as Error)?.name === 'TimeoutError'
    return NextResponse.json({
      ok: false,
      xabar: vaqt
        ? 'Sayt javob bermadi (12 soniya kutildi). Domen ishlayaptimi, tekshiring.'
        : 'Saytga ulanib bo‘lmadi. Domen yoki internet aloqasini tekshiring.',
    })
  }
}
