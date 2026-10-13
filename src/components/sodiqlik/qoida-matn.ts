// Sodiqlik qoidasini oddiy tilda ko'rsatish — ro'yxat va oyna bir xil matn ishlatadi.

import { formatSum } from '@/lib/utils'
import { formatBall, type SodiqlikQoida } from '@/lib/sodiqlik'

export interface QoidaYozuvi extends SodiqlikQoida {
  izoh: string | null
  tovar: { id: string; nomi: string; tartibRaqami: number | null; birlik: string; holati: string } | null
  kategoriya: { id: string; nomi: string } | null
}

const BIRLIK: Record<string, string> = { DONA: 'dona', KG: 'kg', LITR: 'litr', METR: 'metr', PACHKA: 'pachka', QUTI: 'quti' }

export const birlikMatni = (b: string | null | undefined) => BIRLIK[b ?? ''] ?? 'dona'

/** 1 000 000; 2,5 — kasrli miqdor va foizlar uchun */
export const sonMatni = (n: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 }).format(n)

/** Qoida sharti — "1 000 000 UZS va undan ko'p xarid", "5 dona va undan ko'p olinsa" */
export function qoidaSharti(q: Pick<QoidaYozuvi, 'turi' | 'minSumma' | 'minMiqdor' | 'tovar'>): string {
  if (q.turi === 'CHEK') return q.minSumma > 0 ? `${formatSum(q.minSumma)} va undan ko‘p xarid` : 'Har bir xarid'
  const birlik = q.turi === 'MAHSULOT' ? birlikMatni(q.tovar?.birlik) : 'dona'
  return q.minMiqdor > 1 || (q.minMiqdor > 0 && !Number.isInteger(q.minMiqdor))
    ? `${sonMatni(q.minMiqdor)} ${birlik} va undan ko‘p olinsa`
    : 'Har qanday miqdorda'
}

/** Qoida mukofoti — chiplar uchun qisqa matnlar */
export function qoidaMukofoti(q: Pick<QoidaYozuvi, 'turi' | 'ball' | 'keshbekFoiz' | 'tovar'>): string[] {
  const birlik = q.turi === 'MAHSULOT' ? birlikMatni(q.tovar?.birlik) : 'dona'
  const r: string[] = []
  if (q.ball > 0) r.push(q.turi === 'CHEK' ? `+${formatBall(q.ball)} ball` : `har 1 ${birlik} uchun +${formatBall(q.ball)} ball`)
  if (q.keshbekFoiz > 0) r.push(q.turi === 'CHEK' ? `+${sonMatni(q.keshbekFoiz)}% keshbek` : `summasidan +${sonMatni(q.keshbekFoiz)}% keshbek`)
  return r
}
