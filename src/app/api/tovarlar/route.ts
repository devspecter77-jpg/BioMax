import { NextRequest, NextResponse } from 'next/server'
import type { Prisma, TovarHolati } from '@prisma/client'
import { aksiyalarniYangila } from '@/lib/vitrina-server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { normalizeUzbek, toKirill, toLotin } from '@/lib/utils'
import { getStockMap } from '@/lib/stock'
import { sessionFilialId, sessionEgaId, sessionIsRealEga, egaFilialWhere } from '@/lib/filial-scope'
import { tovarYozishRuxsatlari } from '@/lib/tovar-ruxsat'
import { rasmlarniSiqish } from '@/lib/rasm'
import { joriyUsdKursi } from '@/lib/kurs'
import { foydalanuvchiYashirilganMaydonlari, maydonlarniYashir } from '@/lib/maydon-yashirish'
import { amalRuxsatiBormi } from '@/lib/ruxsat-server'
import { tovarKategoriyasi, yangiOmborSoralgan, JoyXatosi } from '@/lib/tovar-ombori-server'
import { birlikNarxlariniJoyla, birlikTozala, narxKiritmasiniOqi, oramlarniTekshir } from '@/lib/birlik'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })

    // Vaqti kelgan onlayn aksiya narxlari kassaga ham darhol o'tsin (cron'ga tayanmasdan)
    await aksiyalarniYangila()

    const { searchParams } = new URL(req.url)
    const qidiruv = searchParams.get('q') || ''
    const kategoriyaId = searchParams.get('kategoriya') || ''
    const holati = searchParams.get('holati') || 'FAOL'
    const page = parseInt(searchParams.get('page') || '1')
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam) : 0

    const ownFilialId = sessionFilialId(session)
    const foydalanuvchiId = session.user.id
    // Ega (filialsiz) — standart holatda faqat OZINING mahsulotlarini ko'radi.
    // ?filialId= bilan ixtiyoriy ravishda boshqa bitta filialni tanlab ko'rishi mumkin
    // (faqat haqiqiy Ega uchun — ulashilgan admin bunday tanlov qila olmaydi).
    // Filialga bog'langan foydalanuvchi esa har doim faqat o'z filialiga qulflangan.
    const isRealEga = sessionIsRealEga(session)
    const filialId = ownFilialId || (isRealEga ? searchParams.get('filialId') : null) || null
    const where: Prisma.TovarWhereInput = { filialId }
    if (!filialId) {
      // Filialsiz katalog — Ega o'zi yoki u ulashgan admin bo'lsa, faqat
      // o'sha Eganing mahsulotlari (jonli, nusxasiz — egaId orqali).
      where.egaId = sessionEgaId(session)
    }
    if (holati !== 'BARCHASI') where.holati = holati as TovarHolati
    // Sotuv (POS) qulflangan tovarlarni umuman ko'rmasligi kerak.
    // Filtrlash SERVERDA: mijoz tomonda yashirish yetarli emas, chunki
    // javobni to'g'ridan-to'g'ri o'qish mumkin.
    if (searchParams.get('sotuvUchun') === '1') where.qulflangan = false
    // Katalogda esa faqat qulflanganlarni ko'rish uchun
    else if (searchParams.get('qulflangan') === '1') where.qulflangan = true
    if (kategoriyaId) where.kategoriyaId = kategoriyaId
    if (qidiruv) {
      const normalized = normalizeUzbek(qidiruv)
      const apostroflar = ["'", '`', 'ʻ', 'ʼ', '\u2018', '\u2019']
      // Lotin va kirill variantlarini qidirish — foydalanuvchi qaysi yozuvda yozgani muhim emas
      const kirill = toKirill(normalized)
      // Uzbek kirill э vs Rus kirill е — ikkalasida ham tekshirish
      const kirillRu = kirill.replace(/э/g, 'е').replace(/Э/g, 'Е')
      const kirillUz = kirill.replace(/е/g, 'э').replace(/Е/g, 'Э')
      const skriptlar = Array.from(new Set([normalized, kirill, kirillRu, kirillUz, toLotin(normalized)]))
      const variantlar = skriptlar.flatMap(s => apostroflar.map(a => s.replace(/'/g, a)))
      // "12", "№12", "#12" — yorliqdagi tartib raqami bilan ham topiladi
      const raqam = /^\s*(?:№|#)?\s*(\d{1,9})\s*$/.exec(qidiruv)
      where.OR = [
        ...variantlar.map(v => ({ nomi: { contains: v, mode: 'insensitive' as const } })),
        { shtrixKod: { contains: normalized } },
        ...(raqam ? [{ tartibRaqami: Number(raqam[1]) }] : []),
      ]
    }

    // foydalanuvchiYashirilganMaydonlari tovarlar natijasiga bog'liq emas —
    // uch(tasi ham) parallel yuboriladi (cross-region DB'da har bir ketma-ket
    // so'rov qo'shimcha round-trip vaqti qo'shadi).
    const [tovarlar, jami, yashirilganMaydonlar] = await Promise.all([
      prisma.tovar.findMany({
        where,
        include: { kategoriya: true, taminotchi: { select: { id: true, nomi: true } } },
        orderBy: { nomi: 'asc' },
        ...(limit > 0 ? { skip: (page - 1) * limit, take: limit } : {}),
      }),
      prisma.tovar.count({ where }),
      foydalanuvchiYashirilganMaydonlari(foydalanuvchiId),
    ])

    // SQL aggregatsiya — omborHarakati yuklanmaydi. tovarlar ID'lariga
    // bog'liq bo'lgani uchun bu alohida (ketma-ket) qoladi.
    const stockMap = await getStockMap(tovarlar.map(t => t.id))

    const tovarlarQoldiq = tovarlar.map((t) => {
      const stock = stockMap.get(t.id)
      return maydonlarniYashir({ ...t, qoldiq: stock?.dokonQoldiq ?? 0 }, yashirilganMaydonlar)
    })

    return NextResponse.json({ tovarlar: tovarlarQoldiq, jami, page, limit })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

async function keyingiShtrixKod(filialId: string | null): Promise<string> {
  const barchasi = await prisma.tovar.findMany({
    where: { shtrixKod: { not: null }, filialId },
    select: { shtrixKod: true }
  })
  const raqamlar = new Set(
    barchasi.map(t => parseInt(t.shtrixKod!)).filter(n => Number.isInteger(n) && n > 0)
  )
  let keyingi = 1
  while (raqamlar.has(keyingi)) keyingi++
  return String(keyingi)
}

// Erkin matnli manzil: bo'sh qiymat null bo'lib saqlanadi (bo'sh satr
// "kiritilgan" deb ko'rinmasin) va uzunligi cheklanadi.
const MANZIL_MAX = 300
function manzilTozala(qiymat: unknown): string | null {
  const matn = String(qiymat ?? '').trim()
  if (!matn) return null
  return matn.slice(0, MANZIL_MAX)
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })

    const data = await req.json()
    const filialId = sessionFilialId(session)
    const egaId = filialId ? null : sessionEgaId(session)

    // Ulashilgan admin — tahrirlash ruxsati bo'lmasa, yangi mahsulot ham
    // qo'sha olmaydi (yozish huquqi bir xil belgi bilan boshqariladi).
    // Bazadan jonli o'qiladi — Ega ruxsatni o'zgartirsa, qayta login
    // qilinmasdan darhol kuchga kiradi.
    const { tahrirlashMumkin } = await tovarYozishRuxsatlari(session)
    if (!filialId && !tahrirlashMumkin) {
      return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })
    }

    // Shtrix kod yo'q bo'lsa ketma-ketlikdagi bo'sh raqamni topib berish
    // Ta'minotchi SHU doiradan bo'lishi kerak — boshqa Eganing
    // ta'minotchisiga tovar bog'lab bo'lmasin.
    let taminotchiId: string | null = null
    if (data.taminotchiId) {
      const tam = await prisma.taminotchi.findFirst({
        where: { id: data.taminotchiId, ...(filialId ? { filialId } : { egaId }) },
        select: { id: true },
      })
      if (!tam) return NextResponse.json({ xato: "Ta'minotchi topilmadi" }, { status: 400 })
      taminotchiId = tam.id
    }

    // O'lchov birligi (tayyor yoki o'zi yozgani) va qo'shimcha birliklar (karobka, qop…)
    const birlik = data.birlik === undefined || data.birlik === '' ? 'DONA' : birlikTozala(data.birlik)
    if (!birlik) return NextResponse.json({ xato: "O'lchov birligi noto'g'ri — 20 belgigacha nom yozing" }, { status: 400 })
    const oramTekshiruv = oramlarniTekshir(data.oramlar, birlik)
    if (!oramTekshiruv.ok) return NextResponse.json({ xato: oramTekshiruv.xato }, { status: 400 })
    // Har bir birlikning o'z narxi (1 dona — 1 300, 1 blok — 75 000): o'ramga
    // o'z narxi, bazaga — bir asosiy birlik narxi (lib/birlik.ts)
    const kiritma = narxKiritmasiniOqi(data)
    const narxlar = birlikNarxlariniJoyla(oramTekshiruv.oramlar, kiritma.birliklar, kiritma.kelish)
    const asosiySotish = narxlar.asosiy.sotish
    if (asosiySotish === null) {
      return NextResponse.json({ xato: 'Sotish narxini kiriting — 1 dona yoki o‘ram uchun' }, { status: 400 })
    }

    const autoShtrixKod = data.shtrixKod?.trim() || await keyingiShtrixKod(filialId)
    const rasmlar = await rasmlarniSiqish(data.rasmlar)

    // Yaratilgan paytdagi USD kursi — keyin kurs o'zgarsa ham bu tovar
    // qanday kursda kiritilgani ma'lum bo'lib qoladi. `joriyUsdKursi`
    // kunlik keshlangan, shuning uchun har yaratishda tashqi so'rov
    // yuborilmaydi. Kurs olinmasa ham mahsulot yaratilishi to'xtamasligi
    // kerak — shuning uchun xato yutiladi.
    const kursQiymati = await joriyUsdKursi()
      .then(k => k.kursi)
      .catch(() => null)

    // Formada yangi ombor yozilgan bo'lsa — ruxsat tranzaksiyadan oldin tekshiriladi
    const omborYaratish = yangiOmborSoralgan(data) && await amalRuxsatiBormi(session, 'omborlar.boshqarish')

    // Ombor va kategoriya (kerak bo'lsa yangisi), mahsulot va boshlang'ich
    // kirim — bitta tranzaksiyada: biri saqlanmasa, hech biri qolmaydi.
    const tovar = await prisma.$transaction(async tx => {
      const kategoriyaId = await tovarKategoriyasi(tx, egaFilialWhere(session), data, omborYaratish)
      const yangi = await tx.tovar.create({
        data: {
          nomi: data.nomi,
          kategoriyaId,
          shtrixKod: autoShtrixKod,
          filialId,
          egaId,
          kelishNarxi: narxlar.asosiy.kelish ?? 0,
          sotishNarxi: asosiySotish,
          optomNarxi: narxlar.asosiy.optom,
          bolishNarxi: narxlar.asosiy.bolish,
          valyuta: data.valyuta === 'USD' ? 'USD' : 'UZS',
          birlik,
          oramlar: narxlar.oramlar,
          minimalQoldiq: parseInt(data.minimalQoldiq) || 5,
          taminotchiId,
          keltirilganManzil: manzilTozala(data.keltirilganManzil),
          yaratilganKursi: kursQiymati,
          rasmlar,
          yaroqlilikMuddati: data.yaroqlilikMuddati ? new Date(data.yaroqlilikMuddati) : null,
        },
        // Ombori bilan — forma oxirgi tanlovni eslab qoladi
        include: { kategoriya: { include: { ombor: { select: { id: true, nomi: true } } } } },
      })

      // Boshlang'ich qoldiq kiritilsa — to'g'ridan-to'g'ri do'konga (sotuvga tayyor)
      if (data.boshlangichQoldiq && parseFloat(data.boshlangichQoldiq) > 0) {
        await tx.omborHarakati.create({
          data: {
            tovarId: yangi.id,
            turi: 'KIRIM',
            joy: 'DOKON',
            miqdor: parseFloat(data.boshlangichQoldiq),
            narx: narxlar.asosiy.kelish ?? 0,
            // Boshlang'ich kirim ham ta'minotchiga bog'lanadi: "bu partiya
            // kimdan keldi" degan savolga ombor tarixi javob beradi.
            taminotchiId,
            // Manzil harakat izohiga ham yoziladi: mahsulot kartasidagi qiymat
            // keyin o'zgartirilsa ham, shu PARTIYA qayerdan kelgani tarixda qoladi.
            izoh: yangi.keltirilganManzil
              ? `Boshlang'ich qoldiq · ${yangi.keltirilganManzil}`
              : "Boshlang'ich qoldiq",
            foydalanuvchiId: session.user.id,
          },
        })
      }
      return yangi
    }, { maxWait: 10_000, timeout: 30_000 })

    return NextResponse.json(tovar, { status: 201 })
  } catch (e) {
    if (e instanceof JoyXatosi) return NextResponse.json({ xato: e.message }, { status: e.status })
    if ((e as { code?: string })?.code === 'P2002') {
      return NextResponse.json({ xato: 'Bu shtrix-kod allaqachon mavjud' }, { status: 400 })
    }
    console.error(e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
