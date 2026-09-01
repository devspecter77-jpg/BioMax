import { TelegramClient, Api } from 'telegram'
import { StringSession } from 'telegram/sessions'
import { computeCheck } from 'telegram/Password'
import { prisma } from './prisma'

// ─── Yordamchi funksiyalar ───────────────────────────────────────────────────

function formatSum(sum: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(sum)) + ' UZS'
}

function formatSana(d: Date) {
  return d.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Mijozlar telefoni bazada har xil formatda saqlangan: ba'zisi "+998901234567"
// (qo'lda kiritilgan), ba'zisi "901234567" (PhoneInput'dan — faqat 9 xonali,
// kod yo'q). Telegram ImportContacts to'liq xalqaro raqam ("998901234567",
// "+"siz) talab qiladi — shuning uchun har doim shu formatga keltiramiz.
function normalizePhone(telefon: string): string {
  const digits = telefon.replace(/\D/g, '')
  return digits.length === 9 ? '998' + digits : digits
}

// ─── Sozlamalar yuklash ──────────────────────────────────────────────────────

async function getSozlama(kalit: string): Promise<string | null> {
  const s = await prisma.sozlama.findUnique({ where: { kalit } })
  return s?.qiymat || null
}

async function isTelegramEnabled(): Promise<boolean> {
  return (await getSozlama('telegram_bildirishnoma')) !== 'false'
}

// ─── Singleton TelegramClient — bitta client qayta ishlatiladi ───────────────

let _client: TelegramClient | null = null
let _clientReady = false
let _connectPromise: Promise<TelegramClient | null> | null = null

// Entity cache — telefon raqamdan Telegram user ID ga (DB da saqlanadi).
// CACHE ABADIY: bir marta resolve qilingan mijoz keyin hech qachon qayta resolve qilinmaydi.
// Bu PEER_FLOOD risk'ni keskin kamaytiradi (har xabar uchun API call yo'q).
const _entityCache = new Map<string, { userId: bigint; accessHash: bigint; cachedAt: number }>()
let _entityCacheLoaded = false

// Flood timer — PEER_FLOOD kelganda shu vaqtgacha kutish
let _floodUntil = 0

// Rate limit — xabarlar orasida minimal kutish
let _lastSendTime = 0
const MIN_SEND_INTERVAL = 3000 // 3 soniya (account-level)

// Queue worker config
const PEER_FLOOD_HOURS = 24 // PEER_FLOOD kelganda Telegram 24+ soat tutadi (3 emas)
const RETRY_BACKOFF_SECS = [30, 90, 270] // attempt 1 fail → 30s, 2 → 90s, 3 → 270s
const QUEUE_BATCH_SIZE = 5 // bir tick'da max 5 ta xabar (yetarli xajm uchun)

// Queue worker tick'i orasidagi global lock
let _queueTickRunning = false

// ─── Entity cache — DB da saqlash/yuklash ────────────────────────────────────

async function loadEntityCache(): Promise<void> {
  if (_entityCacheLoaded) return
  _entityCacheLoaded = true
  try {
    const row = await prisma.sozlama.findUnique({ where: { kalit: 'telegram_entity_cache' } })
    if (!row?.qiymat) return
    const data = JSON.parse(row.qiymat) as Record<string, { userId: string; accessHash: string; cachedAt: number }>
    // ABADIY cache — TTL tekshirilmaydi. Bir marta resolve qilingan mijoz abadiy qoladi.
    for (const [phone, val] of Object.entries(data)) {
      _entityCache.set(phone, {
        userId: BigInt(val.userId),
        accessHash: BigInt(val.accessHash),
        cachedAt: val.cachedAt,
      })
    }
    console.log(`[Telegram] Entity cache yuklandi: ${_entityCache.size} ta raqam (abadiy)`)
  } catch (e) {
    console.error('[Telegram] Entity cache yuklash xatosi:', e)
  }
}

async function saveEntityCache(): Promise<void> {
  try {
    const data: Record<string, { userId: string; accessHash: string; cachedAt: number }> = {}
    for (const [phone, val] of _entityCache.entries()) {
      data[phone] = { userId: val.userId.toString(), accessHash: val.accessHash.toString(), cachedAt: val.cachedAt }
    }
    await prisma.sozlama.upsert({
      where: { kalit: 'telegram_entity_cache' },
      update: { qiymat: JSON.stringify(data) },
      create: { kalit: 'telegram_entity_cache', qiymat: JSON.stringify(data) },
    })
  } catch {}
}

// ─── Flood timer — DB da saqlash/yuklash ─────────────────────────────────────

async function loadFloodTimer(): Promise<void> {
  try {
    const row = await prisma.sozlama.findUnique({ where: { kalit: 'telegram_flood_until' } })
    if (!row?.qiymat) {
      // DB'da flood timer yo'q - in-memory'ni ham tozalash (manual clear ishlashi uchun)
      _floodUntil = 0
      return
    }
    const until = parseInt(row.qiymat)
    if (until > Date.now()) {
      _floodUntil = until
    } else {
      // DB'da eski flood timer - tugagan, tozalaymiz
      _floodUntil = 0
    }
  } catch {}
}

async function saveFloodTimer(untilMs: number): Promise<void> {
  _floodUntil = untilMs
  try {
    await prisma.sozlama.upsert({
      where: { kalit: 'telegram_flood_until' },
      update: { qiymat: String(untilMs) },
      create: { kalit: 'telegram_flood_until', qiymat: String(untilMs) },
    })
  } catch {}
}

function isFlooded(): boolean {
  return _floodUntil > Date.now()
}

function floodSecsLeft(): number {
  return Math.max(0, Math.round((_floodUntil - Date.now()) / 1000))
}

// Cache-only mode: faqat cache'dagi telefon raqamlarga xabar yuborish (ImportContacts'ni o'tkazib yuborish).
// Bu PEER_FLOOD risk'ini keskin kamaytiradi - cache hit'lar 0 API call qiladi.
// telegram_cache_only_until sozlama'sida millisekund timestamp saqlanadi.
let _cacheOnlyUntil = 0

async function loadCacheOnlyMode(): Promise<void> {
  try {
    const row = await prisma.sozlama.findUnique({ where: { kalit: 'telegram_cache_only_until' } })
    if (!row?.qiymat) { _cacheOnlyUntil = 0; return }
    _cacheOnlyUntil = parseInt(row.qiymat) || 0
    if (_cacheOnlyUntil > Date.now()) {
      const hLeft = Math.round((_cacheOnlyUntil - Date.now()) / 3600000)
      console.log(`[Telegram] Cache-only mode FAOL: ${hLeft} soat qoldi`)
    }
  } catch {}
}

function isCacheOnlyMode(): boolean {
  return _cacheOnlyUntil > Date.now()
}

function isPhoneCached(telefon: string | null | undefined): boolean {
  if (!telefon) return false
  return _entityCache.has(normalizePhone(telefon))
}

async function getClient(): Promise<TelegramClient | null> {
  // Agar client tayyor bo'lsa — qaytarish
  if (_client && _clientReady) {
    try {
      // Session hali amalda ekanligini tekshirish
      if (_client.connected) return _client
      await _client.connect()
      return _client
    } catch {
      _client = null
      _clientReady = false
    }
  }

  // Agar boshqa joy allaqachon ulanmoqda bo'lsa — kutish
  if (_connectPromise) return _connectPromise

  _connectPromise = (async () => {
    try {
      const [apiId, apiHash, session] = await Promise.all([
        getSozlama('telegram_api_id'),
        getSozlama('telegram_api_hash'),
        getSozlama('telegram_session'),
      ])
      if (!apiId || !apiHash || !session) return null

      const client = new TelegramClient(
        new StringSession(session),
        parseInt(apiId),
        apiHash,
        { connectionRetries: 5, retryDelay: 1000, floodSleepThreshold: 0 }
      )

      await client.connect()
      _client = client
      _clientReady = true
      // Entity cache, flood timer va cache-only rejim DB dan yuklash
      await Promise.all([loadEntityCache(), loadFloodTimer(), loadCacheOnlyMode()])
      console.log('[Telegram] Client ulandi (singleton)')
      return client
    } catch (e) {
      console.error('[Telegram] Client ulanish xatosi:', e)
      return null
    } finally {
      _connectPromise = null
    }
  })()

  return _connectPromise
}

// ─── Rate limiter ────────────────────────────────────────────────────────────

async function waitForRateLimit(): Promise<void> {
  const now = Date.now()
  const elapsed = now - _lastSendTime
  if (elapsed < MIN_SEND_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_SEND_INTERVAL - elapsed))
  }
  _lastSendTime = Date.now()
}

