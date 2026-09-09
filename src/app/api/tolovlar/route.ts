import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { sessionFilialId, sessionIsRealEga, sessionEgaId } from '@/lib/filial-scope'
import { getReportDateRange, type ReportTur } from '@/lib/hisobotlar'
import { KANAL_USULLARI, KANAL_MAYDONI, type KanalUsuli } from '@/lib/tolov-usullari'
import { bolimRuxsatiBormi } from '@/lib/ruxsat-server'

// To'lovlar bo'limi — do'konga KIRGAN va do'kondan CHIQQAN pul,
// to'lov usuli va filial kesimida.
//
// Ko'rish doirasi (/api/filiallar bilan bir xil mantiq):
//   • filialga bog'langan xodim — faqat o'z filiali
//   • haqiqiy Ega — BARCHA filiallar + o'zining filialsiz (markaziy) yozuvlari,
//     xohlasa ?filialId= bilan bittasini tanlaydi
//
// Uchta manba qo'shiladi:
//   KIRIM  — Sotuv kanal ustunlari (naqd/karta/click/bank) + NasiyaTolov
//   CHIQIM — XaridTolov (ta'minotchiga to'langan pul)
// Qaytarishlar kirimdan ayriladi (sof kirim).
//
// `Xarid` modelida filialId yo'q, lekin `Taminotchi` filialga bog'langan —
// shuning uchun ta'minotchiga to'lov ta'minotchining filiali bo'yicha
// doiralanadi va shu filialga yoziladi.

type KanalYigindi = Record<KanalUsuli, number> & { jami: number }

function bosh(): KanalYigindi {
  return { NAQD: 0, KARTA: 0, CLICK: 0, BANK: 0, jami: 0 }
}

