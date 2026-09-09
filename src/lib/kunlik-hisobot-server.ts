import { prisma } from './prisma'
import { getStockMap } from './stock'
import { foydalanuvchiFilialWhere, type DoiraFoydalanuvchi } from './filial-scope'
import { ichkiXabarYubor } from './telegram'
import {
  HISOBOT_SOZLAMA, sozlamalarniOqi, kamQolganSarala, hisobotMatni,
  kunKaliti, uzKunBoshi, uzSoat,
  type HisobotSozlamalari, type KunlikHisobot, type KamQolganTovar, type TopTovar,
} from './kunlik-hisobot'

/** Prisma mijozi yoki tranzaksiya mijozi — ikkalasi ham qabul qilinadi. */
type PrismaMijoz = typeof prisma | Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

// Kunlik hisobotning baza qismi: ma'lumot yig'ish va Telegramga yuborish.
//
// Bir xil funksiya uch joydan chaqiriladi:
//   • /api/cron/kunlik-hisobot   — Vercel cron (yoki tashqi rejalashtiruvchi)
//   • instrumentation.ts         — localhost'da server ishlab turganda
//   • "Hozir yuborish" tugmasi   — qo'lda
// Takrorlanmasligini `KunlikHisobotLog.kunKaliti + qabulQiluvchiId` unique
// indeksi ta'minlaydi.

/** Hisobot oluvchi xodim — ADMIN roli, faol va telefoni bor. */
export interface HisobotOluvchi extends DoiraFoydalanuvchi {
  id: string
  ism: string
  telefon: string | null
  filialNomi: string | null
}

export async function hisobotSozlamalari(): Promise<HisobotSozlamalari> {
  const kalitlar = Object.values(HISOBOT_SOZLAMA)
  const qatorlar = await prisma.sozlama.findMany({ where: { kalit: { in: [...kalitlar] } } })
  const xom: Record<string, string> = {}
  for (const q of qatorlar) xom[q.kalit] = q.qiymat
  return sozlamalarniOqi(xom)
}

export async function hisobotOluvchilar(): Promise<HisobotOluvchi[]> {
  const xodimlar = await prisma.foydalanuvchi.findMany({
    where: { rol: 'ADMIN', faol: true },
    select: {
      id: true, ism: true, telefon: true, filialId: true, ulashilganEgaId: true,
      filial: { select: { nomi: true } },
    },
    orderBy: { yaratilgan: 'asc' },
  })
  return xodimlar.map(x => ({
    id: x.id,
    ism: x.ism,
    telefon: x.telefon,
    filialId: x.filialId,
    ulashilganEgaId: x.ulashilganEgaId,
    filialNomi: x.filial?.nomi ?? null,
  }))
}

/**
 * Bitta xodimning ko'rish doirasi bo'yicha hisobotni yig'adi.
 *
 * Qoldiq `getStockMap` orqali — `Tovar`da qoldiq ustuni yo'q, u
 * `OmborHarakati` dan hisoblanadi. Ombor + do'kon qoldig'i qo'shiladi:
 * adminni "qayerda turibdi" emas, "umuman yetadimi" qiziqtiradi.
 */
