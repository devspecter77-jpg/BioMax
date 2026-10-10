// Mahsulotlar katalogi — A4 bosma HTML (narxnoma kitobchasi).
//
// Tovarlar bo'limidan chiqariladi: tanlangan mahsulotlar yoki hammasi.
// Mijozga ko'rsatiladigan hujjat, shuning uchun bu yerda faqat TAYYOR
// matnlar bo'ladi — qaysi narx chiqishi va u qanday yozilishi (so'm/dollar,
// yashirilgan maydonlar) sahifada hal qilinadi.
//
// Nega alohida oyna: ERP'ning bosma uslublari 80 mm chek qog'oziga
// sozlangan (`globals.css` → `@media print`). Katalog esa A4 — alohida
// hujjat ikkalasini chalkashtirmaydi.

/** Bosma hujjatdagi bitta mahsulot. */
export interface KatalogTovar {
  id: string
  nomi: string
  kategoriya: string | null
  /** Rasm `data:` URL ko'rinishida; yo'q bo'lsa o'rniga belgi chiziladi */
  rasm: string | null
  shtrixKod: string | null
  /** Tayyor matn, masalan "12 DONA" */
  qoldiq: string | null
  /** Ko'rsatiladigan narxlar: birinchisi asosiy (yirik) */
  narxlar: { yorliq: string; qiymat: string }[]
}

export type KatalogKorinishi = 'karta' | 'ixcham'

export interface KatalogSozlama {
  /** `karta` — rasmli kitobcha; `ixcham` — kichik rasmli zich narxnoma */
  korinish: KatalogKorinishi
  /** Bir qatorda nechta mahsulot */
  ustunlar: number
  dokonNomi: string
  telefon?: string | null
  manzil?: string | null
  sarlavha?: string
  /** Pastdagi eslatma, masalan "Narxlar o'zgarishi mumkin" */
  izoh?: string | null
  /** Kategoriya bo'yicha bo'limlarga ajratish */
  kategoriyaBoyicha: boolean
  /**
   * Narx yorlig'i ("Chakana", "Optom") — bir nechta narx turi tanlanganda.
   * Har tovarga emas, butun hujjatga: bitta narxi yo'q tovarda ham qolgani
   * qaysi narx ekani aniq tursin.
   */
  narxYorliqlari?: boolean
  /** Sarlavhadagi sana (tayyor matn) */
  sana: string
}

export const STANDART_KATALOG: Omit<KatalogSozlama, 'dokonNomi' | 'sana'> = {
  korinish: 'karta',
  ustunlar: 3,
  sarlavha: 'Mahsulotlar katalogi',
  izoh: 'Narxlar o‘zgarishi mumkin — aniqlashtirish uchun bog‘laning',
  kategoriyaBoyicha: true,
}

const OYLAR = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr']

/**
 * "10-oktabr, 2026" — sarlavhadagi sana. Brauzerning `uz-UZ` oy nomlari
 * chala (Chrome "2026 M10 10" deb yozadi), shuning uchun qo'lda.
 */
export function katalogSanasi(sana: Date): string {
  return `${sana.getDate()}-${OYLAR[sana.getMonth()]}, ${sana.getFullYear()}`
}

/** Ustunlar soni ko'rinishga qarab cheklanadi: juda kichik katak o'qilmaydi. */
export function ustunChegarasi(korinish: KatalogKorinishi): number[] {
  return korinish === 'karta' ? [2, 3, 4] : [1, 2]
}

