// Chek print HTML — sotuv/page.tsx va sotuvlar/SaleDetailPanel.tsx ikkalasi ham ishlatadi.
// Format thermal 80mm printer uchun.

import { formatSum, formatSanaVaVaqt } from './utils'
import { tolovLabel, tolovQisqa, tolovKanallari } from './tolov-usullari'

// Lotin → Kirill transliteratsiya
const lotinKirill: Record<string, string> = {
  'Sh':'Ш','sh':'ш','Ch':'Ч','ch':'ч','Ng':'Нг','ng':'нг',
  "O'":'Ў',"o'":'ў',"G'":'Ғ',"g'":'ғ',
  'Yo':'Ё','yo':'ё','Yu':'Ю','yu':'ю','Ya':'Я','ya':'я',
  'Ye':'Е','ye':'е','Ts':'Ц','ts':'ц',
  'A':'А','a':'а','B':'Б','b':'б','D':'Д','d':'д','E':'Э','e':'э',
  'F':'Ф','f':'ф','G':'Г','g':'г','H':'Ҳ','h':'ҳ','I':'И','i':'и',
  'J':'Ж','j':'ж','K':'К','k':'к','L':'Л','l':'л','M':'М','m':'м',
  'N':'Н','n':'н','O':'О','o':'о','P':'П','p':'п','Q':'Қ','q':'қ',
  'R':'Р','r':'р','S':'С','s':'с','T':'Т','t':'т','U':'У','u':'у',
  'V':'В','v':'в','X':'Х','x':'х','Y':'Й','y':'й','Z':'З','z':'з',
}

export function toKirill(text: string): string {
  let result = text
  const keys = Object.keys(lotinKirill).sort((a, b) => b.length - a.length)
  for (const lat of keys) {
    result = result.split(lat).join(lotinKirill[lat])
  }
  return result
}

export interface ChekTarkib {
  tovar?: { nomi: string } | null
  tovarNomi?: string  // fallback
  miqdor: number | string
  birlikNarxi: number | string
  jami: number | string
}

export interface ChekData {
  chekRaqami: string
  sana: string | Date
  tarkiblar: ChekTarkib[]
  chegirma: number | string
  yakuniySumma: number | string
  tolovUsuli: string
  naqdTolangan?: number | string
  kartaTolangan?: number | string
  clickTolangan?: number | string
  bankTolangan?: number | string
  mijoz?: { ism: string } | null
  kassir?: { telefon?: string | null } | null
}

export interface ChekDokonInfo {
  dokon_nomi?: string
  manzil?: string
  telefon?: string
  chek_matn?: string
}

export interface ChekPrintOptions {
  data: ChekData
  dokonInfo?: ChekDokonInfo
  til?: 'lotin' | 'kirill'
  fontSize?: number
}

// Ikkala chek (oddiy sotuv cheki va mijoz xarid tarixi) uchun bir xil
// uslub — thermal 80mm. Bitta joyda turadi, aks holda vaqt o'tib
// ikkalasi bir-biridan ayrilib ketardi.
function chekStyle(sz: number): string {
  return `<style>
  @page{size:80mm auto;margin:0mm}
  html{margin:0;padding:0;background:#fff}
  html,body{height:auto!important;overflow:visible!important;margin:0;padding:0;background:#fff}
  .chek{font-family:'Courier New',Consolas,monospace;font-size:${sz}px;font-weight:bold;width:80mm;max-width:100%;margin:3mm auto;padding:3mm 3mm;color:#000;background:#fff;box-sizing:border-box;word-break:break-word;border:1.5px solid #000;border-radius:2mm}
  /* Print: kontent qog'ozning to'liq kengligini egallaydi (printer driver qog'oz kengligini belgilaydi) */
  @media print{
    html,body{width:100%!important;min-width:0!important;max-width:none!important;margin:0!important;padding:0!important}
    /* Chap padding 6mm — Xprinter'ning chap "dead zone" uchun (3mm yetmas, harflar kesilib qoladi) */
    .chek{width:100%!important;max-width:none!important;min-width:0!important;margin:0!important;padding:2mm 3mm 2mm 6mm!important;border:none!important;border-radius:0!important;box-sizing:border-box!important}
    /* Browser scaling'ni o'chirish */
    @page{size:80mm auto;margin:0}
  }
  table{width:100%;border-collapse:collapse}td{vertical-align:top;padding:1px 0;font-size:${sz}px;font-weight:bold}
  .center{text-align:center}.bold{font-weight:bold}.sep{border-top:1px dashed #000;margin:3px 0}
  .total td{font-weight:bold;font-size:${sz + 2}px}
</style>`
}