// ─── Telefon raqam → Telegram entity resolve ────────────────────────────────
//
// Strategiya (moysklad pattern + kontaktsiz):
//  1. Cache check — abadiy cache, bir marta resolve qilingan mijoz keyin qayta yo'q
//  2. Cache yo'q bo'lsa: ImportContacts (random clientId, 3s delay) → entity oling
//     → keyin kontaktni o'chirish (sizning Telegram ilovangizda mijozlar to'planmasin)
//     → entity FOREVER cache'ga
//  3. Keyingi safar shu mijoz uchun: faqat cache hit, hech qanday API call yo'q
//
// Bu PEER_FLOOD risk'ni keskin kamaytiradi: har xabar uchun avval 1-2 API
// (Resolve + Import + Delete) edi, endi 0 API (cache) yoki 2 API (faqat 1-marta).

async function resolvePhone(client: TelegramClient, telefon: string): Promise<Api.TypeUser | null> {
  const cleanPhone = normalizePhone(telefon)

  // 1) Abadiy cache — bir marta resolve qilingan mijoz keyin qayta API call talab qilmaydi
  const cached = _entityCache.get(cleanPhone)
  if (cached) {
    try {
      const inputUser = new Api.InputUser({ userId: cached.userId as any, accessHash: cached.accessHash as any })
      const result = await client.invoke(new Api.users.GetUsers({ id: [inputUser] }))
      if (result.length > 0) return result[0]
      // GetUsers bo'sh qaytsa, cache buzilgan — qayta resolve
      _entityCache.delete(cleanPhone)
    } catch {
      _entityCache.delete(cleanPhone)
    }
  }

  // 2) ImportContacts — random clientId va 3 sekund delay (Telegram spam pattern'ini buzish)
  await new Promise(resolve => setTimeout(resolve, 3000))

  // Telegram ba'zan bu chaqiruvga darhol emas — "retryContacts" (keyinroq qayta
  // urinib ko'ring) deb javob beradi (masalan yangi ulangan sessiyalarda tez-tez
  // uchraydi). Bir marta bo'sh natija bilan taslim bo'lish o'rniga, qisqa kutib
  // yana bir marta uriniladi — ko'p holatda ikkinchi urinishda topiladi.
  let result: Awaited<ReturnType<typeof client.invoke<Api.contacts.ImportContacts>>> | null = null
  for (let urinish = 1; urinish <= 2; urinish++) {
    const randomClientId = Math.floor(Math.random() * 0x7FFFFFFF)
    try {
      result = await client.invoke(
        new Api.contacts.ImportContacts({
          contacts: [
            new Api.InputPhoneContact({
              clientId: randomClientId as any,
              phone: cleanPhone,
              firstName: 'Mijoz',
              lastName: '',
            }),
          ],
        })
      )
    } catch (e: any) {
      if (e.message?.includes('PHONE_NOT_OCCUPIED') || e.message?.includes('PHONE_NUMBER_INVALID')) {
        return null
      }
      throw e
    }

    if (result.users && result.users.length > 0) break
    if (urinish < 2 && result.retryContacts && result.retryContacts.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 5000))
    }
  }

  if (!result || !result.users || result.users.length === 0) return null

  const user = result.users[0] as any

  if (user.id && user.accessHash) {
    // 3) Kontaktni o'chirish — Telegram kontakt ro'yxatida mijoz qolmasin
    const inputUser = new Api.InputUser({ userId: user.id as any, accessHash: user.accessHash as any })
    await client.invoke(new Api.contacts.DeleteContacts({ id: [inputUser] })).catch(() => {})

    // 4) Entity ABADIY cache'ga — keyingi xabar yuborilganda API call kerak emas
    _entityCache.set(cleanPhone, {
      userId: BigInt(user.id),
      accessHash: BigInt(user.accessHash),
      cachedAt: Date.now(),
    })
    saveEntityCache().catch(() => {})
  }

  return result.users[0]
}

