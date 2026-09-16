// Ruxsatlar katalogi — xodimga NIMA ko'rinishi va NIMA qila olishi.
//
// Uch daraja:
//   · bo'lim  — menyudagi sahifa (Sotuv, Tovarlar...). Yopiq bo'lsa sahifa ham,
//               uning API'lari ham yopiq.
//   · amal    — bo'lim ichidagi funksiya (tovar qo'shish, chegirma berish,
//               mijozni o'chirish...). Faqat bo'lim ochiq bo'lsa amal qiladi.
//   · maydon  — ma'lumotning bir qismi (kelish narxi). Alohida jadvalda
//               saqlanadi (`MaydonYashirish`), lekin shu ekrandan boshqariladi.
//
// Bu fayl serverga bog'liq emas (prisma import qilmaydi) — menyu, sahifa
// tugmalari, proxy va API bitta katalogdan foydalanadi.
//
// ADMIN har doim cheklanmaydi. Sozlamalar, filiallar va ruxsatlarning o'zi bu
// yerda yo'q — ular faqat administratorniki va xodimga berilmaydi.

export type RuxsatTuri = 'bolim' | 'amal' | 'maydon'

export interface RuxsatBolim {
  kalit: string
  label: string
  izoh?: string
  turi?: RuxsatTuri
  /** Xavfli amal: pul, o'chirish, ommaviy o'zgarish — ekranda ajratib ko'rsatiladi */
  xavfli?: boolean
  /** `maydon` turi uchun: `MaydonYashirish.maydon` qiymati */
  maydon?: string
  /** Bo'limning o'zi yopilmaydi (bosh sahifa) — faqat ichidagi amallar boshqariladi */
  doimOchiq?: boolean
  children?: RuxsatBolim[]
}

