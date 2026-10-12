// Savdo cheki — A4 formatda, mahsulot rasmlari bilan.
//
// Oddiy chek 80 mm termal qog'oz uchun (`chek-print.ts`). Bu esa mijozga
// beriladigan to'liq hujjat: har mahsulot alohida qatorda — rasmi, nomi,
// miqdori, narxi va summasi; pastda yakun, to'lov va onlayn chek QR kodi.
//
// Ma'lumot serverdan bitta so'rov bilan keladi (`/api/sotuvlar/:id/a4`):
// rasmlar u yerda kichraytirilgan, shuning uchun hujjat yengil. Kassa,
// mijoz kartasi — qayerdan chiqarilsa ham chek bir xil bo'ladi.

import { formatSanaVaVaqt } from './utils'
import { toKirill, type ChekDokonInfo } from './chek-print'
import { tolovKanallari, tolovLabel, tolovQisqa } from './tolov-usullari'
import { bosmaOynasiniOch } from './bosma-oyna'

export interface ChekA4Qator {
  nomi: string
  /** `Birlik` enum: DONA, KG, ... */
  birlik: string
  shtrixKod: string | null
  miqdor: number
  birlikNarxi: number
  jami: number
  /** Kichraytirilgan rasm (`data:` URL) yoki null */
  rasm: string | null
}

export interface ChekA4Malumot {
  chekRaqami: string
  sana: string
  /** YAKUNLANGAN | BEKOR_QILINGAN */
  holati: string
  qatorlar: ChekA4Qator[]
  /** Chegirmagacha mahsulotlar summasi */
  jamiSumma: number
  chegirma: number
  ballIshlatilgan: number
  keshbekIshlatilgan: number
  /** To'lanadigan (mahsulotlar) */
  yakuniySumma: number
  /** Onlayn buyurtmada yetkazish haqi — mahsulot summasidan alohida */
  yetkazishNarx: number
  tolovUsuli: string
  naqdTolangan: number
  kartaTolangan: number
  clickTolangan: number
  bankTolangan: number
  mijoz: { ism: string; telefon: string | null } | null
  kassir: { ism: string; telefon: string | null } | null
  /** Onlayn chek manzili */
  havola: string
  /** Havolaning QR kodi (`data:` URL) */
  qr: string | null
}

type Til = 'lotin' | 'kirill'

const BIRLIK: Record<string, string> = { DONA: 'dona', KG: 'kg', LITR: 'litr', METR: 'metr', PACHKA: 'pachka', QUTI: 'quti' }

function esc(matn: string | null | undefined): string {
  return String(matn ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const pul = (n: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(n))
const son = (n: number) => new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 3 }).format(n)
/** Faqat o'zimiz yasagan `data:image/...` — boshqa narsa `src` ga tushmasin */
const rasmMi = (r: string | null): r is string => !!r && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(r)

