import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { hisobHolati } from './ruxsat-server'

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt' },
  // Cookie nomini bir xil qilib belgilash (local va production uchun)
  cookies: {
    sessionToken: {
      name: 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        // Productionda (HTTPS) cookie faqat shifrlangan kanal orqali
        // yuboriladi. Localhostda HTTPS yo'q — u yerda false bo'lishi shart,
        // aks holda tizimga umuman kirib bo'lmaydi.
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        login: { label: 'Login', type: 'text' },
        parol: { label: 'Parol', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.login || !credentials?.parol) return null

        const foydalanuvchi = await prisma.foydalanuvchi.findUnique({
          where: { login: credentials.login as string },
          include: { filial: true },
        })

        if (!foydalanuvchi || !foydalanuvchi.faol) return null

        const parolTogri = await bcrypt.compare(
          credentials.parol as string,
          foydalanuvchi.parolHash
        )

        if (!parolTogri) return null

        // Samarali ruxsatlar (bo'lim + amallar) — keshsiz, login paytida aniq holat
        const holat = await hisobHolati(foydalanuvchi.id, true)
        const ruxsatlar = holat?.ruxsatlar ?? null

        return {
          id: foydalanuvchi.id,
          name: foydalanuvchi.ism,
          email: foydalanuvchi.login,
          rol: foydalanuvchi.rol,
          filialId: foydalanuvchi.filialId,
          filialNomi: foydalanuvchi.filial?.nomi ?? null,
          ulashilganEgaId: foydalanuvchi.ulashilganEgaId,
          tovarTahrirlashMumkin: foydalanuvchi.tovarTahrirlashMumkin,
          tovarOchirishMumkin: foydalanuvchi.tovarOchirishMumkin,
          ruxsatlar,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.rol = (user as any).rol
        token.filialId = (user as any).filialId
        token.filialNomi = (user as any).filialNomi
        token.ulashilganEgaId = (user as any).ulashilganEgaId
        token.tovarTahrirlashMumkin = (user as any).tovarTahrirlashMumkin
        token.tovarOchirishMumkin = (user as any).tovarOchirishMumkin
        token.ruxsatlar = (user as any).ruxsatlar
        token.tekshirildi = Date.now()
        return token
      }

      // Har 30 soniyada hisob holati bazadan yangilanadi: ruxsat o'zgarsa xodim
      // qayta kirishi shart emas, o'chirilgan (faol emas) xodim esa tizimdan chiqadi.
      if (token.id && Date.now() - Number(token.tekshirildi ?? 0) > 30_000) {
        const h = await hisobHolati(token.id as string).catch(() => undefined)
        if (h === undefined) return token // baza vaqtincha javob bermadi — eski holat bilan davom
        if (!h || !h.faol) return null
        token.rol = h.rol
        token.filialId = h.filialId
        token.filialNomi = h.filialNomi
        token.ulashilganEgaId = h.ulashilganEgaId
        token.tovarTahrirlashMumkin = h.tovarTahrirlashMumkin
        token.tovarOchirishMumkin = h.tovarOchirishMumkin
        token.ruxsatlar = h.ruxsatlar
        token.tekshirildi = Date.now()
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        ;(session.user as any).rol = token.rol
        ;(session.user as any).filialId = token.filialId
        ;(session.user as any).filialNomi = token.filialNomi
        ;(session.user as any).ulashilganEgaId = token.ulashilganEgaId
        ;(session.user as any).tovarTahrirlashMumkin = token.tovarTahrirlashMumkin
        ;(session.user as any).tovarOchirishMumkin = token.tovarOchirishMumkin
        ;(session.user as any).ruxsatlar = token.ruxsatlar
      }
      return session
    },
  },
})
