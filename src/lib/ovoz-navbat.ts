// Kuryer telefonidagi ovoz navbati (IndexedDB, faqat brauzer).
//
// Yozuv avval telefonga yoziladi, keyin serverga yuboriladi:
//   · har 10 soniyalik qism darhol saqlanadi — ilova yopilib qolsa yoki
//     telefon o'chsa ham ko'pi bilan oxirgi bir necha soniya yo'qoladi;
//   · internet yo'q joyda (podezd, yerto'la, shahar chekkasi) yozuv
//     to'xtamaydi — bo'laklar navbatda kutib, aloqa tiklanganda ketadi.
//
// Qismlar ArrayBuffer sifatida saqlanadi (Blob emas): eski Safari
// IndexedDB'da Blob saqlashda xato berardi.

const DB_NOMI = 'biomax-ovoz'
const VERSIYA = 1
const SEG = 'segmentlar'
const BOL = 'bolaklar'

export interface NavbatSegment {
  segId: string
  smenaId: string
  boshlandi: number
  tugadi: number
  mimeType: string
  /** 'yozilmoqda' — hali qism qo'shilyapti; 'tayyor' — yuborishga tayyor */
  holat: 'yozilmoqda' | 'tayyor'
  hajm: number
  bolakSoni: number
  darajaYigindi: number
  darajaSoni: number
  urinish: number
  keyingiUrinish: number
  xato?: string
}

let dbVada: Promise<IDBDatabase> | null = null

function db(): Promise<IDBDatabase> {
  if (!dbVada) {
    dbVada = new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open(DB_NOMI, VERSIYA)
      r.onupgradeneeded = () => {
        const d = r.result
        if (!d.objectStoreNames.contains(SEG)) d.createObjectStore(SEG, { keyPath: 'segId' })
        if (!d.objectStoreNames.contains(BOL)) {
          d.createObjectStore(BOL, { keyPath: ['segId', 'n'] }).createIndex('segId', 'segId')
        }
      }
      r.onsuccess = () => {
        const d = r.result
        d.onversionchange = () => { d.close(); dbVada = null }
        res(d)
      }
      r.onerror = () => { dbVada = null; rej(r.error) }
    })
  }
  return dbVada
}

function sorov<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => {
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}

function tugashi(t: IDBTransaction): Promise<void> {
  return new Promise((res, rej) => {
    t.oncomplete = () => res()
    t.onerror = () => rej(t.error)
    t.onabort = () => rej(t.error)
  })
}

const bolakOraligi = (segId: string) => IDBKeyRange.bound([segId, 0], [segId, Number.MAX_SAFE_INTEGER])

export async function segmentOch(s: Pick<NavbatSegment, 'segId' | 'smenaId' | 'boshlandi' | 'mimeType'>): Promise<void> {
  const t = (await db()).transaction(SEG, 'readwrite')
  t.objectStore(SEG).put({
    ...s, tugadi: s.boshlandi, holat: 'yozilmoqda', hajm: 0, bolakSoni: 0,
    darajaYigindi: 0, darajaSoni: 0, urinish: 0, keyingiUrinish: 0,
  } satisfies NavbatSegment)
  await tugashi(t)
}

/** Bo'lakka yangi qism qo'shadi (MediaRecorder har 10 soniyada beradi). */
export async function qismQosh(segId: string, n: number, data: ArrayBuffer, tugadi: number, daraja: number | null): Promise<void> {
  const t = (await db()).transaction([SEG, BOL], 'readwrite')
  t.objectStore(BOL).put({ segId, n, data })
  const ss = t.objectStore(SEG)
  const r = ss.get(segId)
  r.onsuccess = () => {
    const s = r.result as NavbatSegment | undefined
    if (!s) return
    s.hajm += data.byteLength
    s.bolakSoni = Math.max(s.bolakSoni, n + 1)
    s.tugadi = Math.max(s.tugadi, tugadi)
    if (daraja !== null) { s.darajaYigindi += daraja; s.darajaSoni += 1 }
    ss.put(s)
  }
  await tugashi(t)
}

