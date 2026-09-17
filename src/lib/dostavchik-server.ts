import { NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { amalRuxsatiBormi } from '@/lib/ruxsat-server'
import { sessionFilialId } from '@/lib/filial-scope'
import {
  FAOL_YETKAZISH, joriyYetkazish, masofaM,
  type DostavchikQisqa, type DostavchikTafsilot, type Lokatsiya, type NamunaBerishQator, type YetkazishHolati, type YetkazishQator,
} from '@/lib/dostavchik'
import type { BuyurtmaDostavchigi, OnlaynHolat, OnlaynRoyxat } from '@/lib/onlayn-buyurtma'
import { mpSorov } from '@/lib/marketplace-mijoz'

// Dostavchiklar — markaziy do'konniki (onlayn buyurtmalar kabi): filialga
// bog'langan xodim ularni ko'rmaydi va boshqarmaydi.
export const DOSTAVCHIK_DOIRASI = { rol: 'DOSTAVCHIK' as const, filialId: null }

export type Kontekst = { ok: true; session: Session; meId: string; rol: string } | { ok: false; javob: NextResponse }

/** Sessiya + markaziy doira + ruxsat (bazadan jonli). */
export async function namunaRuxsat(kalit: string = 'namuna-tovar'): Promise<Kontekst> {
  const session = await auth()
  if (!session) return { ok: false, javob: NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 }) }
  if (sessionFilialId(session) || !(await amalRuxsatiBormi(session, kalit))) {
    return { ok: false, javob: NextResponse.json({ xato: 'Bu amalga ruxsatingiz yo‘q', kod: 'ruxsat_yoq' }, { status: 403 }) }
  }
  const u = session.user as unknown as { id: string; rol?: string }
  return { ok: true, session, meId: u.id, rol: u.rol ?? '' }
}

// ─── Tekislash ───────────────────────────────────────────────────────────────

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null)

const YETKAZISH_SELECT = {
  buyurtmaRaqami: true, holati: true, aloqaIsm: true, aloqaTel: true, manzilMatni: true, lat: true, lng: true,
  jamiSumma: true, tayinlangan: true, yolgaChiqdi: true, yetibKeldi: true, topshirildi: true,
} as const

type YetkazishXom = {
  buyurtmaRaqami: string; holati: YetkazishHolati; aloqaIsm: string | null; aloqaTel: string | null
  manzilMatni: string | null; lat: number | null; lng: number | null; jamiSumma: unknown
  tayinlangan: Date; yolgaChiqdi: Date | null; yetibKeldi: Date | null; topshirildi: Date | null
}

function yetkazishQator(y: YetkazishXom, lok: Lokatsiya | null): YetkazishQator {
  const faol = FAOL_YETKAZISH.includes(y.holati)
  return {
    raqam: y.buyurtmaRaqami,
    holati: y.holati,
    aloqaIsm: y.aloqaIsm,
    aloqaTel: y.aloqaTel,
    manzilMatni: y.manzilMatni,
    lat: y.lat,
    lng: y.lng,
    jamiSumma: y.jamiSumma == null ? null : Number(y.jamiSumma),
    tayinlangan: y.tayinlangan.toISOString(),
    yolgaChiqdi: iso(y.yolgaChiqdi),
    yetibKeldi: iso(y.yetibKeldi),
    topshirildi: iso(y.topshirildi),
    // Masofa faqat hali yetkazilmagan buyurtmaga ma'noli
    masofaM: faol && lok && y.lat != null && y.lng != null ? Math.round(masofaM(lok, { lat: y.lat, lng: y.lng })) : null,
  }
}

const FOYDALANUVCHI_SELECT = {
  id: true, ism: true, login: true, faol: true, telefon: true, yaratilgan: true,
  lokatsiyaLat: true, lokatsiyaLng: true, lokatsiyaYangilangan: true,
  dostavchikProfili: {
    select: {
      transportTuri: true, transportNomi: true, davlatRaqami: true, qoshimchaTelefonlar: true,
      manzil: true, manzilLat: true, manzilLng: true, izoh: true,
    },
  },
} as const