export const ruxsatKatalogi: RuxsatBolim[] = [
  {
    kalit: 'bosh', label: 'Bosh sahifa', izoh: 'Bosh sahifa hammaga ochiq — faqat ko‘rsatkichlar boshqariladi', doimOchiq: true, children: [
      { kalit: 'bosh.statistika', label: 'Savdo va foyda ko‘rsatkichlari', izoh: 'Haftalik tushum, sof foyda, grafiklar' },
    ],
  },
  {
    kalit: 'sotuv', label: 'Sotuv (POS)', children: [
      { kalit: 'sotuv.chegirma', label: 'Chegirma, bonus va narxni pasaytirish', izoh: 'Qo‘lda summa, bonus tovar, narxni ro‘yxatdagidan past qilish', xavfli: true },
      { kalit: 'sotuv.nasiya', label: 'Nasiyaga sotish', izoh: 'To‘lov usuli «Nasiya» yoki sherik do‘kon hisobiga', xavfli: true },
      { kalit: 'sotuv.qaytarish', label: 'Qaytarish qabul qilish', xavfli: true },
      { kalit: 'sotuv.saqlash', label: 'Zakazni saqlab qo‘yish va davom ettirish' },
    ],
  },
  {
    kalit: 'onlayn-buyurtmalar', label: 'Onlayn buyurtmalar', children: [
      { kalit: 'onlayn-buyurtmalar.boshqarish', label: 'Holatni o‘zgartirish', izoh: 'Tasdiqlash, yig‘ish, topshirish — ombor va sotuvga yoziladi' },
      { kalit: 'onlayn-buyurtmalar.bekor', label: 'Buyurtmani bekor qilish', xavfli: true },
    ],
  },
  {
    kalit: 'onlayn-vitrina', label: 'Onlayn vitrina', children: [
      { kalit: 'onlayn-vitrina.tahrirlash', label: 'Kartochkani tahrirlash va saytga chiqarish' },
    ],
  },
  {
    kalit: 'tovarlar', label: 'Tovarlar', children: [
      { kalit: 'tovarlar.qoshish', label: 'Tovar qo‘shish' },
      { kalit: 'tovarlar.tahrirlash', label: 'Tovarni tahrirlash', izoh: 'Nomi, narxi, kategoriyasi, qulflash' },
      { kalit: 'tovarlar.ochirish', label: 'Tovarni o‘chirish', xavfli: true },
      { kalit: 'tovarlar.import', label: 'Excel’dan import', xavfli: true },
      { kalit: 'tovarlar.export', label: 'Excel’ga eksport' },
      { kalit: 'tovarlar.kelishNarxi', label: 'Kelish narxini ko‘rish', turi: 'maydon', maydon: 'kelishNarxi', izoh: 'Tovarlar, ombor va eksportda yashiriladi. Foyda hisobotlari «Hisobotlar» ruxsatlari bilan boshqariladi' },
      { kalit: 'tovarlar.ustamaFoiz', label: 'Ustama foizni ko‘rish', turi: 'maydon', maydon: 'ustamaFoiz', izoh: 'Tovar qo‘shish va tahrirlash oynasida' },
    ],
  },
  {
    kalit: 'omborlar', label: 'Omborlar', children: [
      { kalit: 'omborlar.boshqarish', label: 'Ombor va kategoriya yaratish, tahrirlash, o‘chirish' },
    ],
  },
  {
    kalit: 'ombor', label: 'Ombor harakati', children: [
      { kalit: 'ombor.kirim', label: 'Kirim va mijoz qaytargan tovar', izoh: 'Qoldiqni ko‘paytiradigan qo‘lda yozuvlar, ommaviy kirim' },
      { kalit: 'ombor.chiqim', label: 'Chiqim va yo‘qotish', izoh: 'Qoldiqni kamaytiradigan qo‘lda yozuvlar', xavfli: true },
      { kalit: 'ombor.otkazma', label: 'Ombordan do‘konga o‘tkazish' },
      { kalit: 'ombor.sozlash', label: 'Qoldiqni to‘g‘rilash (inventarizatsiya)', xavfli: true },
    ],
  },
  { kalit: 'kunlik-hisobot', label: 'Kunlik hisobot', children: [
    { kalit: 'kunlik-hisobot.sozlama', label: 'Sozlamalar va qo‘lda yuborish' },
  ] },
  {
    kalit: 'mijozlar', label: 'Mijozlar', children: [
      { kalit: 'mijozlar.qoshish', label: 'Mijoz qo‘shish' },
      { kalit: 'mijozlar.tahrirlash', label: 'Mijozni tahrirlash' },
      { kalit: 'mijozlar.ochirish', label: 'Mijozni o‘chirish', xavfli: true },
      { kalit: 'mijozlar.import', label: 'Excel’dan import', xavfli: true },
      { kalit: 'mijozlar.export', label: 'Excel’ga eksport', izoh: 'Barcha mijozlar telefonlari bilan' },
      { kalit: 'mijozlar.onlayn', label: 'Onlayn do‘kon mijozlarini ko‘rish', izoh: 'Saytda ro‘yxatdan o‘tganlar, ularning buyurtmalari va cheklari' },
    ],
  },
  {
    kalit: 'nasiyalar', label: 'Nasiyalar', children: [
      { kalit: 'nasiyalar.tolov', label: 'To‘lov qabul qilish' },
      { kalit: 'nasiyalar.qarz', label: 'Qarz yaratish va qo‘shish', xavfli: true },
      { kalit: 'nasiyalar.ochirish', label: 'Nasiyani o‘chirish', xavfli: true },
      { kalit: 'nasiyalar.import', label: 'Excel’dan import', xavfli: true },
      { kalit: 'nasiyalar.export', label: 'Excel’ga eksport' },
      { kalit: 'nasiyalar.xarajat', label: 'Xarajatlar va do‘kon qarzlari', xavfli: true },
    ],
  },
  {
    kalit: 'ballar', label: 'Ballar va keshbeklar', children: [
      { kalit: 'ballar.qolda', label: 'Qo‘lda ball berish yoki ayirish', xavfli: true },
      { kalit: 'ballar.sozlama', label: 'Sodiqlik dasturi sozlamalari', xavfli: true },
    ],
  },
  { kalit: 'tolovlar', label: "To'lovlar" },
  {
    kalit: 'taminotchilar', label: "Ta'minotchilar", children: [
      { kalit: 'taminotchilar.qoshish', label: 'Ta’minotchi qo‘shish' },
      { kalit: 'taminotchilar.tahrirlash', label: 'Ta’minotchini tahrirlash' },
      { kalit: 'taminotchilar.ochirish', label: 'Ta’minotchini o‘chirish', xavfli: true },
      { kalit: 'taminotchilar.qarz', label: 'Qarz va to‘lovlarni yozish', xavfli: true },
      { kalit: 'taminotchilar.sorov', label: 'Buyurtma so‘rovi yuborish' },
    ],
  },
  {
    kalit: 'xodimlar', label: 'Xodimlar', children: [
      { kalit: 'xodimlar.qoshish', label: 'Xodim qo‘shish va tahrirlash', xavfli: true },
      { kalit: 'xodimlar.oylik', label: 'Oylik va bonus to‘lash', xavfli: true },
      { kalit: 'xodimlar.mulk', label: 'Biriktirilgan mulkni boshqarish', izoh: 'Mashina, telefon, kalit berish, qaytarib olish, boshqa xodimga o‘tkazish' },
      { kalit: 'xodimlar.sotuvlar', label: 'Xodim sotuvlarini ko‘rish', izoh: 'Kimga nima sotgani: cheklar, mijozlar va mahsulotlar bo‘yicha' },
    ],
  },
  {
    kalit: 'xaridlar', label: 'Xaridlar (sotuvlar tarixi)', children: [
      { kalit: 'xaridlar.export', label: 'Excel’ga eksport' },
    ],
  },
  {
    kalit: 'hisobotlar', label: 'Hisobotlar', children: [
      { kalit: 'hisobotlar.umumiy', label: 'Umumiy' },
      { kalit: 'hisobotlar.sotuv', label: 'Sotuv' },
      { kalit: 'hisobotlar.tovarlar', label: 'Tovarlar' },
      { kalit: 'hisobotlar.ombor', label: 'Ombor' },
      { kalit: 'hisobotlar.mijozlar', label: 'Mijozlar' },
      { kalit: 'hisobotlar.nasiya', label: 'Nasiya' },
      { kalit: 'hisobotlar.xaridlar', label: 'Xaridlar' },
      { kalit: 'hisobotlar.export', label: 'Hisobotni eksport qilish' },
    ],
  },
]

