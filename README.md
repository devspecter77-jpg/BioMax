# BioMax

Do'kon boshqaruv tizimi (ERP/POS) — sotuv, ombor, mijozlar, nasiya, filiallar va hisobotlar.

## Texnologiyalar

- Next.js 16 (App Router) + React 19 + TypeScript
- Prisma 7 + PostgreSQL (Neon)
- NextAuth v5
- Telegram bildirishnomalar (GramJS)

## Ishga tushirish

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

`.env` faylida `DATABASE_URL`, `NEXTAUTH_URL`, `AUTH_SECRET` sozlanishi kerak.
