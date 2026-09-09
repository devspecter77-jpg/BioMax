// Next.js server ishga tushganda bir marta chaqiriladi.
//
// Vazifasi — kunlik hisobotni O'Z SERVERIDA (localhost yoki VPS) yuborish.
// Vercel'da bu ishlamaydi (serverless jarayon uzoq yashamaydi), u yerda
// `vercel.json` dagi cron `/api/cron/kunlik-hisobot` ni chaqiradi.
// Ikkalasi ham bir xil funksiyani chaqiradi va `KunlikHisobotLog` unique
// indeksi tufayli bir kunda bir marta yuboriladi — ikkalasi yonma-yon
// ishlasa ham takroriy xabar bo'lmaydi.

// Tekshirish oralig'i. Soat aniqligi yetarli — 10 daqiqa kifoya va
// baza yuki deyarli nolga teng (bitta sozlama so'rovi).
const ORALIQ_MS = 10 * 60 * 1000

// Dev rejimda hot reload `register()` ni qayta chaqirishi mumkin —
// global bayroq ikkinchi taymerni oldini oladi.
const g = globalThis as unknown as { __kunlikHisobotTimer?: NodeJS.Timeout }

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  // Vercel'da cron ishlatiladi — bu yerda taymer keraksiz (va ishlamaydi ham)
  if (process.env.VERCEL) return
  if (g.__kunlikHisobotTimer) return

  const tekshir = async () => {
    try {
      const { kunlikHisobotlarniYubor } = await import('@/lib/kunlik-hisobot-server')
      const natija = await kunlikHisobotlarniYubor({ soatTekshir: true })
      if (natija.yuborildi > 0) {
        console.log(`[KunlikHisobot] ${natija.yuborildi} ta admin(ga) yuborildi`)
      }
    } catch (e) {
      // Rejalashtiruvchi xatosi serverni to'xtatmasligi kerak
      console.error('[KunlikHisobot] Rejalashtiruvchi xatosi:', e)
    }
  }

  g.__kunlikHisobotTimer = setInterval(tekshir, ORALIQ_MS)
  // Taymer Node jarayonini tirik ushlab turmasin
  g.__kunlikHisobotTimer.unref?.()

  // Server ko'tarilganda darhol bir marta — kun davomida qayta ishga
  // tushirilsa ham o'sha kungi hisobot yo'qolmaydi.
  setTimeout(tekshir, 30_000).unref?.()

  console.log('[KunlikHisobot] Rejalashtiruvchi yoqildi')
}
