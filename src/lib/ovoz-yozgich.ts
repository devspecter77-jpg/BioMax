// Ish vaqtidagi uzluksiz ovoz yozgich (faqat brauzer).
//
// Mikrofon oqimi smena davomida ochiq turadi; MediaRecorder har 3 daqiqada
// qayta ochiladi — har bo'lak mustaqil o'ynaladigan fayl bo'ladi. Bo'lak
// ichida har 10 soniyada qism telefonga (IndexedDB) yoziladi.
//
// Uzilishlar o'zi tiklanadi: qo'ng'iroq kelsa yoki boshqa ilova mikrofonni
// olsa oqim tugaydi — yozgich har 15 soniyada va ilovaga qaytilganda
// mikrofonni qayta ochadi. Ekran o'chib qolmasligi uchun "wake lock" olinadi:
// telefon qulflansa ko'p brauzerlar mikrofonni to'xtatadi.

import { qismQosh, segmentOch, segmentYop } from './ovoz-navbat'
import type { YozuvHolati } from './smena'

export interface YozgichSozlama {
  bolakMs: number
  qismMs: number
  maxBayt: number
  bitreyt: number
  /** Server vaqtiga moslangan soat */
  vaqt: () => number
}

export interface YozgichTinglovchi {
  holat: (h: YozuvHolati, xato?: string) => void
  daraja: (d: number) => void
  bolakTayyor: () => void
}

const MIME_TARTIBI = [
  'audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm',
]

export function yozishQollanadimi(): boolean {
  return typeof window !== 'undefined'
    && window.isSecureContext
    && !!navigator.mediaDevices?.getUserMedia
    && typeof MediaRecorder !== 'undefined'
}

function mimeTanla(): string {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return ''
  return MIME_TARTIBI.find(t => MediaRecorder.isTypeSupported(t)) ?? ''
}

/** Mikrofon — foydalanuvchi tugmani bosgan lahzada chaqirilsin (iOS talabi). */
export function mikrofonniOch(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
  })
}

export function mikrofonXatosi(e: unknown): { holat: YozuvHolati; xato: string } {
  const nom = (e as DOMException | undefined)?.name
  if (nom === 'NotAllowedError' || nom === 'SecurityError' || nom === 'PermissionDeniedError') {
    return { holat: 'ruxsat_yoq', xato: 'Mikrofonga ruxsat berilmagan' }
  }
  if (nom === 'NotFoundError' || nom === 'DevicesNotFoundError' || nom === 'OverconstrainedError') {
    return { holat: 'uzilgan', xato: 'Mikrofon topilmadi' }
  }
  if (nom === 'NotReadableError' || nom === 'TrackStartError' || nom === 'AbortError') {
    return { holat: 'uzilgan', xato: 'Mikrofon band — qo‘ng‘iroq yoki boshqa ilova ishlatyapti' }
  }
  return { holat: 'uzilgan', xato: (e as Error | undefined)?.message || 'Mikrofon ochilmadi' }
}

export class OvozYozgich {
  private oqim: MediaStream | null = null
  private yozgich: MediaRecorder | null = null
  private faol = false
  private ulanmoqda = false
  private aylanish: ReturnType<typeof setTimeout> | null = null
  private qaytaTaymer: ReturnType<typeof setInterval> | null = null
  private darajaTaymer: ReturnType<typeof setInterval> | null = null
  private audioCtx: AudioContext | null = null
  private darajaYigindi = 0
  private darajaSoni = 0
  /** IndexedDB'ga yozishlar ketma-ketligi — qismlar tartibi buzilmasin */
  private zanjir: Promise<void> = Promise.resolve()
  private ekranQulfi: WakeLockSentinel | null = null

  constructor(
    private readonly smenaId: string,
    private readonly s: YozgichSozlama,
    private readonly t: YozgichTinglovchi,
  ) {}

  get ekranYoniq(): boolean { return !!this.ekranQulfi }
  get yozyaptimi(): boolean { return !!this.yozgich && this.yozgich.state === 'recording' }

  /** Yozishni boshlaydi. `oqim` — tugma bosilganda olingan mikrofon (bo'lmasa o'zi so'raydi). */
  async boshla(oqim?: MediaStream): Promise<void> {
    if (this.faol) return
    this.faol = true
    document.addEventListener('visibilitychange', this.korinishOzgardi)
    if (oqim) this.oqimniUla(oqim)
    else await this.ulan()
  }

