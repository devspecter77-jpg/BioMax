// Bog'langan admin hisobidan yashirilishi mumkin bo'lgan maydonlar katalogi.
// Bu fayl serverga bog'liq emas (prisma import qilmaydi) — client komponentlarda
// ham, server route'larda ham xavfsiz ishlatiladi.
//
// "Sotish narxi" va "Miqdori" ATAYLAB bu ro'yxatda YO'Q — POS xuddi shu
// /api/tovarlar javobidan sotuv narxi va qoldiqni o'qiydi; ular yashirilsa,
// mahsulot POS'da 0 so'mga sotilib qolishi yoki "tugagan" deb noto'g'ri
// bloklanishi mumkin edi. Hozircha faqat kelish narxi (foyda) yashiriladi.
export const YASHIRILADIGAN_MAYDONLAR = [
  { kalit: 'kelishNarxi', label: 'Kelish narxi' },
  // Bazada saqlanmaydigan, faqat kelish/sotish narxidan hisoblab
  // ko'rsatiladigan qiymat — shuning uchun serverda emas, mahsulot
  // qo'shish/tahrirlash formasida (client tomonda) yashiriladi.
  { kalit: 'ustamaFoiz', label: 'Ustama foiz' },
] as const