// Chek oynasining boshi (DOCTYPE + head + ochiluvchi .chek div'i)
function chekBoshi(sarlavha: string, sz: number, dokonNomi: string, manzil: string, tel: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${sarlavha}</title>
${chekStyle(sz)}</head><body>
<div class="chek">
<div class="center bold" style="font-size:${sz + 2}px">${dokonNomi}</div>
${manzil ? `<div class="center">${manzil}</div>` : ''}
${tel ? `<div class="center">Tel: ${tel}</div>` : ''}`
}

// Chek HTML qurish (thermal 80mm)
export function buildChekHtml(opts: ChekPrintOptions): string {
  const { data: s, dokonInfo = {}, til = 'lotin', fontSize = 11 } = opts
  const sz = fontSize

  const t = (text: string) => til === 'kirill' ? toKirill(text) : text

  const dokonNomi = t(dokonInfo.dokon_nomi || "Do'kon")
  const manzil = t(dokonInfo.manzil || '')
  const tel = dokonInfo.telefon || ''
  const chekMatn = t(dokonInfo.chek_matn || '')
  const kassirTel = s.kassir?.telefon || ''

  const formatNum = (n: number | string) =>
    new Intl.NumberFormat('uz-UZ').format(Math.round(Number(n)))

  const tovarlarHtml = (s.tarkiblar || []).map((item) => {
    const nomi = t(item.tovar?.nomi || item.tovarNomi || '—')
    const miqdor = Number(item.miqdor)
    const bonusmi = Number(item.birlikNarxi) === 0
    if (bonusmi) {
      return `<tr><td colspan="2" style="font-weight:600;padding-top:3px">${nomi} <span style="font-weight:normal">(${t('Bonus')})</span></td></tr>`
        + `<tr><td colspan="2" style="white-space:nowrap"><span style="color:#222">${miqdor} × ${t('Bepul')}</span></td></tr>`
    }
    const narxQ = formatNum(item.birlikNarxi)
    const jami = formatSum(item.jami)
    return `<tr><td colspan="2" style="font-weight:600;padding-top:3px">${nomi}</td></tr>`
      + `<tr><td colspan="2" style="white-space:nowrap"><span style="color:#222">${miqdor} × ${narxQ}</span> = <span style="font-weight:bold">${jami}</span></td></tr>`
  }).join('')

  const jamiSumma = Number(s.chegirma) + Number(s.yakuniySumma)
  const chegirmaFoizi = Number(s.chegirma) > 0 && jamiSumma > 0
    ? Math.round((Number(s.chegirma) / jamiSumma) * 100) : 0
  const chegirmaHtml = Number(s.chegirma) > 0
    ? `<tr><td>${t('Chegirma')} (${chegirmaFoizi}%):</td><td style="text-align:right;color:#666">-${formatSum(s.chegirma)}</td></tr>` : ''

  // Aralash to'lovda har bir kanal (naqd / karta / Click / o'tkazma)
  // o'z qatorida chiqadi — qaysi biri ishlatilgani chekdan ko'rinadi.
  const tolov = s.tolovUsuli === 'ARALASH'
    ? tolovKanallari(s)
        .map(k => `<tr><td>${tolovQisqa(k.usul, til)}:</td><td style="text-align:right">${formatSum(k.summa)}</td></tr>`)
        .join('')
    : s.tolovUsuli === 'NASIYA'
    ? `<tr><td>${t("To'lov")}:</td><td style="text-align:right">${t('Nasiya')}</td></tr><tr><td>${t('Mijoz')}:</td><td style="text-align:right">${t(s.mijoz?.ism || '—')}</td></tr>`
    : `<tr><td>${t("To'lov")}:</td><td style="text-align:right">${tolovLabel(s.tolovUsuli, til)}</td></tr>`

  const kassirHtml = kassirTel ? `<div>${t('Kassir tel')}: ${kassirTel}</div>` : ''

  return chekBoshi(`${t('Chek')} ${s.chekRaqami}`, sz, dokonNomi, manzil, tel) + `
<div class="sep"></div>
<div>${t('Chek')}: ${s.chekRaqami}</div>
<div>${t('Sana')}: ${formatSanaVaVaqt(s.sana)}</div>
${kassirHtml}
<div class="sep"></div>
<table>${tovarlarHtml}</table>
<div class="sep"></div>
<table>${chegirmaHtml}<tr class="total"><td>${t('JAMI')}:</td><td style="text-align:right">${formatSum(s.yakuniySumma)}</td></tr></table>
<div class="sep"></div>
<table>${tolov}</table>
${chekMatn ? `<div class="sep"></div><div class="center" style="font-size:${sz - 1}px">${chekMatn}</div>` : ''}
<div class="sep"></div>
<div class="center" style="font-size:10px">${t('Rahmat')}!</div>
</div>
</body></html>`
}

// Print oynasi ochib chek chiqarish
export function chekChopEtish(html: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank', 'width=340,height=640,toolbar=no,menubar=no,location=no,status=no')
  if (!win) { URL.revokeObjectURL(url); return }
  win.addEventListener('load', () => {
    setTimeout(() => {
      win.print()
      win.addEventListener('afterprint', () => { win.close(); URL.revokeObjectURL(url) })
    }, 200)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// MIJOZ XARID TARIXI — bitta chek qog'ozida butun tarix
//
// Mijoz kartasidan chiqariladi: qachon, qaysi chek bilan, qaysi mahsulotlarni
// olgani va qaytarganlari xronologik tartibda, oxirida umumiy yakun.
// Oddiy chek bilan bir xil uslub va transliteratsiyadan foydalanadi.
// ─────────────────────────────────────────────────────────────────────────────

export interface TarixQaytarish {
  jamiSumma: number | string
  yaratilgan: string | Date
  sabab?: string | null
  tarkiblar: ChekTarkib[]
}

export interface TarixSotuv {
  chekRaqami: string
  sana: string | Date
  chegirma: number | string
  yakuniySumma: number | string
  tolovUsuli: string
  tarkiblar: ChekTarkib[]
  qaytarishlar?: TarixQaytarish[]
}

export interface MijozTarixOptions {
  mijoz: {
    ism: string
    telefon?: string | null
    manzil?: string | null
    maxsus_kod?: string | null
  }
  sotuvlar: TarixSotuv[]
  /** Joriy nasiya qarzi — bo'lsa yakunda ko'rsatiladi. */
  jamiQarz?: number
  dokonInfo?: ChekDokonInfo
  til?: 'lotin' | 'kirill'
  fontSize?: number
}

export function buildMijozTarixHtml(opts: MijozTarixOptions): string {
  const { mijoz, sotuvlar, jamiQarz = 0, dokonInfo = {}, til = 'lotin', fontSize = 11 } = opts
  const sz = fontSize
  const t = (text: string) => (til === 'kirill' ? toKirill(text) : text)

  const dokonNomi = t(dokonInfo.dokon_nomi || "Do'kon")
  const manzil = t(dokonInfo.manzil || '')
  const tel = dokonInfo.telefon || ''

  const formatNum = (n: number | string) =>
    new Intl.NumberFormat('uz-UZ').format(Math.round(Number(n)))

  // Eng eskisidan yangisiga — tarix tabiiy o'qiladigan tartibda bo'lsin
  // (ro'yxat API'dan teskari tartibda keladi).
  const tartibli = [...sotuvlar].sort(
    (a, b) => new Date(a.sana).getTime() - new Date(b.sana).getTime()
  )

  const tovarQatorlari = (tarkiblar: ChekTarkib[]) =>
    (tarkiblar || [])
      .map((item) => {
        const nomi = t(item.tovar?.nomi || item.tovarNomi || '—')
        const miqdor = Number(item.miqdor)
        const bonusmi = Number(item.birlikNarxi) === 0
        if (bonusmi) {
          return (
            `<tr><td colspan="2">• ${nomi} <span style="font-weight:normal">(${t('Bonus')})</span></td></tr>` +
            `<tr><td colspan="2" style="padding-left:6px">${miqdor} × ${t('Bepul')}</td></tr>`
          )
        }
        return (
          `<tr><td colspan="2">• ${nomi}</td></tr>` +
          `<tr><td colspan="2" style="padding-left:6px;white-space:nowrap">${miqdor} × ${formatNum(item.birlikNarxi)} = ${formatSum(item.jami)}</td></tr>`
        )
      })
      .join('')

  let jamiXarid = 0
  let jamiQaytarilgan = 0

  const bloklar = tartibli
    .map((s, i) => {
      jamiXarid += Number(s.yakuniySumma)

      const chegirmaHtml =
        Number(s.chegirma) > 0
          ? `<tr><td>${t('Chegirma')}:</td><td style="text-align:right">-${formatSum(s.chegirma)}</td></tr>`
          : ''

      const qaytarishHtml = (s.qaytarishlar || [])
        .map((q) => {
          jamiQaytarilgan += Number(q.jamiSumma)
          return (
            `<div class="sep"></div>` +
            `<div style="font-weight:bold">${t('Qaytarish')} — ${formatSanaVaVaqt(q.yaratilgan)}</div>` +
            (q.sabab ? `<div style="font-weight:normal">${t('Sabab')}: ${t(q.sabab)}</div>` : '') +
            `<table>${tovarQatorlari(q.tarkiblar)}` +
            `<tr><td>${t('Qaytarildi')}:</td><td style="text-align:right">-${formatSum(q.jamiSumma)}</td></tr></table>`
          )
        })
        .join('')

      return (
        `<div class="sep"></div>` +
        `<div>${i + 1}) ${t('Chek')}: ${s.chekRaqami}</div>` +
        `<div style="font-weight:normal">${formatSanaVaVaqt(s.sana)} • ${tolovQisqa(s.tolovUsuli, til)}</div>` +
        `<table>${tovarQatorlari(s.tarkiblar)}${chegirmaHtml}` +
        `<tr><td>${t('Jami')}:</td><td style="text-align:right">${formatSum(s.yakuniySumma)}</td></tr></table>` +
        qaytarishHtml
      )
    })
    .join('')

  const sof = jamiXarid - jamiQaytarilgan

  const davr =
    tartibli.length > 0
      ? `${formatSanaVaVaqt(tartibli[0].sana).slice(0, 10)} — ${formatSanaVaVaqt(tartibli[tartibli.length - 1].sana).slice(0, 10)}`
      : '—'

  const bosh =
    chekBoshi(`${t('Xarid tarixi')} — ${t(mijoz.ism)}`, sz, dokonNomi, manzil, tel) +
    `
