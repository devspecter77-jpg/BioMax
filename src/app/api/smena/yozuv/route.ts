import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { omborTuri, ochir, saqla } from '@/lib/ovoz-ombor'
import { smenaXodimi } from '@/lib/smena-server'
import { YUKLASH_MAX_BAYT, kengaytma, toshkentKuni } from '@/lib/smena'

// Kuryer ilovasidan bitta ovoz bo'lagi (≈3 daqiqa) keladi.
//
// Ilova bo'laklarni avval telefonda saqlaydi va internet bo'lganda yuboradi —
// shuning uchun bo'lak smena tugagandan keyin, hatto ertasi kuni ham kelishi
// mumkin. Bir bo'lak qayta yuborilsa (javob yo'lda yo'qolgan) takror
// yozilmaydi: (smena, boshlangan vaqt) bo'yicha yagona.

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/** Smena chegarasidan shuncha tashqaridagi bo'lak ham qabul qilinadi (soat farqi). */
const CHEGARA_ZAXIRA_MS = 60 * 60_000
/** Shundan eski smenaga bo'lak qabul qilinmaydi. */
const KECH_QOLISH_MS = 7 * 86_400_000

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    const xodim = smenaXodimi(session)
    if (!xodim) return NextResponse.json({ xato: 'Ovoz yozuvi faqat kuryerlar uchun' }, { status: 403 })
    if (!omborTuri()) {
      // Ilova bo'lakni o'chirmaydi — ombor sozlangach o'zi yuboradi
      return NextResponse.json({ xato: 'Ovoz ombori sozlanmagan', kod: 'ombor_yoq' }, { status: 503 })
    }

    let fd: FormData
    try {
      fd = await req.formData()
    } catch {
      return NextResponse.json({ xato: 'So‘rov noto‘g‘ri', kod: 'notogri' }, { status: 400 })
    }
    const fayl = fd.get('audio')
    if (!(fayl instanceof Blob) || fayl.size === 0) {
      return NextResponse.json({ xato: 'Ovoz fayli yo‘q', kod: 'notogri' }, { status: 400 })
    }
    if (fayl.size > YUKLASH_MAX_BAYT) {
      return NextResponse.json({ xato: 'Bo‘lak juda katta', kod: 'katta' }, { status: 413 })
    }
    const mimeType = (fayl.type || 'audio/webm').slice(0, 80)
    if (!mimeType.startsWith('audio/')) {
      return NextResponse.json({ xato: 'Faqat ovoz fayli qabul qilinadi', kod: 'notogri' }, { status: 415 })
    }

    const smenaId = String(fd.get('smenaId') ?? '')
    const hozir = Date.now()
    // Telefon soati noto'g'ri bo'lsa (bir necha daqiqa oldinda/orqada) —
    // bo'lak vaqtlari server vaqtiga keltiriladi, aks holda smenadan
    // tashqarida qolib, rad etilardi
    const mijozVaqti = Number(fd.get('hozir'))
    const farq = Number.isFinite(mijozVaqti) && Math.abs(hozir - mijozVaqti) > 5_000 ? hozir - mijozVaqti : 0
    const boshlandi = Number(fd.get('boshlandi')) + farq
    const tugadi = Number(fd.get('tugadi')) + farq
    const darajaXom = Number(fd.get('daraja'))
    const daraja = Number.isFinite(darajaXom) && darajaXom >= 0 ? Math.min(1, darajaXom) : null

    if (!smenaId || !Number.isFinite(boshlandi) || !Number.isFinite(tugadi) || tugadi <= boshlandi) {
      return NextResponse.json({ xato: 'Bo‘lak vaqti noto‘g‘ri', kod: 'notogri' }, { status: 400 })
    }
    const davomiylikMs = Math.round(tugadi - boshlandi)
    if (davomiylikMs > 20 * 60_000) {
      return NextResponse.json({ xato: 'Bo‘lak juda uzun', kod: 'notogri' }, { status: 422 })
    }

    const smena = await prisma.smena.findUnique({
      where: { id: smenaId }, select: { id: true, xodimId: true, boshlandi: true, tugadi: true },
    })
    if (!smena || smena.xodimId !== xodim.id) {
      return NextResponse.json({ xato: 'Smena topilmadi', kod: 'smena_yoq' }, { status: 404 })
    }
    const oxiri = smena.tugadi?.getTime() ?? hozir
    if (hozir - oxiri > KECH_QOLISH_MS) {
      return NextResponse.json({ xato: 'Smena juda eski', kod: 'eski' }, { status: 410 })
    }
    if (boshlandi < smena.boshlandi.getTime() - CHEGARA_ZAXIRA_MS || tugadi > oxiri + CHEGARA_ZAXIRA_MS) {
      return NextResponse.json({ xato: 'Bo‘lak smena vaqtiga to‘g‘ri kelmaydi', kod: 'vaqt' }, { status: 422 })
    }

    const boshlandiSana = new Date(boshlandi)
    const bor = await prisma.ovozYozuv.findUnique({
      where: { smenaId_boshlandi: { smenaId, boshlandi: boshlandiSana } }, select: { id: true },
    })
    if (bor) return NextResponse.json({ ok: true, id: bor.id, takror: true })

    const kalit = [
      'ovozlar', xodim.id, toshkentKuni(boshlandi), smenaId,
      `${boshlandi}-${randomBytes(6).toString('hex')}.${kengaytma(mimeType)}`,
    ].join('/')
    await saqla(kalit, new Uint8Array(await fayl.arrayBuffer()), mimeType)

    try {
      const yozuv = await prisma.ovozYozuv.create({
        data: {
          smenaId, xodimId: xodim.id, boshlandi: boshlandiSana, tugadi: new Date(tugadi),
          davomiylikMs, hajm: fayl.size, mimeType, kalit, daraja,
        },
        select: { id: true },
      })
      // Bo'lak kelishi ham tiriklik belgisi
      if (!smena.tugadi) {
        await prisma.smena.updateMany({ where: { id: smenaId, tugadi: null }, data: { oxirgiPuls: new Date() } })
      }
      return NextResponse.json({ ok: true, id: yozuv.id }, { status: 201 })
    } catch (e) {
      // Bir vaqtda ikki marta yuborilgan — ikkinchisining fayli kerak emas
      if ((e as { code?: string })?.code === 'P2002') {
        await ochir(kalit).catch(() => {})
        return NextResponse.json({ ok: true, takror: true })
      }
      await ochir(kalit).catch(() => {})
      throw e
    }
  } catch (e) {
    console.error('[smena yozuv]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
