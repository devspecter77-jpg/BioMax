# BioMax

Do'kon boshqaruv tizimi (ERP/POS): kassa, ombor va filiallar, mijozlar va nasiya,
ta'minotchilar, xodimlar va ruxsatlar, hisobotlar, onlayn buyurtmalar.

Jonli: **https://www.biomaxx.store** · Onlayn do'kon:
[biomax-marketplace](https://github.com/ozodbek98776-sudo/Biomax-marketplace)

## Texnologiyalar

| Qatlam | Nima |
|---|---|
| Ilova | Next.js 16 (App Router, Turbopack) · React 19 · TypeScript |
| Baza | PostgreSQL (Neon) · Prisma 7 (`@prisma/adapter-pg`) |
| Kirish | NextAuth v5 (JWT sessiya, login + parol) |
| Xabarlar | Telegram (GramJS) — chek, nasiya eslatmasi, kirish kodi |
| Joylashtirish | Vercel (`sin1`) + Vercel Cron |

## Ishga tushirish

Node.js 20.19+ yoki 22 kerak.

```bash
npm install                 # prisma generate ham bajariladi
cp .env.example .env        # qiymatlarni to'ldiring
npx prisma migrate deploy   # jadvallarni yaratish
npm run dev -- -p 3001      # http://localhost:3001
```

Marketplace lokal ERP'ni `http://localhost:3001` da kutadi, shuning uchun
ikkalasini birga ishlatganda ERP'ni `3001` portida oching.

Muhit o'zgaruvchilari va ularning vazifasi — [.env.example](.env.example).

## Buyruqlar

| Buyruq | Vazifasi |
|---|---|
| `npm run dev` | Rivojlanish serveri |
| `npm run build` / `npm start` | Ishlab chiqarish build'i va server |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Tur tekshiruvi |
| `npm run db:migrate` | Yangi migratsiya yaratish (rivojlanish) |
| `npm run db:studio` | Prisma Studio |

GitHub Actions har push va PR'da `lint`, `tsc` va `build` ni ishga tushiradi
([ci.yml](.github/workflows/ci.yml)).

## Tuzilma

```
src/
  app/(dashboard)/   bo'limlar: sotuv, tovarlar, ombor, mijozlar, nasiyalar, ...
  app/api/           API marshrutlari
  components/        umumiy UI komponentlari
  hooks/             React hook'lar (useRuxsat, useJonli, ...)
  lib/               biznes mantiq va server yordamchilari
  proxy.ts           kirish va API ruxsatlarini tekshiradi
prisma/
  schema.prisma      ma'lumotlar modeli
  migrations/        migratsiyalar
docs/                tizim protokoli va taqdimot
```

## Ruxsatlar

Bo'lim va amal ruxsatlari [ruxsat-katalogi.ts](src/lib/ruxsat-katalogi.ts) da
e'lon qilinadi, administrator ularni «Ruxsatlar» bo'limida xodimga beradi.

**Yangi API marshrut qo'shganda** uni
[api-ruxsat-xaritasi.ts](src/lib/api-ruxsat-xaritasi.ts) ga ham yozing:
`proxy.ts` har `/api` so'rovini shu xarita bo'yicha tekshiradi. Kodda
`rol !== 'ADMIN'` deb qattiq yozish o'rniga katalog kalitidan foydalaning.

## Joylashtirish (Vercel)

1. Vercel loyihasi shu repoga ulangan — `main` ga push avtomatik deploy qiladi.
2. Settings → Environment Variables: `.env.example` dagi qiymatlar
   (Production uchun belgilanganiga ishonch hosil qiling).
3. O'zgaruvchi o'zgargach **Redeploy** qiling — eski deploy yangi qiymatni ko'rmaydi.
4. Migratsiyalar deploy paytida qo'llanmaydi: `npx prisma migrate deploy`
   ni bazaning to'g'ridan-to'g'ri (pooler emas) manzili bilan alohida ishga tushiring.

Cron vazifalar [vercel.json](vercel.json) da: nasiya eslatmasi va kunlik hisobot.

Batafsil texnik tavsif — [docs/protokol.md](docs/protokol.md).
