import { NextRequest, NextResponse } from 'next/server'
import { imzoniTekshir } from '@/lib/marketplace-imzo'
import { prisma } from '@/lib/prisma'

// MARKETPLACE SHARTNOMASI — salomatlik tekshiruvi.
//
// Bu marshrut marketplace bilan ERP o'rtasidagi bog'lanishni tekshirish
// uchun ishlatiladi. HMAC autentifikatsiya va baza bog'lanishini tekshiradi.

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const tekshiruv = imzoniTekshir(req, '')
  if (!tekshiruv.ok) {
    console.warn('[mp/salomatlik] imzo rad etildi:', tekshiruv.sabab)
    return NextResponse.json({ 
      ok: false, 
      kod: tekshiruv.sabab, 
      xato: 'Autentifikatsiya xatosi',
      tavsiya: tekshiruv.sabab === 'kalit_sozlanmagan' 
        ? 'ERP .env faylida MP_HMAC_SECRET o\'rnatilganini tekshiring'
        : 'HMAC imzosini tekshiring'
    }, { status: tekshiruv.holat })
  }

  try {
    // Baza bog'lanishini tekshirish
    await prisma.$queryRaw`SELECT 1`
    
    // Do'kon nomi
    const dokonNomi = (await prisma.sozlama.findUnique({ 
      where: { kalit: 'dokon_nomi' } 
    }))?.qiymat?.trim() || 'BioMax'

    return NextResponse.json({
      ok: true,
      xabar: 'ERP tayyor',
      dokonNomi,
      vaqt: new Date().toISOString(),
      versiya: '1.0.0',
      marshrutlar: [
        'GET /api/marketplace/salomatlik',
        'GET /api/marketplace/katalog',
        'POST /api/marketplace/qoldiq',
        'POST /api/marketplace/rezerv',
        'DELETE /api/marketplace/rezerv-boshat',
        'POST /api/marketplace/bajarish',
        'POST /api/marketplace/mijoz',
        'GET /api/marketplace/dokon',
        'GET /api/marketplace/rasm/:tovarId/:tartib',
        'POST /api/marketplace/kod-yubor',
      ]
    })
  } catch (e) {
    console.error('[mp/salomatlik] baza xatosi:', e)
    return NextResponse.json({ 
      ok: false,
      kod: 'baza_xatosi',
      xato: 'Baza bog\'lanishi xatosi',
      tavsiya: 'ERP baza sozlamalarini tekshiring'
    }, { status: 500 })
  }
}
