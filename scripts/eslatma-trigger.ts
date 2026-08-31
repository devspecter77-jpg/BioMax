import 'dotenv/config'
import { nasiyaEslatmalarYuborish } from '../src/lib/telegram'

(async () => {
  console.log('=== Manual trigger boshlandi ===')
  console.log('Vaqt:', new Date().toString())
  await nasiyaEslatmalarYuborish()
  console.log('=== Tugadi ===')
  process.exit(0)
})().catch(e => { console.error('XATO:', e); process.exit(1) })
