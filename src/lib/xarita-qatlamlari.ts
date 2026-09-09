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
  /** Ustiga qo'yiladigan yozuvlar qatlami (gibrid ko'rinish uchun). */
  ustQatlam?: { url: string; maxZoom: number }
}

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
    maxZoom: 19,
  },
  gibrid: {
    nomi: 'Gibrid',
    izoh: "Sputnik tasviri + ko'cha nomlari",
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    atribut: 'Tasvir &copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics',
    maxZoom: 19,
    // Yozuvlar shaffof qatlam sifatida ustiga qo'yiladi
    ustQatlam: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      maxZoom: 19,
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
