// O'zbekiston ma'muriy-hududiy bo'linishi — viloyatlar va ularning
// tuman/shaharlari. Mijoz kartochkasida hududni ro'yxatdan tanlash uchun.
//
// Ro'yxat MAJBURIY EMAS: mijozlar sahifasidagi maydonlar erkin matnni ham
// qabul qiladi (masalan qishloq nomi yoki chet el manzili) — ro'yxat faqat
// tez va bir xil yozilishini ta'minlaydigan yordamchi. Shu sababli hech
// qayerda enum/foreign key qilinmagan, oddiy matn ustuni.

export const VILOYATLAR = [
  'Toshkent shahri',
  'Toshkent viloyati',
  'Andijon viloyati',
  'Buxoro viloyati',
  "Farg'ona viloyati",
  'Jizzax viloyati',
  'Xorazm viloyati',
  'Namangan viloyati',
  'Navoiy viloyati',
  'Qashqadaryo viloyati',
  'Qoraqalpog‘iston Respublikasi',
  'Samarqand viloyati',
  'Sirdaryo viloyati',
  'Surxondaryo viloyati',
] as const

export type Viloyat = (typeof VILOYATLAR)[number]

export const TUMANLAR: Record<string, string[]> = {
  'Toshkent shahri': [
    'Bektemir', 'Chilonzor', 'Mirobod', 'Mirzo Ulug‘bek', 'Olmazor',
    'Sergeli', 'Shayxontohur', 'Uchtepa', 'Yakkasaroy', 'Yashnobod',
    'Yunusobod', 'Yangihayot',
  ],
  'Toshkent viloyati': [
    'Bekobod', 'Bo‘ka', 'Bo‘stonliq', 'Chinoz', 'Ohangaron',
    'Oqqo‘rg‘on', 'Parkent', 'Piskent', 'Quyichirchiq', 'Yangiyo‘l',
    'O‘rtachirchiq', 'Yuqorichirchiq', 'Zangiota', 'Qibray',
    'Nurafshon shahri', 'Angren shahri', 'Bekobod shahri', 'Chirchiq shahri',
    'Olmaliq shahri', 'Yangiyo‘l shahri',
  ],
  'Andijon viloyati': [
    'Andijon shahri', 'Xonobod shahri', 'Andijon', 'Asaka', 'Baliqchi',
    'Bo‘z', 'Buloqboshi', 'Izboskan', 'Jalaquduq', 'Xo‘jaobod',
    'Qo‘rg‘ontepa', 'Marhamat', 'Oltinko‘l', 'Paxtaobod',
    'Shahrixon', 'Ulug‘nor',
  ],
  'Buxoro viloyati': [
    'Buxoro shahri', 'Kogon shahri', 'Buxoro', 'G‘ijduvon', 'Jondor',
    'Kogon', 'Olot', 'Peshku', 'Qorako‘l', 'Qorovulbozor',
    'Romitan', 'Shofirkon', 'Vobkent',
  ],
  "Farg'ona viloyati": [
    'Farg‘ona shahri', 'Marg‘ilon shahri', 'Qo‘qon shahri',
    'Quvasoy shahri', 'Oltiariq', 'Bag‘dod', 'Beshariq', 'Buvayda',
    'Dang‘ara', 'Farg‘ona', 'Furqat', 'Qo‘shtepa', 'Quva',
    'Rishton', 'So‘x', 'Toshloq', 'Uchko‘prik', 'O‘zbekiston',
    'Yozyovon',
  ],
  'Jizzax viloyati': [
    'Jizzax shahri', 'Arnasoy', 'Baxmal', 'Do‘stlik', 'Forish',
    'G‘allaorol', 'Sharof Rashidov', 'Mirzacho‘l', 'Paxtakor',
    'Yangiobod', 'Zarbdor', 'Zomin', 'Zafarobod',
  ],
  'Xorazm viloyati': [
    'Urganch shahri', 'Xiva shahri', 'Bog‘ot', 'Gurlan', 'Xonqa',
    'Hazorasp', 'Xiva', 'Qo‘shko‘pir', 'Shovot', 'Urganch',
    'Yangiariq', 'Yangibozor', 'Tuproqqal‘a',
  ],
  'Namangan viloyati': [
    'Namangan shahri', 'Chortoq', 'Chust', 'Kosonsoy', 'Mingbuloq',
    'Namangan', 'Norin', 'Pop', 'To‘raqo‘rg‘on', 'Uchqo‘rg‘on',
    'Uychi', 'Yangiqo‘rg‘on', 'Davlatobod',
  ],
  'Navoiy viloyati': [
    'Navoiy shahri', 'Zarafshon shahri', 'G‘ozg‘on', 'Karmana',
    'Konimex', 'Navbahor', 'Nurota', 'Qiziltepa', 'Tomdi', 'Uchquduq',
    'Xatirchi',
  ],
  'Qashqadaryo viloyati': [
    'Qarshi shahri', 'Shahrisabz shahri', 'Chiroqchi', 'Dehqonobod',
    'G‘uzor', 'Kasbi', 'Kitob', 'Koson', 'Mirishkor', 'Muborak',
    'Nishon', 'Qamashi', 'Qarshi', 'Shahrisabz', 'Yakkabog‘',
  ],
  'Qoraqalpog‘iston Respublikasi': [
    'Nukus shahri', 'Amudaryo', 'Beruniy', 'Chimboy', 'Ellikqal‘a',
    'Kegeyli', 'Mo‘ynoq', 'Nukus', 'Qanliko‘l', 'Qo‘ng‘irot',
    'Qorao‘zak', 'Shumanay', 'Taxtako‘pir', 'To‘rtko‘l',
    'Xo‘jayli', 'Taxiatosh',
  ],
  'Samarqand viloyati': [
    'Samarqand shahri', 'Kattaqo‘rg‘on shahri', 'Bulung‘ur',
    'Ishtixon', 'Jomboy', 'Kattaqo‘rg‘on', 'Narpay', 'Nurobod',
    'Oqdaryo', 'Past Darg‘om', 'Payariq', 'Paxtachi', 'Qo‘shrabot',
    'Samarqand', 'Toyloq', 'Urgut',
  ],
  'Sirdaryo viloyati': [
    'Guliston shahri', 'Shirin shahri', 'Yangiyer shahri', 'Boyovut',
    'Guliston', 'Mirzaobod', 'Oqoltin', 'Sardoba', 'Sayxunobod',
    'Sirdaryo', 'Xovos',
  ],
  'Surxondaryo viloyati': [
    'Termiz shahri', 'Angor', 'Bandixon', 'Boysun', 'Denov', 'Jarqo‘rg‘on',
    'Muzrabot', 'Oltinsoy', 'Qiziriq', 'Qumqo‘rg‘on', 'Sariosiyo',
    'Sherobod', 'Sho‘rchi', 'Termiz', 'Uzun',
  ],
}

/** Tanlangan viloyatning tumanlari. Viloyat tanlanmagan yoki ro'yxatda
 *  bo'lmagan (qo'lda yozilgan) bo'lsa — bo'sh ro'yxat, ya'ni foydalanuvchi
 *  tumanni ham qo'lda yozadi. */
export function viloyatTumanlari(viloyat: string | null | undefined): string[] {
  if (!viloyat) return []
  return TUMANLAR[viloyat] ?? []
}

/** Viloyat + tuman + manzildan bitta o'qiladigan satr yasaydi.
 *  Bo'sh qismlar tushib qoladi, hech qachon ", ," kabi natija bermaydi. */
export function toliqManzil(m: {
  viloyat?: string | null
  tuman?: string | null
  manzil?: string | null
}): string {
  return [m.viloyat, m.tuman, m.manzil].filter(Boolean).join(', ')
}
