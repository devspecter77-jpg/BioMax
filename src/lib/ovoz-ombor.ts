// Ovoz yozuvlari ombori (faqat server).
//
// Bir kuryerning 8 soatlik yozuvi ~50–60 MB — bu bazaga emas, obyekt
// omboriga sig'adi. S3 bilan mos har qanday xizmat ishlaydi: Cloudflare R2
// (tavsiya: 10 GB bepul, yuklab olish bepul), AWS S3, Backblaze B2, MinIO.
//
// Sozlash (Vercel → Settings → Environment Variables):
//   S3_ENDPOINT           https://<account-id>.r2.cloudflarestorage.com
//   S3_BUCKET             biomax-ovozlar
//   S3_ACCESS_KEY_ID      ...
//   S3_SECRET_ACCESS_KEY  ...
//   S3_REGION             auto   (R2 uchun; AWS'da masalan eu-central-1)
//
// Ular bo'lmasa: lokal rivojlanishda `.ovoz-yozuvlar/` papkasi ishlatiladi,
// productionda esa ombor "sozlanmagan" deb hisoblanadi (yozuv qabul
// qilinmaydi, kuryer ilovasi bo'laklarni telefonda saqlab, keyin yuboradi).
//
// Ombordagi fayl hech qachon ochiq havola bilan berilmaydi: tinglash
// so'rovi ruxsatdan o'tgach, 10 daqiqalik imzolangan havola yaratiladi.

import { promises as fs, createReadStream } from 'node:fs'
import path from 'node:path'
import { AwsClient } from 'aws4fetch'

export type OmborTuri = 's3' | 'lokal'

interface S3Sozlama {
  endpoint: string
  bucket: string
  keyId: string
  secret: string
  region: string
}

function s3Sozlama(): S3Sozlama | null {
  const endpoint = process.env.S3_ENDPOINT?.trim()
  const bucket = process.env.S3_BUCKET?.trim()
  const keyId = process.env.S3_ACCESS_KEY_ID?.trim()
  const secret = process.env.S3_SECRET_ACCESS_KEY?.trim()
  if (!endpoint || !bucket || !keyId || !secret) return null
  return {
    endpoint: endpoint.replace(/\/+$/, ''),
    bucket,
    keyId,
    secret,
    region: process.env.S3_REGION?.trim() || 'auto',
  }
}

/** Qaysi ombor ishlaydi; `null` — productionda sozlanmagan. */
export function omborTuri(): OmborTuri | null {
  if (s3Sozlama()) return 's3'
  if (process.env.NODE_ENV !== 'production') return 'lokal'
  return null
}

export class OmborXatosi extends Error {}

/** S3 xato kodlari — administrator nimani tuzatishi kerakligini bilsin. */
const S3_XATOLARI: Record<string, string> = {
  SignatureDoesNotMatch: 'maxfiy kalit (S3_SECRET_ACCESS_KEY) noto‘g‘ri',
  InvalidAccessKeyId: 'kalit ID (S3_ACCESS_KEY_ID) noto‘g‘ri yoki o‘chirilgan',
  NoSuchBucket: 'chelak (S3_BUCKET) topilmadi — nomini tekshiring',
  AccessDenied: 'kalitning bu chelakka yozish/o‘qish huquqi yo‘q',
  AuthorizationHeaderMalformed: 'mintaqa (S3_REGION) noto‘g‘ri — R2 uchun "auto"',
  RequestTimeTooSkewed: 'server soati noto‘g‘ri',
}

/** S3 javobidagi XML xatoni o'qiladigan matnga aylantiradi. */
async function s3Xatosi(amal: string, r: Response): Promise<OmborXatosi> {
  const xml = await r.text().catch(() => '')
  const kod = /<Code>([^<]+)<\/Code>/.exec(xml)?.[1]
  const sabab = (kod && S3_XATOLARI[kod]) ?? (kod ? `${kod} (HTTP ${r.status})` : `HTTP ${r.status}`)
  return new OmborXatosi(`${amal}: ${sabab}`)
}

/** Ombor manziliga umuman ulanib bo'lmadi (noto'g'ri manzil, DNS, tarmoq). */
async function s3Fetch(mijoz: AwsClient, url: string, init: RequestInit): Promise<Response> {
  try {
    return await mijoz.fetch(url, init)
  } catch {
    throw new OmborXatosi('Omborga ulanib bo‘lmadi — S3_ENDPOINT manzilini tekshiring')
  }
}

let mijozKesh: { kalit: string; mijoz: AwsClient } | null = null
function s3Mijoz(s: S3Sozlama): AwsClient {
  // Kalitlardan biri almashsa eski mijoz qolib ketmasin
  const kalit = `${s.keyId}|${s.secret}|${s.region}`
  if (mijozKesh?.kalit !== kalit) {
    mijozKesh = {
      kalit,
      // Standart 10 ta qayta urinish 5xx'da funksiyani ~50 s ushlab turardi;
      // telefon bo'lakni o'zi navbatda saqlab, keyin qayta yuboradi
      mijoz: new AwsClient({ accessKeyId: s.keyId, secretAccessKey: s.secret, service: 's3', region: s.region, retries: 3 }),
    }
  }
  return mijozKesh.mijoz
}