// ─── Xabar yuborish (rate limited, cached, singleton) ────────────────────────

// Qaytarish turlar: ok | queued (flood, keyinroq qayta urinish) | failed (doimiy xato)
async function sendMessageToPhone(
  telefon: string,
  xabar: string
): Promise<{ ok: boolean; queued?: boolean; xato?: string }> {
  // Flood tekshiruvi
  if (isFlooded()) {
    const secs = floodSecsLeft()
    return { ok: false, queued: true, xato: `Telegram cheklovi: ${secs}s qoldi` }
  }

  try {
    const client = await getClient()
    if (!client) return { ok: false, xato: 'Telegram ulanmagan. Sozlamalardan telefon raqamni ulang.' }

    // Rate limit kutish
    await waitForRateLimit()

    const user = await resolvePhone(client, telefon)
    if (!user) {
      return { ok: false, xato: `${normalizePhone(telefon)} raqami Telegramda topilmadi` }
    }

    await client.sendMessage(user, { message: xabar })
    return { ok: true }
  } catch (e: any) {
    const msg = e.message || String(e)

    // FloodWait — Telegram vaqtinchalik cheklovi, qayta urinish kerak
    if (msg.includes('FLOOD_WAIT') || msg.includes('FloodWait')) {
      const seconds = parseInt(msg.match(/(\d+)/)?.[1] || '3600')
      console.error(`[Telegram] FloodWait: ${seconds}s kutish kerak`)
      await saveFloodTimer(Date.now() + seconds * 1000)
      return { ok: false, queued: true, xato: `Telegram cheklovi: ${seconds}s kutish kerak` }
    }

    // PEER_FLOOD — akkaunt spam filtri.
    // Telegram bu holatda 24-72 soat saqlaydi. 3 soatda qayta urinish → yana PEER_FLOOD.
    // 24 soatga to'xtatamiz va batch'ni umuman bekor qilamiz.
    if (msg.includes('PEER_FLOOD')) {
      console.error(`[Telegram] PEER_FLOOD — akkaunt cheklandi, ${PEER_FLOOD_HOURS} soatdan keyin qayta uriniladi`)
      await saveFloodTimer(Date.now() + PEER_FLOOD_HOURS * 60 * 60 * 1000)
      return { ok: false, queued: true, xato: `Telegram spam filtri: ${PEER_FLOOD_HOURS} soatdan keyin avtomatik qayta yuboriladi` }
    }

    if (msg.includes('PHONE_NOT_OCCUPIED')) {
      return { ok: false, xato: "Bu raqam Telegramda ro'yxatdan o'tmagan" }
    }

    // Session buzilgan — client ni qayta yaratish
    if (msg.includes('AUTH_KEY') || msg.includes('SESSION_REVOKED') || msg.includes('USER_DEACTIVATED')) {
      _client = null
      _clientReady = false
      return { ok: false, xato: 'Telegram sessiya tugagan. Qayta ulaning.' }
    }

    console.error('[Telegram] Xabar yuborish xatosi:', msg)
    return { ok: false, xato: msg }
  }
}

// ─── Eski API uchun alias (legacy) ───────────────────────────────────────────
// queueWorkerTick fayl pastida aniqlangan — bu wrapper export bo'yicha
// orqaga moslik uchun mavjud. Yangi kod queueWorkerTick'ni to'g'ridan-to'g'ri chaqirsin.

export async function queuedXabarlarniYuborish(): Promise<void> {
  return queueWorkerTick()
}

// ─── Scheduler uchun — kunlik eslatma (shaxsiy raqamdan) ─────────────────────