type FoydalanuvchiXom = {
  id: string; ism: string; login: string; faol: boolean; telefon: string | null; yaratilgan: Date
  lokatsiyaLat: number | null; lokatsiyaLng: number | null; lokatsiyaYangilangan: Date | null
  dostavchikProfili: {
    transportTuri: DostavchikQisqa['transportTuri']; transportNomi: string | null; davlatRaqami: string | null
    qoshimchaTelefonlar: string[]; manzil: string | null; manzilLat: number | null; manzilLng: number | null
    izoh: string | null
  } | null
}

function lokatsiya(f: FoydalanuvchiXom): Lokatsiya | null {
  return f.lokatsiyaLat != null && f.lokatsiyaLng != null && f.lokatsiyaYangilangan
    ? { lat: f.lokatsiyaLat, lng: f.lokatsiyaLng, yangilangan: f.lokatsiyaYangilangan.toISOString() }
    : null
}

/** Toshkent vaqti bo'yicha bugunning boshi. */
function bugunBoshi(): Date {
  const sana = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tashkent' })
  return new Date(`${sana}T00:00:00+05:00`)
}

// ─── Ro'yxat ─────────────────────────────────────────────────────────────────

export async function dostavchiklarRoyxati(): Promise<DostavchikQisqa[]> {
  const foydalanuvchilar = await prisma.foydalanuvchi.findMany({
    where: DOSTAVCHIK_DOIRASI,
    select: FOYDALANUVCHI_SELECT,
    orderBy: { ism: 'asc' },
  })
  if (foydalanuvchilar.length === 0) return []
  const idlar = foydalanuvchilar.map(f => f.id)

  const [faollar, bugun, jami, namunalar] = await Promise.all([
    prisma.onlaynYetkazish.findMany({
      where: { dostavchikId: { in: idlar }, holati: { in: FAOL_YETKAZISH } },
      select: { ...YETKAZISH_SELECT, dostavchikId: true },
    }),
    prisma.onlaynYetkazish.groupBy({
      by: ['dostavchikId'],
      where: { dostavchikId: { in: idlar }, holati: 'TOPSHIRILDI', topshirildi: { gte: bugunBoshi() } },
      _count: { _all: true },
    }),
    prisma.onlaynYetkazish.groupBy({
      by: ['dostavchikId'],
      where: { dostavchikId: { in: idlar }, holati: 'TOPSHIRILDI' },
      _count: { _all: true },
    }),
    prisma.namunaTarkibi.findMany({
      where: { holati: 'BERILGAN', berish: { dostavchikId: { in: idlar } } },
      select: { berish: { select: { dostavchikId: true } } },
    }),
  ])

  const sanoq = (g: { dostavchikId: string; _count: { _all: number } }[]) => new Map(g.map(x => [x.dostavchikId, x._count._all]))
  const bugunMap = sanoq(bugun)
  const jamiMap = sanoq(jami)
  const namunaMap = new Map<string, number>()
  for (const n of namunalar) namunaMap.set(n.berish.dostavchikId, (namunaMap.get(n.berish.dostavchikId) ?? 0) + 1)

  const royxat = foydalanuvchilar.map((f): DostavchikQisqa => {
    const lok = lokatsiya(f)
    const qatorlar = faollar.filter(y => y.dostavchikId === f.id).map(y => yetkazishQator(y, lok))
    return {
      ...asosiy(f, lok),
      joriy: joriyYetkazish(qatorlar),
      navbatda: qatorlar.filter(q => q.holati === 'TAYINLANGAN').length,
      bugunTopshirgan: bugunMap.get(f.id) ?? 0,
      jamiTopshirgan: jamiMap.get(f.id) ?? 0,
      qolganNamuna: namunaMap.get(f.id) ?? 0,
    }
  })

  // Faollari tepada; ichida — hozir buyurtma bilan bandlari birinchi
  return royxat.sort((a, b) =>
    Number(b.faol) - Number(a.faol) || Number(!!b.joriy) - Number(!!a.joriy) || a.ism.localeCompare(b.ism))
}

