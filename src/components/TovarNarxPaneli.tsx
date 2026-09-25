'use client'

import { formatNarx } from '@/lib/utils'

// Mahsulot kartasidagi "Miqdori / Kelish / Sotish / Optom / Bo'lish" paneli.
//
// Ilgari bu uch ustunli grid edi va `tovarlar` hamda `sotuv` sahifalarida
// ikki nusxada yozilgan edi. Muammo: har qiymatga kartaning ~33% i tegardi,
// uzun narx esa ($123,456.00 yoki 1 250 000 UZS) shu enga sig'may qo'shni
// ustunga chiqib ketardi — qiymatlar ustma-ust tushardi. Ustiga-ustak
// "100 dona" tor katakda ikki qatorga bo'linib, kartalar bo'yi har xil
// bo'lib qolardi.
//
// Narxni qirqib ko'rsatish ham yechim emas: karta uchun eng muhim ma'lumot
// aynan narx. Shuning uchun ustun emas, QATOR: yorliq chapda, qiymat o'ngda.
// Qiymatga kartaning deyarli butun eni tegadi, `tabular-nums` bilan raqamlar
// bir-birining tagiga aniq tushadi — kelish va sotish narxini ko'z bilan
// solishtirish oson bo'ladi.

interface Props {
  qoldiq: number | null
  birlik: string
  /** Qoldiq kam — miqdor rangi bilan ogohlantiriladi. */
  kamQoldi?: boolean
  kelishNarxi: number | string | null
  sotishNarxi: number | string | null
  /**
   * Optom va bo'lish narxlari. Kassada narx turi (Chakana/Optom/Bo'lish)
   * tanlanadi — kassir qaysi tugmani bosishdan OLDIN uchala narxni ko'rib
   * turishi kerak, aks holda tanlovni savatga qo'shgandan keyingina
   * bilib olardi.
   *
   * `undefined` — qator umuman chizilmaydi (sahifa bu narxlarni
   * ko'rsatmaydi). `null` — narx kiritilmagan yoki foydalanuvchidan
   * yashirilgan: qator turadi, qiymat "—" bo'ladi. Ikkisi ataylab
   * farqlanadi: kartalar bo'yi bir xil qolsin, aks holda optom narxi
   * bor va yo'q mahsulotlar tarh qatorida notekis turardi.
   */
  optomNarxi?: number | string | null
  bolishNarxi?: number | string | null
  valyuta?: string
  /** Sotish narxi rangi: katalogda yashil, kassada brend rangi. */
  sotishRangi?: string
  /** Kassa kartasi biroz kattaroq matn ishlatadi. */
  olcham?: 'ixcham' | 'keng'
  /**
   * Miqdor qatorini ko'rsatish. Kassada qoldiq allaqachon rasm ustidagi
   * nishonda turadi — panelda takrorlash kartani uzaytiradi va bir xil
   * raqamni ikki joyda ko'rsatadi.
   */
  miqdorKorsatilsinmi?: boolean
}

function narxMatni(narx: number | string | null | undefined, valyuta?: string) {
  // `null` — narx yashirilgan yoki kiritilmagan. Nolga aylantirmaymiz:
  // "0 so'm" yolg'on ma'lumot bo'lardi.
  if (narx === null || narx === undefined) return '—'
  return formatNarx(narx, valyuta)
}

function Qator({ yorliq, qiymat, sarlavha, qiymatCls, olcham }: {
  yorliq: string
  qiymat: React.ReactNode
  /** `title` — juda uzun qiymat qirqilsa to'liq holi sichqoncha ostida ko'rinadi. */
  sarlavha: string
  qiymatCls: string
  olcham: 'ixcham' | 'keng'
}) {
  const matn = olcham === 'keng' ? 'text-sm' : 'text-xs sm:text-sm'
  return (
    // `flex-wrap`: qiymat yorliq yoniga sig'masa O'Z QATORIGA tushadi va
    // panelning butun enini oladi — narx qirqilib qolmasin. `ml-auto`
    // yangi qatorda ham o'ngga tekislaydi. `max-w-full` + `truncate` —
    // oxirgi to'siq: qiymat yolg'iz o'zi ham sig'masagina qirqiladi.
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 px-3 py-1.5">
      <span className="shrink-0 text-gray-500 dark:text-gray-400 text-[11px]">{yorliq}</span>
      <span
        title={sarlavha}
        className={`ml-auto max-w-full truncate text-right tabular-nums ${matn} ${qiymatCls}`}
      >
        {qiymat}
      </span>
    </div>
  )
}

export default function TovarNarxPaneli({
  qoldiq, birlik, kamQoldi = false,
  kelishNarxi, sotishNarxi, optomNarxi, bolishNarxi, valyuta,
  sotishRangi = 'text-green-600 dark:text-green-500',
  olcham = 'ixcham',
  miqdorKorsatilsinmi = true,
}: Props) {
  const birlikMatni = birlik.toLowerCase()
  const kelish = narxMatni(kelishNarxi, valyuta)
  const sotish = narxMatni(sotishNarxi, valyuta)
  const optom = narxMatni(optomNarxi, valyuta)
  const bolish = narxMatni(bolishNarxi, valyuta)

  return (
    <div className="mt-2.5 sm:mt-3 bg-gray-50 dark:bg-neutral-800/60 rounded-xl py-1 divide-y divide-gray-200/70 dark:divide-neutral-700/70">
      {miqdorKorsatilsinmi && (
      <Qator
        yorliq="Miqdori"
        olcham={olcham}
        sarlavha={qoldiq === null ? '—' : `${qoldiq} ${birlikMatni}`}
        qiymatCls={`font-bold ${kamQoldi ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}
        qiymat={qoldiq === null ? '—' : (
          <>
            {qoldiq}{' '}
            <span className="font-normal text-gray-500 dark:text-gray-400 text-[11px]">{birlikMatni}</span>
          </>
        )}
      />
      )}
      <Qator
        yorliq="Kelish"
        olcham={olcham}
        sarlavha={kelish}
        qiymat={kelish}
        qiymatCls="text-gray-700 dark:text-gray-300 font-medium"
      />
      <Qator
        yorliq="Sotish"
        olcham={olcham}
        sarlavha={sotish}
        qiymat={sotish}
        qiymatCls={`font-semibold ${sotishRangi}`}
      />
      {/* Optom va bo'lish — asosiy sotish narxidan pastda va betaraf rangda.
          Uchalasi bir xil urg'uda bo'lsa karta "uch narxli" bo'lib chalkashtirardi:
          standart narx AYNAN sotish narxi, qolgan ikkitasi esa maxsus holat. */}
      {optomNarxi !== undefined && (
        <Qator
          yorliq="Optom"
          olcham={olcham}
          sarlavha={optom}
          qiymat={optom}
          qiymatCls="text-gray-700 dark:text-gray-300 font-medium"
        />
      )}
      {bolishNarxi !== undefined && (
        <Qator
          yorliq="Bo'lish"
          olcham={olcham}
          sarlavha={bolish}
          qiymat={bolish}
          qiymatCls="text-gray-700 dark:text-gray-300 font-medium"
        />
      )}
    </div>
  )
}
