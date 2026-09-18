import QRCode from 'qrcode'
import { NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { amalRuxsatiBormi } from '@/lib/ruxsat-server'
import { sessionFilialId } from '@/lib/filial-scope'
import { QR_YOLI, type QrMatritsa } from '@/lib/ilova-qr'

// Ilova QR kodi — server tomoni: matritsa, saqlangan manzil va ruxsat.

/** Manzil shu yerda saqlanadi: domen o'zgarsa kod tahrirlanmasin. */
const SOZLAMA_KALITI = 'ilova_qr_manzil'

export async function qrRuxsat(kalit = 'ilova-qr'): Promise<{ ok: true; session: Session } | { ok: false; javob: NextResponse }> {
  const session = await auth()
  if (!session) return { ok: false, javob: NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 }) }
  // Onlayn do'kon markaziy — filial xodimiga tegishli emas
  if (sessionFilialId(session) || !(await amalRuxsatiBormi(session, kalit))) {
    return { ok: false, javob: NextResponse.json({ xato: 'Bu amalga ruxsatingiz yo‘q', kod: 'ruxsat_yoq' }, { status: 403 }) }
  }
  return { ok: true, session }
}

/** `.env` dagi ommaviy manzildan standart QR havolasi. */
export function standartManzil(): string {
  const asos = (process.env.MARKETPLACE_OMMAVIY_URL || '').trim().replace(/\/$/, '')
  return asos ? asos + QR_YOLI : ''
}

export async function saqlanganManzil(): Promise<string> {
  const q = await prisma.sozlama.findUnique({ where: { kalit: SOZLAMA_KALITI }, select: { qiymat: true } })
  return q?.qiymat?.trim() || standartManzil()
}

export async function manzilniSaqla(manzil: string): Promise<void> {
  await prisma.sozlama.upsert({
    where: { kalit: SOZLAMA_KALITI },
    update: { qiymat: manzil },
    create: { kalit: SOZLAMA_KALITI, qiymat: manzil },
  })
}

export async function dokonNomi(): Promise<string> {
  const q = await prisma.sozlama.findUnique({ where: { kalit: 'dokon_nomi' }, select: { qiymat: true } })
  return q?.qiymat?.trim() || 'BioMax'
}

/**
 * QR matritsasi. Xato tuzatish darajasi «H»: kodning 30% i shikastlansa ham
 * o'qiladi — markazga do'kon belgisini qo'yish shuning hisobiga mumkin.
 */
export async function qrMatritsa(manzil: string): Promise<QrMatritsa> {
  const qr = QRCode.create(manzil, { errorCorrectionLevel: 'H' })
  const { size, data } = qr.modules
  return { olcham: size, data: Array.from(data, (b: number) => b === 1) }
}
