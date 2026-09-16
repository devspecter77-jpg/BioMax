// Onlayn do'kon xaridorlari — ERP "Mijozlar › Onlayn mijozlar" uchun turlar.
//
// Ma'lumot manbai — marketplace (imzolangan `/api/erp/mijozlar` shartnomasi).
// ERP faqat o'z izini qo'shadi: do'kondagi mijoz kartasi va buyurtma cheki.

import type { OnlaynBuyurtma } from './onlayn-buyurtma'

export type OnlaynMijozTartibi = 'yangi' | 'oxirgi' | 'summa'
export type OnlaynMijozFiltri = 'hammasi' | 'buyurtmali' | 'buyurtmasiz'

/** Do'kondagi (ERP) mijoz kartasi — telefon raqami bo'yicha topiladi */
export interface ErpKarta {
  id: string
  ism: string
  sotuvSoni: number
}

export interface OnlaynMijozQatori {
  id: string
  telefon: string
  ism: string | null
  tasdiqlangan: boolean
  faol: boolean
  yaratilgan: string
  buyurtmaSoni: number
  bajarilganSoni: number
  faolSoni: number
  xaridSumma: number
  oxirgiBuyurtma: string | null
  erpKarta?: ErpKarta | null
}

export interface OnlaynMijozRoyxat {
  mijozlar: OnlaynMijozQatori[]
  jami: number
  sahifa: number
  sahifaHajmi: number
  statistika: { jami: number; buyurtmali: number; yangi7: number; faolBuyurtmali: number }
}

export interface OnlaynMijozManzil {
  id: string; nomi: string; viloyat: string | null; tuman: string | null; manzil: string
  moljal: string | null; lat: number | null; lng: number | null; asosiy: boolean
}

export interface OnlaynMijozTafsilot {
  id: string
  telefon: string
  ism: string | null
  tasdiqlangan: boolean
  faol: boolean
  yaratilgan: string
  yangilangan: string
  manzillar: OnlaynMijozManzil[]
  buyurtmalar: OnlaynBuyurtma[]
  jamiBuyurtma: number
  xulosa: {
    buyurtmaSoni: number; bajarilganSoni: number; faolSoni: number; bekorSoni: number
    xaridSumma: number; ortachaChek: number
  }
  erpKarta?: ErpKarta | null
}

/** Marketplace hisob identifikatori (cuid) — boshqa narsani yo'lga qo'ymaslik uchun */
export function mijozIdmi(id: string): boolean {
  return /^[a-z0-9]{10,40}$/i.test(id)
}
