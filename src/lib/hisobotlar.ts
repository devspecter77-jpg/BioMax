export type ReportTur = 'kunlik' | 'haftalik' | 'oylik' | 'yillik' | 'maxsus'

/**
 * Sana oraliqini aniqlash: tur (preset) va custom dan/gacha dan.
 * Oldingi davr ham hisoblanadi (taqqoslash uchun).
 */
export function getReportDateRange(
  tur: ReportTur,
  dan?: string,
  gacha?: string,
): { dan: Date; gacha: Date } {
  const bugun = new Date()
  bugun.setHours(0, 0, 0, 0)

  let danSana: Date
  let gachaSana: Date

  if (tur === 'maxsus' && dan && gacha) {
    danSana = new Date(dan)
    gachaSana = new Date(gacha)
    gachaSana.setHours(23, 59, 59, 999)
  } else if (tur === 'kunlik') {
    danSana = new Date(bugun)
    gachaSana = new Date(bugun)
    gachaSana.setDate(gachaSana.getDate() + 1)
  } else if (tur === 'haftalik') {
    danSana = new Date(bugun)
    danSana.setDate(danSana.getDate() - 7)
    gachaSana = new Date(bugun)
    gachaSana.setDate(gachaSana.getDate() + 1)
  } else if (tur === 'oylik') {
    danSana = new Date(bugun)
    danSana.setDate(1)
    gachaSana = new Date(bugun)
    gachaSana.setDate(gachaSana.getDate() + 1)
  } else if (tur === 'yillik') {
    danSana = new Date(bugun.getFullYear(), 0, 1)
    gachaSana = new Date(bugun)
    gachaSana.setDate(gachaSana.getDate() + 1)
  } else {
    // fallback: bugun
    danSana = new Date(bugun)
    gachaSana = new Date(bugun)
    gachaSana.setDate(gachaSana.getDate() + 1)
  }

  return {
    dan: danSana,
    gacha: gachaSana,
  }
}

/** Prisma where: sotuv filtering */
export function baseSotuvFilter(
  danSana: Date,
  gachaSana: Date,
  kassirId?: string,
  filialId?: string | null,
) {
  return {
    holati: 'YAKUNLANGAN' as const,
    sana: { gte: danSana, lt: gachaSana },
    tolovUsuli: { not: 'SHERIK' as const },
    ...(kassirId ? { kassirId } : {}),
    ...(filialId ? { filialId } : {}),
  }
}

/** Aging bucket: muddat bugundan necha kun oldin. */
export type AgingBucket = 'kechikmagan' | 'b_0_30' | 'b_31_60' | 'b_61_90' | 'b_90_plus'

export function agingBucket(muddat: Date | null, bugun: Date): AgingBucket {
  if (!muddat) return 'b_0_30' // muddat yo'q, 0-30 bucket'ga
  const ms = bugun.getTime() - muddat.getTime()
  const kun = Math.floor(ms / (1000 * 60 * 60 * 24))
  if (kun < 0) return 'kechikmagan'
  if (kun <= 30) return 'b_0_30'
  if (kun <= 60) return 'b_31_60'
  if (kun <= 90) return 'b_61_90'
  return 'b_90_plus'
}