/** To'liq A4 hujjat (HTML). Rasmlar `data:` URL — bosma oynasi tarmoqni kutmaydi. */
export function chekA4Html(m: ChekA4Malumot, dokon: ChekDokonInfo = {}, til: Til = 'lotin'): string {
  const t = (s: string) => (til === 'kirill' ? toKirill(s) : s)
  const tt = (s: string | null | undefined) => esc(t(String(s ?? '')))
  const uzs = (n: number) => `${pul(n)} UZS`

  const dokonNomi = tt(dokon.dokon_nomi || "Do'kon")
  const aloqa = [dokon.manzil ? tt(dokon.manzil) : '', dokon.telefon ? `Tel: ${esc(dokon.telefon)}` : '']
    .filter(Boolean).join(' · ')
  const bekor = m.holati === 'BEKOR_QILINGAN'

  const qatorlar = m.qatorlar.map((q, i) => {
    const bonus = q.birlikNarxi === 0
    const rasm = rasmMi(q.rasm)
      ? `<img src="${q.rasm}" alt="" />`
      : `<span>${tt("Rasm yo'q")}</span>`
    return `<tr>
  <td class="n">${i + 1}</td>
  <td class="r"><div class="rasm">${rasm}</div></td>
  <td class="nom">
    <div class="nomi">${tt(q.nomi)}</div>
    ${q.shtrixKod ? `<div class="kod">${esc(q.shtrixKod)}</div>` : ''}
    ${bonus ? `<span class="bonus">${tt('Bonus — bepul')}</span>` : ''}
  </td>
  <td class="son">${son(q.miqdor)} ${tt(BIRLIK[q.birlik] ?? q.birlik.toLowerCase())}</td>
  <td class="pul">${bonus ? '—' : pul(q.birlikNarxi)}</td>
  <td class="pul jami">${bonus ? '0' : pul(q.jami)}</td>
</tr>`
  }).join('')

  // Yakun: chegirma va sodiqlik (ball, keshbek) alohida — mijoz nima uchun
  // kam to'laganini ko'radi
  const yigma: string[] = []
  const qator = (yorliq: string, qiymat: string, cls = '') =>
    `<div class="qator ${cls}"><span>${yorliq}</span><b>${qiymat}</b></div>`
  const kamaytirish = m.chegirma > 0 || m.ballIshlatilgan > 0 || m.keshbekIshlatilgan > 0
  if (kamaytirish) yigma.push(qator(tt('Mahsulotlar'), uzs(m.jamiSumma)))
  if (m.chegirma > 0) {
    const foiz = m.jamiSumma > 0 ? Math.round((m.chegirma / m.jamiSumma) * 100) : 0
    yigma.push(qator(`${tt('Chegirma')}${foiz > 0 ? ` (${foiz}%)` : ''}`, `−${uzs(m.chegirma)}`, 'kam'))
  }
  if (m.ballIshlatilgan > 0) yigma.push(qator(tt('Ball bilan to‘landi'), `−${uzs(m.ballIshlatilgan)}`, 'kam'))
  if (m.keshbekIshlatilgan > 0) yigma.push(qator(tt('Keshbek bilan to‘landi'), `−${uzs(m.keshbekIshlatilgan)}`, 'kam'))
  yigma.push(qator(tt('JAMI'), uzs(m.yakuniySumma), 'jami'))
  if (m.yetkazishNarx > 0) {
    yigma.push(qator(tt('Yetkazish'), `+${uzs(m.yetkazishNarx)}`))
    yigma.push(qator(tt('Umumiy to‘lov'), uzs(m.yakuniySumma + m.yetkazishNarx), 'umumiy'))
  }

  const tolov = m.tolovUsuli === 'ARALASH'
    ? tolovKanallari(m).map(k => qator(esc(tolovQisqa(k.usul, til)), uzs(k.summa), 'tolov')).join('')
    : qator(tt("To'lov"), esc(tolovLabel(m.tolovUsuli, til)), 'tolov')

  const tomon = (yorliq: string, ism: string | null | undefined, tel: string | null | undefined) =>
    ism || tel
      ? `<div><div class="yorliq">${tt(yorliq)}</div><div>${tt(ism || '—')}${tel ? ` · ${esc(tel)}` : ''}</div></div>`
      : ''
  const tomonlar = [tomon('Xaridor', m.mijoz?.ism, m.mijoz?.telefon), tomon('Kassir', m.kassir?.ism, m.kassir?.telefon)]
    .filter(Boolean).join('')

  const chekMatn = dokon.chek_matn ? tt(dokon.chek_matn) : ''

  return `<!DOCTYPE html>
<html lang="uz"><head><meta charset="utf-8" />
<title>${tt('Chek')} ${esc(m.chekRaqami)} — ${dokonNomi}</title>
<style>
  @page { size: A4; margin: 12mm 12mm 14mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: #fff; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    font-size: 10pt; color: #111; line-height: 1.35;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  /* Ekranda — qog'oz varag'i ko'rinishi; bosmada varaqning o'zi */
  @media screen {
    body { background: #e9eaec; padding: 8mm 0; }
    .varaq { width: 210mm; max-width: 100%; margin: 0 auto; padding: 12mm; background: #fff; box-shadow: 0 1px 6px rgba(0,0,0,.15); }
  }

  .bosh { display: flex; justify-content: space-between; align-items: flex-start; gap: 8mm;
    padding-bottom: 4.5mm; border-bottom: 2px solid #111; }
  .dokon h1 { margin: 0; font-size: 20pt; letter-spacing: -0.3pt; line-height: 1.1; }
  .dokon .aloqa { margin-top: 1.5mm; color: #555; font-size: 9pt; }
  .hujjat { text-align: right; white-space: nowrap; }
  .hujjat .tur { font-size: 8.5pt; font-weight: 700; letter-spacing: 1.4pt; color: #666; }
  .hujjat .raqam { margin-top: 1mm; font-size: 14pt; font-weight: 700; font-variant-numeric: tabular-nums; }
  .hujjat .sana { margin-top: .5mm; color: #555; font-variant-numeric: tabular-nums; }
  .bekor { margin-top: 1.5mm; display: inline-block; padding: .6mm 2.5mm; border: 1.5px solid #b91c1c;
    color: #b91c1c; border-radius: 1mm; font-size: 8.5pt; font-weight: 800; letter-spacing: .8pt; }

  .tomonlar { display: flex; gap: 12mm; margin: 3.5mm 0 4.5mm; font-size: 9.5pt; }
  .tomonlar .yorliq { font-size: 7.5pt; font-weight: 600; letter-spacing: .7pt; text-transform: uppercase; color: #888; }

  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  th { padding: 2mm; background: #f2f3f5; border-bottom: 1px solid #cfd2d6; text-align: left;
    font-size: 7.5pt; font-weight: 700; letter-spacing: .6pt; text-transform: uppercase; color: #555; }
  th.ong { text-align: right; }
  td { padding: 2mm; border-bottom: 1px solid #e6e7ea; vertical-align: middle; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  td.n { width: 8mm; text-align: center; color: #888; font-variant-numeric: tabular-nums; }
  td.r { width: 26mm; }
  .rasm { width: 22mm; height: 22mm; display: flex; align-items: center; justify-content: center;
    overflow: hidden; border-radius: 1.5mm; background: #f5f5f6; }
  .rasm img { max-width: 100%; max-height: 100%; object-fit: contain; }
  .rasm span { padding: 1mm; font-size: 7pt; color: #aaa; text-align: center; }
  .nomi { font-size: 10.5pt; font-weight: 600; }
  .kod { margin-top: .8mm; font-family: "Courier New", monospace; font-size: 8pt; color: #888; }
  .bonus { display: inline-block; margin-top: 1mm; padding: 0 1.5mm; border: 1px solid #c4b5fd;
    border-radius: 1mm; color: #6d28d9; font-size: 7.5pt; font-weight: 700; }
  td.son, td.pul { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  td.son { width: 24mm; }
  td.pul { width: 27mm; }
  td.jami { font-weight: 700; }

  .yakun { display: flex; justify-content: space-between; align-items: flex-start; gap: 10mm;
    margin-top: 5mm; break-inside: avoid; page-break-inside: avoid; }
  .soni { color: #555; font-size: 9.5pt; padding-top: 1mm; }
  .yigma { width: 84mm; font-variant-numeric: tabular-nums; }
  .yigma .qator { display: flex; justify-content: space-between; gap: 4mm; padding: .9mm 0; }
  .yigma .qator b { font-weight: 600; white-space: nowrap; }
  .yigma .kam b { color: #444; }
  .yigma .jami { margin-top: 1.2mm; padding-top: 2.2mm; border-top: 2px solid #111; font-size: 14pt; }
  .yigma .jami b { font-weight: 800; }
  .yigma .umumiy { font-size: 11pt; }
  .yigma .umumiy b { font-weight: 800; }
  .yigma .tolovlar { margin-top: 1.5mm; padding-top: 1.2mm; border-top: 1px dashed #cfd2d6; }
  .yigma .tolov { color: #444; font-size: 9.5pt; }

  .past { display: flex; justify-content: space-between; align-items: flex-end; gap: 8mm;
    margin-top: 8mm; padding-top: 4mm; border-top: 1px solid #e6e7ea;
    break-inside: avoid; page-break-inside: avoid; }
  .rahmat { font-size: 12pt; font-weight: 700; }
  .matn { margin-top: 1mm; max-width: 120mm; color: #555; font-size: 9pt; white-space: pre-line; }
  .qr { text-align: center; font-size: 7.5pt; color: #777; }
  .qr img { display: block; width: 26mm; height: 26mm; margin: 0 auto 1mm; }
</style>
</head><body>
<div class="varaq">
  <header class="bosh">
    <div class="dokon">
      <h1>${dokonNomi}</h1>
      ${aloqa ? `<div class="aloqa">${aloqa}</div>` : ''}
    </div>
    <div class="hujjat">
      <div class="tur">${tt('SAVDO CHEKI')}</div>
      <div class="raqam">№ ${esc(m.chekRaqami)}</div>
      <div class="sana">${esc(formatSanaVaVaqt(m.sana))}</div>
      ${bekor ? `<div class="bekor">${tt('BEKOR QILINGAN')}</div>` : ''}
    </div>
  </header>

  ${tomonlar ? `<div class="tomonlar">${tomonlar}</div>` : '<div style="height:4mm"></div>'}

  <table>
    <thead><tr>
      <th style="text-align:center">№</th>
      <th>${tt('Rasm')}</th>
      <th>${tt('Mahsulot')}</th>
      <th class="ong">${tt('Miqdor')}</th>
      <th class="ong">${tt('Narxi')}, UZS</th>
      <th class="ong">${tt('Summa')}, UZS</th>
    </tr></thead>
    <tbody>${qatorlar}</tbody>
  </table>

  <section class="yakun">
    <div class="soni">${tt('Jami')}: ${m.qatorlar.length} ${tt('xil mahsulot')}</div>
    <div class="yigma">${yigma.join('')}<div class="tolovlar">${tolov}</div></div>
  </section>

  <footer class="past">
    <div>
      <div class="rahmat">${tt('Xaridingiz uchun rahmat!')}</div>
      ${chekMatn ? `<div class="matn">${chekMatn}</div>` : ''}
    </div>
    ${m.qr && rasmMi(m.qr) ? `<div class="qr"><img src="${m.qr}" alt="" />${tt('Chekni onlayn ko‘rish')}</div>` : ''}
  </footer>
</div>
</body></html>`
}