export async function nasiyaEslatmalarYuborish() {
  if (!(await isTelegramEnabled())) return
  console.log('[Scheduler] Nasiya eslatmalar tekshirilmoqda...')

  const bugun = new Date()
  bugun.setHours(0, 0, 0, 0)

  const nasiyalar = await prisma.nasiya.findMany({
    where: {
      holati: { in: ['OCHIQ', 'MUDDATI_OTGAN'] },
      ochirilgan: false,
      muddat: { not: null },
      mijoz: { telefon: { not: null }, telegramYoq: false },
    },
    include: {
      mijoz: true,
      sotuv: { select: { chekRaqami: true } },
    },
  })

  const dokonNomi = (await getSozlama('dokon_nomi')) || "Do'kon"
  let yuborilgan = 0
  let xatolik = 0

  for (const nasiya of nasiyalar) {
    if (!nasiya.mijoz.telefon || !nasiya.muddat) continue
    // Mijoz Telegram'da yo'q deb belgilangan bo'lsa — o'tkazib yuboramiz
    // (qayta-qayta urinmaymiz — PEER_FLOOD risk va vaqt sarflash).
    if (nasiya.mijoz.telegramYoq) continue

    const muddat = new Date(nasiya.muddat)
    muddat.setHours(0, 0, 0, 0)
    const kunFarq = Math.round((muddat.getTime() - bugun.getTime()) / (1000 * 60 * 60 * 24))

    let xabarTuri: string | null = null
    let xabarMatni: string | null = null

    if (kunFarq === 3) {
      xabarTuri = '3_kun'
      xabarMatni =
        `⚠️ Nasiya eslatma\n\n` +
        `🏪 ${dokonNomi}\n` +
        `👤 ${nasiya.mijoz.ism}\n` +
        `🧾 ${nasiya.sotuv?.chekRaqami || 'Nasiya'}\n` +
        `💰 Qoldiq qarz: ${formatSum(Number(nasiya.qoldiq))}\n` +
        `📅 Muddat: ${formatSana(muddat)} (3 kun qoldi)` +
        `\n\nIltimos, o'z vaqtida to'lang.`
    } else if (kunFarq === 2) {
      xabarTuri = '2_kun'
      xabarMatni =
        `⚠️ Nasiya eslatma\n\n` +
        `🏪 ${dokonNomi}\n` +
        `👤 ${nasiya.mijoz.ism}\n` +
        `🧾 ${nasiya.sotuv?.chekRaqami || 'Nasiya'}\n` +
        `💰 Qoldiq qarz: ${formatSum(Number(nasiya.qoldiq))}\n` +
        `📅 Muddat: ${formatSana(muddat)} (2 kun qoldi)` +
        `\n\nIltimos, o'z vaqtida to'lang.`
    } else if (kunFarq === 1) {
      xabarTuri = '1_kun'
      xabarMatni =
        `Assalomu alaykum, ${nasiya.mijoz.ism}!\n\n` +
        `Sizda ${dokonNomi} do'konidan ${formatSum(Number(nasiya.qoldiq))} miqdorida qarz summasi bor ekan. ` +
        `Ertaga (${formatSana(muddat)}) to'lov sanangiz.\n\n` +
        `Iltimos, to'lovni o'z vaqtida amalga oshiring. Oldindan rahmat!`
    } else if (kunFarq <= 0 && nasiya.holati !== 'YOPILGAN') {
      xabarTuri = 'muddati_otgan'
      const otganKun = Math.abs(kunFarq)
      xabarMatni =
        `🚨 Nasiya muddati o'tdi!\n\n` +
        `🏪 ${dokonNomi}\n` +
        `👤 ${nasiya.mijoz.ism}\n` +
        `🧾 ${nasiya.sotuv?.chekRaqami || 'Nasiya'}\n` +
        `💰 Qoldiq qarz: ${formatSum(Number(nasiya.qoldiq))}\n` +
        `📅 Muddat: ${formatSana(muddat)} (${otganKun} kun o'tdi)` +
        `\n\nIltimos, tezroq to'lang.`
    }

    if (!xabarTuri || !xabarMatni) continue

    // Cross-day dedup: bu nasiya uchun shu turdagi xabar bormi?
    // (1) Bugun yaratilgan — yangi log kerak emas
    // (2) Hali yuborilmagan (pending/queued/sending) — backlog'ga yana qo'shmaymiz,
    //     aks holda xabarlar to'planib mijozni chalkashtiradi.
    // (3) Oxirgi 7 kun ichida muvaffaqiyatli yuborilgan — qaytarishga hojat yo'q
    const ettiKunOldin = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const allaqachon = await prisma.bildirishnomLog.findFirst({
      where: {
        nasiyaId: nasiya.id,
        xabarTuri,
        OR: [
          { sana: { gte: bugun } },                                       // bugun yaratilgan
          { status: { in: ['pending', 'queued', 'sending'] } },           // hali yuborilmagan
          { status: 'sent', yuborilganSana: { gte: ettiKunOldin } },      // yaqinda yuborilgan
        ],
      },
    })
    if (allaqachon) continue

    // Xabar yuborish — darhol (queue'siz), Vercel'da doimiy fon jarayoni yo'q
    // (avval navbatga qo'yib, hech kim o'qimaydigan fon workerini kutar edi).
    const natija = await xabarDarholYuborVaSaqla({
      nasiyaId: nasiya.id,
      mijozId: nasiya.mijozId,
      xabarTuri,
      xabar: xabarMatni,
      telefon: nasiya.mijoz.telefon,
    })

    if (natija.ok) {
      yuborilgan++
      console.log(`[Scheduler] Yuborildi: ${nasiya.mijoz.ism} (${xabarTuri})`)
    } else {
      xatolik++
      console.error(`[Scheduler] Yuborish xatosi: ${nasiya.mijoz.ism} — ${natija.xato}`)
    }

    // Muddati o'tganlarni yangilash
    if (kunFarq < 0 && nasiya.holati === 'OCHIQ') {
      await prisma.nasiya.update({
        where: { id: nasiya.id },
        data: { holati: 'MUDDATI_OTGAN' },
      })
    }
  }

  console.log(`[Scheduler] Yakunlandi: ${yuborilgan} yuborildi, ${xatolik} xato`)
}

// ─── Ulanish (kod yuborish) ──────────────────────────────────────────────────

export async function telegramConnect(apiId: number, apiHash: string, phone: string): Promise<{
  ok: boolean
  phoneCodeHash?: string
  xato?: string
}> {
  let client: TelegramClient | null = null
  try {
    client = new TelegramClient(
      new StringSession(''),
      apiId,
      apiHash,
      { connectionRetries: 3, floodSleepThreshold: 0 }
    )
    await client.connect()

    // GramJS ning yuqori darajadagi metodi — apiId/apiHash ni to'g'ri uzatadi
    const { phoneCodeHash } = await client.sendCode(
      { apiId, apiHash },
      phone
    )

    const tempSession = client.session.save() as unknown as string
    await prisma.sozlama.upsert({
      where: { kalit: 'telegram_temp_session' },
      update: { qiymat: tempSession },
      create: { kalit: 'telegram_temp_session', qiymat: tempSession },
    })

    return { ok: true, phoneCodeHash }
  } catch (e: any) {
    const msg = e.message || String(e)
    if (msg.includes('API_ID_INVALID')) {
      return { ok: false, xato: "API ID yoki API Hash noto'g'ri. my.telegram.org dan qayta tekshiring." }
    }
    if (msg.includes('PHONE_NUMBER_INVALID')) {
      return { ok: false, xato: "Telefon raqam noto'g'ri formatda" }
    }
    return { ok: false, xato: msg }
  } finally {
    if (client) await client.disconnect().catch(() => {})
  }
}

// ─── Kodni tasdiqlash ────────────────────────────────────────────────────────

