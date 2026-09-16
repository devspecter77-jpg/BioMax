import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { generateChekRaqami } from '@/lib/utils'
import { egaFilialWhere } from '@/lib/filial-scope'
import { tolovTaqsimoti, tolovUsuliMi, aralashTekshir, type AralashKiritma } from '@/lib/tolov-usullari'
import { sarflashniHisobla, sotuvdanToplanadi, ballSomda } from '@/lib/sodiqlik'
import { sodiqlikSozlamasi, balansOzgartir } from '@/lib/sodiqlik-server'
import { amalRuxsatiBormi } from '@/lib/ruxsat-server'
import { katalogBoyicha } from '@/lib/ruxsat-katalogi'
import { minNarxSomda, ruxsatYoqXabari, sotuvUchunKerak } from '@/lib/ruxsat-amallar'
import { joriyUsdKursi } from '@/lib/kurs'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const dan = searchParams.get('dan')
    const gacha = searchParams.get('gacha')
    const chekRaqami = searchParams.get('chekRaqami')
    const kassirId = searchParams.get('kassirId')
    const mijozId = searchParams.get('mijozId')
    const tolovUsuliParam = searchParams.get('tolovUsuli')
    const tolovUsuli = tolovUsuliMi(tolovUsuliParam) ? tolovUsuliParam : null
    const q = searchParams.get('q')
    const sort = searchParams.get('sort')
    const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc'

    // Chek raqami bo'yicha qidirish (qaytarish uchun)
    if (chekRaqami) {
      const sotuv = await prisma.sotuv.findFirst({
        where: { chekRaqami, ...egaFilialWhere(session) },
        include: {
          mijoz: { select: { ism: true, telefon: true } },
          kassir: { select: { ism: true } },
          tarkiblar: { include: { tovar: { select: { nomi: true, birlik: true } } } },
          nasiya: true,
        },
      })
      return NextResponse.json(sotuv ? { sotuvlar: [sotuv], jami: 1 } : { sotuvlar: [], jami: 0 })
    }

    const where: any = { ...egaFilialWhere(session) }
    if (dan || gacha) {
      where.sana = {}
      if (dan) where.sana.gte = new Date(dan)
      if (gacha) {
        const gachaD = new Date(gacha)
        gachaD.setHours(23, 59, 59)
        where.sana.lte = gachaD
      }
    }

    if (kassirId) where.kassirId = kassirId
    if (mijozId) where.mijozId = mijozId
    if (tolovUsuli) where.tolovUsuli = tolovUsuli
    if (q) {
      where.OR = [
        { chekRaqami: { contains: q, mode: 'insensitive' } },
        { mijoz: { ism: { contains: q, mode: 'insensitive' } } },
        { mijoz: { telefon: { contains: q } } },
      ]
    }

    const allowedSort = ['sana', 'yakuniySumma', 'chekRaqami']
    const sortField = allowedSort.includes(sort || '') ? sort! : 'sana'
    const orderBy = { [sortField]: order } as Record<string, 'asc' | 'desc'>

    const [sotuvlar, jami] = await Promise.all([
      prisma.sotuv.findMany({
        where,
        include: {
          mijoz: { select: { ism: true, telefon: true } },
          kassir: { select: { ism: true } },
          sherikDokon: { select: { nomi: true } },
          tarkiblar: {
            include: { tovar: { select: { nomi: true, birlik: true } } },
          },
          nasiya: true,
          qaytarishlar: {
            include: {
              tarkiblar: { include: { tovar: { select: { nomi: true, birlik: true } } } },
              kassir: { select: { ism: true } },
            },
            orderBy: { yaratilgan: 'desc' },
          },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.sotuv.count({ where }),
    ])

    return NextResponse.json({ sotuvlar, jami, page, limit })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })

    const data = await req.json()
    const kassirId = (session.user as any).id

    // To'lov usuli — enum'da yo'q qiymat kelsa sotuv butunlay yiqilardi
    // (Prisma xatosi), shuning uchun oldindan tekshiramiz.
    if (!tolovUsuliMi(data.tolovUsuli)) {
      return NextResponse.json({ xato: "Noma'lum to'lov usuli" }, { status: 400 })
    }

    const yakuniySumma = parseFloat(data.yakuniySumma)
    if (!Number.isFinite(yakuniySumma) || yakuniySumma < 0) {
      return NextResponse.json({ xato: "Noto'g'ri yakuniy summa" }, { status: 400 })
    }

    // ── Amal ruxsatlari: chegirma/bonus/narx pasaytirish va nasiya ──
    // Bo'lim ruxsatini proxy tekshirgan; bular esa so'rov mazmuniga bog'liq.
    // Narxlar bazadan olinadi — brauzer yuborgan narxga ishonilmaydi.
    {
      const tarkibIdlar = [...new Set(
        (Array.isArray(data.tarkiblar) ? data.tarkiblar as { tovarId?: unknown }[] : [])
          .map(t => String(t.tovarId ?? '')).filter(Boolean),
      )]
      const narxlar = tarkibIdlar.length === 0 ? [] : await prisma.tovar.findMany({
        where: { id: { in: tarkibIdlar } },
        select: { id: true, sotishNarxi: true, optomNarxi: true, bolishNarxi: true, valyuta: true },
      })
      const kursi = narxlar.some(t => t.valyuta === 'USD') ? (await joriyUsdKursi()).kursi : 0
      const minNarxlar = new Map(narxlar.map(t => [t.id, minNarxSomda(t, kursi)]))
      for (const kalit of sotuvUchunKerak(data, minNarxlar)) {
        if (!(await amalRuxsatiBormi(session, kalit))) {
          return NextResponse.json(ruxsatYoqXabari(kalit, katalogBoyicha.get(kalit)?.label ?? kalit), { status: 403 })
        }
      }
    }

    // ── Sodiqlik: sarflashni SERVERDA qayta hisoblash ──
    // Brauzer yuborgan qiymatga ishonib bo'lmaydi — balansdan ortiq
    // sarflash yoki chegarani chetlab o'tish mumkin bo'lardi. Shuning
    // uchun mijozning haqiqiy balansidan qayta hisoblanadi va client
    // ko'rsatgan yakuniy summa shunga MOS kelishi talab qilinadi.
    const sodiqlikSozlama = await sodiqlikSozlamasi()
    const soralganSarf = (data.sodiqlikSarf ?? {}) as { ball?: number; keshbek?: number }
    const sarfSoralgan = (Number(soralganSarf.ball) || 0) > 0 || (Number(soralganSarf.keshbek) || 0) > 0

    let sarflash = { ball: 0, keshbek: 0, jamiChegirma: 0 }
    if (sarfSoralgan) {
      if (!data.mijozId) {
        return NextResponse.json({ xato: 'Ball/keshbek sarflash uchun mijoz tanlanishi kerak' }, { status: 400 })
      }
      const mijozBalans = await prisma.mijoz.findFirst({
        where: { id: data.mijozId, ...egaFilialWhere(session) },
        select: { ballBalans: true, keshbekBalans: true },
      })
      if (!mijozBalans) return NextResponse.json({ xato: 'Mijoz topilmadi' }, { status: 404 })

      // Sodiqlikdan oldingi chek summasi = jami - chegirma
      const chekSummasi = (parseFloat(data.jamiSumma) || 0) - (parseFloat(data.chegirma) || 0)
      const hisob = sarflashniHisobla({
        chekSummasi,
        ballBalans: Number(mijozBalans.ballBalans),
        keshbekBalans: Number(mijozBalans.keshbekBalans),
        soralgan: soralganSarf,
        sozlama: sodiqlikSozlama,
      })

      // Client ko'rsatgan summa server hisobiga mos kelmasa — to'xtatamiz.
      // Jimgina "to'g'rilab" yuborish kassirga bir summa, mijozga boshqa
      // summa ko'rsatilishiga olib kelardi.
      const kutilganYakuniy = chekSummasi - hisob.jamiChegirma
      if (Math.abs(kutilganYakuniy - yakuniySumma) >= 1) {
        return NextResponse.json({
          xato: `Ball/keshbek balansi o'zgargan — sahifani yangilang. Hozirgi balans bo'yicha to'lov: ${Math.round(kutilganYakuniy).toLocaleString('uz-UZ')} so'm`,
        }, { status: 409 })
      }
      sarflash = { ball: hisob.ball, keshbek: hisob.keshbek, jamiChegirma: hisob.jamiChegirma }
    }

    // Ball so'mda qancha qoplagani — chekda va hisobotlarda shu ko'rinadi
    const sarflanganBallSom = ballSomda(sarflash.ball, sodiqlikSozlama)

    // Aralash to'lovda kanal summalarining yig'indisi yakuniy summaga teng
    // bo'lishi SHART. Bu tekshiruv brauzerda ham bor, lekin so'rovni to'g'ridan
    // to'g'ri yuborib chetlab o'tish mumkin — u holda kassa hisoboti jimgina
    // noto'g'ri bo'lib qolardi (masalan 100 000 lik sotuvda 30 000 qayd etilib).
    const aralash = data.aralash as AralashKiritma | undefined
    if (data.tolovUsuli === 'ARALASH') {
      const natija = aralashTekshir(aralash, yakuniySumma)
      if (!natija.ok) return NextResponse.json({ xato: natija.xato }, { status: 400 })
    }

    // Kanal summalari (naqd/karta/click/bank) — bitta usulli sotuvda
    // yakuniy summadan, aralashda esa kassir kiritgan qiymatlardan
    // (yuqorida yig'indisi tekshirilgan) hisoblanadi.
    const kanalSummalari = tolovTaqsimoti({
      tolovUsuli: data.tolovUsuli,
      yakuniySumma,
      aralash,
    })

    // Qulflangan tovarni sotib bo'lmaydi. Bu HAQIQIY himoya: POS ro'yxati
    // va skaner allaqachon ularni ko'rsatmaydi, lekin savatda tovar turgan
    // paytda qulflansa yoki so'rov to'g'ridan-to'g'ri yuborilsa shu yerda
    // to'xtatiladi.
    const sotilayotganIdlar = [...new Set(
      (data.tarkiblar as { tovarId: string }[]).map(t => t.tovarId).filter(Boolean),
    )]
    if (sotilayotganIdlar.length > 0) {
      const qulflanganlar = await prisma.tovar.findMany({
        where: { id: { in: sotilayotganIdlar }, qulflangan: true },
        select: { nomi: true },
      })
      if (qulflanganlar.length > 0) {
        return NextResponse.json({
          xato: `Qulflangan mahsulot sotilmaydi: ${qulflanganlar.map(t => t.nomi).join(', ')}`,
        }, { status: 400 })
      }
    }

    // Tranzaksiya: sotuv + ombor harakati + nasiya
    const sotuv = await prisma.$transaction(async (tx) => {
      // 1. Sotuv yaratish
      const yangiSotuv = await tx.sotuv.create({
        data: {
          chekRaqami: generateChekRaqami(),
          mijozId: data.mijozId || null,
          sherikDokonId: data.sherikDokonId || null,
          jamiSumma: parseFloat(data.jamiSumma),
          chegirma: parseFloat(data.chegirma || 0),
          yakuniySumma,
          tolovUsuli: data.tolovUsuli,
          ...kanalSummalari,
          // Sodiqlik hisobidan qoplangan qism — ikkalasi ham SO'MDA.
          // Ball soni (ochko) esa harakatlar jurnalida saqlanadi.
          ballIshlatilgan: sarflanganBallSom,
          keshbekIshlatilgan: sarflash.keshbek,
          kassirId,
          ...egaFilialWhere(session),
        },
      })

      // 2. Sotuv tarkiblarini kiritish va omborni kamaytirish
      for (const item of data.tarkiblar) {
        await tx.sotuvTarkibi.create({
          data: {
            sotuvId: yangiSotuv.id,
            tovarId: item.tovarId,
            miqdor: parseFloat(item.miqdor),
            birlikNarxi: parseFloat(item.birlikNarxi),
            chegirma: parseFloat(item.chegirma || 0),
            jami: parseFloat(item.jami),
          },
        })

        // Ombor harakati - chiqim (do'kondan sotuv)
        await tx.omborHarakati.create({
          data: {
            tovarId: item.tovarId,
            turi: 'CHIQIM',
            joy: 'DOKON',
            miqdor: parseFloat(item.miqdor),
            narx: parseFloat(item.birlikNarxi),
            sotuvId: yangiSotuv.id,
            izoh: `Sotuv: ${yangiSotuv.chekRaqami}`,
            foydalanuvchiId: kassirId,
          },
        })
      }

      // 3. Sherikdan olish (agar stock yetishmasa)
      if (data.sherikdanOlishlar && Array.isArray(data.sherikdanOlishlar)) {
        for (const so of data.sherikdanOlishlar) {
          let sherikId = so.sherikId
          // Yangi sherik yaratish
          if (!sherikId && so.yangiSherikIsm) {
            const yangiSherik = await tx.sherik.create({
              data: { ism: so.yangiSherikIsm, telefon: so.yangiSherikTelefon || null }
            })
            sherikId = yangiSherik.id
          }
          if (sherikId) {
            await tx.sherikdanOlish.create({
              data: {
                sotuvId: yangiSotuv.id,
                sherikId,
                tovarId: so.tovarId,
                miqdor: parseFloat(so.miqdor),
                narx: parseFloat(so.narx),
                jami: parseFloat(so.miqdor) * parseFloat(so.narx),
                izoh: so.izoh || null,
              }
            })
          }
        }
      }

      // 4. Nasiya yaratish (agar nasiya bo'lsa)
      if (data.tolovUsuli === 'NASIYA' && data.mijozId) {
        await tx.nasiya.create({
          data: {
            sotuvId: yangiSotuv.id,
            mijozId: data.mijozId,
            jamiQarz: parseFloat(data.yakuniySumma),
            tolangan: 0,
            qoldiq: parseFloat(data.yakuniySumma),
            muddat: data.nasiyaMuddat ? new Date(data.nasiyaMuddat) : null,
          },
        })
      }

      // 5. Sodiqlik: avval SARFLANGANI ayiriladi, keyin yangi to'planadi.
      //    Ikkalasi ham sotuv bilan BIR tranzaksiyada — sotuv bekor bo'lsa
      //    ball ham qolib ketmaydi.
      if (data.mijozId) {
        if (sarflash.keshbek > 0) {
          await balansOzgartir(tx, {
            mijozId: data.mijozId, hisob: 'KESHBEK', miqdor: -sarflash.keshbek,
            sabab: 'SARFLANDI', sotuvId: yangiSotuv.id,
            izoh: `Chek ${yangiSotuv.chekRaqami}`, foydalanuvchiId: kassirId,
          })
        }
        if (sarflash.ball > 0) {
          await balansOzgartir(tx, {
            mijozId: data.mijozId, hisob: 'BALL', miqdor: -sarflash.ball,
            sabab: 'SARFLANDI', sotuvId: yangiSotuv.id,
            izoh: `Chek ${yangiSotuv.chekRaqami}`, foydalanuvchiId: kassirId,
          })
        }

        // To'plash bazasidan ballar bilan qoplangan qism chiqariladi —
        // keshbek o'z ustiga keshbek bermasin.
        const toplanadi = sotuvdanToplanadi({
          yakuniySumma,
          sarflanganKeshbek: sarflash.keshbek,
          sarflanganBallSomda: sarflanganBallSom,
          tolovUsuli: data.tolovUsuli,
          sozlama: sodiqlikSozlama,
        })
        if (toplanadi.ball > 0) {
          await balansOzgartir(tx, {
            mijozId: data.mijozId, hisob: 'BALL', miqdor: toplanadi.ball,
            sabab: 'SOTUVDAN', sotuvId: yangiSotuv.id,
            izoh: `Chek ${yangiSotuv.chekRaqami}`, foydalanuvchiId: kassirId,
          })
        }
        if (toplanadi.keshbek > 0) {
          await balansOzgartir(tx, {
            mijozId: data.mijozId, hisob: 'KESHBEK', miqdor: toplanadi.keshbek,
            sabab: 'SOTUVDAN', sotuvId: yangiSotuv.id,
            izoh: `Chek ${yangiSotuv.chekRaqami}`, foydalanuvchiId: kassirId,
          })
        }
      }

      return yangiSotuv
    })

    const toliSotuv = await prisma.sotuv.findUnique({
      where: { id: sotuv.id },
      include: {
        tarkiblar: { include: { tovar: true } },
        mijoz: true,
        kassir: { select: { ism: true, telefon: true } },
        nasiya: true,
      },
    })

    // Telegram xabari ATAYLAB avtomatik yuborilmaydi.
    // Kassir chek oynasidagi "Telegramga yuborish" tugmasi orqali
    // o'zi qaror qiladi (POST /api/sotuvlar/[id]/chek-yuborish).
    // Sabab: har sotuvda avtomatik yuborish mijozni ham bezovta qilardi,
    // ham Telegram akkauntini spam filtriga yaqinlashtirardi.

    return NextResponse.json(toliSotuv, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ xato: 'Sotuv amalga oshmadi' }, { status: 500 })
  }
}
