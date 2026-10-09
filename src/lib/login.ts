// Login qoidalari — kirish sahifasi, auth va xodim API'si bir xil ishlatadi.
//
// Login katta-kichik harfga sezgir EMAS: telefonda klaviatura birinchi harfni
// o'zi katta qiladi, "ozodbek" va "Ozodbek" bitta hisob. Shu sababli yangi
// login mavjudidan faqat registri bilan farq qilsa, band hisoblanadi.

/** Kiritilgan loginni solishtirishga tayyorlaydi. */
export function loginTozala(s: string): string {
  return s.trim()
}

/** Yangi/o'zgartirilgan login uchun xato matni yoki `null`. */
export function loginXatosi(login: string): string | null {
  if (login.length < 3) return 'Login kamida 3 belgi'
  if (login.length > 50) return 'Login 50 belgidan oshmasin'
  if (/\s/.test(login)) return 'Loginda bo‘sh joy bo‘lmasin'
  return null
}

/**
 * Eski hisoblar login sifatida telefonning 9 raqamini (901234567) ishlatgan.
 * Odat bo'yicha "+998 90 123-45-67" yozilsa ham shu hisob topilsin.
 */
export function telefonLogin(s: string): string | null {
  if (!/^[\d\s+()-]+$/.test(s)) return null
  const r = s.replace(/\D/g, '')
  if (r.length === 9) return r
  if (r.length === 12 && r.startsWith('998')) return r.slice(3)
  return null
}