export async function kunlikHisobotYig(
  oluvchi: DoiraFoydalanuvchi & { filialNomi?: string | null },
  sozlama: HisobotSozlamalari,
  hozir: Date = new Date(),
  db: PrismaMijoz = prisma,
): Promise<KunlikHisobot> {
  const doira = foydalanuvchiFilialWhere(oluvchi)

  const kunBoshi = uzKunBoshi(hozir)
  const kechaBoshi = new Date(kunBoshi.getTime() - 24 * 60 * 60 * 1000)
  const topDan = new Date(kunBoshi.getTime() - sozlama.topKun * 24 * 60 * 60 * 1000)

  const sotuvDoira = {
    holati: 'YAKUNLANGAN' as const,
    tolovUsuli: { not: 'SHERIK' as const },
    ...doira,
  }

  const [tovarlar, topXom, kecha] = await Promise.all([
    db.tovar.findMany({
      where: { holati: 'FAOL', ...doira },
      select: {
        id: true, nomi: true, birlik: true, minimalQoldiq: true,
        taminotchi: { select: { nomi: true } },
      },
    }),
    db.sotuvTarkibi.groupBy({
      by: ['tovarId'],
      _sum: { miqdor: true, jami: true },
      where: { sotuv: { ...sotuvDoira, sana: { gte: topDan, lt: hozir } } },
      orderBy: { _sum: { jami: 'desc' } },
      take: sozlama.topSoni,
    }),
    db.sotuv.aggregate({
      where: { ...sotuvDoira, sana: { gte: kechaBoshi, lt: kunBoshi } },
      _sum: { yakuniySumma: true },
      _count: true,
    }),
  ])

  // ── Kam qolganlar ──
  const stockMap = await getStockMap(tovarlar.map(t => t.id), db)
  const barchaKam: KamQolganTovar[] = []
  for (const t of tovarlar) {
    const s = stockMap.get(t.id) || { omborQoldiq: 0, dokonQoldiq: 0 }
    const qoldiq = s.omborQoldiq + s.dokonQoldiq
    if (qoldiq > t.minimalQoldiq) continue
    barchaKam.push({
      id: t.id,
      nomi: t.nomi,
      qoldiq,
      minimalQoldiq: t.minimalQoldiq,
      birlik: t.birlik,
      taminotchi: t.taminotchi?.nomi ?? null,
      tugagan: qoldiq <= 0,
    })
  }
  const saralangan = kamQolganSarala(barchaKam)

  // ── Top mahsulotlar ──
  const topIds = topXom.map(t => t.tovarId)
  const topNomlar = topIds.length
    ? await db.tovar.findMany({
        where: { id: { in: topIds } },
        select: { id: true, nomi: true, birlik: true },
      })
    : []
  const nomMap = new Map(topNomlar.map(t => [t.id, t]))
  const topTovarlar: TopTovar[] = topXom.map(t => {
    const tv = nomMap.get(t.tovarId)
    return {
      id: t.tovarId,
      nomi: tv?.nomi ?? "Noma'lum",
      birlik: tv?.birlik ?? 'DONA',
      miqdor: Number(t._sum.miqdor ?? 0),
      summa: Number(t._sum.jami ?? 0),
    }
  })

  return {
    kunKaliti: kunKaliti(hozir),
    doiraNomi: oluvchi.filialNomi ?? '',
    topKun: sozlama.topKun,
    kamQolganlar: saralangan.slice(0, sozlama.kamSoni),
    kamQolganSoni: saralangan.length,
    tugaganSoni: saralangan.filter(t => t.tugagan).length,
    topTovarlar,
    kecha: {
      summa: Number(kecha._sum.yakuniySumma ?? 0),
      soni: kecha._count,
    },
  }
}

export type YuborishNatijasi = {
  oluvchi: string
  status: 'sent' | 'failed' | 'skipped' | 'takroriy'
  xato?: string
}

/**
 * Bitta xodimga hisobotni yuboradi va jurnalga yozadi.
 *
 * `majburiy=false` (cron) — bugun allaqachon muvaffaqiyatli yuborilgan bo'lsa
 * qayta yuborilmaydi. `majburiy=true` ("Hozir yuborish") — har doim yuboriladi,
 * lekin jurnalning shu kungi qatori yangilanadi.
 */