export interface TekisRuxsat extends Omit<RuxsatBolim, 'children'> {
  turi: RuxsatTuri
  ota: string | null
}

/** Daraxtni tekis ro'yxatga — tartib saqlanadi, ota har doim bolasidan oldin. */
export const tekisKatalog: TekisRuxsat[] = ruxsatKatalogi.flatMap(b => [
  { ...omit(b), turi: 'bolim' as const, ota: null },
  ...(b.children ?? []).map(c => ({ ...omit(c), turi: c.turi ?? ('amal' as const), ota: b.kalit })),
])

function omit(b: RuxsatBolim): Omit<RuxsatBolim, 'children'> {
  const { children: _c, ...qolgan } = b
  return qolgan
}

/** Katalogdagi barcha kalitlar (asosiy + ichki), tekis ro'yxat sifatida. */
export const barchaRuxsatKalitlari: string[] = tekisKatalog.map(r => r.kalit)

export const katalogBoyicha = new Map(tekisKatalog.map(r => [r.kalit, r]))

// Rol bo'yicha standart — xodim uchun hali alohida sozlanmagan kalitlarda shu
// ishlatiladi. Bo'limlar rolga qarab; amallar esa "bo'lim ochiq bo'lsa ochiq"
// (bo'lim yopiq bo'lsa amal baribir ishlamaydi) — quyidagi istisnolardan tashqari.
const ROL_STANDART: Record<string, string[]> = {
  KASSIR: [
    'bosh',
    'sotuv', 'onlayn-buyurtmalar', 'tovarlar', 'ombor', 'mijozlar', 'nasiyalar', 'ballar',
    'taminotchilar', 'xaridlar', 'hisobotlar', 'hisobotlar.umumiy', 'hisobotlar.sotuv',
  ],
  OMBORCHI: ['bosh', 'tovarlar', 'ombor', 'taminotchilar'],
  SOTUVCHI: ['bosh', 'sotuv'],
}

