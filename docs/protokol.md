# BioMax — loyiha protokoli

> Do'kon boshqaruv tizimi (ERP/POS): sotuv, ombor, mijozlar, nasiya, ta'minot,
> hisobotlar va ko'p-filial/ko'p-do'kon (multi-tenant) boshqaruvi.
> Ishlab turgan sayt: **https://www.biomaxx.store**
> GitHub: `devspecter77-jpg/BioMax`

---

## 1. Loyiha haqida

BioMax — kichik-o'rta chakana savdo do'konlari (masalan oziq-ovqat, aralash mol)
uchun mo'ljallangan veb-asosli ERP/POS tizimi. Bitta tizim orqali bir nechta
mustaqil biznes (Ega) va ularning filiallari ishlaydi — har birining o'z
mahsulot katalogi, mijozlari, sotuvlari va hisobotlari bir-biridan to'liq
izolyatsiya qilingan holda.

Asosiy imkoniyatlar bir jumlada: mahsulot va ombor boshqaruvi, kassa (POS)
orqali sotuv, mijozlarga nasiya (qarz) berish va Telegram orqali avtomatik
eslatma, ta'minotchilardan xarid va qarz kuzatuvi, xarajatlar, batafsil
hisobotlar (ABC-tahlil, dead-stock, aylanma, kassirlar samaradorligi va h.k.),
ko'p-filial va ko'p-Ega tuzilmasi, xodim/Ega joylashuvini kuzatish (GPS).

---

## 2. Texnologiyalar

| Qatlam | Texnologiya |
|---|---|
| Frontend/Backend | Next.js 16 (App Router, Turbopack), React 19, TypeScript |
| Ma'lumotlar bazasi | PostgreSQL (Neon, serverless, pooled connection) |
| ORM | Prisma 7 (`@prisma/adapter-pg` driver adapter) |
| Autentifikatsiya | NextAuth v5 (Credentials provider, JWT sessiya) |
| Stillar | Tailwind CSS |
| Bildirishnoma | Telegram — GramJS (`telegram` paketi, MTProto/userbot, bot emas) |
| Joylashtirish | Vercel (serverless funksiyalar + Vercel Cron) |
| Boshqa | Sonner (toast), Recharts (grafiklar), xlsx (Excel import/export), jsPDF (chek/PDF), html5-qrcode (shtrix-kod skaner), react-hook-form + zod |

---

## 3. Arxitektura — ko'p-tenant (multi-tenant) tuzilma

Tizimda uchta "egalik darajasi" bor, hammasi bitta `Foydalanuvchi` jadvalida:

1. **Ega** (`rol: ADMIN`, `filialId: null`, `ulashilganEgaId: null`) — mustaqil
   biznes egasi. O'zining mahsulot katalogi, mijozlari, sotuvlari, filiallari
   bor. Boshqa Egalarning ma'lumotlarini ko'rmaydi.
