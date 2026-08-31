// Chek print HTML — sotuv/page.tsx va sotuvlar/SaleDetailPanel.tsx ikkalasi ham ishlatadi.
// Format thermal 80mm printer uchun.

import { formatSum, formatSanaVaVaqt } from './utils'

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
    const narxQ = formatNum(item.birlikNarxi)
    const jami = formatSum(item.jami)
    return `<tr><td colspan="2" style="font-weight:600;padding-top:3px">${nomi}</td></tr>`
      + `<tr><td colspan="2" style="white-space:nowrap"><span style="color:#222">${miqdor} × ${narxQ}</span> = <span style="font-weight:bold">${jami}</span></td></tr>`
  }).join('')

  const chegirmaHtml = Number(s.chegirma) > 0
    ? `<tr><td>${t('Chegirma')}:</td><td style="text-align:right;color:#666">-${formatSum(s.chegirma)}</td></tr>` : ''

  const tolov = s.tolovUsuli === 'ARALASH'
    ? `<tr><td>${t('Naqd')}:</td><td style="text-align:right">${formatSum(s.naqdTolangan || 0)}</td></tr><tr><td>${t('Karta')}:</td><td style="text-align:right">${formatSum(s.kartaTolangan || 0)}</td></tr>`
    : s.tolovUsuli === 'NASIYA'
    ? `<tr><td>${t("To'lov")}:</td><td style="text-align:right">${t('Nasiya')}</td></tr><tr><td>${t('Mijoz')}:</td><td style="text-align:right">${t(s.mijoz?.ism || '—')}</td></tr>`
    : `<tr><td>${t("To'lov")}:</td><td style="text-align:right">${s.tolovUsuli === 'KARTA' ? t('Karta') : t('Naqd pul')}</td></tr>`

  const kassirHtml = kassirTel ? `<div>${t('Kassir tel')}: ${kassirTel}</div>` : ''

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${t('Chek')} ${s.chekRaqami}</title>
<style>
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
</style></head><body>
<div class="chek">
<div class="center bold" style="font-size:${sz + 2}px">${dokonNomi}</div>
${manzil ? `<div class="center">${manzil}</div>` : ''}
${tel ? `<div class="center">Tel: ${tel}</div>` : ''}
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