  /** Foydalanuvchi "Qayta ulash"ni bosganda. */
  async qaytaUlan(): Promise<boolean> {
    if (!this.faol) return false
    if (this.oqim) return true
    return this.ulan()
  }

  /** To'xtatadi; joriy bo'lak yopilib navbatga tushguncha kutadi. */
  async toxtat(): Promise<void> {
    if (!this.faol) return
    this.faol = false
    document.removeEventListener('visibilitychange', this.korinishOzgardi)
    if (this.aylanish) { clearTimeout(this.aylanish); this.aylanish = null }
    this.qaytaUrinishniToxtat()
    const y = this.yozgich
    if (y && y.state !== 'inactive') {
      await new Promise<void>(res => {
        y.addEventListener('stop', () => res(), { once: true })
        try { y.stop() } catch { res() }
      })
    }
    this.oqimniYop()
    await this.zanjir
    await this.ekranniQoyibYubor()
  }

  private async ulan(): Promise<boolean> {
    if (this.ulanmoqda || !this.faol) return false
    if (!yozishQollanadimi()) {
      this.t.holat('qollanmaydi', 'Bu brauzer ovoz yozishni qo‘llamaydi')
      return false
    }
    this.ulanmoqda = true
    try {
      const oqim = await mikrofonniOch()
      if (!this.faol) {
        oqim.getTracks().forEach(tr => tr.stop())
        return false
      }
      this.oqimniUla(oqim)
      return true
    } catch (e) {
      const x = mikrofonXatosi(e)
      this.t.holat(x.holat, x.xato)
      this.qaytaUrinishniRejala()
      return false
    } finally {
      this.ulanmoqda = false
    }
  }

  private oqimniUla(oqim: MediaStream): void {
    this.oqim = oqim
    for (const tr of oqim.getAudioTracks()) tr.addEventListener('ended', this.oqimUzildi)
    this.darajaniUla(oqim)
    void this.ekranniYoq()
    this.qaytaUrinishniToxtat()
    this.yangiBolak()
  }

  private yangiBolak(): void {
    const oqim = this.oqim
    if (!oqim || !this.faol) return
    const segId = crypto.randomUUID()
    const boshlandi = this.s.vaqt()
    const mime = mimeTanla()
    let yozgich: MediaRecorder
    try {
      yozgich = new MediaRecorder(oqim, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: this.s.bitreyt })
    } catch {
      try {
        yozgich = new MediaRecorder(oqim)
      } catch (e) {
        this.t.holat('qollanmaydi', (e as Error)?.message || 'Ovoz yozib bo‘lmadi')
        return
      }
    }
    const turi = yozgich.mimeType || mime || 'audio/webm'
    let qismN = 0
    let bayt = 0
    this.zanjir = this.zanjir
      .then(() => segmentOch({ segId, smenaId: this.smenaId, boshlandi, mimeType: turi }))
      .catch(e => console.warn('[ovoz] bo‘lak ochilmadi', e))

    yozgich.ondataavailable = (e: BlobEvent) => {
      if (!e.data || e.data.size === 0) return
      const n = qismN++
      bayt += e.data.size
      const daraja = this.darajaSoni ? this.darajaYigindi / this.darajaSoni : null
      this.darajaYigindi = 0
      this.darajaSoni = 0
      const tugadi = this.s.vaqt()
      const blob = e.data
      this.zanjir = this.zanjir
        .then(async () => qismQosh(segId, n, await blob.arrayBuffer(), tugadi, daraja))
        .catch(err => console.warn('[ovoz] qism saqlanmadi', err))
      // Brauzer past bitreytni qo'llamasa fayl katta bo'ladi — muddatidan oldin yopamiz
      if (bayt >= this.s.maxBayt && yozgich.state === 'recording') this.aylantir()
    }
    yozgich.onstop = () => {
      const tugadi = this.s.vaqt()
      this.zanjir = this.zanjir
        .then(() => segmentYop(segId, tugadi))
        .then(() => this.t.bolakTayyor())
        .catch(err => console.warn('[ovoz] bo‘lak yopilmadi', err))
      if (this.yozgich === yozgich) this.yozgich = null
      if (this.faol && this.oqimTirikmi()) this.yangiBolak()
    }
    yozgich.onerror = () => {
      if (yozgich.state !== 'inactive') {
        try { yozgich.stop() } catch { /* allaqachon to'xtagan */ }
      }
    }

