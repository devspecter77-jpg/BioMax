import 'dotenv/config'
import { Bot, InlineKeyboard } from 'grammy'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
if (!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN env variable kerak!')

const bot = new Bot(BOT_TOKEN)

// ─── Yordamchi funksiyalar ───────────────────────────────────────────────────

function formatSum(sum: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(sum)) + ' UZS'
}

function formatSana(d: Date) {
  return d.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ─── /start komandasi ────────────────────────────────────────────────────────

bot.command('start', async (ctx) => {
  const args = ctx.message?.text?.split(' ')
  const deeplink = args?.[1] // /start <maxsus_kod>

  if (deeplink) {
    // Deep link orqali avtomatik identifikatsiya
    const mijoz = await prisma.mijoz.findUnique({ where: { maxsus_kod: deeplink } })
    if (mijoz) {
      await prisma.mijoz.update({
        where: { id: mijoz.id },
        data: { telegram_id: String(ctx.from!.id) },
      })
      await ctx.reply(
        `✅ Salom, *${mijoz.ism}*\\!\n\nSiz tizimga muvaffaqiyatli bog'landingiz\\.\nKodingiz: \`${mijoz.maxsus_kod}\``,
        { parse_mode: 'MarkdownV2', reply_markup: mainKeyboard() }
      )
      return
    }
  }

  // Telegram ID orqali aniqlashga urinish
  const mavjud = await prisma.mijoz.findUnique({ where: { telegram_id: String(ctx.from!.id) } })
  if (mavjud) {
    await ctx.reply(
      `👋 Xush kelibsiz, *${mavjud.ism}*\\!`,
      { parse_mode: 'MarkdownV2', reply_markup: mainKeyboard() }
    )
    return
  }

  await ctx.reply(
    `👋 Salom\\!\n\nBu *Optimum Do'kon* bot tizimi\\.\n\nO'zingizni aniqlash uchun maxsus kodingizni yuboring:\n_Misol: \`123\\-456\\-789\`_\n\nKodingizni do'kon kassiridan so'rang\\.`,
    { parse_mode: 'MarkdownV2' }
  )
})

// ─── Asosiy menyu keyboard ───────────────────────────────────────────────────

function mainKeyboard() {
  return new InlineKeyboard()
    .text('💳 Nasiyalarim', 'nasiyalar')
    .text('📋 Xarid tarixi', 'tarix').row()
    .text('👤 Mening ma\'lumotlarim', 'info')
}

// ─── Kod orqali identifikatsiya ──────────────────────────────────────────────

bot.on('message:text', async (ctx) => {
  const matn = ctx.message.text.trim()

  // Maxsus kod formati: XXX-XXX-XXX
  if (/^\d{3}-\d{3}-\d{3}$/.test(matn)) {
    const mijoz = await prisma.mijoz.findUnique({ where: { maxsus_kod: matn } })
    if (!mijoz) {
      await ctx.reply('❌ Bunday kod topilmadi. Iltimos, to\'g\'ri kodni kiriting.')
      return
    }
    await prisma.mijoz.update({
      where: { id: mijoz.id },
      data: { telegram_id: String(ctx.from!.id) },
    })
    await ctx.reply(
      `✅ Salom, *${escMd(mijoz.ism)}*\\!\n\nSiz muvaffaqiyatli bog'landingiz\\.\nKodingiz: \`${matn}\``,
      { parse_mode: 'MarkdownV2', reply_markup: mainKeyboard() }
    )
    return
  }

  // Identifikatsiya qilinmagan foydalanuvchi uchun
  const mijoz = await prisma.mijoz.findUnique({ where: { telegram_id: String(ctx.from!.id) } })
  if (!mijoz) {
    await ctx.reply('Maxsus kodingizni kiriting (format: 123-456-789). Kassirdan so\'rang.')
    return
  }

  await ctx.reply('Menyu:', { reply_markup: mainKeyboard() })
})

// ─── Inline callback query'lar ───────────────────────────────────────────────

function escMd(text: string) {
  return text.replace(/[_*[\]()~`>#+=|{}.!\\-]/g, '\\$&')
}

bot.callbackQuery('nasiyalar', async (ctx) => {
  await ctx.answerCallbackQuery()
  const mijoz = await prisma.mijoz.findUnique({ where: { telegram_id: String(ctx.from!.id) } })
  if (!mijoz) { await ctx.reply('Avval kodingizni kiriting.'); return }

  const nasiyalar = await prisma.nasiya.findMany({
    where: { mijozId: mijoz.id, holati: { in: ['OCHIQ', 'MUDDATI_OTGAN'] } },
    include: { sotuv: { select: { sana: true, chekRaqami: true } } },
    orderBy: { sana: 'desc' },
  })

  if (nasiyalar.length === 0) {
    await ctx.editMessageText(`✅ *${escMd(mijoz.ism)}*, sizda hozirda nasiya qarz yo'q\\.`, { parse_mode: 'MarkdownV2' })
    return
  }

  let xabar = `💳 *${escMd(mijoz.ism)}* \\— Nasiyalar:\n\n`
  let jami = 0
  for (const n of nasiyalar) {
    const qoldiq = Number(n.qoldiq)
    jami += qoldiq
    const muddat = n.muddat ? ` \\(muddat: ${escMd(formatSana(n.muddat))}\\)` : ''
    const holat = n.holati === 'MUDDATI_OTGAN' ? '🔴' : '🟡'
    xabar += `${holat} ${n.sotuv ? `Chek: \`${escMd(n.sotuv.chekRaqami)}\`` : 'Nasiya'}\n`
    xabar += `   Qoldiq qarz: *${escMd(formatSum(qoldiq))}*${muddat}\n\n`
  }
  xabar += `📊 *Jami qarz: ${escMd(formatSum(jami))}*`

  await ctx.editMessageText(xabar, { parse_mode: 'MarkdownV2', reply_markup: backKeyboard() })
})

bot.callbackQuery('tarix', async (ctx) => {
  await ctx.answerCallbackQuery()
  const mijoz = await prisma.mijoz.findUnique({ where: { telegram_id: String(ctx.from!.id) } })
  if (!mijoz) { await ctx.reply('Avval kodingizni kiriting.'); return }

  const sotuvlar = await prisma.sotuv.findMany({
    where: { mijozId: mijoz.id },
    include: { tarkiblar: { include: { tovar: { select: { nomi: true } } } } },
    orderBy: { sana: 'desc' },
    take: 10,
  })

  if (sotuvlar.length === 0) {
    await ctx.editMessageText('📋 Xarid tarixi topilmadi.', { reply_markup: backKeyboard() })
    return
  }

  let xabar = `📋 *${escMd(mijoz.ism)}* \\— So'nggi xaridlar:\n\n`
  for (const s of sotuvlar) {
    xabar += `🧾 \`${escMd(s.chekRaqami)}\` — *${escMd(formatSum(Number(s.yakuniySumma)))}*\n`
    xabar += `   📅 ${escMd(formatSana(s.sana))}\n`
    if (s.tarkiblar.length <= 3) {
      for (const t of s.tarkiblar) {
        xabar += `   • ${escMd(t.tovar.nomi)} × ${Number(t.miqdor)}\n`
      }
    } else {
      xabar += `   ${s.tarkiblar.length} ta mahsulot\n`
    }
    xabar += '\n'
  }

  await ctx.editMessageText(xabar, { parse_mode: 'MarkdownV2', reply_markup: backKeyboard() })
})

bot.callbackQuery('info', async (ctx) => {
  await ctx.answerCallbackQuery()
  const mijoz = await prisma.mijoz.findUnique({
    where: { telegram_id: String(ctx.from!.id) },
    include: {
      _count: { select: { sotuvlar: true, nasiyalar: true } },
      nasiyalar: {
        where: { holati: { in: ['OCHIQ', 'MUDDATI_OTGAN'] } },
        select: { qoldiq: true },
      },
    },
  })
  if (!mijoz) { await ctx.reply('Avval kodingizni kiriting.'); return }

  const jamiQarz = mijoz.nasiyalar.reduce((s, n) => s + Number(n.qoldiq), 0)

  const xabar = `👤 *Mening ma'lumotlarim*\n\n` +
    `📛 Ism: *${escMd(mijoz.ism)}*\n` +
    (mijoz.telefon ? `📱 Telefon: \`${escMd(mijoz.telefon)}\`\n` : '') +
    (mijoz.manzil ? `📍 Manzil: ${escMd(mijoz.manzil)}\n` : '') +
    `🔑 Maxsus kod: \`${escMd(mijoz.maxsus_kod || '—')}\`\n\n` +
    `🛒 Jami xarid: *${mijoz._count.sotuvlar} ta*\n` +
    `💳 Nasiya qarz: *${escMd(formatSum(jamiQarz))}*`

  await ctx.editMessageText(xabar, { parse_mode: 'MarkdownV2', reply_markup: backKeyboard() })
})

bot.callbackQuery('back', async (ctx) => {
  await ctx.answerCallbackQuery()
  const mijoz = await prisma.mijoz.findUnique({ where: { telegram_id: String(ctx.from!.id) } })
  await ctx.editMessageText(
    mijoz ? `👋 *${escMd(mijoz.ism)}*, menyuni tanlang:` : 'Menyuni tanlang:',
    { parse_mode: 'MarkdownV2', reply_markup: mainKeyboard() }
  )
})

function backKeyboard() {
  return new InlineKeyboard().text('⬅️ Orqaga', 'back')
}

// ─── Ishga tushirish ─────────────────────────────────────────────────────────

bot.catch((err) => console.error('Bot xatosi:', err))

bot.start({ onStart: (info) => console.log(`Bot ishga tushdi: @${info.username}`) })

export default bot
