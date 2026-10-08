// Xodim hisoblari: kim kimni ko'radi, tahrirlaydi va o'chiradi.
// (Mulk va sotuvlar marshrutlaridagi umumiy tekshiruv — lib/xodim-server.ts.)
//
// Nega alohida modul: `/api/xodimlar` ro'yxati ilgari filialsiz Ega uchun
// BUTUN tizimdagi hisoblarni qaytarardi — bir do'kon egasi boshqa do'konning
// egasini va xodimlarini ko'rardi. Tahrirlash va o'chirish qo'shilganda bu
// "ko'rish" emas, "o'chirib yuborish" bo'lib qolardi. Ro'yxat, bitta xodim,
// tahrirlash va o'chirish AYNAN shu qoidalardan o'tadi.

import bcrypt from 'bcryptjs'
import type { Prisma } from '@prisma/client'
import type { Session } from 'next-auth'
import { prisma } from './prisma'
import { sessionFilialId, sessionEgaId } from './filial-scope'
import { ruxsatKeshiniTozala } from './ruxsat-server'

/**
 * O'chirilgan (tarixi bor) hisob login'i shu bilan boshlanadi — login
 * bo'shaydi, yozuv esa eski hisobotlar uchun qoladi. `/api/foydalanuvchilar`
 * dagi eski o'chirish ham aynan shu prefiksni ishlatgan.
 */
export const ARXIV_PREFIKS = 'ochirilgan_'

/** Sessiya ko'radigan xodimlar. O'chirilganlar hech qachon kirmaydi. */
export function xodimlarDoirasi(session: Session | null): Prisma.FoydalanuvchiWhereInput {
  const arxivEmas: Prisma.FoydalanuvchiWhereInput = { NOT: { login: { startsWith: ARXIV_PREFIKS } } }
  const filialId = sessionFilialId(session)
  if (filialId) return { AND: [{ filialId }, arxivEmas] }
  const egaId = sessionEgaId(session)
  return {
    AND: [arxivEmas, {
      OR: [
        { id: egaId ?? undefined },
        // Shu Egaga ulangan xodimlar va adminlar
        { ulashilganEgaId: egaId },
        // Filial xodimlari — filial Egaga bog'lanmagan, Ega hammasini boshqaradi
        { filialId: { not: null } },
        // Eski, hech kimga biriktirilmagan xodimlar (Ega hisobi emas)
        { filialId: null, ulashilganEgaId: null, rol: { not: 'ADMIN' } },
      ],
    }],
  }
}

export interface XodimNishon {
  id: string
  rol: string
  filialId: string | null
  ulashilganEgaId: string | null
}

/** Sessiya shu xodimni tahrirlay / o'chira oladimi (bo'lim ruxsatidan tashqari). */
export function xodimAmallari(
  session: Session | null,
  x: XodimNishon,
  boshqaraOladi: boolean,
): { tahrir: boolean; ochirish: boolean } {
  const yoq = { tahrir: false, ochirish: false }
  if (!session || !boshqaraOladi) return yoq
  const meId = (session.user as { id?: string }).id
  const admin = (session.user as { rol?: string }).rol === 'ADMIN'
  const egaId = sessionEgaId(session)

  // Boshqa do'kon egasi (mustaqil Ega) yoki boshqa Egaga ulangan hisob — tegilmaydi
  const mustaqilEga = x.rol === 'ADMIN' && !x.filialId && !x.ulashilganEgaId
  if (mustaqilEga && x.id !== egaId) return yoq
  if (egaId && x.ulashilganEgaId && x.ulashilganEgaId !== egaId) return yoq
  // Ruxsat berilgan xodim administrator hisobiga ham, o'z hisobiga ham tegmaydi
  if (!admin && (x.rol === 'ADMIN' || x.id === meId)) return yoq

  return {
    // Do'kon egasining hisobini faqat egasining o'zi tahrirlaydi (unga ulangan admin emas).
    // O'z hisobida rol va faollik server tomonda qulflangan.
    tahrir: x.id === egaId ? x.id === meId : true,
    // O'zini ham, do'kon egasini ham o'chirib bo'lmaydi
    ochirish: x.id !== meId && x.id !== egaId,
  }
}

export type OchirishNatija =
  | { holat: 'ochirildi' | 'arxivlandi' }
  | { holat: 'rad'; xato: string }

/**
 * Xodimni o'chiradi — tarixini buzmasdan.
 *
 * Oylik to'lovlari va biriktirilgan mulk bazada `onDelete: Cascade` bilan
 * bog'langan: yozuvni butunlay o'chirish xodimning butun oylik tarixini
 * jimgina yo'q qilardi. Shuning uchun:
 *   - hech qanday tarixi yo'q (xato ochilgan) hisob — butunlay o'chiriladi;
 *   - tarixi bor hisob — nofaol bo'ladi, login bo'shaydi, parol bekor
 *     qilinadi; sotuvlar, oyliklar va boshqa yozuvlarda ismi saqlanib qoladi.
 * Qo'lida qaytarilmagan mulk bo'lsa o'chirilmaydi — avval qaytarib olinsin.
 */
export async function xodimniOchir(id: string): Promise<OchirishNatija> {
  const x = await prisma.foydalanuvchi.findUnique({
    where: { id },
    select: {
      login: true,
      _count: {
        select: {
          tolovlari: true,
          sotuvlar: true,
          omborlar: true,
          xaridlar: true,
          xarajatlar: true,
          uchunXarajatlar: true,
          qaytarishlar: true,
          buyurtmalar: true,
          nasiyaTolovlar: true,
          otkazmalar: true,
          // Ish smenalari va ovoz yozuvlari — dalil, xodim bilan birga yo'qolmasin
          smenalari: true,
        },
      },
    },
  })
  if (!x) return { holat: 'rad', xato: 'Xodim topilmadi' }

  const [qolidagiMulk, faolYetkazish, mulkTarixi] = await Promise.all([
    prisma.xodimMulki.count({ where: { xodimId: id, holati: 'BERILGAN' } }),
    prisma.onlaynYetkazish.count({ where: { dostavchikId: id, holati: { in: ['TAYINLANGAN', 'YOLDA', 'YETIB_KELDI'] } } }),
    prisma.xodimMulki.count({ where: { xodimId: id } }),
  ])
  if (qolidagiMulk > 0) {
    return { holat: 'rad', xato: `Xodim qo'lida ${qolidagiMulk} ta mulk bor — avval «Biriktirilgan mulk» bo'limida qaytarib oling` }
  }
  if (faolYetkazish > 0) {
    return { holat: 'rad', xato: `Xodimda ${faolYetkazish} ta tugallanmagan yetkazish bor — avval boshqa dostavchikka o'tkazing` }
  }

  const tarixBor = mulkTarixi > 0 || Object.values(x._count).some(n => n > 0)
  if (!tarixBor) {
    try {
      await prisma.foydalanuvchi.delete({ where: { id } })
      ruxsatKeshiniTozala(id)
      return { holat: 'ochirildi' }
    } catch {
      // Sanalmagan boshqa bog'liqlik (masalan onlayn rezerv) — arxivlashga o'tamiz
    }
  }

  await prisma.foydalanuvchi.update({
    where: { id },
    data: {
      faol: false,
      login: `${ARXIV_PREFIKS}${Date.now()}_${x.login}`.slice(0, 190),
      parolHash: await bcrypt.hash(`${ARXIV_PREFIKS}${Date.now()}_${Math.random()}`, 10),
    },
  })
  ruxsatKeshiniTozala(id)
  return { holat: 'arxivlandi' }
}
