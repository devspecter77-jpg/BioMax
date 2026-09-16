// Tashqi xarita xizmatlariga havolalar — koordinata bo'yicha.
//
// Nega kerak: ichki xarita (Esri sputnik) O'zbekistonda z17 dan
// yaqinlashtira olmaydi — undan aniqroq ko'rish kerak bo'lganda
// foydalanuvchi aynan shu nuqtani Google Xaritada ochadi. Google'ning
// O'zbekiston bo'yicha tasviri ancha batafsil.
//
// Hech qanday API kalit kerak emas: bularning hammasi oddiy havola.

/** Koordinata haqiqiy va Yer sharida bo'lishi kerak. */
export function koordinataTogrimi(lat: unknown, lng: unknown): boolean {
  const a = Number(lat)
  const b = Number(lng)
  return Number.isFinite(a) && Number.isFinite(b)
    && a >= -90 && a <= 90 && b >= -180 && b <= 180
    // (0,0) — Atlantika okeanidagi "Null orol". Amalda bu deyarli
    // har doim to'ldirilmagan maydon belgisi, haqiqiy joylashuv emas.
    && !(a === 0 && b === 0)
}

/**
 * Ko'rsatish uchun qisqartirilgan koordinata.
 * 6 xona ≈ 11 sm aniqlik — bundan ortig'i shovqin.
 */
export function koordinataMatni(lat: number, lng: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
}

/** Google Xaritada shu nuqtani qidirish (belgi qo'yilgan holda). */
export function googleXarita(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
}

/** Google Xaritada sputnik ko'rinishida ochish. */
export function googleSputnik(lat: number, lng: number, zoom = 18): string {
  // `@lat,lng,zoomz` + `/data=!3m1!1e3` — sputnik qatlami.
  return `https://www.google.com/maps/@${lat},${lng},${zoom}z/data=!3m1!1e3`
}

/** Joriy joydan shu nuqtagacha yo'nalish. */
export function googleYonalish(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
}

/** Yandex — CIS bo'yicha tasviri ba'zan Google'dan ham aniqroq. */
export function yandexXarita(lat: number, lng: number): string {
  return `https://yandex.uz/maps/?pt=${lng},${lat}&z=17&l=sat`
}

/** Yandex Xaritada nuqta (oddiy xarita qatlami, belgi bilan) — kuryer uchun ko'chalar ko'rinsin. */
export function yandexNuqta(lat: number, lng: number): string {
  return `https://yandex.uz/maps/?pt=${lng},${lat},pm2rdm&z=17`
}

/** Joriy joydan shu nuqtagacha Yandex yo'nalishi (avtomobil). */
export function yandexYonalish(lat: number, lng: number): string {
  return `https://yandex.uz/maps/?rtext=~${lat},${lng}&rtt=auto`
}

/** Yandex Navigator ilovasida marshrut (telefonda ilova o'rnatilgan bo'lsa). */
export function yandexNavigator(lat: number, lng: number): string {
  return `yandexnavi://build_route_on_map?lat_to=${lat}&lon_to=${lng}`
}

/** Manzil matni bo'yicha Google Xaritada qidirish — koordinata bo'lmaganda. */
export function googleQidiruv(matn: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(matn)}`
}

/** Manzil matni bo'yicha Yandex Xaritada qidirish. */
export function yandexQidiruv(matn: string): string {
  return `https://yandex.uz/maps/?text=${encodeURIComponent(matn)}`
}

/**
 * Qidiruv uchun to'liq manzil: qismlar birlashtiriladi, bir-birini takrorlaganlari
 * tashlanadi ("Yunusobod" ham tuman, ham manzil ichida bo'lsa bir marta).
 */
export function manzilQidiruvMatni(qismlar: (string | null | undefined)[], shahar = 'Toshkent'): string {
  const natija: string[] = []
  for (const q of [...qismlar, shahar, 'O‘zbekiston']) {
    const t = String(q ?? '').trim()
    if (!t) continue
    const kichik = t.toLowerCase()
    if (natija.some(n => n.toLowerCase().includes(kichik))) continue
    natija.push(t)
  }
  return natija.join(', ')
}

