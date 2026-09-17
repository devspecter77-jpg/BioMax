// API ruxsatlari xaritasi — qaysi so'rov qaysi ruxsatni talab qiladi.
//
// Nega markazda: ruxsatlar ilgari faqat MENYUNI yashirardi. Sahifa yopiq
// bo'lsa ham API ochiq qolardi — xodim brauzerda to'g'ridan-to'g'ri
// `/api/hisobotlar` (foyda) yoki `DELETE /api/mijozlar/...` ni chaqira olardi.
// Yuzdan ortiq marshrutning har biriga tekshiruv yozish o'rniga, bitta jadval
// va `proxy.ts` hammasini birdan qo'riqlaydi. Yangi marshrut qo'shilganda shu
// jadvalga qator qo'shiladi (sinov qoplanmagan marshrutni ko'rsatadi).
//
// Qoidalar:
//   · `kerak` — ro'yxatdagilardan BITTASI bo'lsa yetarli. O'qish so'rovlari
//     odatda bir nechta bo'lim uchun ochiq (masalan tovarlar ro'yxatini Sotuv
//     ham, Ombor ham o'qiydi); yozish so'rovlari aniq amalni talab qiladi.
//   · `ADMIN` — faqat administrator.
//   · Birinchi mos kelgan qoida ishlaydi — aniqroq yo'l yuqorida turadi.
//   · Xaritada yo'q marshrut: faqat tizimga kirganlik tekshiriladi (masalan
//     o'z parolini almashtirish, joylashuvni yuborish).

export type Usul = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface ApiQoida {
  yol: RegExp
  usul: Usul[] | '*'
  kerak: string[] | 'ADMIN'
  /** Rad etilganda xodimga ko'rsatiladigan amal nomi */
  nomi: string
}

const Q = (yol: string, usul: Usul[] | '*', kerak: string[] | 'ADMIN', nomi: string): ApiQoida => ({
  // `:id` — bitta yo'l bo'lagi; oxiridagi `*` — qolgan hamma narsa
  yol: new RegExp('^' + yol.replace(/:[a-zA-Z]+/g, '[^/]+').replace(/\/\*$/, '(?:/.*)?') + '/?$'),
  usul, kerak, nomi,
})

const OQISH: Usul[] = ['GET']
const YOZISH: Usul[] = ['POST', 'PUT', 'PATCH', 'DELETE']

