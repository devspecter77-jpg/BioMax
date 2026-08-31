// Qolgan 17 ta tovarni 1000 ga keltirish (negative stock'lar uchun fix)
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) { console.error('DATABASE_URL yo\'q'); process.exit(1) }

const ADMIN_ID = 'cmma346l000002xkklxwvu2wy'
const TARGET = 1000
const IZOH = "Boshlang'ich qoldiq qayta belgilandi"

const pool = new Pool({ connectionString: DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  // Raw stock (clamping yo'q)
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      t.id, t."kelishNarxi"::float as narx,
      COALESCE(SUM(CASE
        WHEN oh.turi = 'OTKAZMA' THEN oh.miqdor
        WHEN oh.joy != 'DOKON' THEN 0
        WHEN oh.turi = 'KIRIM' OR oh.turi = 'QAYTARISH' THEN oh.miqdor
        ELSE -oh.miqdor
      END), 0)::float AS "raw_dokon"
    FROM tovarlar t
    LEFT JOIN ombor_harakati oh ON oh."tovarId" = t.id
    GROUP BY t.id
    HAVING ABS(1000 - COALESCE(SUM(CASE
      WHEN oh.turi = 'OTKAZMA' THEN oh.miqdor
      WHEN oh.joy != 'DOKON' THEN 0
      WHEN oh.turi = 'KIRIM' OR oh.turi = 'QAYTARISH' THEN oh.miqdor
      ELSE -oh.miqdor
    END), 0)) > 0.001
  `)
  console.log(`Tuzatish kerak: ${rows.length}`)

  const batch = rows.map(r => {
    const current = Number(r.raw_dokon)
    const diff = TARGET - current  // raw, no clamp
    return {
      tovarId: r.id,
      turi: diff > 0 ? 'KIRIM' : 'CHIQIM',
      joy: 'DOKON',
      miqdor: Math.abs(diff),
      narx: Number(r.narx) || 0,
      izoh: IZOH,
      foydalanuvchiId: ADMIN_ID,
    }
  })

  if (batch.length === 0) { console.log('Hammasi 1000 da'); return }

  const result = await prisma.omborHarakati.createMany({ data: batch })
  console.log(`Yaratildi: ${result.count}`)

  // Verify
  const v = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int as total,
      COUNT(CASE WHEN ABS(stock - 1000) < 0.001 THEN 1 END)::int as ok_count,
      MIN(stock)::float as min, MAX(stock)::float as max
    FROM (
      SELECT t.id, GREATEST(0, COALESCE(SUM(CASE
        WHEN oh.turi = 'OTKAZMA' THEN oh.miqdor
        WHEN oh.joy != 'DOKON' THEN 0
        WHEN oh.turi = 'KIRIM' OR oh.turi = 'QAYTARISH' THEN oh.miqdor
        ELSE -oh.miqdor
      END), 0))::float as stock
      FROM tovarlar t LEFT JOIN ombor_harakati oh ON oh."tovarId" = t.id
      GROUP BY t.id
    ) s
  `)
  console.log(`Tekshirish: ${v[0].ok_count}/${v[0].total} 1000 da | min=${v[0].min} max=${v[0].max}`)
}

main().catch(e => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect(); await pool.end() })