    this.yozgich = yozgich
    try {
      yozgich.start(this.s.qismMs)
    } catch (e) {
      this.yozgich = null
      this.t.holat('uzilgan', (e as Error)?.message || 'Yozuv boshlanmadi')
      return
    }
    this.t.holat('yozilmoqda')
    if (this.aylanish) clearTimeout(this.aylanish)
    this.aylanish = setTimeout(() => this.aylantir(), this.s.bolakMs)
  }

  /** Joriy bo'lakni yopadi — `onstop` yangisini ochadi. */
  private aylantir(): void {
    if (this.aylanish) { clearTimeout(this.aylanish); this.aylanish = null }
    const y = this.yozgich
    if (y && y.state !== 'inactive') {
      try { y.stop() } catch { /* allaqachon to'xtagan */ }
    }
  }

  private oqimTirikmi(): boolean {
    return !!this.oqim && this.oqim.getAudioTracks().some(tr => tr.readyState === 'live')
  }

  /** Mikrofon oqimi uzildi: qo'ng'iroq, boshqa ilova, tizim to'xtatdi. */
  private oqimUzildi = (): void => {
    if (!this.faol || !this.oqim || this.oqimTirikmi()) return
    this.oqimniYop()
    this.aylantir() // joriy bo'lak saqlanadi; oqim yo'q — yangisi ochilmaydi
    this.t.holat('uzilgan', 'Mikrofon to‘xtadi — qayta ulanmoqda')
    this.qaytaUrinishniRejala()
  }

  private qaytaUrinishniRejala(): void {
    if (this.qaytaTaymer || !this.faol) return
    this.qaytaTaymer = setInterval(() => {
      if (!this.faol) { this.qaytaUrinishniToxtat(); return }
      if (!this.oqim && document.visibilityState === 'visible') void this.ulan()
    }, 15_000)
  }

  private qaytaUrinishniToxtat(): void {
    if (this.qaytaTaymer) { clearInterval(this.qaytaTaymer); this.qaytaTaymer = null }
  }

  private korinishOzgardi = (): void => {
    if (document.visibilityState !== 'visible' || !this.faol) return
    if (!this.oqim) void this.ulan()
    else void this.ekranniYoq()
  }

  private darajaniUla(oqim: MediaStream): void {
    this.darajaniYop()
    try {
      const Ctx = window.AudioContext
        ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctx) return
      const ctx = new Ctx()
      const analizator = ctx.createAnalyser()
      analizator.fftSize = 1024
      ctx.createMediaStreamSource(oqim).connect(analizator)
      const buf = new Float32Array(analizator.fftSize)
      this.audioCtx = ctx
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
      this.darajaTaymer = setInterval(() => {
        analizator.getFloatTimeDomainData(buf)
        let yig = 0
        for (let i = 0; i < buf.length; i++) yig += buf[i] * buf[i]
        const d = Math.min(1, Math.sqrt(yig / buf.length) * 4)
        this.darajaYigindi += d
        this.darajaSoni += 1
        this.t.daraja(d)
      }, 250)
    } catch {
      // Ko'rsatkich shart emas — yozuv baribir davom etadi
    }
  }

  private darajaniYop(): void {
    if (this.darajaTaymer) { clearInterval(this.darajaTaymer); this.darajaTaymer = null }
    if (this.audioCtx) { void this.audioCtx.close().catch(() => {}); this.audioCtx = null }
    this.t.daraja(0)
  }

  private oqimniYop(): void {
    this.darajaniYop()
    if (!this.oqim) return
    for (const tr of this.oqim.getTracks()) {
      tr.removeEventListener('ended', this.oqimUzildi)
      tr.stop()
    }
    this.oqim = null
  }

  /** Ekran o'chmasin — telefon qulflansa brauzer mikrofonni to'xtatishi mumkin. */
  private async ekranniYoq(): Promise<void> {
    if (this.ekranQulfi || document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return
    try {
      const q = await navigator.wakeLock.request('screen')
      this.ekranQulfi = q
      q.addEventListener('release', () => { if (this.ekranQulfi === q) this.ekranQulfi = null })
    } catch {
      // Quvvatni tejash rejimi yoki brauzer ruxsat bermadi — yozuv baribir ketadi
    }
  }

  private async ekranniQoyibYubor(): Promise<void> {
    const q = this.ekranQulfi
    this.ekranQulfi = null
    if (q) await q.release().catch(() => {})
  }
}
