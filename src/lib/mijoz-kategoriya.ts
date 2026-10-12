// Mijozlar kategoriyasi — brauzer va server uchun umumiy qismi (rang belgilari).

export const RANGLAR = ['kulrang', 'qizil', 'sariq', 'yashil', 'kok', 'binafsha'] as const
export type KategoriyaRangi = (typeof RANGLAR)[number]

/** Kategoriya belgisi uchun Tailwind klasslari (yorug' va qorong'i mavzu). */
export const RANG_KLASS: Record<KategoriyaRangi, { chip: string; nuqta: string }> = {
  kulrang: { chip: 'bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-gray-300', nuqta: 'bg-gray-400' },
  qizil: { chip: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300', nuqta: 'bg-red-500' },
  sariq: { chip: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300', nuqta: 'bg-amber-500' },
  yashil: { chip: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300', nuqta: 'bg-emerald-500' },
  kok: { chip: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300', nuqta: 'bg-blue-500' },
  binafsha: { chip: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300', nuqta: 'bg-violet-500' },
}

export const rangKlassi = (rang: string | null | undefined) =>
  RANG_KLASS[(RANGLAR as readonly string[]).includes(rang ?? '') ? (rang as KategoriyaRangi) : 'kulrang']

/** Ruxsatlar bo'limidagi dinamik kalit: `mijoz-kategoriya.<id>` — xodimga shu kategoriya ochiq */
export const KATEGORIYA_KALIT = 'mijoz-kategoriya.'

// ─── API javobi turlari (Mijozlar sahifasi) ──────────────────────────────────

export interface KategoriyaQisqa { id: string; nomi: string; rang: string }

export interface KategoriyaQatori extends KategoriyaQisqa {
  /** Barcha xodimlarga ko'rinadi */
  hammaga: boolean
  /** Shu foydalanuvchiga ko'rinadigan mijozlar soni */
  mijozlar: number
  /** Faqat administratorga: kimlarga ochiq */
  xodimIdlar?: string[]
}

export interface XodimQisqa { id: string; ism: string; rol: string; faol: boolean }

export interface KategoriyalarJavobi {
  kategoriyalar: KategoriyaQatori[]
  /** Kategoriyasiz (ko'rinadigan) mijozlar soni */
  kategoriyasiz: number
  /** Foydalanuvchi barcha mijozlarni ko'radimi */
  hammasi: boolean
  /** Administratorga: mas'ul tanlash va kategoriyani ochish uchun */
  xodimlar: XodimQisqa[]
  /** Administratorga: faqat administratorlarga ko'rinadigan mijozlar soni */
  faqatAdmin: number
}

export const RANG_NOMI: Record<KategoriyaRangi, string> = {
  kulrang: 'Kulrang', qizil: 'Qizil', sariq: 'Sariq', yashil: 'Yashil', kok: 'Ko‘k', binafsha: 'Binafsha',
}
