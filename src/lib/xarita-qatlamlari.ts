// Xarita ko'rinishlari (tayl qatlamlari) — sof ma'lumot, bazasiz.
//
// Hammasi API KALITSIZ ishlaydi va bepul. Kalit talab qiladiganlar
// (Google, Mapbox, Bing, Yandex) ataylab kiritilmadi: ular hisob ochish,
// to'lov kartasi va litsenziya shartlarini talab qiladi. Kerak bo'lsa
// shu ro'yxatga qo'shish uchun faqat bitta yozuv yetadi.

export type QatlamKaliti = 'oddiy' | 'sputnik' | 'gibrid' | 'relyef' | 'tungi'

export interface XaritaQatlami {
  nomi: string
  /** Qisqa tushuntirish — foydalanuvchi qaysi birini tanlashini bilsin. */
  izoh: string
  url: string
  /** Litsenziya bo'yicha KO'RSATILISHI SHART bo'lgan manba. */
  atribut: string
  maxZoom: number
  /**
   * Provayderda HAQIQATAN tayl mavjud bo'lgan eng katta masshtab.
   * Undan yaqinlashtirilganda Leaflet mavjud taylni kattalashtirib
   * ko'rsatadi — bo'sh kulrang joy chiqmaydi.
   */
  maxNativeZoom?: number
  /** Ustiga qo'yiladigan yozuvlar qatlami (gibrid ko'rinish uchun). */
  ustQatlam?: { url: string; maxZoom: number; maxNativeZoom?: number }
}

/**
 * Esri sputnik tasviri O'zbekistonda hamma joyda z17 gacha bor; z18 esa
 * faqat bir necha yirik shaharda, z19 amalda faqat Toshkentda. Mavjud
 * bo'lmagan taylga so'rov yuborilsa Esri 404 emas, "ma'lumot yo'q"
 * degan KULRANG rasm qaytaradi — shuning uchun xarita xato bermay,
 * shunchaki bo'sh ko'rinardi va "joylashuvni topa olmadi" degan
 * taassurot qolardi.
 *
 * Qiymat o'lchov bilan aniqlangan (Toshkent, Samarqand, Buxoro,
 * Namangan, Andijon, Farg'ona, Nukus, Qarshi, Chirchiq, Gazalkent va
 * qishloq): z17 — barcha sinovda tasvir mavjud bo'lgan yagona daraja.
 * Yaqinlashtirilganda tasvir biroz xiralashadi, lekin YO'QOLMAYDI.
 * Aniqroq ko'rish kerak bo'lsa "Google Xarita" tugmasi bor.
 */
const SPUTNIK_ENG_KATTA = 17

export const XARITA_QATLAMLARI: Record<QatlamKaliti, XaritaQatlami> = {
  oddiy: {
    nomi: 'Oddiy',
    izoh: "Ko'chalar va binolar chizmasi",
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    atribut: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  },
  sputnik: {
    nomi: 'Sputnik',
    izoh: 'Kosmosdan olingan haqiqiy tasvir',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    atribut: 'Tasvir &copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics',
    maxZoom: 20,
    maxNativeZoom: SPUTNIK_ENG_KATTA,
  },
  gibrid: {
    nomi: 'Gibrid',
    izoh: "Sputnik tasviri + ko'cha nomlari",
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    atribut: 'Tasvir &copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics',
    maxZoom: 20,
    maxNativeZoom: SPUTNIK_ENG_KATTA,
    // Yozuvlar shaffof qatlam sifatida ustiga qo'yiladi
    ustQatlam: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      maxZoom: 20,
      maxNativeZoom: SPUTNIK_ENG_KATTA,
    },
  },
  relyef: {
    nomi: 'Relyef',
    izoh: 'Tog’lar va balandliklar',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    atribut: '&copy; <a href="https://opentopomap.org/">OpenTopoMap</a> (CC-BY-SA), &copy; OpenStreetMap',
    maxZoom: 17,
  },
  tungi: {
    nomi: 'Tungi',
    izoh: "Qorong'i rejim uchun sokin ko'rinish",
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    atribut: '&copy; <a href="https://carto.com/">CARTO</a>, &copy; OpenStreetMap',
    maxZoom: 20,
  },
}

export const QATLAM_TARTIBI: QatlamKaliti[] = ['oddiy', 'sputnik', 'gibrid', 'relyef', 'tungi']

const SAQLASH_KALITI = 'xarita_qatlami'

/** Foydalanuvchi oxirgi tanlagan ko'rinish — brauzerda saqlanadi. */
export function saqlanganQatlam(): QatlamKaliti {
  if (typeof window === 'undefined') return 'oddiy'
  try {
    const q = window.localStorage.getItem(SAQLASH_KALITI)
    return q && q in XARITA_QATLAMLARI ? (q as QatlamKaliti) : 'oddiy'
  } catch {
    // Shaxsiy rejimda localStorage taqiqlangan bo'lishi mumkin
    return 'oddiy'
  }
}

export function qatlamniSaqla(kalit: QatlamKaliti): void {
  try {
    window.localStorage.setItem(SAQLASH_KALITI, kalit)
  } catch {
    /* saqlanmasa ham xarita ishlayveradi */
  }
}
