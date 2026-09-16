import { NextRequest, NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { ruxsatKeshiniTozala } from '@/lib/ruxsat-server'
import {
  holatXulosasi, nusxaSorovi, ozgarishRejasi, standartSorovi, xodimHolati,
  type JurnalQatori,
} from '@/lib/ruxsat-boshqaruv'

export const dynamic = 'force-dynamic'

// Ruxsatlar bo'limi API — faqat administrator (proxy ham tekshiradi).
//
//   GET                      — boshqariladigan xodimlar ro'yxati va so'nggi o'zgarishlar
//   GET ?foydalanuvchiId=…   — bitta xodimning to'liq ruxsat holati va jurnali
//   PUT { foydalanuvchiId, amal: 'QOLDA', ozgarishlar }  — tanlangan kalitlarni o'zgartirish
//   PUT { foydalanuvchiId, amal: 'NUSXA', manbaId }      — boshqa xodimning ruxsatlarini ko'chirish
//   PUT { foydalanuvchiId, amal: 'STANDART' }            — rol standartiga qaytarish
//
// Doira: filial administratori faqat o'z filiali xodimlarini, ulashilgan
// administrator — o'zi ishlaydigan Ega jamoasini, bosh Ega — hammani ko'radi.

type Admin = { id: string; ism: string; filialId: string | null; ulashilganEgaId: string | null }

const TOVAR_BAYROQLARI = {
  'ulashish.tovarTahrirlash': 'tovarTahrirlashMumkin',
  'ulashish.tovarOchirish': 'tovarOchirishMumkin',
} as const

const xato = (xabar: string, holat = 400) => NextResponse.json({ xato: xabar }, { status: holat })

function adminOl(session: Session | null): Admin | null {
  const u = session?.user as { id?: string; name?: string | null; rol?: string; filialId?: string | null; ulashilganEgaId?: string | null } | undefined
  if (!u?.id || u.rol !== 'ADMIN') return null
  return { id: u.id, ism: u.name || 'Administrator', filialId: u.filialId ?? null, ulashilganEgaId: u.ulashilganEgaId ?? null }
}

function doira(a: Admin): Prisma.FoydalanuvchiWhereInput {
  if (a.filialId) return { filialId: a.filialId }
  if (a.ulashilganEgaId) return { filialId: null, OR: [{ ulashilganEgaId: a.ulashilganEgaId }, { id: a.ulashilganEgaId }] }
  return {}
}

const haqiqiyEga = (a: Admin) => !a.filialId && !a.ulashilganEgaId

/** Nishon xodimda nimani o'zgartirish mumkin. */
function tahrirHuquqi(a: Admin, x: { id: string; rol: string; ulashilganEgaId: string | null }) {
  if (x.id === a.id) return { tahrirlanadi: false, faqatMaydon: false, sabab: 'O‘z ruxsatlaringizni o‘zgartira olmaysiz' }
  if (x.rol === 'ADMIN') {
    // Administrator bo'lim va amallar bilan cheklanmaydi; faqat bosh Ega uning
    // ma'lumot maydonlarini (kelish narxi) va ulashilgan katalog huquqlarini boshqaradi
    return haqiqiyEga(a)
      ? { tahrirlanadi: true, faqatMaydon: true, sabab: 'Administrator — barcha bo‘limlar ochiq. Faqat ma’lumot maydonlari cheklanadi' }
      : { tahrirlanadi: false, faqatMaydon: true, sabab: 'Administrator hisobini faqat bosh Ega cheklaydi' }
  }
  return { tahrirlanadi: true, faqatMaydon: false, sabab: null }
}

const XODIM_SELECT = {
  id: true, ism: true, login: true, rol: true, faol: true, telefon: true, filialId: true, ulashilganEgaId: true,
  tovarTahrirlashMumkin: true, tovarOchirishMumkin: true,
  filial: { select: { nomi: true } },
  ruxsatlar: { select: { bolim: true, korinadi: true } },
  yashirilganMaydonlar: { select: { maydon: true } },
} satisfies Prisma.FoydalanuvchiSelect

type XodimQatori = Prisma.FoydalanuvchiGetPayload<{ select: typeof XODIM_SELECT }>

function holatiniHisobla(x: XodimQatori) {
  return xodimHolati(x.rol, new Map(x.ruxsatlar.map(r => [r.bolim, r.korinadi])), new Set(x.yashirilganMaydonlar.map(m => m.maydon)))
}

const JURNAL_SELECT = {
  id: true, foydalanuvchiId: true, foydalanuvchiIsm: true, ozgartiruvchiIsm: true,
  kalit: true, eski: true, yangi: true, sabab: true, sana: true,
} satisfies Prisma.RuxsatJurnaliSelect

export async function GET(req: NextRequest) {
  try {
    const a = adminOl(await auth())
    if (!a) return xato("Ruxsat yo'q", 403)

    const foydalanuvchiId = new URL(req.url).searchParams.get('foydalanuvchiId')

    if (!foydalanuvchiId) {
      const xodimlar = await prisma.foydalanuvchi.findMany({
        where: doira(a),
        select: XODIM_SELECT,
        orderBy: [{ faol: 'desc' }, { yaratilgan: 'asc' }],
      })
      const idlar = xodimlar.map(x => x.id)
      const songgi = await prisma.ruxsatJurnali.findMany({
        where: haqiqiyEga(a) ? {} : { foydalanuvchiId: { in: idlar } },
        select: JURNAL_SELECT,
        orderBy: { sana: 'desc' },
        take: 40,
      })
      return NextResponse.json({
        meId: a.id,
        xodimlar: xodimlar.map(x => {
          const h = tahrirHuquqi(a, x)
          return {
            id: x.id, ism: x.ism, login: x.login, rol: x.rol, faol: x.faol, telefon: x.telefon,
            filialNomi: x.filial?.nomi ?? null, ulashilgan: !!x.ulashilganEgaId && x.rol === 'ADMIN',
            tahrirlanadi: h.tahrirlanadi, ozim: x.id === a.id,
            xulosa: holatXulosasi(holatiniHisobla(x)),
          }
        }),
        songgi,
      })
    }

    const x = await prisma.foydalanuvchi.findFirst({ where: { AND: [{ id: foydalanuvchiId }, doira(a)] }, select: XODIM_SELECT })
    if (!x) return xato('Xodim topilmadi', 404)
    const huquq = tahrirHuquqi(a, x)
    const jurnal = await prisma.ruxsatJurnali.findMany({
      where: { foydalanuvchiId: x.id },
      select: JURNAL_SELECT,
      orderBy: { sana: 'desc' },
      take: 60,
    })

    return NextResponse.json({
      xodim: {
        id: x.id, ism: x.ism, login: x.login, rol: x.rol, faol: x.faol,
        filialNomi: x.filial?.nomi ?? null, ulashilgan: !!x.ulashilganEgaId && x.rol === 'ADMIN',
      },
      holat: holatiniHisobla(x),
      ...huquq,
      // Ulashilgan administratorning Ega katalogidagi huquqlari (faqat shu hisoblarda ma'noli)
      tovarBayroqlari: x.rol === 'ADMIN' && x.ulashilganEgaId
        ? { 'ulashish.tovarTahrirlash': x.tovarTahrirlashMumkin, 'ulashish.tovarOchirish': x.tovarOchirishMumkin }
        : null,
      jurnal,
    })
  } catch (e) {
    console.error('[ruxsatlar GET]', e)
    return xato('Server xatosi', 500)
  }
}

export async function PUT(req: NextRequest) {
  try {
    const a = adminOl(await auth())
    if (!a) return xato("Ruxsat yo'q", 403)

    let tana: { foydalanuvchiId?: unknown; amal?: unknown; ozgarishlar?: unknown; manbaId?: unknown }
    try {
      tana = await req.json()
    } catch {
      return xato("So'rov noto'g'ri")
    }
    const foydalanuvchiId = typeof tana.foydalanuvchiId === 'string' ? tana.foydalanuvchiId : ''
    const amal = tana.amal === 'NUSXA' || tana.amal === 'STANDART' ? tana.amal : 'QOLDA'
    if (!foydalanuvchiId) return xato('Xodim tanlanmagan')

    const natija = await prisma.$transaction(async tx => {
      const x = await tx.foydalanuvchi.findFirst({ where: { AND: [{ id: foydalanuvchiId }, doira(a)] }, select: XODIM_SELECT })
      if (!x) return { xato: 'Xodim topilmadi', holat: 404 } as const
      const huquq = tahrirHuquqi(a, x)
      if (!huquq.tahrirlanadi) return { xato: huquq.sabab!, holat: 403 } as const

      // So'ralgan qiymatlar
      let soralgan: Record<string, unknown>
      if (amal === 'NUSXA') {
        const manbaId = typeof tana.manbaId === 'string' ? tana.manbaId : ''
        const manba = manbaId ? await tx.foydalanuvchi.findFirst({ where: { AND: [{ id: manbaId }, doira(a)] }, select: XODIM_SELECT }) : null
        if (!manba) return { xato: 'Nusxa olinadigan xodim topilmadi', holat: 404 } as const
        if (manba.id === x.id) return { xato: 'Xodimning o‘zidan nusxa olib bo‘lmaydi', holat: 400 } as const
        if (manba.rol === 'ADMIN' && !huquq.faqatMaydon) return { xato: 'Administratordan nusxa olib bo‘lmaydi — u cheklanmagan', holat: 400 } as const
        soralgan = nusxaSorovi(holatiniHisobla(manba))
      } else if (amal === 'STANDART') {
        soralgan = standartSorovi(x.rol)
      } else {
        if (!tana.ozgarishlar || typeof tana.ozgarishlar !== 'object' || Array.isArray(tana.ozgarishlar)) {
          return { xato: 'O‘zgarishlar ko‘rsatilmagan', holat: 400 } as const
        }
        soralgan = tana.ozgarishlar as Record<string, unknown>
      }

      // Ulashilgan administrator katalog huquqlari — katalogdan tashqari ikki bayroq
      const bayroqJurnal: JurnalQatori[] = []
      const bayroqYozish: Partial<Record<(typeof TOVAR_BAYROQLARI)[keyof typeof TOVAR_BAYROQLARI], boolean>> = {}
      for (const [kalit, ustun] of Object.entries(TOVAR_BAYROQLARI)) {
        if (!(kalit in soralgan)) continue
        const yangi = soralgan[kalit]
        delete soralgan[kalit]
        if (typeof yangi !== 'boolean' || x.rol !== 'ADMIN' || !x.ulashilganEgaId) continue
        if (x[ustun] === yangi) continue
        bayroqYozish[ustun] = yangi
        bayroqJurnal.push({ kalit, eski: x[ustun], yangi })
      }

      const reja = ozgarishRejasi(
        x.rol,
        new Map(x.ruxsatlar.map(r => [r.bolim, r.korinadi])),
        new Set(x.yashirilganMaydonlar.map(m => m.maydon)),
        soralgan,
        huquq.faqatMaydon,
      )
      const jurnal = [...reja.jurnal, ...bayroqJurnal]

      if (reja.ochirish.length) {
        await tx.ruxsat.deleteMany({ where: { foydalanuvchiId: x.id, bolim: { in: reja.ochirish } } })
      }
      for (const r of reja.yozish) {
        await tx.ruxsat.upsert({
          where: { foydalanuvchiId_bolim: { foydalanuvchiId: x.id, bolim: r.kalit } },
          update: { korinadi: r.korinadi },
          create: { foydalanuvchiId: x.id, bolim: r.kalit, korinadi: r.korinadi },
        })
      }
      if (reja.maydonKorsat.length) {
        await tx.maydonYashirish.deleteMany({ where: { foydalanuvchiId: x.id, maydon: { in: reja.maydonKorsat } } })
      }
      if (reja.maydonYashir.length) {
        await tx.maydonYashirish.createMany({
          data: reja.maydonYashir.map(maydon => ({ foydalanuvchiId: x.id, maydon })),
          skipDuplicates: true,
        })
      }
      if (Object.keys(bayroqYozish).length) {
        await tx.foydalanuvchi.update({ where: { id: x.id }, data: bayroqYozish })
      }
      if (jurnal.length) {
        await tx.ruxsatJurnali.createMany({
          data: jurnal.map(j => ({
            foydalanuvchiId: x.id, foydalanuvchiIsm: x.ism,
            ozgartiruvchiId: a.id, ozgartiruvchiIsm: a.ism,
            kalit: j.kalit, eski: j.eski, yangi: j.yangi, sabab: amal,
          })),
        })
      }
      return { ok: true, ozgardi: jurnal.length, rad: reja.rad } as const
    }, { timeout: 20_000 })

    if ('xato' in natija) return xato(natija.xato!, natija.holat)

    // Xodim sessiyasi keyingi tekshiruvda (≤30 s) yangi ruxsatlarni oladi,
    // nozik amallar esa darhol — kesh shu yerda tozalanadi
    ruxsatKeshiniTozala(foydalanuvchiId)

    const x = await prisma.foydalanuvchi.findUnique({ where: { id: foydalanuvchiId }, select: XODIM_SELECT })
    return NextResponse.json({
      ok: true,
      ozgardi: natija.ozgardi,
      rad: natija.rad,
      holat: x ? holatiniHisobla(x) : null,
      tovarBayroqlari: x && x.rol === 'ADMIN' && x.ulashilganEgaId
        ? { 'ulashish.tovarTahrirlash': x.tovarTahrirlashMumkin, 'ulashish.tovarOchirish': x.tovarOchirishMumkin }
        : null,
    })
  } catch (e) {
    console.error('[ruxsatlar PUT]', e)
    return xato('Server xatosi', 500)
  }
}
