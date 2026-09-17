export type Rol = 'ADMIN' | 'KASSIR' | 'OMBORCHI' | 'SOTUVCHI' | 'DOSTAVCHIK'
export type Birlik = 'DONA' | 'KG' | 'LITR' | 'METR' | 'PACHKA' | 'QUTI'
export type TovarHolati = 'FAOL' | 'ARXIVLANGAN'
export type HarakatTuri = 'KIRIM' | 'CHIQIM' | 'QAYTARISH' | 'YOQOTISH' | 'OTKAZMA' | 'OTKAZMA_CHIQIM' | 'OTKAZMA_KIRIM'
export type { TolovUsuliKalit as TolovUsuli } from '@/lib/tolov-usullari'
export type SotuvHolati = 'YAKUNLANGAN' | 'BEKOR_QILINGAN'
export type NasiyaHolati = 'OCHIQ' | 'YOPILGAN' | 'MUDDATI_OTGAN'
export type XarajatKategoriya = 'IJARA' | 'MAOSH' | 'TRANSPORT' | 'KOMMUNAL' | 'BOSHQA'

export interface SavatItem {
  tovarId: string
  nomi: string
  birlikNarxi: number
  miqdor: number
  birlik: Birlik
  chegirma: number
  jami: number
  mavjudQoldiq: number
}