2. **Filial egasi/xodimi** (`filialId` to'ldirilgan) — muayyan filialga
   bog'langan. Faqat shu filialning ma'lumotlarini ko'radi/boshqaradi.
3. **Ulashilgan Admin** (`filialId: null`, `ulashilganEgaId` to'ldirilgan) —
   filialsiz, lekin o'z katalogi yo'q — biror Eganing katalogini **jonli**
   (nusxasiz) ko'radi/boshqaradi. Ega bu adminga qaysi maydonlarni
   (masalan kelish narxi) yashirishni va tahrirlash/o'chirish huquqini
   berish-bermaslikni belgilaydi (`tovarTahrirlashMumkin`,
   `tovarOchirishMumkin`, `MaydonYashirish` jadvali).

Bu izolyatsiya `src/lib/filial-scope.ts` dagi bitta markaziy yordamchi orqali
ta'minlanadi:

```ts
egaFilialWhere(session)
// filialga bog'langan bo'lsa → { filialId }
// aks holda (Ega darajasi) → { filialId: null, egaId: <shu yoki ulashgan Eganing id'si> }
```

Har bir asosiy jadval (`Tovar`, `Mijoz`, `Kategoriya`, `Sotuv`, `Taminotchi`,
`Xarajat`) da `filialId` **va** `egaId` maydonlari bor — shu funksiya orqali
har doim ikkalasi bilan ham filtrlanadi, hech qachon "bo'sh where" bilan
barcha tenantlarga ochiq qolib ketmaydi.

### Rollar

| Rol | Ta'rif |
|---|---|
| `ADMIN` | Ega / filial egasi / ulashilgan admin — to'liq huquq (ruxsatlar tizimi unga tegmaydi) |
| `KASSIR` | Sotuv, mijozlar, nasiya, ombor, hisobot — standart ko'rish |
| `OMBORCHI` | Faqat Tovarlar va Ombor harakati |
| `SOTUVCHI` | Sxemada bor, lekin joriy UI'da faol foydalanilmaydi (eski Buyurtma oqimi bilan bog'liq, sahifasi olib tashlangan) |

### Granular ruxsatlar (`Ruxsat` jadvali)

ADMIN bo'lmagan xodimlar uchun har bir bo'lim (`sotuv`, `tovarlar`, `ombor`,
`mijozlar`, `nasiyalar`, `xaridlar`, `hisobotlar` va uning ichki tablari)
alohida yoqilishi/o'chirilishi mumkin (`src/lib/ruxsat-katalogi.ts`). Sozlanmagan
bo'limlar uchun rol bo'yicha standart qiymat ishlatiladi (`rolStandartRuxsat`).

---

## 4. Ma'lumotlar bazasi modeli (Prisma)

`prisma/schema.prisma` — asosiy jadvallar:

- **Filial** — filial (do'kon shoxobchasi): nomi, manzil, telefon, faollik.
- **Foydalanuvchi** — barcha login qiladigan hisoblar (Ega/filial/xodim/admin),
  GPS joylashuvi (`lokatsiyaLat/Lng/Yangilangan`), Ega-ulashish maydonlari.
- **Ruxsat** — xodimga bo'lim bo'yicha ko'rish ruxsati (override).
- **Kategoriya** — mahsulot turkumi (filial yoki Ega darajasida).
- **Tovar** — mahsulot: kelish/sotish/optom/bo'lish narxi, birlik, shtrix-kod,
  valyuta (UZS/USD), rasm(lar), minimal qoldiq, holati (faol/arxiv).
- **MaydonYashirish** — ulashilgan adminga qaysi Tovar maydoni yashirilgani.
- **OmborHarakati** — har bir kirim/chiqim/qaytarish/yo'qotish/o'tkazma
  yozuvi; **Tovar.qoldiq bazada saqlanmaydi**, shu jadval yig'indisidan
  hisoblanadi (joy: OMBOR/DOKON).
- **Mijoz** — mijoz kartasi: telefon, manzil, GPS joylashuv, Telegram holati.
- **Sotuv** / **SotuvTarkibi** — chek (savdo) va uning tarkibidagi qatorlar;
  to'lov turi (NAQD/KARTA/ARALASH/NASIYA/SHERIK), chegirma.
- **Nasiya** / **NasiyaTolov** / **NasiyaQarzTarixi** — mijozga berilgan qarz,
  to'lovlar va qarz o'zgarishi tarixi; holati OCHIQ/YOPILGAN/MUDDATI_OTGAN.
- **Taminotchi** / **Xarid** / **XaridTarkibi** / **XaridTolov** /
  **XaridQarzTarixi** — ta'minotchidan xarid va unga to'lov/qarz kuzatuvi.
- **Xarajat** — do'kon xarajatlari (ijara, maosh, transport, kommunal, boshqa).
- **Sozlama** — kalit-qiymat umumiy sozlamalar jadvali (Telegram sessiyasi,
  dollar kursi, do'kon nomi va h.k. shu yerda saqlanadi).
- **SherikDokon**/**Sherik**/**SherikQarz**/**SherikdanOlish** va tarkiblari —
  "sherik" (agent/hamkor do'kon) orqali nasiyaga tovar berish/qarz oqimi.
- **Qaytarish** / **QaytarishTarkibi** — sotuvdan mahsulot qaytarish (vozvrat).
- **Buyurtma** / **BuyurtmaTarkibi** — eski Sotuvchi→Kassir buyurtma oqimi
  (backend saqlanib qolgan, UI sahifasi olib tashlangan).
- **BildirishnomLog** — yuborilgan/yuborilmagan Telegram xabarlari jurnali
  (turi, matni, holati, urinishlar soni).

---

## 5. Sahifalar (frontend, `src/app/(dashboard)/`)

| Yo'l | Sahifa | Kimlar ko'radi |
|---|---|---|
| `/` | Bosh sahifa — umumiy statistika | ADMIN, KASSIR, OMBORCHI |
| `/sotuv` | **Sotuv (POS)** — kassa: mahsulot tanlash, savat, chegirma/bonus, narx turi (chakana/optom/bo'lish), to'lov, chek chop etish/ulashish, mijoz avvalgi xaridi eslatmasi | ADMIN, KASSIR |
| `/tovarlar` | Mahsulotlar CRUD, kategoriyalar, ko'rinish sozlamalari (ulashilgan adminga) | ADMIN, KASSIR, OMBORCHI |
| `/ombor` | Ombor harakati — kirim/chiqim/o'tkazma tarixi | ADMIN, KASSIR, OMBORCHI |
| `/mijozlar` | Mijozlar kartasi, tarixi, joylashuvi, "Sotuvni boshlash" (POS'ga o'tish) | ADMIN, KASSIR |
| `/nasiyalar` | Ochiq/yopiq qarzlar, to'lov qabul qilish, muddat, Telegram eslatma holati | ADMIN, KASSIR |
| `/xaridlar` | Ta'minotchidan xarid, qarz va to'lovlar | ADMIN, KASSIR |
| `/hisobotlar` | Umumiy, Sotuv, Tovarlar, Ombor, Mijozlar, Nasiya, Xaridlar tablari — ABC-tahlil, dead-stock, aylanma, kassirlar, aging va h.k. | ADMIN, KASSIR |
| `/filiallar` | Filiallar/Egalar/Adminlar qo'shish-tahrirlash, Telegram ulash, xodim/Ega joylashuvi | faqat ADMIN (bosh Ega) |

Bundan tashqari backend'da (sahifasiz, faqat API) saqlanib qolgan: Sheriklar,
Sherik do'konlar, Ta'minotchilar (asosiy CRUD Xaridlar ichida), Buyurtmalar,
Sozlamalar — bular "BioMax rebrand" bosqichida soddalashtirish uchun UI'dan
olib tashlangan, lekin ma'lumotlar va mantiq saqlanib qolgan.

---

## 6. Asosiy xususiyatlar

- **POS (Sotuv)**: mahsulot qidirish/shtrix-kod skaner, chakana/optom/bo'lish
  narx tanlash, chegirma foizi, bonus (bepul) mahsulot qo'shish, mijoz
  tanlash/yaratish, NAQD/KARTA/ARALASH/NASIYA/SHERIK to'lov, chek PDF/chop
  etish/Telegram orqali yuborish, mijoz shu mahsulotni avval sotib olganini
  eslatuvchi bildirishnoma.
- **Mijoz kartasidan sotuvni boshlash**: Mijozlar sahifasidagi "Sotuvni
  boshlash" tugmasi shu mijoz oldindan tanlangan holda POS'ga olib o'tadi.
- **Nasiya va Telegram eslatma**: qarz muddatidan 3/2/1 kun oldin va muddati
  o'tganda mijozning shaxsiy Telegram raqamiga avtomatik xabar (Vercel Cron,
  har kuni), shuningdek sotuv/nasiya yaratilganda darhol xabar.
- **Ko'p-filial va ko'p-Ega**: yuqorida (3-bo'lim) tavsiflangan izolyatsiya;
  Filiallar sahifasidan yangi filial+egasi, mustaqil Ega yoki ulashilgan
  Admin qo'shish/tahrirlash/o'chirish (hard yoki soft delete — agar hisobda
  savdo tarixi bo'lsa, login "bo'shatiladi" va yozuv nofaol saqlanadi).
- **GPS kuzatuv**: xodim/Ega saytga kirganda sokin ravishda joylashuvi
  yoziladi (`LokatsiyaKuzatuv` komponenti), Filiallar sahifasida "X vaqt
  oldin shu yerda edi" (Google Maps havolasi bilan) ko'rinadi; mijoz
  kartasiga ham qo'lda GPS biriktirish mumkin.
- **Hisobotlar**: ABC-tahlil, dead-stock (sotilmayotgan tovarlar), tovar
  aylanmasi, kassirlar samaradorligi, soat kesimida sotuv, nasiya aging,
  ta'minotchi qarz aging, moliyaviy P&L, Excel eksport.
- **Excel import/export va zaxira**: Tovarlar/Mijozlar/Nasiyalar/Sotuvlar
  Excel orqali import/eksport, to'liq DB backup/export/clean (`/api/backup/*`).
- **Chek**: har bir sotuv uchun raqamlangan chek, PDF va HTML ko'rinishida,
  ulashiladigan havola (`/chek/[chekRaqami]`).

---

## 7. Telegram integratsiyasi

`src/lib/telegram.ts` — bot emas, **haqiqiy shaxsiy Telegram akkaunt**
(MTProto/GramJS orqali) mijozlarga bot bilan `/start` bosishni talab qilmasdan
to'g'ridan-to'g'ri xabar yuboradi.

- Ulanish/uzish/test — `src/components/TelegramUlash.tsx` (Filiallar sahifasida),
  backend `POST /api/telegram` (`connect` → kod yuborish, `verify` → tasdiqlash,
  `disconnect`, `test`). API ID/Hash **my.telegram.org** dan olinadi.
- Hozircha **bitta umumiy hisob** — butun tizim (barcha filial/Ega) shu bitta
  Telegram akkaunt orqali xabar yuboradi (`Sozlama` jadvalida saqlanadi:
  `telegram_api_id`, `telegram_api_hash`, `telegram_session` va h.k.).
- Raqamni topish `contacts.ImportContacts` orqali (vaqtincha kontakt sifatida
  qo'shib, keyin o'chiradi) — topilgan Telegram user-ID/access-hash **abadiy
  keshlanadi** (`telegram_entity_cache` — spam-himoya, takroriy so'rov shart
  emas). Telegram ba'zan "retryContacts" (keyinroq urinib ko'ring) qaytarsa,
  kod 5 soniya kutib yana bir bor uradi.
- Yuborish darhol (queue'siz) — `xabarDarholYuborVaSaqla()`, chunki Vercel
  serverless'da doimiy fon jarayoni ishlamaydi. Har bir urinish
  `BildirishnomLog`ga yoziladi.
- Muddat eslatmalari `vercel.json` cron orqali (`0 4 * * *` — har kuni soat
  4:00 da) `/api/cron/nasiya-eslatma` chaqiradi, `Authorization: Bearer
  $CRON_SECRET` bilan himoyalangan.
- Eski `src/bot/` (grammy + node-cron) — VPS/PM2 davridan qolgan, Vercel'da
  ishlamaydi (doimiy jarayon yo'q), amalda ishlatilmaydi.

---

## 8. API tuzilishi (`src/app/api/`)

REST-uslubidagi Next.js Route Handler'lar, resurs bo'yicha guruhlangan:
`sotuvlar`, `tovarlar`, `ombor`, `mijozlar`, `nasiyalar`, `xaridlar`,
`taminotchilar`, `kategoriyalar`, `xarajatlar`, `hisobotlar/*` (har bir
hisobot turi alohida endpoint), `filiallar`, `foydalanuvchilar`, `ruxsatlar`,
`telegram`, `xabarlar` (bildirishnoma jurnali), `backup/*`, `cron/*`,
`public/chek/[chekRaqami]` (tashqi/ulashiladigan chek), `profil/lokatsiya`
(GPS yozish), `kurs` (dollar kursi — O'zbekiston Markaziy bankidan avtomatik).

Har bir endpoint `auth()` orqali sessiyani tekshiradi, so'ng
`egaFilialWhere(session)` (yoki filial-scope'ning boshqa yordamchilari) bilan
faqat shu tenant'ning ma'lumotlariga cheklaydi.

---

## 9. Joylashtirish (Deployment)

- **Hosting**: Vercel — serverless funksiyalar, har bir API route alohida
  funksiya sifatida ishlaydi (doimiy background process yo'q).
- **Ma'lumotlar bazasi**: Neon (serverless Postgres), pooled connection
  (`@prisma/adapter-pg` + `pg.Pool`).
- **Region**: `sin1` (Singapur) — O'zbekistonga yaqinroq latency uchun.
- **Cron**: Vercel Cron (`vercel.json`) — nasiya eslatmalari uchun.
- **Migratsiyalar**: `prisma migrate deploy` (qo'lda yoki deploy skripti orqali).
- **Eski (endi ishlatilmaydigan) fayllar**: `deploy.sh`/`update.sh`/
  `ecosystem.config.js` — bular loyihaning VPS+PM2 bilan boshqarilgan
  davridan qolgan, hozirgi Vercel joylashtirish bilan bog'liq emas.

---

## 10. Loyiha papka tuzilishi (qisqacha)

```
src/
  app/
    (auth)/login/         — login sahifasi
    (dashboard)/          — barcha asosiy sahifalar (yuqoridagi jadval)
    api/                  — barcha backend endpoint'lar
    chek/[chekRaqami]/    — ulashiladigan chek sahifasi
  components/              — qayta ishlatiladigan UI komponentlar
    layout/                — Sidebar, Header, MobileNav, nav-items.ts
    ui/                     — PhoneInput, MoneyInput, Combobox va h.k.
  lib/                     — biznes-mantiq: auth, prisma, telegram,
                              filial-scope, ruxsat-katalogi, hisobotlar,
                              chek-print, utils
  hooks/                   — useBodyScrollLock va boshqa custom hook'lar
  bot/                     — eski Telegram bot/scheduler (endi ishlatilmaydi)
prisma/
  schema.prisma            — to'liq ma'lumotlar modeli
  migrations/               — barcha SQL migratsiyalar (xronologik)
docs/
  protokol.md               — shu fayl
  protokol.html              — interaktiv (eski) loyiha-checklist sahifasi
  presentation.html           — taqdimot
```

---

*Bu fayl loyihaning umumiy holatini tavsiflaydi va vaqti-vaqti bilan
yangilanishi kerak — kod har doim haqiqiy manba (source of truth) hisoblanadi.*
