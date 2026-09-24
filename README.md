# BioMax

Do'kon boshqaruv tizimi (ERP/POS): kassa, ombor va filiallar, mijozlar va nasiya,
ta'minotchilar, xodimlar va ruxsatlar, hisobotlar, onlayn buyurtmalar.

Jonli: **https://www.biomaxx.store** · **https://qaqnus222.biznesjon.uz**  
Onlayn do'kon: [biomax-marketplace](https://github.com/ozodbek98776-sudo/Biomax-marketplace) · **https://www.biomaxmarketplace.store**

## Texnologiyalar

| Qatlam | Nima |
|---|---|
| Ilova | Next.js 16 (App Router, Turbopack) · React 19 · TypeScript |
| Baza | PostgreSQL (Neon) · Prisma 7 (`@prisma/adapter-pg`) |
| Kirish | NextAuth v5 (JWT sessiya, login + parol) |
| Xabarlar | Telegram (GramJS) — chek, nasiya eslatmasi, kirish kodi |
| Joylashtirish | Vercel (`sin1`) + Vercel Cron |
| Integratsiya | Marketplace API (HMAC-SHA256 autentifikatsiya) |

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

## Marketplace integratsiyasi

ERP va onlayn do'kon **bitta PostgreSQL bazasida**: ERP `public`, do'kon
`marketplace` sxemasida. Shuning uchun ma'lumot almashinuvi ikki qatlamda:

| Yo'nalish | Nima | Qanday |
|---|---|---|
| Sayt → ERP ma'lumotlari | katalog, narx, mavjudlik, do'kon ma'lumoti, rasm | `public.vitrina_katalog` ko'rinishidan **to'g'ridan-to'g'ri** (real vaqtda) |
| ERP → buyurtmalar | panel ro'yxati, tafsilot, jonli belgi | `marketplace.erp_buyurtmalar` ko'rinishidan **to'g'ridan-to'g'ri** |
| ERP → buyurtma holatini o'zgartirish | tasdiqlash, yig'ish, yo'lda, bekor | imzolangan `POST /api/erp/*` (qoidalar do'kon tomonida) |

Ko'rinishlar qoidalarni o'zida saqlaydi: `vitrina_katalog` faqat saytga
chiqarilgan mahsulotni va BOR/KAM/YOQ mavjudlikni beradi (aniq qoldiq,
kelish narxi va ta'minotchi YO'Q); `erp_buyurtmalar` esa buyurtma qatorlari,
tarixi va ruxsat etilgan keyingi holatlarni beradi.

Natijada katalog va panel HMAC kalitiga bog'liq emas — kalit faqat holat
o'zgartirish uchun kerak (`MP_HMAC_SECRET`).

### Eski HTTP shartnomasi (`/api/marketplace/*`)

Marshrutlar joyida qoldi: jonli saytda hali eski versiya ishlayapti va u
shularga murojaat qiladi. Yangi deploydan keyin ular faqat zaxira yo'l.

**10 ta endpoint** (`/api/marketplace/*`):

| Marshrut | Method | Maqsad |
|----------|--------|--------|
| `/salomatlik` | GET | Health check, bog'lanish testi |
| `/katalog` | GET | Vitrina uchun mahsulotlar (BOR/KAM/YOQ) |
| `/qoldiq` | POST | Bir nechta tovar mavjudligini tekshirish |
| `/rezerv` | POST | Buyurtma uchun zaxira band qilish |
| `/rezerv-boshat` | POST | Rezervni bo'shatish |
| `/bajarish` | POST | Buyurtmani bajarish, sotuv yaratish |
| `/mijoz` | POST | Mijoz topish yoki yaratish |
| `/dokon` | GET | Do'kon aloqa ma'lumotlari |
| `/rasm/:id/:n` | GET | Mahsulot rasmi |
| `/kod-yubor` | POST | Telegram orqali kirish kodi |

### Xavfsizlik

- ✅ **HMAC-SHA256** autentifikatsiya har bir so'rovda
- ✅ **Timing-safe** taqqoslash
- ✅ **5 daqiqalik** vaqt oynasi
- ✅ **Aniq qoldiq yashirilgan** (faqat BOR/KAM/YOQ)
- ✅ **Kelish narxi va ta'minotchi** hech qachon qaytarilmaydi

### Hujjatlar

- 📚 [MARKETPLACE_INTEGRATSIYA.md](MARKETPLACE_INTEGRATSIYA.md) - To'liq API hujjatlari (500+ qator)
- 📄 [MARKETPLACE_XULOSA.md](MARKETPLACE_XULOSA.md) - Qisqa xulosa
- ✅ [TEKSHIRUV_NATIJASI.md](TEKSHIRUV_NATIJASI.md) - Tekshiruv hisoboti
- 🧪 [test-marketplace.mjs](test-marketplace.mjs) - Test script

### Test qilish

```bash
# Automatic test (salomatlik, katalog, qoldiq, mijoz, rezerv)
node test-marketplace.mjs

# Yoki curl orqali
curl -H "X-MP-Timestamp: <timestamp>" \
     -H "X-MP-Signature: <hmac-signature>" \
     https://qaqnus222.biznesjon.uz/api/marketplace/salomatlik
```

### Sozlash

.env faylida quyidagilar kerak:
```bash
MP_HMAC_SECRET="<64-belgili-kalit>"  # Marketplace bilan bir xil
MARKETPLACE_URL="https://www.biomaxmarketplace.store"
MARKETPLACE_OMMAVIY_URL="https://www.biomaxmarketplace.store"
```

Batafsil: [MARKETPLACE_INTEGRATSIYA.md](MARKETPLACE_INTEGRATSIYA.md)