export const API_QOIDALARI: ApiQoida[] = [
  // ── Faqat administrator ──
  Q('/api/ruxsatlar/*', '*', 'ADMIN', 'Ruxsatlarni boshqarish'),
  Q('/api/backup/*', '*', 'ADMIN', 'Zaxira nusxa'),
  Q('/api/foydalanuvchilar/parol', '*', [], 'Parolni almashtirish'), // o'z paroli — hammaga
  Q('/api/foydalanuvchilar/*', '*', 'ADMIN', 'Hisoblarni boshqarish'),
  Q('/api/sozlamalar', YOZISH, 'ADMIN', 'Tizim sozlamalarini o‘zgartirish'),
  Q('/api/telegram/*', YOZISH, 'ADMIN', 'Telegram ulash'),
  Q('/api/xabarlar/*', '*', 'ADMIN', 'Xabarlar jurnali'),
  Q('/api/sheriklar/*', '*', 'ADMIN', 'Sheriklar'),
  Q('/api/sherik-dokonlar/*', '*', 'ADMIN', 'Sherik do‘konlar'),
  Q('/api/sherikdan-olish/*', '*', 'ADMIN', 'Sherikdan olish'),
  Q('/api/sherik-qarzlar/*', '*', 'ADMIN', 'Sherik qarzlari'),
  Q('/api/filiallar/*', '*', 'ADMIN', 'Filiallar'),
  Q('/api/otkazmalar/*', '*', 'ADMIN', 'Omborlararo o‘tkazma'),
  Q('/api/xarita/*', '*', 'ADMIN', 'Xodimlar xaritasi'),
  Q('/api/profil/*', '*', [], 'Profil'), // o'z joylashuvi va ruxsatlari — hammaga

  // ── Bosh sahifa va hisobotlar ──
  Q('/api/hisobotlar/export', OQISH, ['hisobotlar.export'], 'Hisobotni eksport qilish'),
  Q('/api/hisobotlar/sotuv/*', OQISH, ['hisobotlar.sotuv'], 'Sotuv hisoboti'),
  Q('/api/hisobotlar/soatlar', OQISH, ['hisobotlar.sotuv'], 'Sotuv hisoboti'),
  Q('/api/hisobotlar/kassirlar', OQISH, ['hisobotlar.sotuv'], 'Kassirlar hisoboti'),
  Q('/api/hisobotlar/abc', OQISH, ['hisobotlar.tovarlar'], 'Tovarlar hisoboti'),
  Q('/api/hisobotlar/dead-stock', OQISH, ['hisobotlar.tovarlar'], 'Tovarlar hisoboti'),
  Q('/api/hisobotlar/tovarlar/*', OQISH, ['hisobotlar.tovarlar'], 'Tovarlar hisoboti'),
  Q('/api/hisobotlar/ombor', OQISH, ['hisobotlar.ombor'], 'Ombor hisoboti'),
  Q('/api/hisobotlar/mijozlar', OQISH, ['hisobotlar.mijozlar'], 'Mijozlar hisoboti'),
  Q('/api/hisobotlar/nasiya-aging', OQISH, ['hisobotlar.nasiya'], 'Nasiya hisoboti'),
  Q('/api/hisobotlar/nasiya/*', OQISH, ['hisobotlar.nasiya'], 'Nasiya hisoboti'),
  Q('/api/hisobotlar/xaridlar/*', OQISH, ['hisobotlar.xaridlar'], 'Xaridlar hisoboti'),
  Q('/api/hisobotlar/moliya/*', OQISH, 'ADMIN', 'Foyda va zarar hisoboti'),
  Q('/api/hisobotlar', OQISH, ['hisobotlar.umumiy', 'bosh.statistika'], 'Savdo ko‘rsatkichlari'),
  Q('/api/hisobotlar/*', '*', 'ADMIN', 'Hisobot'), // yangi hisobot qo'shilsa — avval xaritaga
  Q('/api/sotuvlar/analitika', OQISH, ['hisobotlar.sotuv', 'hisobotlar.umumiy'], 'Sotuv tahlili'),

  // ── Sotuv ──
  Q('/api/sotuvlar/export', OQISH, ['xaridlar.export'], 'Sotuvlarni eksport qilish'),
  Q('/api/sotuvlar/:id/chek-yuborish', ['POST'], ['sotuv', 'xaridlar', 'mijozlar'], 'Chekni yuborish'),
  Q('/api/sotuvlar', ['POST'], ['sotuv'], 'Sotuv qilish'),
  Q('/api/sotuvlar/*', OQISH, ['sotuv', 'xaridlar', 'mijozlar'], 'Sotuvlarni ko‘rish'),
  Q('/api/qaytarish', ['POST'], ['sotuv.qaytarish'], 'Qaytarish qabul qilish'),
  Q('/api/qaytarish/*', OQISH, ['sotuv', 'xaridlar'], 'Qaytarishlarni ko‘rish'),
  Q('/api/buyurtmalar/*', YOZISH, ['sotuv.saqlash'], 'Savatni saqlash'),
  Q('/api/buyurtmalar/*', OQISH, ['sotuv'], 'Saqlangan savatlar'),
  Q('/api/kurs', ['PUT'], ['tovarlar', 'sotuv'], 'Valyuta kursini yangilash'),

  // ── Tovarlar, kategoriyalar, omborlar ──
  Q('/api/tovarlar/import', '*', ['tovarlar.import'], 'Tovarlarni import qilish'),
  Q('/api/tovarlar/export', '*', ['tovarlar.export'], 'Tovarlarni eksport qilish'),
  Q('/api/tovarlar/keyingi-kod', OQISH, ['tovarlar.qoshish', 'tovarlar.tahrirlash'], 'Shtrix-kod yaratish'),
  Q('/api/tovarlar/qr', ['POST'], ['tovarlar', 'ombor', 'omborlar'], 'QR kod chop etish'),
  Q('/api/tovarlar', ['POST'], ['tovarlar.qoshish'], 'Tovar qo‘shish'),
  Q('/api/tovarlar/:id', ['PUT', 'PATCH'], ['tovarlar.tahrirlash'], 'Tovarni tahrirlash'),
  Q('/api/tovarlar/:id', ['DELETE'], ['tovarlar.ochirish'], 'Tovarni o‘chirish'),
  Q('/api/tovarlar/*', OQISH, ['tovarlar', 'sotuv', 'ombor', 'omborlar', 'onlayn-vitrina', 'namuna-tovar.berish'], 'Tovarlarni ko‘rish'),
  Q('/api/kategoriyalar/*', YOZISH, ['omborlar.boshqarish', 'tovarlar.qoshish', 'tovarlar.tahrirlash'], 'Kategoriyani o‘zgartirish'),
  Q('/api/kategoriyalar/*', OQISH, ['tovarlar', 'sotuv', 'ombor', 'omborlar'], 'Kategoriyalarni ko‘rish'),
  Q('/api/omborlar/*', YOZISH, ['omborlar.boshqarish'], 'Omborni o‘zgartirish'),
  Q('/api/omborlar/*', OQISH, ['omborlar', 'ombor', 'tovarlar', 'sotuv'], 'Omborlarni ko‘rish'),

  // ── Ombor harakati ──
  Q('/api/ombor/harakat', ['POST'], ['ombor.kirim', 'ombor.chiqim'], 'Ombor harakati'), // turi marshrutda aniqlashtiriladi
  Q('/api/ombor/ommaviy', ['POST'], ['ombor.kirim'], 'Ommaviy kirim'),
  Q('/api/ombor/otkazma', ['POST'], ['ombor.otkazma'], 'Ombordan do‘konga o‘tkazish'),
  Q('/api/ombor/sozlash', ['POST'], ['ombor.sozlash'], 'Qoldiqni to‘g‘rilash'),
  Q('/api/ombor/*', OQISH, ['ombor', 'omborlar', 'tovarlar'], 'Ombor qoldig‘ini ko‘rish'),
  Q('/api/kunlik-hisobot/yuborish', ['POST'], ['kunlik-hisobot.sozlama'], 'Kunlik hisobotni yuborish'),
  Q('/api/kunlik-hisobot', ['PUT'], ['kunlik-hisobot.sozlama'], 'Kunlik hisobot sozlamasi'),
  Q('/api/kunlik-hisobot/*', OQISH, ['kunlik-hisobot'], 'Kunlik hisobot'),

  // ── Mijozlar va nasiya ──
  Q('/api/mijozlar/import', '*', ['mijozlar.import'], 'Mijozlarni import qilish'),
  Q('/api/mijozlar/export', '*', ['mijozlar.export'], 'Mijozlarni eksport qilish'),
  // Kassada yangi mijoz ham qo'shiladi — Sotuv bo'limi ham yetarli
  Q('/api/mijozlar', ['POST'], ['mijozlar.qoshish', 'sotuv'], 'Mijoz qo‘shish'),
  Q('/api/mijozlar/:id', ['PUT', 'PATCH'], ['mijozlar.tahrirlash'], 'Mijozni tahrirlash'),
  Q('/api/mijozlar/:id', ['DELETE'], ['mijozlar.ochirish'], 'Mijozni o‘chirish'),
  Q('/api/mijozlar/*', OQISH, ['mijozlar', 'sotuv', 'nasiyalar', 'ballar'], 'Mijozlarni ko‘rish'),
  Q('/api/nasiyalar/import', '*', ['nasiyalar.import'], 'Nasiyalarni import qilish'),
  Q('/api/nasiyalar/export', '*', ['nasiyalar.export'], 'Nasiyalarni eksport qilish'),
  Q('/api/nasiyalar/:id/tolov', ['POST'], ['nasiyalar.tolov'], 'Nasiya to‘lovini qabul qilish'),
  Q('/api/nasiyalar/:id/qarz', ['POST'], ['nasiyalar.qarz'], 'Qarz qo‘shish'),
  Q('/api/nasiyalar', ['POST'], ['nasiyalar.qarz'], 'Nasiya yaratish'),
  Q('/api/nasiyalar/:id', ['DELETE'], ['nasiyalar.ochirish'], 'Nasiyani o‘chirish'),
  Q('/api/nasiyalar/:id', ['PATCH', 'PUT'], ['nasiyalar.qarz'], 'Nasiyani o‘zgartirish'),
  Q('/api/nasiyalar/*', OQISH, ['nasiyalar', 'mijozlar'], 'Nasiyalarni ko‘rish'),
  Q('/api/dokon-qarz/*', YOZISH, ['nasiyalar.xarajat'], 'Do‘kon qarzini yozish'),
  Q('/api/dokon-qarz/*', OQISH, ['nasiyalar'], 'Do‘kon qarzlari'),
  Q('/api/xarajatlar/*', YOZISH, ['nasiyalar.xarajat'], 'Xarajat yozish'),
  Q('/api/xarajatlar/*', OQISH, ['nasiyalar', 'tolovlar'], 'Xarajatlarni ko‘rish'),
  Q('/api/sodiqlik/qolda', '*', ['ballar.qolda'], 'Qo‘lda ball berish'),
  Q('/api/sodiqlik/sozlamalar', YOZISH, ['ballar.sozlama'], 'Sodiqlik sozlamalari'),
  Q('/api/sodiqlik/*', OQISH, ['ballar', 'sotuv', 'mijozlar'], 'Ballarni ko‘rish'),

  // ── Ta'minot, to'lovlar, xodimlar ──
  Q('/api/taminotchilar/:id/qarz', YOZISH, ['taminotchilar.qarz'], 'Ta’minotchi qarzini yozish'),
  Q('/api/taminotchilar/:id/sorov', ['POST'], ['taminotchilar.sorov'], 'Buyurtma so‘rovi'),
  Q('/api/taminotchi-sorov/*', '*', ['taminotchilar.sorov'], 'Buyurtma so‘rovi'),
  Q('/api/taminotchilar', ['POST'], ['taminotchilar.qoshish'], 'Ta’minotchi qo‘shish'),
  Q('/api/taminotchilar/:id', ['PUT', 'PATCH'], ['taminotchilar.tahrirlash'], 'Ta’minotchini tahrirlash'),
  Q('/api/taminotchilar/:id', ['DELETE'], ['taminotchilar.ochirish'], 'Ta’minotchini o‘chirish'),
  Q('/api/taminotchilar/*', OQISH, ['taminotchilar', 'tovarlar', 'ombor', 'omborlar'], 'Ta’minotchilarni ko‘rish'),
  Q('/api/xaridlar/*', YOZISH, ['taminotchilar.qarz'], 'Ta’minotchidan xarid yozish'),
  Q('/api/xaridlar/*', OQISH, ['taminotchilar', 'hisobotlar.xaridlar'], 'Ta’minotchidan xaridlar'),
  Q('/api/tolovlar/*', '*', ['tolovlar'], 'To‘lovlar'),
  Q('/api/xodimlar/:id/tolov', '*', ['xodimlar.oylik'], 'Oylik va bonus'),
  Q('/api/xodimlar/:id/mulk/*', YOZISH, ['xodimlar.mulk'], 'Biriktirilgan mulkni boshqarish'),
  Q('/api/xodimlar/:id/mulk/*', OQISH, ['xodimlar'], 'Biriktirilgan mulk'),
  Q('/api/xodimlar/:id/sotuvlar', OQISH, ['xodimlar.sotuvlar'], 'Xodim sotuvlari'),
  Q('/api/xodimlar/*', YOZISH, ['xodimlar.qoshish'], 'Xodimni o‘zgartirish'),
  Q('/api/xodimlar/*', OQISH, ['xodimlar', 'nasiyalar.xarajat'], 'Xodimlarni ko‘rish'),

  // ── Onlayn do'kon ──
  Q('/api/onlayn-buyurtmalar/sozlama', YOZISH, 'ADMIN', 'Sayt sozlamalari'),
  Q('/api/onlayn-buyurtmalar/:raqam/nuqta', ['POST'], ['onlayn-buyurtmalar.boshqarish'], 'Yetkazish nuqtasini belgilash'),
  // BEKOR va dostavchik yo'li marshrutda aniqlashtiriladi
  Q('/api/onlayn-buyurtmalar/:raqam/holat', ['POST'], ['onlayn-buyurtmalar.boshqarish', 'onlayn-buyurtmalar.bekor', 'onlayn-buyurtmalar.yetkazish'], 'Buyurtma holatini o‘zgartirish'),
  Q('/api/onlayn-buyurtmalar/:raqam/yetkazish', ['POST'], ['onlayn-buyurtmalar.yetkazish'], 'Yetkazishni belgilash'),
  Q('/api/onlayn-buyurtmalar/:raqam/dostavchik', ['POST'], ['onlayn-buyurtmalar.kuryer'], 'Dostavchik biriktirish'),
  Q('/api/onlayn-buyurtmalar/dostavchiklar', OQISH, ['onlayn-buyurtmalar.kuryer'], 'Dostavchiklar ro‘yxati'),
  Q('/api/onlayn-buyurtmalar/*', OQISH, ['onlayn-buyurtmalar'], 'Onlayn buyurtmalar'),
  Q('/api/namuna-tovar/dostavchiklar/:id/namuna', ['POST'], ['namuna-tovar.berish'], 'Namuna berish'),
  Q('/api/namuna-tovar/namunalar/*', ['POST'], ['namuna-tovar.berish'], 'Namunani qaytib olish yoki o‘chirish'),
  Q('/api/namuna-tovar/dostavchiklar/*', YOZISH, ['namuna-tovar.dostavchik'], 'Dostavchikni o‘zgartirish'),
  Q('/api/namuna-tovar/*', OQISH, ['namuna-tovar'], 'Namuna tovar'),
  Q('/api/onlayn-mijozlar/:id/manzil/:manzilId', ['POST'], ['mijozlar.tahrirlash'], 'Mijoz manziliga nuqta qo‘yish'),
  Q('/api/onlayn-mijozlar/*', OQISH, ['mijozlar.onlayn'], 'Onlayn do‘kon mijozlari'),
  Q('/api/onlayn-vitrina/:id/aksiya', '*', 'ADMIN', 'Aksiya belgilash'),
  Q('/api/onlayn-vitrina/*', YOZISH, ['onlayn-vitrina.tahrirlash'], 'Kartochkani tahrirlash'),
  Q('/api/onlayn-vitrina/*', OQISH, ['onlayn-vitrina'], 'Onlayn vitrina'),
]

/**
 * So'rov uchun qoida. `null` — xaritada yo'q (faqat tizimga kirganlik yetarli)
 * yoki proxy tekshirmaydigan marshrut (imzo/cron bilan himoyalangan).
 */
export function apiQoidasi(yol: string, usul: string): ApiQoida | null {
  const u = usul.toUpperCase() as Usul
  for (const q of API_QOIDALARI) {
    if ((q.usul === '*' || q.usul.includes(u)) && q.yol.test(yol)) return q
  }
  return null
}

/** Qoida bo'yicha ruxsat: `ruxsatlar === null` — administrator. */
export function apiRuxsatBormi(q: ApiQoida | null, rol: string | undefined, ruxsatlar: string[] | null | undefined): boolean {
  if (!q) return true
  if (rol === 'ADMIN') return true
  if (q.kerak === 'ADMIN') return false
  if (q.kerak.length === 0) return true
  const r = ruxsatlar ?? []
  return q.kerak.some(k => r.includes(k))
}