function asosiy(f: FoydalanuvchiXom, lok: Lokatsiya | null) {
  const p = f.dostavchikProfili
  return {
    id: f.id,
    ism: f.ism,
    login: f.login,
    faol: f.faol,
    telefon: f.telefon,
    qoshimchaTelefonlar: p?.qoshimchaTelefonlar ?? [],
    transportTuri: p?.transportTuri ?? null,
    transportNomi: p?.transportNomi ?? null,
    davlatRaqami: p?.davlatRaqami ?? null,
    manzil: p?.manzil ?? null,
    manzilLat: p?.manzilLat ?? null,
    manzilLng: p?.manzilLng ?? null,
    lokatsiya: lok,
  }
}

// ─── Tafsilot ────────────────────────────────────────────────────────────────

export async function dostavchikTafsiloti(id: string): Promise<DostavchikTafsilot | null> {
  const f = await prisma.foydalanuvchi.findFirst({ where: { id, ...DOSTAVCHIK_DOIRASI }, select: FOYDALANUVCHI_SELECT })
  if (!f) return null
  const lok = lokatsiya(f)

  const [faollar, oxirgilar, bugun, jami, berishlar] = await Promise.all([
    prisma.onlaynYetkazish.findMany({
      where: { dostavchikId: id, holati: { in: FAOL_YETKAZISH } },
      select: YETKAZISH_SELECT,
      orderBy: { tayinlangan: 'asc' },
    }),
    prisma.onlaynYetkazish.findMany({
      where: { dostavchikId: id, holati: { notIn: FAOL_YETKAZISH } },
      select: YETKAZISH_SELECT,
      orderBy: { yangilangan: 'desc' },
      take: 100,
    }),
    prisma.onlaynYetkazish.count({ where: { dostavchikId: id, holati: 'TOPSHIRILDI', topshirildi: { gte: bugunBoshi() } } }),
    prisma.onlaynYetkazish.count({ where: { dostavchikId: id, holati: 'TOPSHIRILDI' } }),
    prisma.namunaBerish.findMany({
      where: { dostavchikId: id },
      orderBy: { yaratilgan: 'desc' },
      take: 100,
      select: {
        id: true, izoh: true, yaratilgan: true,
        bergan: { select: { ism: true } },
        tarkiblar: {
          orderBy: { nomi: 'asc' },
          select: {
            id: true, tovarId: true, nomi: true, birlik: true, miqdor: true, holati: true, topshirilganVaqt: true,
            qabulQilgan: { select: { ism: true } },
          },
        },
      },
    }),
  ])

  const faolQatorlar = faollar.map(y => yetkazishQator(y, lok))
  const namunalar: NamunaBerishQator[] = berishlar.map(b => ({
    id: b.id,
    izoh: b.izoh,
    yaratilgan: b.yaratilgan.toISOString(),
    bergan: b.bergan.ism,
    tarkiblar: b.tarkiblar.map(t => ({
      id: t.id,
      tovarId: t.tovarId,
      nomi: t.nomi,
      birlik: t.birlik,
      miqdor: Number(t.miqdor),
      holati: t.holati,
      topshirilganVaqt: iso(t.topshirilganVaqt),
      qabulQilgan: t.qabulQilgan?.ism ?? null,
    })),
  }))

  return {
    ...asosiy(f, lok),
    izoh: f.dostavchikProfili?.izoh ?? null,
    yaratilgan: f.yaratilgan.toISOString(),
    joriy: joriyYetkazish(faolQatorlar),
    navbatda: faolQatorlar.filter(q => q.holati === 'TAYINLANGAN').length,
    bugunTopshirgan: bugun,
    jamiTopshirgan: jami,
    qolganNamuna: namunalar.reduce((s, b) => s + b.tarkiblar.filter(t => t.holati === 'BERILGAN').length, 0),
    yetkazishlar: [...faolQatorlar, ...oxirgilar.map(y => yetkazishQator(y, lok))],
    namunalar,
  }
}

// ─── Jonli belgi ─────────────────────────────────────────────────────────────

