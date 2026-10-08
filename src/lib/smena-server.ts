// Ish smenasi va ovoz yozuvlari — server tomoni.

import type { Session } from 'next-auth'
import { prisma } from './prisma'
import { sessionEgaId, sessionFilialId } from './filial-scope'
import { omborTuri, ochir } from './ovoz-ombor'
import {
  ALOQA_YOQ_MS, SAQLASH_STANDART, SAQLASH_VARIANTLARI, UNUTILGAN_SMENA_MS,
  kunBoshi, qamrovniHisobla, smenaRolimi, toshkentKuni, yozuvHolatimi, type YozuvHolati,
} from './smena'

export const SAQLASH_KALITI = 'ovoz_saqlash_kun'
const TEXNIK_KALITI = 'ovoz_texnik_oxirgi'
/** Texnik xizmat (eski smenalarni yopish, muddati o'tgan yozuvlarni o'chirish) oralig'i. */
const TEXNIK_ORALIQ_MS = 6 * 3_600_000

export type Tugatuvchi = 'xodim' | 'admin' | 'avtomatik'

/** Sessiyadagi foydalanuvchi smena yurita oladimi (kuryer). */
export function smenaXodimi(session: Session | null): { id: string; rol: string } | null {
  const u = session?.user as { id?: string; rol?: string } | undefined
  if (!u?.id || !smenaRolimi(u.rol)) return null
  return { id: u.id, rol: u.rol! }
}

export async function saqlashKuni(): Promise<number> {
  const q = await prisma.sozlama.findUnique({ where: { kalit: SAQLASH_KALITI }, select: { qiymat: true } })
  const n = Number(q?.qiymat)
  return (SAQLASH_VARIANTLARI as readonly number[]).includes(n) ? n : SAQLASH_STANDART
}

export async function saqlashKuniniOrnat(kun: number): Promise<void> {
  await prisma.sozlama.upsert({
    where: { kalit: SAQLASH_KALITI },
    update: { qiymat: String(kun) },
    create: { kalit: SAQLASH_KALITI, qiymat: String(kun) },
  })
}

export function faolSmena(xodimId: string) {
  return prisma.smena.findFirst({ where: { xodimId, tugadi: null }, orderBy: { boshlandi: 'desc' } })
}

function koordinata(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  const a = Number(lat), b = Number(lng)
  if (lat === null || lat === undefined || lng === null || lng === undefined) return null
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180) return null
  return { lat: a, lng: b }
}

/**
 * Smena ochadi. Ikki marta bosilsa yoki ikki qurilmadan bir vaqtda
 * so'ralsa ham ikkinchi ochiq smena paydo bo'lmaydi — xodim bo'yicha
 * tranzaksiya qulfi ostida tekshiriladi.
 */
