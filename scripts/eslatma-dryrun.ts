import 'dotenv/config'
import { prisma } from '../src/lib/prisma'

async function main() {
  const bugun = new Date()
  bugun.setHours(0, 0, 0, 0)
  console.log('Bugun (process TZ):', new Date().toString())
  console.log('Bugun midnight:', bugun.toISOString(), '|', bugun.toString())

  const all = await prisma.nasiya.findMany({
    where: {
      holati: { in: ['OCHIQ', 'MUDDATI_OTGAN'] },
      ochirilgan: false,
      muddat: { not: null },
      mijoz: { telefon: { not: null } },
    },
    select: { id: true, muddat: true, mijoz: { select: { ism: true, telefon: true } } },
  })

  const fullStats: Record<string, number> = {}
  for (const n of all) {
    const muddat = new Date(n.muddat!)
    muddat.setHours(0, 0, 0, 0)
    const kunFarq = Math.round((muddat.getTime() - bugun.getTime()) / 86400000)
    fullStats[kunFarq] = (fullStats[kunFarq] || 0) + 1
  }

  console.log('\n3 ta misol:')
  for (let i=0; i<3 && i<all.length; i++) {
    const n = all[i]
    const m = new Date(n.muddat!); m.setHours(0,0,0,0)
    const kf = Math.round((m.getTime() - bugun.getTime()) / 86400000)
    console.log('  ' + n.mijoz.ism + ': raw=' + new Date(n.muddat!).toISOString() + ' midnight=' + m.toISOString() + ' kunFarq=' + kf)
  }

  console.log('\nKun farqi -> mijozlar soni:', fullStats)
  console.log('Jami telefon bor + muddati bor:', all.length)
  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
