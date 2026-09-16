// Sessiya so'rovlarining himoya qatlami (faqat brauzer).
//
// NextAuth mijozi `/api/auth/session` so'rovi muvaffaqiyatsiz bo'lsa (server qayta
// ishga tushyapti, internet uzildi, dev server kompilyatsiya qilib HTML qaytardi):
//   · `console.error(ClientFetchError: Failed to fetch)` chiqaradi — dev rejimda
//     Next.js buni qizil xato oynasi qiladi;
//   · sessiyani `null` qiladi — foydalanuvchi tizimdan chiqmagan bo'lsa ham menyu,
//     ruxsatlar va yangilashlar yo'qoladi.
// NextAuth'ning mijoz qismida bu xatti-harakatni sozlab bo'lmaydi (logger ichki).
//
// Shuning uchun FAQAT `GET /api/auth/session` so'rovi o'raladi: javob to'g'ri bo'lsa
// o'zgarishsiz qaytadi va eslab qolinadi; xato bo'lsa — oxirgi to'g'ri sessiya
// qaytariladi (hali bo'lmasa `null`). Boshqa hech qanday so'rovga tegilmaydi.
// Haqiqiy holatni bilish kerak bo'lganda (sessiya qorovuli) `aslFetch` ishlatiladi.

export const SESSIYA_YOLI = '/api/auth/session'

interface SessiyaOyna extends Window {
  __sessiyaFetchOrnatildi?: boolean
  __aslFetch?: typeof fetch
  __oxirgiSessiya?: string
}

/** Javob matni sessiya JSON'imi (`null` yoki `{...}`) */
export function sessiyaJsonimi(matn: string): boolean {
  const t = matn.trim()
  if (t === 'null' || t === '{}') return true
  if (!t.startsWith('{')) return false
  try {
    const j = JSON.parse(t)
    return !!j && typeof j === 'object'
  } catch {
    return false
  }
}

function sessiyaSorovimi(input: RequestInfo | URL, init?: RequestInit): boolean {
  try {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const usul = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase()
    return usul === 'GET' && new URL(url, window.location.href).pathname === SESSIYA_YOLI
  } catch {
    return false
  }
}

/** Himoya qatlamini bir marta o'rnatadi (HMR yoki modul ikki marta yuklansa ham). */
export function sessiyaFetchniOrnat(): void {
  if (typeof window === 'undefined') return
  const w = window as SessiyaOyna
  if (w.__sessiyaFetchOrnatildi) return
  w.__sessiyaFetchOrnatildi = true
  const asl = window.fetch.bind(window)
  w.__aslFetch = asl

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!sessiyaSorovimi(input, init)) return asl(input, init)
    try {
      const javob = await asl(input, init)
      if (javob.ok) {
        const matn = await javob.clone().text()
        if (sessiyaJsonimi(matn)) {
          w.__oxirgiSessiya = matn
          return javob
        }
      }
    } catch {
      // tarmoq xatosi — pastda zaxira javob
    }
    return new Response(w.__oxirgiSessiya ?? 'null', {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-Sessiya-Zaxira': '1' },
    })
  }
}

/** Himoya qatlamisiz asl `fetch` — haqiqiy tarmoq holatini bilish uchun. */
export function aslFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const w = typeof window !== 'undefined' ? (window as SessiyaOyna) : null
  return (w?.__aslFetch ?? fetch)(input, init)
}