/**
 * A4 chekni tayyorlab chop etish oynasini ochadi. Bosish ichida chaqirilishi
 * shart: oyna DARHOL ochiladi ("Tayyorlanmoqda…"), aks holda rasm yuklanib
 * bo'lgach ochilgan oynani brauzer "qalqib chiquvchi" deb to'sadi.
 */
export async function chekniA4ChopEt(sotuvId: string, dokon: ChekDokonInfo | undefined, til: Til = 'lotin'): Promise<void> {
  const oyna = bosmaOynasiniOch(til === 'kirill' ? toKirill('Chek tayyorlanmoqda…') : 'Chek tayyorlanmoqda…')
  if (!oyna) throw new Error('Brauzer yangi oynani to‘sdi — bu sayt uchun qalqib chiquvchi oynalarga ruxsat bering')
  let javob: Response
  try {
    javob = await fetch(
      `/api/sotuvlar/${encodeURIComponent(sotuvId)}/a4?origin=${encodeURIComponent(window.location.origin)}`,
      { cache: 'no-store' },
    )
  } catch {
    oyna.yop()
    throw new Error('Internet aloqasini tekshiring')
  }
  const j = await javob.json().catch(() => null) as (ChekA4Malumot & { xato?: string }) | null
  if (!javob.ok || !j) {
    oyna.yop()
    throw new Error(j?.xato ?? 'Chek ma’lumoti yuklanmadi')
  }
  await oyna.chopEt(chekA4Html(j, dokon, til))
}