/**
 * Bo'limdagi biror narsa o'zgarganini bildiruvchi qisqa satr.
 *
 * Sahifa har necha soniyada shu satrni so'raydi va u o'zgargandagina to'liq
 * ma'lumotni qayta yuklaydi — dostavchik joylashuvi, yetkazish holati yoki
 * namuna o'zgarsa bir necha soniyada ko'rinadi, o'zgarish bo'lmasa baza
 * ortiqcha yuklanmaydi. Bitta so'rov, faqat indekslangan ustunlar.
 */
export async function namunaBelgisi(): Promise<string> {
  const [q] = await prisma.$queryRaw<{ a: Date | null; b: Date | null; c: Date | null; d: Date | null; e: bigint; f: bigint; g: bigint }[]>`
    SELECT
      (SELECT max(GREATEST(COALESCE("lokatsiyaYangilangan", 'epoch'::timestamp), "yangilangan")) FROM public.foydalanuvchilar WHERE rol = 'DOSTAVCHIK') AS a,
      (SELECT max("yangilangan") FROM public.dostavchik_profillari) AS b,
      (SELECT max("yangilangan") FROM public.onlayn_yetkazishlar) AS c,
      (SELECT max("yangilangan") FROM public.namuna_tarkiblari) AS d,
      (SELECT count(*) FROM public.namuna_tarkiblari) AS e,
      (SELECT count(*) FROM public.onlayn_yetkazishlar) AS f,
      (SELECT count(*) FROM public.foydalanuvchilar WHERE rol = 'DOSTAVCHIK') AS g`
  const t = (d: Date | null) => (d ? d.getTime() : 0)
  return [t(q.a), t(q.b), t(q.c), t(q.d), q.e, q.f, q.g].join('.')
}

/** Onlayn buyurtmalar paneli uchun ERP tomonidagi o'zgarish: biriktirish va yetkazish bosqichlari. */
export async function yetkazishBelgisi(dostavchikId?: string): Promise<{ belgi: string; faolSoni: number }> {
  const where = dostavchikId ? { dostavchikId } : {}
  const [agg, faolSoni] = await Promise.all([
    prisma.onlaynYetkazish.aggregate({ where, _max: { yangilangan: true }, _count: { _all: true } }),
    prisma.onlaynYetkazish.count({ where: { ...where, holati: { in: FAOL_YETKAZISH } } }),
  ])
  return { belgi: `${agg._max.yangilangan?.getTime() ?? 0}.${agg._count._all}`, faolSoni }
}

// ─── Onlayn buyurtmalar bilan bog'lanish ─────────────────────────────────────

/** Buyurtma raqamlari bo'yicha kim olib borayotgani (panel kartochkalari uchun). */
export async function buyurtmaDostavchiklari(raqamlar: string[]): Promise<Map<string, BuyurtmaDostavchigi>> {
  if (raqamlar.length === 0) return new Map()
  const qatorlar = await prisma.onlaynYetkazish.findMany({
    where: { buyurtmaRaqami: { in: raqamlar } },
    select: {
      buyurtmaRaqami: true, holati: true, yolgaChiqdi: true, yetibKeldi: true,
      dostavchik: { select: { id: true, ism: true, telefon: true } },
    },
  })
  return new Map(qatorlar.map(q => [q.buyurtmaRaqami, {
    id: q.dostavchik.id,
    ism: q.dostavchik.ism,
    telefon: q.dostavchik.telefon,
    holati: q.holati,
    yolgaChiqdi: iso(q.yolgaChiqdi),
    yetibKeldi: iso(q.yetibKeldi),
  }]))
}

/**
 * Dostavchik ko'radigan buyurtmalar: hali tugamaganlari va oxirgi 30 kunda
 * yakunlanganlari (eng yangi 100 ta). Boshqa buyurtmalar — mijoz telefoni va
 * manzili — unga ko'rinmaydi.
 */
export async function dostavchikRaqamlari(dostavchikId: string): Promise<string[]> {
  const qatorlar = await prisma.onlaynYetkazish.findMany({
    where: {
      dostavchikId,
      OR: [{ holati: { in: FAOL_YETKAZISH } }, { yangilangan: { gte: new Date(Date.now() - 30 * 86_400_000) } }],
    },
    orderBy: { tayinlangan: 'desc' },
    take: 100,
    select: { buyurtmaRaqami: true },
  })
  return qatorlar.map(q => q.buyurtmaRaqami)
}