export async function telegramVerify(
  apiId: number,
  apiHash: string,
  phone: string,
  code: string,
  phoneCodeHash: string,
  password?: string
): Promise<{ ok: boolean; xato?: string }> {
  let client: TelegramClient | null = null
  try {
    const tempSession = await getSozlama('telegram_temp_session')
    client = new TelegramClient(
      new StringSession(tempSession || ''),
      apiId,
      apiHash,
      { connectionRetries: 3, floodSleepThreshold: 0 }
    )
    await client.connect()

    try {
      await client.invoke(
        new Api.auth.SignIn({
          phoneNumber: phone,
          phoneCodeHash,
          phoneCode: code,
        })
      )
    } catch (e: any) {
      if (e.message?.includes('SESSION_PASSWORD_NEEDED')) {
        if (!password) {
          return { ok: false, xato: '2FA parol kiritish kerak' }
        }
        const srpPassword = await client.invoke(new Api.account.GetPassword())
        const srpResult = await computeCheck(srpPassword, password)
        await client.invoke(new Api.auth.CheckPassword({ password: srpResult }))
      } else {
        throw e
      }
    }

    const sessionStr = client.session.save() as unknown as string
    const me = await client.getMe()

    await Promise.all([
      prisma.sozlama.upsert({
        where: { kalit: 'telegram_session' },
        update: { qiymat: sessionStr },
        create: { kalit: 'telegram_session', qiymat: sessionStr },
      }),
      prisma.sozlama.upsert({
        where: { kalit: 'telegram_api_id' },
        update: { qiymat: String(apiId) },
        create: { kalit: 'telegram_api_id', qiymat: String(apiId) },
      }),
      prisma.sozlama.upsert({
        where: { kalit: 'telegram_api_hash' },
        update: { qiymat: apiHash },
        create: { kalit: 'telegram_api_hash', qiymat: apiHash },
      }),
      prisma.sozlama.upsert({
        where: { kalit: 'telegram_phone' },
        update: { qiymat: phone },
        create: { kalit: 'telegram_phone', qiymat: phone },
      }),
      prisma.sozlama.upsert({
        where: { kalit: 'telegram_user_name' },
        update: { qiymat: `${(me as any).firstName || ''} ${(me as any).lastName || ''}`.trim() },
        create: { kalit: 'telegram_user_name', qiymat: `${(me as any).firstName || ''} ${(me as any).lastName || ''}`.trim() },
      }),
      prisma.sozlama.deleteMany({ where: { kalit: 'telegram_temp_session' } }),
    ])

    // Singleton client ni yangilash
    _client = null
    _clientReady = false

    return { ok: true }
  } catch (e: any) {
    return { ok: false, xato: e.message || String(e) }
  } finally {
    if (client) await client.disconnect().catch(() => {})
  }
}

// ─── Telegram holati ─────────────────────────────────────────────────────────

export async function telegramStatus(): Promise<{
  ulangan: boolean
  telefon: string | null
  foydalanuvchi: string | null
}> {
  const [telefon, foydalanuvchi, session] = await Promise.all([
    getSozlama('telegram_phone'),
    getSozlama('telegram_user_name'),
    getSozlama('telegram_session'),
  ])
  return { ulangan: !!session, telefon, foydalanuvchi }
}

// ─── Uzish ───────────────────────────────────────────────────────────────────

export async function telegramDisconnect(): Promise<{ ok: boolean }> {
  // Singleton client ni tozalash
  if (_client) {
    await _client.disconnect().catch(() => {})
    _client = null
    _clientReady = false
  }
  _entityCache.clear()
  _entityCacheLoaded = false
  _floodUntil = 0
  _cacheOnlyUntil = 0
  _lastSendTime = 0

  // Entity cache, flood-timer va cache-only rejim shu (eskirayotgan) hisobga
  // tegishli — access hash'lar akkauntga bog'liq, boshqa hisob ulanganda
  // ular yaroqsiz. DB'da qolib ketsa, keyingi cold start'da (Vercel) qayta
  // yuklanib, yangi hisobni buzilgan ma'lumot bilan zaharlashi mumkin edi.
  await prisma.sozlama.deleteMany({
    where: {
      kalit: {
        in: [
          'telegram_session', 'telegram_api_id', 'telegram_api_hash',
          'telegram_phone', 'telegram_user_name', 'telegram_temp_session',
          'telegram_entity_cache', 'telegram_flood_until', 'telegram_cache_only_until',
        ],
      },
    },
  })
  return { ok: true }
}

// ─── Sotuv tarkibidan mahsulotlar ro'yxatini formatlash ─────────────────────

async function getMahsulotlarMatni(sotuvId: string | null, maxQator: number = 10): Promise<string> {
  if (!sotuvId) return ''
  const tarkiblar = await prisma.sotuvTarkibi.findMany({
    where: { sotuvId },
    include: { tovar: { select: { nomi: true, birlik: true } } },
  })
  if (tarkiblar.length === 0) return ''

  const qatorlar: string[] = []
  const korsatiladigan = tarkiblar.slice(0, maxQator)
  for (const t of korsatiladigan) {
    const miqdor = Number(t.miqdor)
    const narx = Number(t.birlikNarxi)
    const birlik = t.tovar.birlik === 'DONA' ? 'dona' : t.tovar.birlik.toLowerCase()
    if (narx === 0) {
      qatorlar.push(`  • ${t.tovar.nomi} (Bonus) — ${miqdor} ${birlik} × Bepul`)
    } else {
      qatorlar.push(`  • ${t.tovar.nomi} — ${miqdor} ${birlik} × ${formatSum(narx)}`)
    }
  }
  if (tarkiblar.length > maxQator) {
    qatorlar.push(`  ... va yana ${tarkiblar.length - maxQator} ta mahsulot`)
  }
  return '\n📦 Mahsulotlar:\n' + qatorlar.join('\n')
}

