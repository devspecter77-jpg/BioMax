// Bulk stock adjustment: barcha tovarlarning DOKON qoldig'ini 1000 ga keltirish
// Foydalanish: node scripts/bulk-stock-1000.mjs

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL env var topilmadi')
  process.exit(1)
}

const ADMIN_ID = 'cmma346l000002xkklxwvu2wy' // Administrator
const TARGET_QOLDIQ = 1000
const IZOH = "Boshlang'ich qoldiq qayta belgilandi"

const pool = new Pool({ connectionString: DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('=== Bulk stock 1000 ===')

  // 1) Tovarlar ro'yxati
  const tovarlar = await prisma.tovar.findMany({
    select: { id: true, nomi: true, kelishNarxi: true },
  })
  console.log(`Jami tovarlar: ${tovarlar.length}`)

  // 2) Hozirgi DOKON qoldiqlari
  const stockRows = await prisma.$queryRawUnsafe(`
    SELECT
      "tovarId",
      COALESCE(SUM(CASE
        WHEN turi = 'OTKAZMA' THEN miqdor
        WHEN joy != 'DOKON' THEN 0
        WHEN turi = 'KIRIM' OR turi = 'QAYTARISH' THEN miqdor
        ELSE -miqdor
      END), 0)::float AS "dokonQoldiq"
    FROM ombor_harakati
    GROUP BY "tovarId"
  `)
  const stockMap = new Map(stockRows.map(r => [r.tovarId, Number(r.dokonQoldiq)]))

  // 3) Har biri uchun harakat yaratish
  let kirim = 0
  let chiqim = 0
  let skipped = 0

  const batch = []
  for (const t of tovarlar) {
    const current = Math.max(0, stockMap.get(t.id) || 0)
    const diff = TARGET_QOLDIQ - current

    if (Math.abs(diff) < 0.001) {
      skipped++
      continue
    }

    batch.push({
      tovarId: t.id,
      turi: diff > 0 ? 'KIRIM' : 'CHIQIM',
      joy: 'DOKON',
      miqdor: Math.abs(diff),
      narx: Number(t.kelishNarxi) || 0,
      izoh: IZOH,
      foydalanuvchiId: ADMIN_ID,
    })

    if (diff > 0) kirim++
    else chiqim++
  }

  console.log(`KIRIM (qo'shish): ${kirim}`)
  console.log(`CHIQIM (kamaytirish): ${chiqim}`)
  console.log(`O'tkazib yuborildi (1000 da turgan): ${skipped}`)
  console.log(`Jami yangi harakat: ${batch.length}`)

  if (batch.length === 0) {
    console.log('Hech narsa qilinmadi')
    return
  }

  // 4) Toplam transaction'da insert
  const result = await prisma.omborHarakati.createMany({ data: batch })
  console.log(`Yaratildi: ${result.count} ta yozuv`)

  // 5) Tekshirish — yangi DOKON qoldiqlari
  const verifyRows = await prisma.$queryRawUnsafe(`
    SELECT
      COUNT(*)::int as total,
      COUNT(CASE WHEN ABS(stock - 1000) < 0.001 THEN 1 END)::int as ok_count,
      MIN(stock)::float as min_qoldiq,
      MAX(stock)::float as max_qoldiq
    FROM (
      SELECT
        t.id,
        GREATEST(0, COALESCE(SUM(CASE
          WHEN oh.turi = 'OTKAZMA' THEN oh.miqdor
          WHEN oh.joy != 'DOKON' THEN 0
          WHEN oh.turi = 'KIRIM' OR oh.turi = 'QAYTARISH' THEN oh.miqdor
          ELSE -oh.miqdor
        END), 0))::float as stock
      FROM tovarlar t
      LEFT JOIN ombor_harakati oh ON oh."tovarId" = t.id
      GROUP BY t.id
    ) sub
  `)
  const v = verifyRows[0]
  console.log('\n=== Tekshirish ===')
  console.log(`Jami tovarlar: ${v.total}`)
  console.log(`DOKON qoldiq = 1000: ${v.ok_count}`)
  console.log(`Min qoldiq: ${v.min_qoldiq}`)
  console.log(`Max qoldiq: ${v.max_qoldiq}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