<div class="sep"></div>
<div class="center bold" style="font-size:${sz + 1}px">${t('XARID TARIXI')}</div>
<div class="sep"></div>
<div>${t('Mijoz')}: ${t(mijoz.ism)}</div>
${mijoz.telefon ? `<div>${t('Telefon')}: ${mijoz.telefon}</div>` : ''}
${mijoz.manzil ? `<div>${t('Manzil')}: ${t(mijoz.manzil)}</div>` : ''}
${mijoz.maxsus_kod ? `<div>${t('Kod')}: ${mijoz.maxsus_kod}</div>` : ''}
<div>${t('Davr')}: ${davr}</div>
<div style="font-weight:normal">${t('Chiqarildi')}: ${formatSanaVaVaqt(new Date())}</div>`

  const bosh_yoq = tartibli.length === 0
    ? `<div class="sep"></div><div class="center">${t('Xarid qilinmagan')}</div>`
    : bloklar

  const yakun =
    `<div class="sep"></div>` +
    `<table>` +
    `<tr><td>${t('Cheklar soni')}:</td><td style="text-align:right">${tartibli.length}</td></tr>` +
    `<tr><td>${t('Xaridlar')}:</td><td style="text-align:right">${formatSum(jamiXarid)}</td></tr>` +
    (jamiQaytarilgan > 0
      ? `<tr><td>${t('Qaytarishlar')}:</td><td style="text-align:right">-${formatSum(jamiQaytarilgan)}</td></tr>`
      : '') +
    `<tr class="total"><td>${t('SOF JAMI')}:</td><td style="text-align:right">${formatSum(sof)}</td></tr>` +
    (jamiQarz > 0
      ? `<tr><td>${t('Joriy qarz')}:</td><td style="text-align:right">${formatSum(jamiQarz)}</td></tr>`
      : '') +
    `</table>`

  const chekMatn = t(dokonInfo.chek_matn || '')

  return (
    bosh +
    bosh_yoq +
    yakun +
    (chekMatn
      ? `<div class="sep"></div><div class="center" style="font-size:${sz - 1}px">${chekMatn}</div>`
      : '') +
    `<div class="sep"></div>
<div class="center" style="font-size:10px">${t('Rahmat')}!</div>
</div>
</body></html>`
  )
}