/**
 * Bo'limi ochiq bo'lsa ham standartda YOPIQ amallar — ommaviy yoki qaytarib
 * bo'lmaydigan o'zgarishlar va nozik ma'lumot. Ega xohlasa ochib beradi.
 * `kalit:ROL` — faqat shu rol uchun yopiq.
 */
const STANDART_YOPIQ = new Set([
  'bosh.statistika:OMBORCHI', 'bosh.statistika:SOTUVCHI',
  'tovarlar.ochirish', 'tovarlar.import', 'mijozlar.ochirish', 'mijozlar.import', 'mijozlar.export',
  'nasiyalar.ochirish', 'nasiyalar.import', 'nasiyalar.xarajat',
  'taminotchilar.ochirish', 'taminotchilar.qarz', 'ballar.qolda', 'ballar.sozlama', 'xodimlar.qoshish', 'xodimlar.oylik', 'xodimlar.mulk', 'xodimlar.sotuvlar',
  'kunlik-hisobot.sozlama', 'ombor.sozlash', 'onlayn-vitrina.tahrirlash',
])

/**
 * Kalitning rol bo'yicha standart qiymati.
 *
 * Amal uchun qiymat ota bo'limga BOG'LIQ EMAS ("bo'lim ochiq bo'lsa" deb
 * hisoblanadi): Ega bo'limni yopib qayta ochsa, ichidagi qo'lda yopilgan
 * amallar yo'qolib ketmasin. Ota yopiqligi `samaraliRuxsatlar` da hisobga olinadi.
 */
export function rolStandartRuxsat(rol: string, kalit: string): boolean {
  if (rol === 'ADMIN') return true
  const r = katalogBoyicha.get(kalit)
  if (!r) return false
  if (r.doimOchiq || r.turi === 'maydon') return true
  if (!r.ota) return (ROL_STANDART[rol] || []).includes(kalit)
  if (STANDART_YOPIQ.has(kalit) || STANDART_YOPIQ.has(`${kalit}:${rol}`)) return false
  // Hisobot bo'limlari (foyda, tannarx) — rolga alohida belgilanadi
  if (r.ota === 'hisobotlar' && kalit !== 'hisobotlar.export') return (ROL_STANDART[rol] || []).includes(kalit)
  return true
}

/**
 * Samarali ruxsatlar — sessiya, menyu va API shu ro'yxatga qaraydi.
 * Ota bo'lim yopiq bo'lsa, bolasi alohida "ochiq" deb belgilangan bo'lsa ham yopiq.
 * `maydon` turidagi kalitlar bu yerda emas (`MaydonYashirish` jadvali).
 */
export function samaraliRuxsatlar(rol: string, alohida: Map<string, boolean>): string[] {
  const ochiq = new Set<string>()
  for (const r of tekisKatalog) {
    if (r.turi === 'maydon') continue
    const qiymat = r.doimOchiq || rol === 'ADMIN' || (alohida.has(r.kalit) ? alohida.get(r.kalit)! : rolStandartRuxsat(rol, r.kalit))
    if (qiymat && (!r.ota || ochiq.has(r.ota))) ochiq.add(r.kalit)
  }
  return [...ochiq]
}