/** Bo'lak yopildi — yuborishga tayyor. */
export async function segmentYop(segId: string, tugadi: number): Promise<void> {
  const t = (await db()).transaction(SEG, 'readwrite')
  const ss = t.objectStore(SEG)
  const r = ss.get(segId)
  r.onsuccess = () => {
    const s = r.result as NavbatSegment | undefined
    if (!s) return
    s.holat = 'tayyor'
    // Oxirgi qism kelmagan bo'lsa ham yozuv tugagan vaqtni olamiz
    if (tugadi > s.tugadi && s.bolakSoni > 0) s.tugadi = Math.min(tugadi, s.tugadi + 15_000)
    ss.put(s)
  }
  await tugashi(t)
}

/**
 * Ilova to'satdan yopilgan bo'lsa "yozilmoqda" bo'laklar shu holicha
 * qoladi — ochilganda ular yopiladi va yuboriladi (saqlangan qismlar
 * mustaqil o'ynaladi). Qismi yo'q bo'sh bo'laklar tashlab yuboriladi.
 */
export async function yetimlarniYop(): Promise<void> {
  for (const s of await barchaSegmentlar()) {
    if (s.holat !== 'yozilmoqda') continue
    if (s.bolakSoni === 0) await segmentniOchir(s.segId)
    else await segmentYop(s.segId, s.tugadi)
  }
}

export async function barchaSegmentlar(): Promise<NavbatSegment[]> {
  const t = (await db()).transaction(SEG, 'readonly')
  const r = await sorov(t.objectStore(SEG).getAll() as IDBRequest<NavbatSegment[]>)
  return r.sort((a, b) => a.boshlandi - b.boshlandi)
}

export async function segmentFayli(s: NavbatSegment): Promise<Blob> {
  const t = (await db()).transaction(BOL, 'readonly')
  const qismlar = await sorov(t.objectStore(BOL).getAll(bolakOraligi(s.segId)) as IDBRequest<{ n: number; data: ArrayBuffer }[]>)
  qismlar.sort((a, b) => a.n - b.n)
  return new Blob(qismlar.map(q => q.data), { type: s.mimeType })
}

export async function segmentniOchir(segId: string): Promise<void> {
  const t = (await db()).transaction([SEG, BOL], 'readwrite')
  t.objectStore(SEG).delete(segId)
  t.objectStore(BOL).delete(bolakOraligi(segId))
  await tugashi(t)
}

export async function urinishniBelgila(segId: string, keyingiUrinish: number, xato: string): Promise<void> {
  const t = (await db()).transaction(SEG, 'readwrite')
  const ss = t.objectStore(SEG)
  const r = ss.get(segId)
  r.onsuccess = () => {
    const s = r.result as NavbatSegment | undefined
    if (!s) return
    s.urinish += 1
    s.keyingiUrinish = keyingiUrinish
    s.xato = xato
    ss.put(s)
  }
  await tugashi(t)
}

/**
 * Navbat chegaradan oshsa ENG ESKI tayyor bo'laklarni o'chiradi (halqa bufer).
 * Ombor uzoq vaqt sozlanmasa yoki internet kunlab bo'lmasa ham yozuv
 * to'xtamaydi va telefon xotirasi to'lmaydi — eng yangi yozuvlar saqlanadi.
 * Hozir yozilayotgan bo'lakka tegilmaydi. Qaytaradi: o'chirilganlar soni.
 */
export async function navbatniQisqart(maxBayt: number): Promise<number> {
  const hammasi = await barchaSegmentlar() // eskisi birinchi
  let hajm = hammasi.reduce((a, s) => a + s.hajm, 0)
  let ochirildi = 0
  for (const s of hammasi) {
    if (hajm <= maxBayt) break
    if (s.holat !== 'tayyor') continue
    await segmentniOchir(s.segId)
    hajm -= s.hajm
    ochirildi += 1
  }
  return ochirildi
}

/** Yuborilmagan bo'laklar soni va hajmi. */
export async function navbatHolati(): Promise<{ soni: number; hajm: number }> {
  const hammasi = await barchaSegmentlar()
  return { soni: hammasi.length, hajm: hammasi.reduce((a, s) => a + s.hajm, 0) }
}