// ─── Darhol yuborish (queue'siz) — bitta hodisali xabarlar uchun ────────────
//
// sotuv/qarz/to'lov — har biri bitta aniq voqea, tabiiy ravishda kam-kam
// sodir bo'ladi (kassir ketma-ket 100 ta sotuvni bir soniyada qila olmaydi).
// Shuning uchun bularni navbatga qo'yib, doimiy fon jarayonini kutishning
// hojati yo'q — to'g'ridan-to'g'ri yuboramiz. Bu serverless (Vercel) muhitda
// ham ishlaydi, chunki doimiy jarayon talab qilinmaydi — faqat bitta so'rov
// davomida yuborib, natijasini saqlaymiz.
async function xabarDarholYuborVaSaqla(params: {
  nasiyaId: string | null
  mijozId: string
  xabarTuri: string
  xabar: string
  telefon: string
}): Promise<{ ok: boolean; xato?: string }> {
  const natija = await sendMessageToPhone(params.telefon, params.xabar)

  await prisma.bildirishnomLog.create({
    data: {
      nasiyaId: params.nasiyaId,
      mijozId: params.mijozId,
      xabarTuri: params.xabarTuri,
      xabarMatni: params.xabar,
      telegramTarget: params.telefon,
      status: natija.ok ? 'sent' : (natija.queued ? 'queued' : 'failed'),
      yuborildi: natija.ok,
      xato: natija.xato || null,
      urinishSoni: 1,
      yuborilganSana: natija.ok ? new Date() : null,
      // Flood bo'lsa — keyinroq qayta urinish uchun navbatda qoldiramiz
      // (agar fon jarayoni ishlab tursa, u avtomatik oladi; aks holda
      // qo'lda "qayta yuborish" orqali ham jo'natish mumkin).
      keyingiUrinish: natija.queued ? new Date(Date.now() + 5 * 60 * 1000) : null,
    },
  }).catch((e) => console.error('[Telegram] Log saqlash xatosi:', e))

  return natija
}

// ─── Queue worker: bitta tick, max QUEUE_BATCH_SIZE xabar yuboradi ──────────
//
// Pattern: pending/queued/retry holatdagi xabarlarni keyingiUrinish vaqti
// kelganda bittadan yuboradi. Rate limit (3s) + flood timer + max attempts.

export async function queueWorkerTick(): Promise<void> {
  if (_queueTickRunning) return // re-entrant himoyasi
  _queueTickRunning = true

  try {
    if (!(await isTelegramEnabled())) return

    // Cache, flood timer va cache-only rejim'ni avval yuklash
    // (getClient lazy chaqiriladi - har tick boshida sozlamalarni yangilaymiz).
    await Promise.all([loadEntityCache(), loadFloodTimer(), loadCacheOnlyMode()])

    // Eskirgan xabarlarni avtomat 'expired' qilish (max 3 kun navbatda kutadi).
    // Reminder turlari uchun: ertalabki cron ishlamasa, ertaga yangi bo'lganda yuboriladi.
    // Sotuv turlari uchun: 3 kun kechikkan tasdiq mijozni chalkashtiradi.
    const expireBeforeReminder = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 kun (eslatma uchun)
    const expireBeforeSale = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)     // 3 kun (sotuv uchun)

    const expiredReminders = await prisma.bildirishnomLog.updateMany({
      where: {
        status: { in: ['pending', 'queued'] },
        xabarTuri: { in: ['muddati_otgan', '1_kun', '2_kun', '3_kun'] },
        sana: { lt: expireBeforeReminder },
      },
      data: {
        status: 'expired',
        xato: 'Eskirgan (1 kundan ortiq) - mijozni chalkashtirmaslik uchun yuborilmadi',
        keyingiUrinish: null,
      },
    }).catch(() => ({ count: 0 }))

    const expiredSales = await prisma.bildirishnomLog.updateMany({
      where: {
        status: { in: ['pending', 'queued'] },
        xabarTuri: { in: ['nasiya_yaratildi', 'qarz_qoshildi', 'tolov_qilindi', 'sotuv_cheki'] },
        sana: { lt: expireBeforeSale },
      },
      data: {
        status: 'expired',
        xato: 'Eskirgan (3 kundan ortiq) - mijozni chalkashtirmaslik uchun yuborilmadi',
        keyingiUrinish: null,
      },
    }).catch(() => ({ count: 0 }))

    if (expiredReminders.count + expiredSales.count > 0) {
      console.log(`[Queue] Eskirgan xabarlar: ${expiredReminders.count} eslatma + ${expiredSales.count} sotuv -> expired`)
    }

    if (isFlooded()) {
      // Flood davom etyapti — hech narsa qilmaymiz
      return
    }

    const now = new Date()
    const candidates = await prisma.bildirishnomLog.findMany({
      where: {
        status: { in: ['pending', 'queued'] },
        OR: [
          { keyingiUrinish: null },
          { keyingiUrinish: { lte: now } },
        ],
      },
      orderBy: { sana: 'asc' },
      take: QUEUE_BATCH_SIZE,
      include: { mijoz: { select: { telefon: true, telegramYoq: true } } },
    })

    if (candidates.length === 0) return

    const cacheOnly = isCacheOnlyMode()
    if (cacheOnly) {
      const hLeft = Math.round((_cacheOnlyUntil - Date.now()) / 3600000)
      console.log(`[Queue] Cache-only rejim: faqat cache'dagi mijozlarga yuboriladi (${hLeft} soat qoldi)`)
    }

    for (const log of candidates) {
      if (isFlooded()) {
        // Flood orada keldi — qolgan xabarlarni qoldiramiz
        console.log(`[Queue] Flood orada keldi, ${floodSecsLeft()}s qoldi`)
        break
      }

      const telefon = log.telegramTarget || log.mijoz?.telefon
      if (!telefon || !log.xabarMatni) {
        await prisma.bildirishnomLog.update({
          where: { id: log.id },
          data: { status: 'failed', xato: 'Telefon yoki matn yo\'q' },
        }).catch(() => {})
        continue
      }

      // Mijoz Telegram'da yo'q deb belgilangan bo'lsa — qayta urinmaymiz
      if (log.mijoz?.telegramYoq) {
        await prisma.bildirishnomLog.update({
          where: { id: log.id },
          data: {
            status: 'failed',
            xato: 'Mijoz Telegramda yo\'q (avval belgilangan)',
            keyingiUrinish: null,
          },
        }).catch(() => {})
        continue
      }

      // Cache-only mode: yangi mijoz uchun ImportContacts qilmaslik (PEER_FLOOD risk)
      if (cacheOnly && !isPhoneCached(telefon)) {
        await prisma.bildirishnomLog.update({
          where: { id: log.id },
          data: {
            status: 'queued',
            keyingiUrinish: new Date(_cacheOnlyUntil),
            xato: 'Cache-only rejim - keyingi cycle\'da yuboriladi',
          },
        }).catch(() => {})
        continue
      }

      // 'sending' markeri — concurrent worker'lardan himoya
      await prisma.bildirishnomLog.update({
        where: { id: log.id },
        data: { status: 'sending', urinishSoni: log.urinishSoni + 1 },
      }).catch(() => {})

      const natija = await sendMessageToPhone(telefon, log.xabarMatni)

      if (natija.ok) {
        await prisma.bildirishnomLog.update({
          where: { id: log.id },
          data: {
            status: 'sent',
            yuborildi: true,
            xato: null,
            yuborilganSana: new Date(),
            keyingiUrinish: null,
          },
        }).catch(() => {})
        console.log(`[Queue] Yuborildi: ${telefon} (urinish #${log.urinishSoni + 1})`)
        continue
      }

      // Xato — turini aniqlash
      const xato = natija.xato || ''
      const isPermanentFail =
        /topilmadi|not found|ro'yxatdan o'tmagan|PHONE_NOT_OCCUPIED/i.test(xato)
      const isFloodErr = natija.queued === true

      if (isPermanentFail) {
        // PHONE_NOT_OCCUPIED — qayta urinmaymiz, darhol failed
        await prisma.bildirishnomLog.update({
          where: { id: log.id },
          data: {
            status: 'failed',
            xato: xato.slice(0, 500),
            keyingiUrinish: null,
          },
        }).catch(() => {})

        // Mijozni "Telegram yo'q" deb belgilash — kelajakda qayta urinmaslik
        // (cron, manual yuborish — barchasi shu flag bilan o'tkazib yuborishadi)
        if (log.mijozId) {
          await prisma.mijoz.update({
            where: { id: log.mijozId },
            data: { telegramYoq: true },
          }).catch(() => {})
        }

        console.warn(`[Queue] Failed (permanent): ${telefon} — mijoz Telegramda yo'q deb belgilandi`)
        continue
      }

      if (isFloodErr) {
        // Flood — bu xabarni queued holatda qoldirib, urinishSoni'ni -1 qilamiz
        // (bu urinish hisobga olinmaydi — bir nechta retry'da failure'ga ketmaslik uchun).
        await prisma.bildirishnomLog.update({
          where: { id: log.id },
          data: {
            status: 'queued',
            urinishSoni: log.urinishSoni, // qaytarib qo'yamiz
            xato: xato.slice(0, 500),
            keyingiUrinish: new Date(_floodUntil),
          },
        }).catch(() => {})
        console.warn(`[Queue] Flood: ${telefon} — keyingi urinish ${floodSecsLeft()}s dan keyin`)
        break // qolgan xabarlarni hozir urinmaymiz
      }

      // Transient xato — exponential backoff bilan retry
      const attempt = log.urinishSoni + 1 // increment qilingan urinishSoni
      const maxAttempts = log.maxUrinish || 3

      if (attempt >= maxAttempts) {
        await prisma.bildirishnomLog.update({
          where: { id: log.id },
          data: {
            status: 'failed',
            xato: xato.slice(0, 500),
            keyingiUrinish: null,
          },
        }).catch(() => {})
        console.error(`[Queue] Failed after ${attempt} attempts: ${telefon} — ${xato.slice(0, 80)}`)
        continue
      }

      const backoffIdx = Math.min(attempt - 1, RETRY_BACKOFF_SECS.length - 1)
      const backoffSecs = RETRY_BACKOFF_SECS[backoffIdx]
      const nextRetry = new Date(Date.now() + backoffSecs * 1000)

      await prisma.bildirishnomLog.update({
        where: { id: log.id },
        data: {
          status: 'queued',
          xato: xato.slice(0, 500),
          keyingiUrinish: nextRetry,
        },
      }).catch(() => {})
      console.log(`[Queue] Retry #${attempt}/${maxAttempts} for ${telefon} in ${backoffSecs}s`)
    }
  } catch (e) {
    console.error('[Queue] Tick xatosi:', e)
  } finally {
    _queueTickRunning = false
  }
}