export async function kunlikHisobotYubor(
  oluvchi: HisobotOluvchi,
  sozlama: HisobotSozlamalari,
  opts: { majburiy?: boolean; dokonNomi?: string; hozir?: Date } = {},
): Promise<YuborishNatijasi> {
  const hozir = opts.hozir ?? new Date()
  const kun = kunKaliti(hozir)

  if (!opts.majburiy) {
    const bor = await prisma.kunlikHisobotLog.findUnique({
      where: { kunKaliti_qabulQiluvchiId: { kunKaliti: kun, qabulQiluvchiId: oluvchi.id } },
      select: { status: true },
    })
    if (bor?.status === 'sent') return { oluvchi: oluvchi.ism, status: 'takroriy' }
  }

  const hisobot = await kunlikHisobotYig(oluvchi, sozlama, hozir)
  const dokonNomi = opts.dokonNomi
    ?? (await prisma.sozlama.findUnique({ where: { kalit: 'dokon_nomi' } }))?.qiymat
    ?? "Do'kon"
  const matn = hisobotMatni(hisobot, dokonNomi)

  let status: string
  let xato: string | null = null
  if (!oluvchi.telefon) {
    status = 'skipped'
    xato = 'Telefon raqami kiritilmagan'
  } else {
    const natija = await ichkiXabarYubor(oluvchi.telefon, matn)
    status = natija.ok ? 'sent' : 'failed'
    xato = natija.ok ? null : (natija.xato ?? 'Nomaʼlum xato')
  }

  const yozuv = {
    telefon: oluvchi.telefon,
    status,
    xato,
    kamQolganSoni: hisobot.kamQolganSoni,
    tugaganSoni: hisobot.tugaganSoni,
    matn,
    yuborilganSana: status === 'sent' ? hozir : null,
  }
  await prisma.kunlikHisobotLog.upsert({
    where: { kunKaliti_qabulQiluvchiId: { kunKaliti: kun, qabulQiluvchiId: oluvchi.id } },
    create: { kunKaliti: kun, qabulQiluvchiId: oluvchi.id, urinishSoni: 1, sana: hozir, ...yozuv },
    update: { urinishSoni: { increment: 1 }, ...yozuv },
  })

  return {
    oluvchi: oluvchi.ism,
    status: status as YuborishNatijasi['status'],
    ...(xato ? { xato } : {}),
  }
}

/**
 * Barcha adminlarga kunlik hisobot — cron va localhost rejalashtiruvchisi
 * uchun yagona kirish nuqtasi.
 *
 * `soatTekshir=true` bo'lsa (localhost'dagi interval) belgilangan soatdan
 * oldin hech narsa yuborilmaydi. Cron aniq vaqtda chaqiriladi, unga
 * bu tekshiruv shart emas.
 */
export async function kunlikHisobotlarniYubor(
  opts: { majburiy?: boolean; soatTekshir?: boolean; hozir?: Date } = {},
): Promise<{ yuborildi: number; natijalar: YuborishNatijasi[]; sabab?: string }> {
  const hozir = opts.hozir ?? new Date()
  const sozlama = await hisobotSozlamalari()

  if (!opts.majburiy) {
    if (!sozlama.yoqilgan) return { yuborildi: 0, natijalar: [], sabab: "Kunlik hisobot o'chirilgan" }
    if (opts.soatTekshir && uzSoat(hozir) < sozlama.soat) {
      return { yuborildi: 0, natijalar: [], sabab: `Yuborish vaqti hali kelmadi (${sozlama.soat}:00)` }
    }
  }

  const oluvchilar = await hisobotOluvchilar()
  if (oluvchilar.length === 0) {
    return { yuborildi: 0, natijalar: [], sabab: 'Faol admin topilmadi' }
  }

  const dokonNomi = (await prisma.sozlama.findUnique({ where: { kalit: 'dokon_nomi' } }))?.qiymat ?? "Do'kon"

  // Ketma-ket — Telegram rate limiti (3s) baribir parallelizmga yo'l bermaydi.
  const natijalar: YuborishNatijasi[] = []
  for (const o of oluvchilar) {
    try {
      natijalar.push(await kunlikHisobotYubor(o, sozlama, { majburiy: opts.majburiy, dokonNomi, hozir }))
    } catch (e) {
      console.error('[KunlikHisobot] Yuborish xatosi:', o.ism, e)
      natijalar.push({ oluvchi: o.ism, status: 'failed', xato: String((e as Error)?.message ?? e) })
    }
  }

  return { yuborildi: natijalar.filter(n => n.status === 'sent').length, natijalar }
}
