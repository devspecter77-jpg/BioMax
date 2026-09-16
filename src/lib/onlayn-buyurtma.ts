// Onlayn do'kon buyurtmalari — ERP paneli uchun turlar va yorliqlar.
//
// Holat O'TISH QOIDALARI bu yerda YO'Q: ular marketplace'da yashaydi va
// har javobda `keyingiHolatlar` bo'lib keladi. Panel faqat ko'rsatadi —
// qoidani ikki joyda yozib, bir kun ikkalasi farq qilib qolmasin.

export type OnlaynHolat = 'YANGI' | 'TASDIQLANGAN' | 'YIGILMOQDA' | 'YOLDA' | 'BAJARILGAN' | 'BEKOR' | 'QAYTARILGAN'

export interface OnlaynBuyurtma {
  id: string
  raqam: string
  holati: OnlaynHolat
  holatYorligi: string
  yetkazish: 'KURYER' | 'OLIB_KETISH'
  hudud: string | null
  manzilMatni: string | null
  moljal: string | null
  lat: number | null
  lng: number | null
  aloqaTel: string
  aloqaIsm: string | null
  vaqtOraligi: string | null
  yetkazishBoshi: string | null
  tolovUsuli: 'NAQD_YETKAZISHDA' | 'KARTA_YETKAZISHDA' | 'ONLAYN'
  mahsulotSumma: number
  yetkazishNarx: number
  jamiSumma: number
  izoh: string | null
  bekorSababi: string | null
  yaratilgan: string
  yangilangan: string
  qatorlar: { id: string; erpTovarId: string; slug: string | null; nomi: string; birlik: string; birlikNarxi: number; miqdor: number; jami: number }[]
  tarix: { holati: OnlaynHolat; izoh: string | null; kim: string | null; sana: string }[]
  keyingiHolatlar?: OnlaynHolat[]
  /** ERP'dagi izi — faqat panel marshrutlari qo'shadi */
  erp?: {
    sotuv: { id: string; chekRaqami: string; sana: string; holati: string } | null
    rezerv: 'YOQ' | 'FAOL' | 'SOTILDI' | 'BOSHATILDI' | 'MUDDATI_OTGAN'
  }
}

export interface OnlaynRoyxat {
  buyurtmalar: OnlaynBuyurtma[]
  jami: number
  sahifa: number
  sahifaHajmi: number
  sonlar: Partial<Record<OnlaynHolat, number>>
}

export const FAOL_HOLATLAR: OnlaynHolat[] = ['YANGI', 'TASDIQLANGAN', 'YIGILMOQDA', 'YOLDA']

export function holatNomi(h: OnlaynHolat, yetkazish: OnlaynBuyurtma['yetkazish'] = 'KURYER'): string {
  switch (h) {
    case 'YANGI': return 'Yangi'
    case 'TASDIQLANGAN': return 'Tasdiqlangan'
    case 'YIGILMOQDA': return 'Yig‘ilmoqda'
    case 'YOLDA': return yetkazish === 'OLIB_KETISH' ? 'Olib ketishga tayyor' : 'Yo‘lda'
    case 'BAJARILGAN': return yetkazish === 'OLIB_KETISH' ? 'Olib ketildi' : 'Topshirildi'
    case 'BEKOR': return 'Bekor qilingan'
    case 'QAYTARILGAN': return 'Qaytarilgan'
  }
}

/** Tugma matni — xodim nima qilayotganini aniq bilsin. */
export function amalNomi(h: OnlaynHolat, yetkazish: OnlaynBuyurtma['yetkazish']): string {
  switch (h) {
    case 'TASDIQLANGAN': return 'Tasdiqlash'
    case 'YIGILMOQDA': return 'Yig‘ishni boshlash'
    case 'YOLDA': return yetkazish === 'OLIB_KETISH' ? 'Tayyor — mijozga xabar berish' : 'Kuryerga topshirildi'
    case 'BAJARILGAN': return yetkazish === 'OLIB_KETISH' ? 'Mijoz olib ketdi' : 'Topshirildi'
    case 'BEKOR': return 'Bekor qilish'
    case 'QAYTARILGAN': return 'Qaytarildi'
    default: return h
  }
}

export const HOLAT_RANGI: Record<OnlaynHolat, string> = {
  YANGI: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  TASDIQLANGAN: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
  YIGILMOQDA: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  YOLDA: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400',
  BAJARILGAN: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
  BEKOR: 'bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-gray-400',
  QAYTARILGAN: 'bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-gray-400',
}

export function tolovNomi(t: OnlaynBuyurtma['tolovUsuli']): string {
  return t === 'NAQD_YETKAZISHDA' ? 'Naqd (qabul qilganda)' : t === 'KARTA_YETKAZISHDA' ? 'Karta (qabul qilganda)' : 'Onlayn'
}

function som(n: number): string {
  return `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} so‘m`
}

/**
 * Holat o'zgarganda mijozga Telegram xabari. `null` — bu holat uchun xabar
 * yuborilmaydi (masalan "yig'ilmoqda" — mijozni ortiqcha bezovta qilmaymiz).
 */
export function mijozXabari(
  b: Pick<OnlaynBuyurtma, 'raqam' | 'yetkazish' | 'jamiSumma' | 'vaqtOraligi' | 'bekorSababi'>,
  holat: OnlaynHolat,
  o: { dokon: string; dokonManzili: string | null; saytUrl: string | null },
): string | null {
  const havola = o.saytUrl ? `\n\nBatafsil: ${o.saytUrl.replace(/\/$/, '')}/buyurtma/${encodeURIComponent(b.raqam)}` : ''
  const bosh = `${o.dokon} · buyurtma ${b.raqam}\n\n`
  switch (holat) {
    case 'TASDIQLANGAN':
      return `✅ ${bosh}Buyurtmangiz tasdiqlandi.\nJami: ${som(b.jamiSumma)}${b.vaqtOraligi ? `\nVaqt: ${b.vaqtOraligi}` : ''}${havola}`
    case 'YOLDA':
      return b.yetkazish === 'OLIB_KETISH'
        ? `📦 ${bosh}Buyurtmangiz tayyor — do‘kondan olib ketishingiz mumkin.${o.dokonManzili ? `\nManzil: ${o.dokonManzili}` : ''}\nTo‘lov: ${som(b.jamiSumma)}${havola}`
        : `🚚 ${bosh}Buyurtmangiz yo‘lda. Kuryer tez orada yetib boradi.\nTo‘lov: ${som(b.jamiSumma)} — qabul qilganda.${havola}`
    case 'BAJARILGAN':
      return `🙏 ${bosh}Xaridingiz uchun rahmat! Yana kutib qolamiz.`
    case 'BEKOR':
      return `❌ ${bosh}Buyurtmangiz bekor qilindi.${b.bekorSababi ? `\nSabab: ${b.bekorSababi}` : ''}\n\nSavollar bo‘lsa, do‘konga murojaat qiling.`
    default:
      return null
  }
}