// ─── Bildirishnoma funksiyalari ──────────────────────────────────────────────

export async function nasiyaYaratildiXabarToliq(
  nasiyaId: string,
  mijozId: string,
  data: { chekRaqami: string; summasi: number; qoldiqQarz: number; muddat?: Date | null; mijozIsm?: string; sotuvId?: string | null; chegirma?: number; jamiSumma?: number }
) {
  if (!(await isTelegramEnabled())) return

  const mijoz = await prisma.mijoz.findUnique({ where: { id: mijozId } })
  if (!mijoz?.telefon) return

  const dokonNomi = (await getSozlama('dokon_nomi')) || "Do'kon"
  const mahsulotlarMatni = await getMahsulotlarMatni(data.sotuvId || null)
  const chegirmaFoizi = data.chegirma && data.jamiSumma
    ? Math.round((data.chegirma / data.jamiSumma) * 100) : 0

  const xabar =
    `📋 Yangi nasiya ochildi\n\n` +
    `🏪 ${dokonNomi}\n` +
    `👤 Mijoz: ${data.mijozIsm || mijoz.ism}\n` +
    `🧾 Chek: ${data.chekRaqami}\n` +
    mahsulotlarMatni +
    (chegirmaFoizi > 0 ? `\n🏷️ Chegirma: ${chegirmaFoizi}%\n` : '\n') +
    `💰 Summa: ${formatSum(data.summasi)}\n` +
    `📊 Qoldiq qarz: ${formatSum(data.qoldiqQarz)}\n` +
    (data.muddat ? `📅 Muddat: ${formatSana(data.muddat)}\n` : '') +
    `\nIltimos, o'z vaqtida to'lang.`

  return xabarDarholYuborVaSaqla({
    nasiyaId,
    mijozId,
    xabarTuri: 'nasiya_yaratildi',
    xabar,
    telefon: mijoz.telefon,
  })
}

