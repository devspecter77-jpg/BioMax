// Foyda hisobi — sof mantiq (bazasiz, testlanadigan).
//
// Foyda = sotilgan narx − tannarx (kelish narxi).
//
// Ikkita nozik joy bor:
//
// 1) VALYUTA. POS mahsulot USD'da narxlangan bo'lsa ham savatga SO'MDA
//    qo'shadi (`sotishNarxiSomda`), ya'ni `SotuvTarkibi.birlikNarxi` va
//    `jami` har doim so'mda. `Tovar.kelishNarxi` esa o'z valyutasida
//    qoladi. Shuning uchun tannarx so'mga o'tkazilishi SHART, aks holda
//    10 dollarlik tovar 10 so'm deb hisoblanib, foyda 100 barobar
//    katta chiqardi.
//
// 2) CHEGIRMA. Qator darajasidagi chegirma `jami` ichida hisobga olingan,
//    sotuv darajasidagi chegirma esa alohida — u ham foydani kamaytiradi.

export interface FoydaQatori {
  miqdor: number
  /** Qator daromadi (so'mda, qator chegirmasi ayrilgan). */
  jami: number
  /** Mahsulotning kelish narxi — o'z valyutasida. */
  kelishNarxi: number | null
  valyuta: string
}

export interface FoydaNatijasi {
  daromad: number
  tannarx: number
  foyda: number
  /** Ustama foiz: foyda / daromad. Daromad nol bo'lsa null. */
  foiz: number | null
}

/** Tannarxni so'mga o'tkazadi. USD bo'lmasa qiymat o'zgarmaydi. */
export function tannarxSomda(kelishNarxi: number, valyuta: string, usdKursi: number): number {
  if (valyuta !== 'USD') return kelishNarxi
  if (!Number.isFinite(usdKursi) || usdKursi <= 0) return kelishNarxi
  return kelishNarxi * usdKursi
}

function foiz(foyda: number, daromad: number): number | null {
  if (!(daromad > 0)) return null
  return Math.round((foyda / daromad) * 1000) / 10
}

/**
 * Bitta sotuvning foydasi.
 *
 * `qaytarilgan` — shu sotuvdan qaytarilgan qatorlar. Qaytarilgan tovar
 * na daromad, na foyda beradi, shuning uchun ikkalasidan ham ayriladi.
 */
export function sotuvFoydasi(params: {
  qatorlar: FoydaQatori[]
  /** Sotuv darajasidagi chegirma (so'm). */
  chegirma?: number
  qaytarilgan?: FoydaQatori[]
  usdKursi: number
}): FoydaNatijasi {
  const { qatorlar, chegirma = 0, qaytarilgan = [], usdKursi } = params

  let daromad = 0
  let tannarx = 0

  for (const q of qatorlar) {
    daromad += q.jami
    // Kelish narxi noma'lum bo'lsa (yashirilgan yoki kiritilmagan) —
    // tannarx nol deb olinmaydi, shunda foyda sun'iy oshib ketardi.
    // Bunday qator hisobga umuman kiritilmaydi; chaqiruvchi buni
    // `toliqEmas` bayrog'i orqali biladi.
    if (q.kelishNarxi === null) {
      daromad -= q.jami
      continue
    }
    tannarx += tannarxSomda(q.kelishNarxi, q.valyuta, usdKursi) * q.miqdor
  }

  for (const q of qaytarilgan) {
    if (q.kelishNarxi === null) continue
    daromad -= q.jami
    tannarx -= tannarxSomda(q.kelishNarxi, q.valyuta, usdKursi) * q.miqdor
  }

  // Sotuv chegirmasi daromadni kamaytiradi (tannarx o'zgarmaydi)
  daromad -= chegirma

  const f = daromad - tannarx
  return {
    daromad: Math.round(daromad),
    tannarx: Math.round(tannarx),
    foyda: Math.round(f),
    foiz: foiz(f, daromad),
  }
}

/** Bir nechta sotuv natijasini qo'shadi. */
export function foydalarniYig(natijalar: FoydaNatijasi[]): FoydaNatijasi {
  let daromad = 0
  let tannarx = 0
  for (const n of natijalar) {
    daromad += n.daromad
    tannarx += n.tannarx
  }
  const f = daromad - tannarx
  return { daromad, tannarx, foyda: f, foiz: foiz(f, daromad) }
}