/** Ko'rsatish uchun manzil: qismlar birlashtiriladi, takrorlanganlari tashlanadi (shahar qo'shilmaydi). */
export function manzilKorinishi(qismlar: (string | null | undefined)[]): string {
  const natija: string[] = []
  for (const q of qismlar) {
    const t = String(q ?? '').trim()
    if (!t) continue
    const kichik = t.toLowerCase()
    // Oldingisi shu qismni o'z ichiga olsa — tashlanadi; shu qism oldingisini o'z ichiga olsa — almashtiriladi
    if (natija.some(n => n.toLowerCase().includes(kichik))) continue
    for (let i = natija.length - 1; i >= 0; i--) if (kichik.includes(natija[i]!.toLowerCase())) natija.splice(i, 1)
    natija.push(t)
  }
  return natija.join(', ')
}

/** O'zbekiston hududi — yetkazish nuqtasi shu chegarada bo'lishi kerak. */
export function uzbekistondami(lat: number, lng: number): boolean {
  return lat >= 37.1 && lat <= 45.6 && lng >= 55.9 && lng <= 73.2
}

/**
 * Kiritilgan havola yoki matndan yetkazish nuqtasi. Yandex havolalarida tartib
 * teskari (lng,lat) bo'lishi mumkin — O'zbekiston chegarasi bo'yicha to'g'rilanadi.
 */
export function yetkazishNuqtasi(matn: string): { lat: number; lng: number } | { xato: string } | null {
  const k = matndanKoordinata(matn)
  if (!k) return null
  if (uzbekistondami(k.lat, k.lng)) return k
  if (uzbekistondami(k.lng, k.lat)) return { lat: k.lng, lng: k.lat }
  return { xato: 'Bu nuqta O‘zbekiston hududida emas' }
}

/**
 * Matndan koordinata ajratib oladi.
 *
 * Amalda foydalanuvchi joyni Google Xaritadan "ulashish" orqali yuboradi
 * yoki koordinatani ko'chirib qo'yadi. Shuning uchun bir nechta ko'rinish
 * qo'llab-quvvatlanadi:
 *   "41.311081, 69.279737"          — oddiy juftlik
 *   "41.311081,69.279737"           — probelsiz
 *   "41,311081 69,279737"           — kasr vergul bilan (rus tili sozlamasi)
 *   "https://maps.google.com/?q=41.31,69.27"
 *   "https://www.google.com/maps/@41.31,69.27,17z"
 *   "https://yandex.uz/maps/?ll=69.27,41.31"   — Yandexda TARTIB TESKARI
 *
 * Topilmasa `null`. Hech qachon xato tashlamaydi — foydalanuvchi yozayotganda
 * har bosishda chaqiriladi.
 */
export function matndanKoordinata(matn: string): { lat: number; lng: number } | null {
  const xom = String(matn ?? '').trim()
  if (!xom) return null

  // Yandex `ll=` da tartib lng,lat — boshqalardan teskari.
  const yandex = xom.match(/[?&]ll=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
  if (yandex) {
    const lng = Number(yandex[1])
    const lat = Number(yandex[2])
    if (koordinataTogrimi(lat, lng)) return { lat, lng }
  }

  // Kasr vergulni nuqtaga aylantiramiz, lekin faqat raqamlar orasidagisini:
  // "41,311081 69,279737" -> "41.311081 69.279737". Ajratuvchi vergul
  // (masalan "41.31, 69.27") probel bilan keladi va tegilmaydi.
  const tayyor = xom.replace(/(\d),(\d)/g, '$1.$2')

  // Birinchi ikkita mos keluvchi son — kenglik va uzunlik.
  const sonlar = tayyor.match(/-?\d+\.\d+|-?\d+/g)
  if (!sonlar) return null
  for (let i = 0; i + 1 < sonlar.length; i++) {
    const lat = Number(sonlar[i])
    const lng = Number(sonlar[i + 1])
    // Kenglik |90| dan oshmaydi — shu shart noto'g'ri juftlikni chetlab o'tadi
    // (masalan havoladagi "17z" masshtab raqami).
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && koordinataTogrimi(lat, lng)) {
      // Butun sonlar juftligi (masalan "1 2") tasodifiy mos kelishi mumkin —
      // kamida bittasi kasr bo'lsin, aks holda ishonchsiz.
      if (sonlar[i].includes('.') || sonlar[i + 1].includes('.')) return { lat, lng }
    }
  }
  return null
}