function html(matn: string | null | undefined): string {
  return String(matn ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Kategoriya bo'yicha guruhlaydi; tartib — kategoriya nomi, ichida tovar nomi. */
export function guruhla(
  tovarlar: KatalogTovar[],
  kategoriyaBoyicha: boolean,
): { nomi: string | null; tovarlar: KatalogTovar[] }[] {
  if (!kategoriyaBoyicha) return [{ nomi: null, tovarlar }]
  const xarita = new Map<string, KatalogTovar[]>()
  for (const t of tovarlar) {
    const k = t.kategoriya?.trim() || 'Boshqa'
    const bor = xarita.get(k)
    if (bor) bor.push(t)
    else xarita.set(k, [t])
  }
  return [...xarita.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'uz'))
    .map(([nomi, royxat]) => ({ nomi, tovarlar: royxat }))
}

function kartaHtml(t: KatalogTovar, rasmBalandligi: string, yorliqli: boolean): string {
  const [asosiy, ...qolgan] = t.narxlar
  const rasm = t.rasm
    ? `<img src="${t.rasm}" alt="" loading="eager" />`
    : `<span class="rasmsiz">Rasm yo‘q</span>`
  return `<article class="karta">
  <div class="rasm" style="height:${rasmBalandligi}">${rasm}</div>
  <h3 class="nomi">${html(t.nomi)}</h3>
  ${asosiy ? `<div class="narx"><span class="qiymat">${html(asosiy.qiymat)}</span>${
    yorliqli ? `<span class="yorliq">${html(asosiy.yorliq)}</span>` : ''
  }</div>` : ''}
  ${qolgan.length ? `<ul class="qolgan">${qolgan
    .map(n => `<li><span>${html(n.yorliq)}</span><b>${html(n.qiymat)}</b></li>`).join('')}</ul>` : ''}
  ${t.qoldiq || t.shtrixKod ? `<div class="past">${
    [t.qoldiq ? html(t.qoldiq) : '', t.shtrixKod ? `<span class="kod">${html(t.shtrixKod)}</span>` : '']
      .filter(Boolean).join(' · ')
  }</div>` : ''}
</article>`
}

function ixchamHtml(t: KatalogTovar, yorliqli: boolean): string {
  const rasm = t.rasm ? `<img src="${t.rasm}" alt="" />` : `<span class="rasmsiz"></span>`
  return `<article class="qator">
  <div class="kichik">${rasm}</div>
  <div class="matn">
    <h3 class="nomi">${html(t.nomi)}</h3>
    ${t.qoldiq || t.shtrixKod ? `<div class="past">${
      [t.qoldiq ? html(t.qoldiq) : '', t.shtrixKod ? html(t.shtrixKod) : ''].filter(Boolean).join(' · ')
    }</div>` : ''}
  </div>
  <div class="narxlar">${t.narxlar
    .map((n, i) => `<div class="${i === 0 ? 'asosiy' : ''}">${
      yorliqli ? `<span>${html(n.yorliq)}</span>` : ''
    }<b>${html(n.qiymat)}</b></div>`).join('')}</div>
</article>`
}

/**
 * To'liq A4 hujjat. Rasmlar `data:` URL bo'lgani uchun hujjat o'zi
 * yetarli — bosma oynasi tarmoqni kutmaydi va rasmlar albatta chiqadi.
 */
export function katalogHtml(tovarlar: KatalogTovar[], s: KatalogSozlama): string {
  const karta = s.korinish === 'karta'
  const ustunlar = Math.min(karta ? 4 : 2, Math.max(1, Math.round(s.ustunlar) || 1))
  // Katak torayganda rasm ham pasayadi — nisbat buzilmasin
  const rasmBalandligi = ustunlar >= 4 ? '34mm' : ustunlar === 3 ? '42mm' : '54mm'
  const guruhlar = guruhla(tovarlar, s.kategoriyaBoyicha)
  const yorliqli = s.narxYorliqlari ?? tovarlar.some(t => t.narxlar.length > 1)

  const tana = guruhlar.map(g => {
    const ichi = (karta
      ? g.tovarlar.map(t => kartaHtml(t, rasmBalandligi, yorliqli)).join('')
      : g.tovarlar.map(t => ixchamHtml(t, yorliqli)).join(''))
    return `<section class="bolim">
  ${g.nomi ? `<h2 class="bolim-nomi">${html(g.nomi)} <span>${g.tovarlar.length} ta</span></h2>` : ''}
  <div class="${karta ? 'setka' : 'royxat'}">${ichi}</div>
</section>`
  }).join('')

  const tepaQatori = [s.telefon, s.manzil].filter(Boolean).map(x => html(x)).join(' · ')

  return `<!DOCTYPE html>
<html lang="uz"><head><meta charset="utf-8" />
<title>${html(s.sarlavha || 'Katalog')}${s.dokonNomi ? ' — ' + html(s.dokonNomi) : ''}</title>
<style>
  @page { size: A4; margin: 12mm 10mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    color: #111; background: #fff;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  /* ── Sarlavha ── */
  .sarlavha-blok { border-bottom: 2px solid #111; padding-bottom: 4mm; margin-bottom: 6mm; }
  .sarlavha-blok h1 { margin: 0; font-size: 22pt; letter-spacing: -0.3pt; }
  .sarlavha-blok .ost { margin-top: 1.5mm; font-size: 10pt; color: #444; }
  .sarlavha-blok .aloqa { margin-top: 1mm; font-size: 9pt; color: #666; }

  /* ── Kategoriya bo'limi ── */
  .bolim { margin-bottom: 7mm; }
  .bolim-nomi {
    font-size: 12pt; margin: 0 0 3mm;
    padding-bottom: 1.5mm; border-bottom: 1px solid #ccc;
    /* Bo'lim sarlavhasi sahifa oxirida yolg'iz qolmasin */
    break-after: avoid; page-break-after: avoid;
  }
  .bolim-nomi span { font-size: 9pt; font-weight: normal; color: #777; }

  /* ── Kartalar ── */
  .setka { display: grid; grid-template-columns: repeat(${ustunlar}, 1fr); gap: 4mm; }
  .karta {
    border: 1px solid #d8d8d8; border-radius: 2.5mm; padding: 3mm;
    display: flex; flex-direction: column;
    break-inside: avoid; page-break-inside: avoid;
  }
  .karta .rasm {
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 2.5mm; overflow: hidden;
    background: #f6f6f6; border-radius: 1.5mm;
  }
  .karta .rasm img { max-width: 100%; max-height: 100%; object-fit: contain; }
  .rasmsiz { font-size: 8pt; color: #aaa; }
  .karta .nomi {
    margin: 0 0 2mm; font-size: 10pt; line-height: 1.25; font-weight: 600;
    /* Uzun nom kartani cho'zib yubormasin */
    display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
  }
  .karta .narx { margin-top: auto; display: flex; align-items: baseline; gap: 2mm; flex-wrap: wrap; }
  .karta .narx .qiymat { font-size: 13pt; font-weight: 700; letter-spacing: -0.2pt; }
  .karta .narx .yorliq { font-size: 7.5pt; color: #777; }
  .karta .qolgan { list-style: none; margin: 1.5mm 0 0; padding: 0; font-size: 8.5pt; color: #333; }
  .karta .qolgan li { display: flex; justify-content: space-between; gap: 2mm; }
  .karta .qolgan span { color: #777; }
  .karta .past { margin-top: 2mm; font-size: 7.5pt; color: #888; }
  .karta .past .kod { font-family: "Courier New", monospace; }

  /* ── Ixcham ro'yxat ── */
  .royxat { display: grid; grid-template-columns: repeat(${ustunlar}, 1fr); gap: 0 6mm; }
  .qator {
    display: flex; align-items: center; gap: 2.5mm;
    padding: 2mm 0; border-bottom: 1px solid #e8e8e8;
    break-inside: avoid; page-break-inside: avoid;
  }
  .qator .kichik {
    width: 12mm; height: 12mm; flex: 0 0 12mm;
    display: flex; align-items: center; justify-content: center;
    background: #f6f6f6; border-radius: 1mm; overflow: hidden;
  }
  .qator .kichik img { max-width: 100%; max-height: 100%; object-fit: contain; }
  .qator .matn { flex: 1; min-width: 0; }
  .qator .nomi { margin: 0; font-size: 9pt; font-weight: 600; line-height: 1.2;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .qator .past { font-size: 7pt; color: #999; margin-top: 0.5mm; }
  .qator .narxlar { text-align: right; flex: 0 0 auto; font-size: 8pt; }
  .qator .narxlar div { white-space: nowrap; }
  .qator .narxlar span { color: #888; margin-right: 1.5mm; }
  .qator .narxlar .asosiy b { font-size: 10pt; }

  /* ── Pastki eslatma ── */
  .izoh { margin-top: 6mm; padding-top: 3mm; border-top: 1px solid #ddd;
    font-size: 8.5pt; color: #666; text-align: center; }
</style>
</head><body>
<header class="sarlavha-blok">
  <h1>${html(s.dokonNomi || s.sarlavha || 'Katalog')}</h1>
  <div class="ost">${html(s.sarlavha || 'Mahsulotlar katalogi')} · ${html(s.sana)} · ${tovarlar.length} ta mahsulot</div>
  ${tepaQatori ? `<div class="aloqa">${tepaQatori}</div>` : ''}
</header>
${tana || '<p>Mahsulot tanlanmagan.</p>'}
${s.izoh ? `<div class="izoh">${html(s.izoh)}</div>` : ''}
</body></html>`
}
