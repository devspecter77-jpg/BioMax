import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const user = session?.user as { rol?: string } | undefined
    if (!session || user?.rol !== 'ADMIN') {
      return NextResponse.json({ xato: 'Faqat admin' }, { status: 403 })
    }

    const backup = await req.json()
    if (!backup || !backup.version) {
      return NextResponse.json({ xato: "Noto'g'ri fayl formati" }, { status: 400 })
    }

    const result: Record<string, number> = {}

    // Import kategoriyalar
    if (backup.kategoriyalar?.length) {
      for (const k of backup.kategoriyalar) {
        await prisma.kategoriya.upsert({
          where: { id: k.id },
          create: { id: k.id, nomi: k.nomi, tavsif: k.tavsif || null },
          update: { nomi: k.nomi, tavsif: k.tavsif || null },
        })
      }
      result.kategoriyalar = backup.kategoriyalar.length
    }

    // Import tovarlar
    if (backup.tovarlar?.length) {
      for (const t of backup.tovarlar) {
        await prisma.tovar.upsert({
          where: { id: t.id },
          create: {
            id: t.id, nomi: t.nomi, kategoriyaId: t.kategoriyaId,
            kelishNarxi: t.kelishNarxi, sotishNarxi: t.sotishNarxi,
            birlik: t.birlik, minimalQoldiq: t.minimalQoldiq,
            holati: t.holati, shtrixKod: t.shtrixKod || null,
            keltirilganManzil: t.keltirilganManzil || null,
          },
          update: {
            nomi: t.nomi, kategoriyaId: t.kategoriyaId,
            kelishNarxi: t.kelishNarxi, sotishNarxi: t.sotishNarxi,
            birlik: t.birlik, minimalQoldiq: t.minimalQoldiq,
            holati: t.holati, shtrixKod: t.shtrixKod || null,
            keltirilganManzil: t.keltirilganManzil || null,
          },
        })
      }
      result.tovarlar = backup.tovarlar.length
    }

    // Import mijozlar
    if (backup.mijozlar?.length) {
      for (const m of backup.mijozlar) {
        await prisma.mijoz.upsert({
          where: { id: m.id },
          create: { id: m.id, ism: m.ism, telefon: m.telefon || null, manzil: m.manzil || null },
          update: { ism: m.ism, telefon: m.telefon || null, manzil: m.manzil || null },
        })
      }
      result.mijozlar = backup.mijozlar.length
    }

    // Import taminotchilar
    if (backup.taminotchilar?.length) {
      for (const t of backup.taminotchilar) {
        await prisma.taminotchi.upsert({
          where: { id: t.id },
          create: { id: t.id, nomi: t.nomi, kontaktShaxs: t.kontaktShaxs || null, telefon: t.telefon || null, manzil: t.manzil || null },
          update: { nomi: t.nomi, kontaktShaxs: t.kontaktShaxs || null, telefon: t.telefon || null, manzil: t.manzil || null },
        })
      }
      result.taminotchilar = backup.taminotchilar.length
    }

    // Import sozlamalar
    if (backup.sozlamalar?.length) {
      for (const s of backup.sozlamalar) {
        await prisma.sozlama.upsert({
          where: { kalit: s.kalit },
          create: { kalit: s.kalit, qiymat: s.qiymat },
          update: { qiymat: s.qiymat },
        })
      }
      result.sozlamalar = backup.sozlamalar.length
    }

    return NextResponse.json({
      muvaffaqiyat: true,
      natija: result,
    })
  } catch (e) {
    console.error('[backup/import] Error:', e)
    return NextResponse.json({ xato: 'Import xatosi: ' + String(e) }, { status: 500 })
  }
}