function qosh(y: KanalYigindi, usul: KanalUsuli, summa: number) {
  if (!(summa > 0)) return
  y[usul] += summa
  y.jami += summa
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    // Sahifa proxy.ts'da yopilgan bo'lsa, API ham yopiq bo'lishi kerak —
    // aks holda ruxsatsiz xodim marshrutni to'g'ridan-to'g'ri chaqira oladi.
    if (!bolimRuxsatiBormi(session, 'tolovlar')) {
      return NextResponse.json({ xato: "Bu bo'limga ruxsatingiz yo'q" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const tur = (searchParams.get('tur') || 'oylik') as ReportTur
    const { dan, gacha } = getReportDateRange(
      tur,
      searchParams.get('dan') || undefined,
      searchParams.get('gacha') || undefined,
    )

    const ownFilialId = sessionFilialId(session)
    const isEga = sessionIsRealEga(session)
    const soralganFilial = searchParams.get('filialId')

    // Doira: filial xodimi — o'z filiali; Ega — hammasi (yoki tanlangani).
    // filialId/egaId ustunlariga ega har qanday modelga (Sotuv, Mijoz,
    // Taminotchi) bir xil qo'llaniladi.
    let doira: Record<string, unknown>
    if (ownFilialId) {
      doira = { filialId: ownFilialId }
    } else if (isEga && soralganFilial) {
      doira = soralganFilial === 'markaziy'
        ? { filialId: null, egaId: sessionEgaId(session) }
        : { filialId: soralganFilial }
    } else if (isEga) {
      doira = {} // barcha filiallar + markaziy
    } else {
      // Ulashilgan admin — faqat o'z (ulashgan) katalogi
      doira = { filialId: null, egaId: sessionEgaId(session) }
    }

    // Nasiya to'lovi filialga MIJOZ orqali bog'lanadi (o'zida filialId yo'q),
    // ta'minotchiga to'lov esa XARID → TA'MINOTCHI orqali.
    const nasiyaDoira = isEga && !soralganFilial ? {} : { nasiya: { mijoz: doira } }
    const xaridDoira = isEga && !soralganFilial ? {} : { xarid: { taminotchi: doira } }

    const [sotuvlar, nasiyaTolovlar, qaytarishlar, xaridTolovlar, filiallar] = await Promise.all([
      prisma.sotuv.findMany({
        where: {
          holati: 'YAKUNLANGAN',
          sana: { gte: dan, lt: gacha },
          ...doira,
        },
        select: {
          id: true, chekRaqami: true, sana: true, filialId: true, tolovUsuli: true,
          naqdTolangan: true, kartaTolangan: true, clickTolangan: true, bankTolangan: true,
          mijoz: { select: { ism: true } },
          kassir: { select: { ism: true } },
        },
        orderBy: { sana: 'desc' },
      }),
      prisma.nasiyaTolov.findMany({
        where: { sana: { gte: dan, lt: gacha }, ...nasiyaDoira },
        select: {
          id: true, summa: true, tolovUsuli: true, sana: true,
          nasiya: { select: { mijoz: { select: { ism: true, filialId: true } } } },
          qabulQiluvchi: { select: { ism: true } },
        },
        orderBy: { sana: 'desc' },
      }),
      prisma.qaytarish.aggregate({
        where: { yaratilgan: { gte: dan, lt: gacha }, aslSotuv: doira },
        _sum: { jamiSumma: true },
      }),
      prisma.xaridTolov.findMany({
        where: { sana: { gte: dan, lt: gacha }, ...xaridDoira },
        select: {
          id: true, summa: true, tolovUsuli: true, sana: true,
          xarid: { select: { taminotchi: { select: { nomi: true, filialId: true } } } },
          qabulQiluvchi: { select: { ism: true } },
        },
        orderBy: { sana: 'desc' },
      }),
      prisma.filial.findMany({ select: { id: true, nomi: true }, orderBy: { yaratilgan: 'asc' } }),
    ])

    // ── Yig'indilar ──
    const jami = bosh()
    const sotuvdan = bosh()
    const nasiyadan = bosh()
    const chiqim = bosh()

    // filialId (yoki 'markaziy') -> { kirim, chiqim }
    const filialBoyicha = new Map<string, { kirim: KanalYigindi; chiqim: KanalYigindi }>()

    function filialYigindi(filialId: string | null) {
      const kalit = filialId ?? 'markaziy'
      let y = filialBoyicha.get(kalit)
      if (!y) { y = { kirim: bosh(), chiqim: bosh() }; filialBoyicha.set(kalit, y) }
      return y
    }

    for (const s of sotuvlar) {
      const fy = filialYigindi(s.filialId)
      for (const usul of KANAL_USULLARI) {
        const summa = Number(s[KANAL_MAYDONI[usul]])
        qosh(jami, usul, summa)
        qosh(sotuvdan, usul, summa)
        qosh(fy.kirim, usul, summa)
      }
    }

    for (const n of nasiyaTolovlar) {
      const usul = n.tolovUsuli as KanalUsuli
      if (!KANAL_USULLARI.includes(usul)) continue
      const summa = Number(n.summa)
      qosh(jami, usul, summa)
      qosh(nasiyadan, usul, summa)
      qosh(filialYigindi(n.nasiya.mijoz.filialId).kirim, usul, summa)
    }

    for (const x of xaridTolovlar) {
      const usul = x.tolovUsuli as KanalUsuli
      if (!KANAL_USULLARI.includes(usul)) continue
      const summa = Number(x.summa)
      qosh(chiqim, usul, summa)
      qosh(filialYigindi(x.xarid?.taminotchi?.filialId ?? null).chiqim, usul, summa)
    }

    const qaytarish = Number(qaytarishlar._sum.jamiSumma || 0)

    const filialNomi = new Map(filiallar.map(f => [f.id, f.nomi]))
    const filialQatorlar = Array.from(filialBoyicha.entries())
      .map(([kalit, y]) => ({
        id: kalit,
        nomi: kalit === 'markaziy' ? 'Markaziy' : (filialNomi.get(kalit) ?? "O'chirilgan filial"),
        ...y.kirim,
        chiqim: y.chiqim.jami,
      }))
      .sort((a, b) => b.jami - a.jami)

    // ── Tranzaksiyalar ro'yxati (aralash, sana bo'yicha) ──
    const tranzaksiyalar = [
      ...sotuvlar.map(s => ({
        id: 's:' + s.id,
        turi: 'sotuv' as const,
        sana: s.sana,
        nomi: s.chekRaqami,
        kim: s.mijoz?.ism ?? null,
        xodim: s.kassir?.ism ?? null,
        filialId: s.filialId,
        kanallar: KANAL_USULLARI
          .map(u => ({ usul: u, summa: Number(s[KANAL_MAYDONI[u]]) }))
          .filter(k => k.summa > 0),
        jami: KANAL_USULLARI.reduce((t, u) => t + Number(s[KANAL_MAYDONI[u]]), 0),
      })).filter(s => s.jami > 0),
      ...nasiyaTolovlar.map(n => ({
        id: 'n:' + n.id,
        turi: 'nasiya' as const,
        sana: n.sana,
        nomi: 'Nasiya to‘lovi',
        kim: n.nasiya.mijoz.ism,
        xodim: n.qabulQiluvchi?.ism ?? null,
        filialId: n.nasiya.mijoz.filialId,
        kanallar: [{ usul: n.tolovUsuli as KanalUsuli, summa: Number(n.summa) }],
        jami: Number(n.summa),
      })),
      ...xaridTolovlar.map(x => ({
        id: 'x:' + x.id,
        turi: 'xarid' as const,
        sana: x.sana,
        nomi: x.xarid?.taminotchi?.nomi ?? "Ta'minotchi",
        kim: null,
        xodim: x.qabulQiluvchi?.ism ?? null,
        filialId: x.xarid?.taminotchi?.filialId ?? null,
        kanallar: [{ usul: x.tolovUsuli as KanalUsuli, summa: Number(x.summa) }],
        jami: Number(x.summa),
      })),
    ]
      .sort((a, b) => new Date(b.sana).getTime() - new Date(a.sana).getTime())
      .slice(0, 300)

    return NextResponse.json({
      davr: { dan, gacha },
      jami,
      manbalar: { sotuvdan, nasiyadan },
      qaytarish,
      sofKirim: jami.jami - qaytarish,
      chiqim,
      filiallar: filialQatorlar,
      // Ega filial tanlay oladi; filial xodimi yo'q
      filialRoyxati: isEga ? filiallar : [],
      egaMi: isEga,
      tranzaksiyalar,
    })
  } catch (e) {
    console.error('[tolovlar]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
