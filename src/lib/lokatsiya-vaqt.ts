// Xodim joylashuvining yangiligi — sof mantiq. Xarita bo'limi va xodim oynasi bir xil qoidada.

export type Yangilik = 'jonli' | 'yaqin' | 'eski'

/** Necha daqiqadan keyin nuqta "jonli" bo'lmay qoladi. */
export const JONLI_DAQ = 3
export const YAQIN_DAQ = 20

export function yangilikAniqla(yangilangan: string | Date | null | undefined, hozir: number = Date.now()): Yangilik {
  if (!yangilangan) return 'eski'
  const daq = (hozir - new Date(yangilangan).getTime()) / 60_000
  if (daq <= JONLI_DAQ) return 'jonli'
  if (daq <= YAQIN_DAQ) return 'yaqin'
  return 'eski'
}

export function vaqtMatni(yangilangan: string | Date | null | undefined, hozir: number = Date.now()): string {
  if (!yangilangan) return "Joylashuv yo'q"
  const daq = Math.max(0, Math.round((hozir - new Date(yangilangan).getTime()) / 60_000))
  if (daq < 1) return 'Hozir'
  if (daq < 60) return `${daq} daqiqa oldin`
  const soat = Math.round(daq / 60)
  if (soat < 24) return `${soat} soat oldin`
  return `${Math.round(soat / 24)} kun oldin`
}