export async function smenaniBoshla(
  session: Session,
  xodimId: string,
  q: { lat?: unknown; lng?: unknown; qurilma?: string | null },
) {
  const joy = koordinata(q.lat, q.lng)
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'smena:' + xodimId}))`
    const bor = await tx.smena.findFirst({ where: { xodimId, tugadi: null } })
    if (bor) return { smena: bor, yangi: false }
    const smena = await tx.smena.create({
      data: {
        xodimId,
        oxirgiPuls: new Date(),
        boshLat: joy?.lat ?? null,
        boshLng: joy?.lng ?? null,
        qurilma: q.qurilma?.slice(0, 160) ?? null,
        filialId: sessionFilialId(session),
        egaId: sessionEgaId(session),
      },
    })
    return { smena, yangi: true }
  })
}

export async function smenaniTugat(
  smenaId: string,
  q: { tugatuvchi: Tugatuvchi; tugatganId?: string | null; lat?: unknown; lng?: unknown; vaqt?: Date },
): Promise<boolean> {
  const joy = koordinata(q.lat, q.lng)
  const r = await prisma.smena.updateMany({
    where: { id: smenaId, tugadi: null },
    data: {
      tugadi: q.vaqt ?? new Date(),
      tugatuvchi: q.tugatuvchi,
      tugatganId: q.tugatganId ?? null,
      oxirLat: joy?.lat ?? null,
      oxirLng: joy?.lng ?? null,
    },
  })
  return r.count > 0
}

/** Kuryer ilovasidan "tirikman" belgisi va yozuv holati. */
export async function pulsYoz(smenaId: string, holat: unknown): Promise<void> {
  await prisma.smena.updateMany({
    where: { id: smenaId, tugadi: null },
    data: { oxirgiPuls: new Date(), ...(yozuvHolatimi(holat) ? { yozuvHolati: holat } : {}) },
  })
}

// ─── Xulosalar ───────────────────────────────────────────────────────────────

export interface YozuvMalumoti {
  id: string
  boshlandi: string
  tugadi: string
  davomiylikMs: number
  hajm: number
  daraja: number | null
  mimeType: string
}

export interface SmenaXulosasi {
  id: string
  boshlandi: string
  tugadi: string | null
  tugatuvchi: string | null
  oxirgiPuls: string | null
  yozuvHolati: YozuvHolati | null
  /** Faol smenada ilova bilan aloqa bormi (oxirgi puls yangimi) */
  aloqa: boolean | null
  yozuvSoni: number
  hajm: number
  yozilganMs: number
  smenaMs: number
  foiz: number
  boshliqlar: { dan: string; gacha: string }[]
  yozuvlar?: YozuvMalumoti[]
}

const YOZUV_SELECT = {
  id: true, boshlandi: true, tugadi: true, davomiylikMs: true, hajm: true, daraja: true, mimeType: true,
} as const

/** Xodimning `dan` dan keyin boshlangan (va hali ochiq) smenalari — eng yangisi birinchi. */
export async function smenalarXulosasi(
  xodimId: string,
  dan: Date,
  opts: { yozuvlarBilan?: boolean } = {},
): Promise<SmenaXulosasi[]> {
  const smenalar = await prisma.smena.findMany({
    where: { xodimId, OR: [{ boshlandi: { gte: dan } }, { tugadi: null }] },
    orderBy: { boshlandi: 'desc' },
    take: 200,
    include: { yozuvlar: { select: YOZUV_SELECT, orderBy: { boshlandi: 'asc' } } },
  })
  const hozir = Date.now()
  return smenalar.map(s => {
    const oxiri = s.tugadi?.getTime() ?? hozir
    const q = qamrovniHisobla(
      { boshlandi: s.boshlandi.getTime(), tugadi: oxiri },
      s.yozuvlar.map(y => ({ dan: y.boshlandi.getTime(), gacha: y.tugadi.getTime() })),
    )
    const puls = (s.oxirgiPuls ?? s.boshlandi).getTime()
    return {
      id: s.id,
      boshlandi: s.boshlandi.toISOString(),
      tugadi: s.tugadi?.toISOString() ?? null,
      tugatuvchi: s.tugatuvchi,
      oxirgiPuls: s.oxirgiPuls?.toISOString() ?? null,
      yozuvHolati: yozuvHolatimi(s.yozuvHolati) ? s.yozuvHolati : null,
      aloqa: s.tugadi ? null : hozir - puls < ALOQA_YOQ_MS,
      yozuvSoni: s.yozuvlar.length,
      hajm: s.yozuvlar.reduce((a, y) => a + y.hajm, 0),
      yozilganMs: q.yozilganMs,
      smenaMs: q.smenaMs,
      foiz: q.foiz,
      boshliqlar: q.boshliqlar.map(b => ({ dan: new Date(b.dan).toISOString(), gacha: new Date(b.gacha).toISOString() })),
      ...(opts.yozuvlarBilan
        ? {
            yozuvlar: s.yozuvlar.map(y => ({
              id: y.id,
              boshlandi: y.boshlandi.toISOString(),
              tugadi: y.tugadi.toISOString(),
              davomiylikMs: y.davomiylikMs,
              hajm: y.hajm,
              daraja: y.daraja,
              mimeType: y.mimeType,
            })),
          }
        : {}),
    }
  })
}

/** Kuryer paneli uchun to'liq holat (GET va har bir amaldan keyin bir xil shakl). */
export async function kuryerHolati(xodimId: string) {
  const bugun = kunBoshi(toshkentKuni(new Date()))
  const [u, smenalar, kun] = await Promise.all([
    prisma.foydalanuvchi.findUnique({ where: { id: xodimId }, select: { ovozRozilik: true } }),
    smenalarXulosasi(xodimId, bugun),
    saqlashKuni(),
  ])
  const faol = smenalar.find(s => !s.tugadi) ?? null
  return {
    mavjud: true as const,
    rozilik: !!u?.ovozRozilik,
    omborTayyor: omborTuri() !== null,
    saqlashKun: kun,
    serverVaqti: Date.now(),
    smena: faol ? { id: faol.id, boshlandi: faol.boshlandi } : null,
    bugun: smenalar.map(s => ({
      id: s.id, boshlandi: s.boshlandi, tugadi: s.tugadi, yozilganMs: s.yozilganMs, smenaMs: s.smenaMs,
    })),
  }
}

export interface SmenaHolatQisqa {
  faol: boolean
  boshlandi: string
  tugadi: string | null
  aloqa: boolean | null
  yozuvHolati: YozuvHolati | null
}

/** Xodimlar ro'yxati uchun: hozir ishdami yoki bugun qachon tugatgan. */
export async function smenaHolatlari(xodimIdlar: string[]): Promise<Map<string, SmenaHolatQisqa>> {
  const natija = new Map<string, SmenaHolatQisqa>()
  if (xodimIdlar.length === 0) return natija
  const bugun = kunBoshi(toshkentKuni(new Date()))
  const smenalar = await prisma.smena.findMany({
    where: { xodimId: { in: xodimIdlar }, OR: [{ tugadi: null }, { boshlandi: { gte: bugun } }] },
    orderBy: { boshlandi: 'desc' },
    select: { xodimId: true, boshlandi: true, tugadi: true, oxirgiPuls: true, yozuvHolati: true },
  })
  const hozir = Date.now()
  for (const s of smenalar) {
    const bor = natija.get(s.xodimId)
    // Ochiq smena har doim ustun; aks holda eng so'nggisi
    if (bor && (bor.faol || s.tugadi)) continue
    const puls = (s.oxirgiPuls ?? s.boshlandi).getTime()
    natija.set(s.xodimId, {
      faol: !s.tugadi,
      boshlandi: s.boshlandi.toISOString(),
      tugadi: s.tugadi?.toISOString() ?? null,
      aloqa: s.tugadi ? null : hozir - puls < ALOQA_YOQ_MS,
      yozuvHolati: yozuvHolatimi(s.yozuvHolati) ? s.yozuvHolati : null,
    })
  }
  return natija
}

// ─── Texnik xizmat ───────────────────────────────────────────────────────────

/**
 * Unutib qo'yilgan smenalarni yopadi va saqlash muddati o'tgan yozuvlarni
 * ombordan ham, bazadan ham o'chiradi. Alohida cron talab qilmaydi:
 * kuryer paneli ochilganda javobdan keyin (`after`) ishga tushadi, lekin
 * 6 soatda ko'pi bilan bir marta.
 */
export async function texnikXizmat(majburiy = false): Promise<void> {
  const hozir = Date.now()
  if (!majburiy) {
    const q = await prisma.sozlama.findUnique({ where: { kalit: TEXNIK_KALITI }, select: { qiymat: true } })
    if (q && hozir - Number(q.qiymat) < TEXNIK_ORALIQ_MS) return
  }
  await prisma.sozlama.upsert({
    where: { kalit: TEXNIK_KALITI },
    update: { qiymat: String(hozir) },
    create: { kalit: TEXNIK_KALITI, qiymat: String(hozir) },
  })

  // 1) Puls bermay qolgan (ilova yopilgan, kuryer tugatishni unutgan) smenalar —
  //    oxirgi ma'lum faollik vaqtida yopiladi, ertalabgacha "ishda" turmaydi
  const chegara = new Date(hozir - UNUTILGAN_SMENA_MS)
  const eskilar = await prisma.smena.findMany({
    where: {
      tugadi: null,
      OR: [{ oxirgiPuls: { lt: chegara } }, { oxirgiPuls: null, boshlandi: { lt: chegara } }],
    },
    select: { id: true, boshlandi: true, oxirgiPuls: true },
  })
  for (const s of eskilar) {
    const oxirgiYozuv = await prisma.ovozYozuv.findFirst({
      where: { smenaId: s.id }, orderBy: { tugadi: 'desc' }, select: { tugadi: true },
    })
    const vaqt = new Date(Math.max(
      s.boshlandi.getTime(), s.oxirgiPuls?.getTime() ?? 0, oxirgiYozuv?.tugadi.getTime() ?? 0,
    ))
    await smenaniTugat(s.id, { tugatuvchi: 'avtomatik', vaqt })
  }

  // 2) Saqlash muddati o'tgan yozuvlar — avval ombordan, keyin bazadan
  const kun = await saqlashKuni()
  const muddat = new Date(hozir - kun * 86_400_000)
  for (let i = 0; i < 20; i++) {
    const partiya = await prisma.ovozYozuv.findMany({
      where: { boshlandi: { lt: muddat } }, select: { id: true, kalit: true }, take: 100,
    })
    if (partiya.length === 0) break
    const ochirildi: string[] = []
    for (const y of partiya) {
      try {
        await ochir(y.kalit)
        ochirildi.push(y.id)
      } catch (e) {
        console.error('[ovoz texnik] ombordan o‘chmadi', y.kalit, e)
      }
    }
    if (ochirildi.length) await prisma.ovozYozuv.deleteMany({ where: { id: { in: ochirildi } } })
    if (ochirildi.length < partiya.length) break
  }
}

/** Smenaning barcha yozuvlarini ombordan va bazadan o'chiradi (smena ham o'chadi). */
export async function smenaniOchir(smenaId: string): Promise<number> {
  const yozuvlar = await prisma.ovozYozuv.findMany({ where: { smenaId }, select: { id: true, kalit: true } })
  for (const y of yozuvlar) await ochir(y.kalit)
  await prisma.smena.delete({ where: { id: smenaId } })
  return yozuvlar.length
}