/** Obyekt manzili — path-style (R2, MinIO, B2, S3 hammasi qo'llaydi). */
function s3Url(s: S3Sozlama, kalit: string): string {
  return `${s.endpoint}/${encodeURIComponent(s.bucket)}/${kalit.split('/').map(encodeURIComponent).join('/')}`
}

const LOKAL_PAPKA = path.join(process.cwd(), '.ovoz-yozuvlar')

/** Lokal fayl yo'li — kalit papkadan tashqariga chiqa olmaydi. */
export function lokalYol(kalit: string): string {
  const yol = path.resolve(LOKAL_PAPKA, kalit)
  if (!yol.startsWith(LOKAL_PAPKA + path.sep)) throw new OmborXatosi('Noto‘g‘ri kalit')
  return yol
}

export async function saqla(kalit: string, data: Uint8Array<ArrayBuffer>, mimeType: string): Promise<void> {
  const s = s3Sozlama()
  if (s) {
    const r = await s3Fetch(s3Mijoz(s), s3Url(s, kalit), {
      method: 'PUT',
      body: data,
      headers: { 'Content-Type': mimeType },
    })
    if (!r.ok) throw await s3Xatosi('Ombor faylni qabul qilmadi', r)
    return
  }
  if (omborTuri() !== 'lokal') throw new OmborXatosi('Ovoz ombori sozlanmagan')
  const yol = lokalYol(kalit)
  await fs.mkdir(path.dirname(yol), { recursive: true })
  await fs.writeFile(yol, data)
}

/**
 * S3 uchun vaqtinchalik imzolangan havola. `yuklabOlish` berilsa brauzer
 * faylni shu nom bilan saqlaydi.
 */
export async function imzolanganHavola(kalit: string, opts: { sekund?: number; yuklabOlish?: string; mimeType?: string } = {}): Promise<string> {
  const s = s3Sozlama()
  if (!s) throw new OmborXatosi('S3 ombori sozlanmagan')
  const u = new URL(s3Url(s, kalit))
  u.searchParams.set('X-Amz-Expires', String(opts.sekund ?? 600))
  if (opts.yuklabOlish) {
    u.searchParams.set('response-content-disposition', `attachment; filename="${opts.yuklabOlish.replace(/[^\w.\-]/g, '_')}"`)
  }
  if (opts.mimeType) u.searchParams.set('response-content-type', opts.mimeType)
  const imzolangan = await s3Mijoz(s).sign(u.toString(), { method: 'GET', aws: { signQuery: true } })
  return imzolangan.url
}

/** Lokal fayl: hajmi va o'qish oqimi (Range qo'llab-quvvatlanadi). */
export async function lokalFayl(kalit: string): Promise<{ hajm: number; oqim: (dan?: number, gacha?: number) => NodeJS.ReadableStream }> {
  const yol = lokalYol(kalit)
  const st = await fs.stat(yol)
  return {
    hajm: st.size,
    oqim: (dan, gacha) => createReadStream(yol, dan === undefined ? undefined : { start: dan, end: gacha }),
  }
}

export async function ochir(kalit: string): Promise<void> {
  const s = s3Sozlama()
  if (s) {
    const r = await s3Fetch(s3Mijoz(s), s3Url(s, kalit), { method: 'DELETE' })
    if (!r.ok && r.status !== 404) throw await s3Xatosi('Ombordan o‘chmadi', r)
    return
  }
  if (omborTuri() !== 'lokal') return
  await fs.unlink(lokalYol(kalit)).catch((e: NodeJS.ErrnoException) => {
    if (e.code !== 'ENOENT') throw e
  })
}

/**
 * Ombor ulanishini haqiqiy yozish-o'qish-o'chirish bilan tekshiradi.
 * Sozlashdan keyin administrator "Tekshirish"ni bosib aniq xatoni ko'radi.
 */
export async function tekshir(): Promise<{ ok: true; turi: OmborTuri } | { ok: false; xato: string }> {
  const turi = omborTuri()
  if (!turi) {
    return { ok: false, xato: 'Ombor sozlanmagan: S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY kiritilmagan' }
  }
  const kalit = `ovozlar/_tekshiruv/${Date.now()}.txt`
  const matn = `biomax-ombor-tekshiruv-${Date.now()}`
  try {
    await saqla(kalit, new TextEncoder().encode(matn), 'text/plain')
    let oqildi: string
    if (turi === 's3') {
      const r = await fetch(await imzolanganHavola(kalit, { sekund: 60 }))
      if (!r.ok) return { ok: false, xato: (await s3Xatosi('Yozildi, lekin o‘qib bo‘lmadi', r)).message }
      oqildi = await r.text()
    } else {
      oqildi = await fs.readFile(lokalYol(kalit), 'utf8')
    }
    await ochir(kalit)
    if (oqildi !== matn) return { ok: false, xato: 'O‘qilgan ma’lumot yozilganiga mos emas' }
    return { ok: true, turi }
  } catch (e) {
    return { ok: false, xato: e instanceof Error ? e.message : String(e) }
  }
}
