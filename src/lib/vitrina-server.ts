import { createHash } from 'node:crypto'
import { prisma } from './prisma'
import { aksiyaAmali } from './vitrina'

// Onlayn vitrina — baza bilan ishlaydigan qism.

let oxirgiTekshiruv = 0

/**
 * Vaqti kelgan aksiyalarni qo'llash va tugaganlarini qaytarish.
 *
 * Rejalashtiruvchiga (cron) TAYANMAYDI: katalog, kassa ro'yxati va vitrina
 * sahifasi ochilganda chaqiriladi — server qayta ishga tushsa ham, cron
 * ishlamasa ham narx kechikmasdan to'g'ri bo'ladi. 30 soniyada bir martadan
 * ko'p bazaga bormaydi.
 */
export async function aksiyalarniYangila(majburiy = false): Promise<{ qollandi: number; qaytarildi: number }> {
  const hozir = Date.now()
  if (!majburiy && hozir - oxirgiTekshiruv < 30_000) return { qollandi: 0, qaytarildi: 0 }
  oxirgiTekshiruv = hozir

  const nomzodlar = await prisma.tovarKartochka.findMany({
    where: {
      aksiyaNarxi: { not: null },
      OR: [
        { aksiyaEskiNarx: null, aksiyaBoshi: { lte: new Date(hozir) } },
        { aksiyaOxiri: { lte: new Date(hozir) } },
      ],
    },
    select: { id: true, tovarId: true, aksiyaNarxi: true, aksiyaBoshi: true, aksiyaOxiri: true, aksiyaEskiNarx: true },
  })

  let qollandi = 0
  let qaytarildi = 0
  for (const k of nomzodlar) {
    const a = {
      aksiyaNarxi: k.aksiyaNarxi === null ? null : Number(k.aksiyaNarxi),
      aksiyaBoshi: k.aksiyaBoshi,
      aksiyaOxiri: k.aksiyaOxiri,
      aksiyaEskiNarx: k.aksiyaEskiNarx === null ? null : Number(k.aksiyaEskiNarx),
    }
    const amal = aksiyaAmali(a, hozir)
    if (!amal) continue

    await prisma.$transaction(async tx => {
      // Qatorni qayta o'qish va shart bilan yozish: ikki parallel chaqiruv
      // narxni ikki marta almashtirib, "eski narx" sifatida aksiya narxini saqlab qo'ymasin
      const tovar = await tx.tovar.findUnique({ where: { id: k.tovarId }, select: { sotishNarxi: true } })
      if (!tovar) return
      if (amal === 'qolla') {
        const n = await tx.tovarKartochka.updateMany({
          where: { id: k.id, aksiyaEskiNarx: null },
          data: { aksiyaEskiNarx: tovar.sotishNarxi },
        })
        if (n.count === 0) return
        await tx.tovar.update({ where: { id: k.tovarId }, data: { sotishNarxi: a.aksiyaNarxi! } })
        qollandi++
      } else {
        const n = await tx.tovarKartochka.updateMany({
          where: { id: k.id, aksiyaNarxi: { not: null } },
          data: { aksiyaNarxi: null, aksiyaBoshi: null, aksiyaOxiri: null, aksiyaEskiNarx: null },
        })
        if (n.count === 0) return
        // Aksiya davomida xodim narxni qo'lda o'zgartirgan bo'lsa, uning qarori saqlanadi
        if (amal === 'qaytar' && Number(tovar.sotishNarxi) === a.aksiyaNarxi) {
          await tx.tovar.update({ where: { id: k.tovarId }, data: { sotishNarxi: a.aksiyaEskiNarx! } })
        }
        qaytarildi++
      }
    })
  }
  if (qollandi || qaytarildi) console.log(`[aksiya] qo‘llandi: ${qollandi}, qaytarildi: ${qaytarildi}`)
  return { qollandi, qaytarildi }
}

/**
 * Rasm versiyasi — marketplace keshini rasm o'zgarganda yangilash uchun.
 * Bazadagi `rasmVersiyalari` bilan AYNAN bir xil formula (md5, 12 belgi).
 */
export function rasmVersiyasi(dataUrl: string): string {
  return createHash('md5').update(dataUrl).digest('hex').slice(0, 12)
}

/** Ko'p mahsulot rasm versiyalari — hisob bazada, rasmlarning o'zi tarmoqdan o'tmaydi. */
export async function rasmVersiyalari(tovarIds: string[]): Promise<Map<string, string[]>> {
  if (tovarIds.length === 0) return new Map()
  const qatorlar = await prisma.$queryRawUnsafe<{ id: string; v: string[] | null }[]>(
    `SELECT id, ARRAY(SELECT left(md5(r), 12) FROM unnest(rasmlar) WITH ORDINALITY AS u(r, i) ORDER BY i) AS v
     FROM public.tovarlar WHERE id = ANY($1::text[])`,
    tovarIds,
  )
  return new Map(qatorlar.map(q => [q.id, q.v ?? []]))
}

/** `data:image/jpeg;base64,...` → baytlar va turi. */
export function rasmniOch(dataUrl: string): { turi: string; baytlar: Buffer } | null {
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(dataUrl)
  if (!m) return null
  return { turi: m[1]!, baytlar: Buffer.from(m[2]!, 'base64') }
}