export async function qarzQoshildiXabar(nasiyaId: string, mijozId: string, summasi: number, yangiQoldiq: number) {
  if (!(await isTelegramEnabled())) return

  const mijoz = await prisma.mijoz.findUnique({ where: { id: mijozId } })
  if (!mijoz?.telefon) return

  const dokonNomi = (await getSozlama('dokon_nomi')) || "Do'kon"

  const xabar =
    `📦 Yangi qarz qo'shildi\n\n` +
    `🏪 ${dokonNomi}\n` +
    `👤 Mijoz: ${mijoz.ism}\n` +
    `💰 Qo'shilgan summa: ${formatSum(summasi)}\n` +
    `📊 Jami qoldiq qarz: ${formatSum(yangiQoldiq)}\n` +
    `\nIltimos, o'z vaqtida to'lang.`

  return xabarDarholYuborVaSaqla({
    nasiyaId,
    mijozId,
    xabarTuri: 'qarz_qoshildi',
    xabar,
    telefon: mijoz.telefon,
  })
}

export async function tolovQilindiXabar(nasiyaId: string, mijozId: string, tolovSummasi: number, qoldiq: number) {
  if (!(await isTelegramEnabled())) return

  const mijoz = await prisma.mijoz.findUnique({ where: { id: mijozId } })
  if (!mijoz?.telefon) return

  const dokonNomi = (await getSozlama('dokon_nomi')) || "Do'kon"
  const yopildi = qoldiq <= 0

  const xabar = yopildi
    ? `✅ Nasiya to'liq to'landi!\n\n🏪 ${dokonNomi}\n👤 Mijoz: ${mijoz.ism}\n💳 To'langan: ${formatSum(tolovSummasi)}\n📊 Qoldiq: 0 UZS\n\nRahmat, nasiyangiz yopildi! ✅`
    : `💳 To'lov qabul qilindi\n\n🏪 ${dokonNomi}\n👤 Mijoz: ${mijoz.ism}\n💳 To'langan: ${formatSum(tolovSummasi)}\n📊 Qoldiq qarz: ${formatSum(qoldiq)}\n\nRahmat!`

  return xabarDarholYuborVaSaqla({
    nasiyaId,
    mijozId,
    xabarTuri: 'tolov_qilindi',
    xabar,
    telefon: mijoz.telefon,
  })
}

const TOLOV_LABEL: Record<string, string> = {
  NAQD: 'Naqd', KARTA: 'Karta', ARALASH: 'Aralash', SHERIK: 'Sherik',
}

export async function sotuvChekiXabar(
  sotuvId: string,
  mijozId: string,
  data: { chekRaqami: string; summasi: number; tolovUsuli: string; mijozIsm?: string; chegirma?: number; jamiSumma?: number }
) {
  if (!(await isTelegramEnabled())) return

  const mijoz = await prisma.mijoz.findUnique({ where: { id: mijozId } })
  if (!mijoz?.telefon) return

  const dokonNomi = (await getSozlama('dokon_nomi')) || "Do'kon"
  const mahsulotlarMatni = await getMahsulotlarMatni(sotuvId)
  const chegirmaFoizi = data.chegirma && data.jamiSumma
    ? Math.round((data.chegirma / data.jamiSumma) * 100) : 0

  const xabar =
    `🧾 Xaridingiz uchun rahmat!\n\n` +
    `🏪 ${dokonNomi}\n` +
    `👤 ${data.mijozIsm || mijoz.ism}\n` +
    `🧾 Chek: ${data.chekRaqami}\n` +
    mahsulotlarMatni +
    (chegirmaFoizi > 0 ? `\n🏷️ Chegirma: ${chegirmaFoizi}%\n` : '\n') +
    `💰 Jami: ${formatSum(data.summasi)}\n` +
    `💳 To'lov: ${TOLOV_LABEL[data.tolovUsuli] || data.tolovUsuli}\n` +
    `\nBizni tanlaganingiz uchun rahmat! 🙏`

  return xabarDarholYuborVaSaqla({
    nasiyaId: null,
    mijozId,
    xabarTuri: 'sotuv_cheki',
    xabar,
    telefon: mijoz.telefon,
  })
}

export async function testXabarYuborish(telefon: string): Promise<{ ok: boolean; xato?: string }> {
  const dokonNomi = (await getSozlama('dokon_nomi')) || "Do'kon"
  const xabar = `✅ Test xabar\n\n🏪 ${dokonNomi}\n\nTelegram bildirishnomalar muvaffaqiyatli ishlayapti!`
  return sendMessageToPhone(telefon, xabar)
}

// ─── Qayta yuborish (resend) ─────────────────────────────────────────────────

export async function xabarQaytaYuborish(logId: string): Promise<{ ok: boolean; xato?: string }> {
  const log = await prisma.bildirishnomLog.findUnique({
    where: { id: logId },
    include: { mijoz: true },
  })
  if (!log) return { ok: false, xato: 'Xabar topilmadi' }
  if (!log.xabarMatni) return { ok: false, xato: 'Xabar matni saqlanmagan' }

  const telefon = log.telegramTarget || log.mijoz.telefon
  if (!telefon) return { ok: false, xato: "Mijozda telefon raqam yo'q" }

  // Queue'ga qaytarish — worker keyingi tick'da yuboradi.
  // Counter va xato'ni reset qilamiz (foydalanuvchi qayta urinishni so'radi).
  await prisma.bildirishnomLog.update({
    where: { id: logId },
    data: {
      status: 'pending',
      xato: null,
      urinishSoni: 0,
      keyingiUrinish: new Date(),
      telegramTarget: telefon,
    },
  }).catch(() => {})

  // Darhol tick chaqiramiz — agar boshqa worker ishlamayotgan bo'lsa
  queueWorkerTick().catch(() => {})

  return { ok: true }
}

// ─── Qo'lda yangi xabar yuborish (manual) ────────────────────────────────────

export async function qolbolaXabarYuborish(mijozId: string, matn: string): Promise<{ ok: boolean; xato?: string }> {
  const mijoz = await prisma.mijoz.findUnique({ where: { id: mijozId } })
  if (!mijoz?.telefon) return { ok: false, xato: "Mijozda telefon raqam yo'q" }

  return xabarDarholYuborVaSaqla({
    nasiyaId: null,
    mijozId,
    xabarTuri: 'qolbola',
    xabar: matn,
    telefon: mijoz.telefon,
  })
}
