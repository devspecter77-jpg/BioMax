// Ruxsatlar tizimi uchun to'liq boshqariladigan bo'limlar katalogi.
// Sozlamalar, Filiallar va Ruxsatlar bu yerda yo'q — ular har doim faqat
// ADMIN'ga tegishli, xodimga hech qachon berilmaydi.

export interface RuxsatBolim {
  kalit: string
  label: string
  children?: RuxsatBolim[]
}

export const ruxsatKatalogi: RuxsatBolim[] = [
  { kalit: 'sotuv', label: 'Sotuv (POS)' },
  { kalit: 'tovarlar', label: 'Tovarlar' },
  { kalit: 'ombor', label: 'Ombor harakati' },
  { kalit: 'mijozlar', label: 'Mijozlar' },
  { kalit: 'nasiyalar', label: 'Nasiyalar' },
  { kalit: 'xaridlar', label: 'Xaridlar' },
  {
    kalit: 'hisobotlar', label: 'Hisobotlar', children: [
      { kalit: 'hisobotlar.umumiy', label: 'Umumiy' },
      { kalit: 'hisobotlar.sotuv', label: 'Sotuv' },
      { kalit: 'hisobotlar.moliya', label: 'Moliya' },
      { kalit: 'hisobotlar.tovarlar', label: 'Tovarlar' },
      { kalit: 'hisobotlar.ombor', label: 'Ombor' },
      { kalit: 'hisobotlar.mijozlar', label: 'Mijozlar' },
      { kalit: 'hisobotlar.nasiya', label: 'Nasiya' },
      { kalit: 'hisobotlar.xaridlar', label: 'Xaridlar' },
      { kalit: 'hisobotlar.kassirlar', label: 'Kassirlar' },
    ],
  },
]

/** Katalogdagi barcha kalitlar (asosiy + ichki), tekis ro'yxat sifatida. */
export const barchaRuxsatKalitlari: string[] = ruxsatKatalogi.flatMap(b =>
  b.children ? [b.kalit, ...b.children.map(c => c.kalit)] : [b.kalit]
)

// Rol bo'yicha standart ko'rinish — nav-items.ts'dagi `roles` va
// hisobotlar/page.tsx'dagi eski `adminOnly` bayrog'i bilan bir xil ma'noda.
// Xodim uchun hali maxsus sozlash qilinmagan bo'limlarda shu standart ishlatiladi.
const ROL_STANDART: Record<string, string[]> = {
  KASSIR: [
    'sotuv', 'tovarlar', 'ombor', 'mijozlar', 'nasiyalar',
    'xaridlar', 'hisobotlar', 'hisobotlar.umumiy', 'hisobotlar.sotuv',
  ],
  OMBORCHI: ['tovarlar', 'ombor'],
}

export function rolStandartRuxsat(rol: string, bolim: string): boolean {
  return (ROL_STANDART[rol] || []).includes(bolim)
}