/**
 * Buyurtma holati o'zgarganda (kim o'zgartirganidan qat'i nazar) yetkazish
 * yozuvini moslash. Biriktirilmagan buyurtmada hech narsa qilmaydi.
 */
export async function yetkazishniMoslash(raqam: string, holat: OnlaynHolat): Promise<void> {
  const hozir = new Date()
  if (holat === 'YOLDA') {
    await prisma.onlaynYetkazish.updateMany({
      where: { buyurtmaRaqami: raqam, holati: 'TAYINLANGAN' },
      data: { holati: 'YOLDA', yolgaChiqdi: hozir },
    })
  } else if (holat === 'BAJARILGAN') {
    await prisma.onlaynYetkazish.updateMany({
      where: { buyurtmaRaqami: raqam, holati: { in: FAOL_YETKAZISH } },
      data: { holati: 'TOPSHIRILDI', topshirildi: hozir },
    })
  } else if (holat === 'BEKOR') {
    await prisma.onlaynYetkazish.updateMany({
      where: { buyurtmaRaqami: raqam, holati: { in: FAOL_YETKAZISH } },
      data: { holati: 'BEKOR' },
    })
  }
}

/** Shu buyurtma aynan shu foydalanuvchiga biriktirilganmi. */
export async function mengaBiriktirilganmi(raqam: string, foydalanuvchiId: string) {
  return prisma.onlaynYetkazish.findFirst({
    where: { buyurtmaRaqami: raqam, dostavchikId: foydalanuvchiId },
    select: { holati: true },
  })
}

/**
 * Saytdagi haqiqiy holat bilan moslash.
 *
 * Holat ERP panelidan o'zgarsa yetkazish darhol siljiydi (`yetkazishniMoslash`).
 * Lekin mijoz buyurtmani saytning o'zida bekor qilishi mumkin — ERP buni
 * bilmaydi va dostavchik "navbatda" bo'sh buyurtma bilan qolardi. Shuning
 * uchun ro'yxatlar ochilganda saytdan kelgan holatlar bo'yicha tuzatiladi.
 */
export async function saytHolatlariBilanMoslash(buyurtmalar: { raqam: string; holati: OnlaynHolat }[]): Promise<void> {
  const yakunlangan = buyurtmalar.filter(b => b.holati === 'BEKOR' || b.holati === 'BAJARILGAN' || b.holati === 'YOLDA')
  if (yakunlangan.length === 0) return
  const faollar = await prisma.onlaynYetkazish.findMany({
    where: { buyurtmaRaqami: { in: yakunlangan.map(b => b.raqam) }, holati: { in: FAOL_YETKAZISH } },
    select: { buyurtmaRaqami: true, holati: true },
  })
  for (const y of faollar) {
    const holat = yakunlangan.find(b => b.raqam === y.buyurtmaRaqami)!.holati
    // "Yo'lda" faqat hali navbatdagisini siljitadi (yetib kelgani orqaga qaytmasin)
    if (holat === 'YOLDA' && y.holati !== 'TAYINLANGAN') continue
    await yetkazishniMoslash(y.buyurtmaRaqami, holat)
  }
}

/** Barcha faol yetkazishlarni saytdan tekshirish ("Namuna tovar" sahifasi ochilganda). Sayt javob bermasa jim o'tadi. */
export async function faolYetkazishlarniTekshir(): Promise<void> {
  const faollar = await prisma.onlaynYetkazish.findMany({
    where: { holati: { in: FAOL_YETKAZISH } },
    select: { buyurtmaRaqami: true },
    // Sayt sahifasiga 30 tadan qaytaradi; eng eskilari birinchi — eskirib qolish ehtimoli ularda
    orderBy: { tayinlangan: 'asc' },
    take: 30,
  })
  if (faollar.length === 0) return
  const n = await mpSorov<OnlaynRoyxat>('GET', `/api/erp/buyurtmalar?raqamlar=${faollar.map(f => f.buyurtmaRaqami).join(',')}`)
  if (n.ok) await saytHolatlariBilanMoslash(n.qiymat.buyurtmalar)
}
