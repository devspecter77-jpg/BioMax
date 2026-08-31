import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { barchaRuxsatKalitlari, rolStandartRuxsat } from './ruxsat-katalogi'

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt' },
  // Cookie nomini bir xil qilib belgilash (local va production uchun)
  cookies: {
    sessionToken: {
      name: 'next-auth.session-token',
      options: { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: false },
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

        let ruxsatlar: string[] | null = null
        if (foydalanuvchi.rol !== 'ADMIN') {
          const overrides = await prisma.ruxsat.findMany({ where: { foydalanuvchiId: foydalanuvchi.id } })
          const overrideMap = new Map(overrides.map(o => [o.bolim, o.korinadi]))
          ruxsatlar = barchaRuxsatKalitlari.filter(kalit =>
            overrideMap.has(kalit) ? overrideMap.get(kalit)! : rolStandartRuxsat(foydalanuvchi.rol, kalit)
          )
        }

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
