# BioMax ERP ↔ Marketplace Integratsiya

> **Eslatma (2026-09-24):** katalog va buyurtmalar endi bitta bazadagi
> ko‘rinishlardan to‘g‘ridan-to‘g‘ri o‘qiladi (README → «Marketplace
> integratsiyasi»). Quyidagi HMAC shartnomasi holat o‘zgartirish va eski
> deploylar uchun kuchda qoladi.

## Umumiy ma'lumot

BioMax ERP tizimi Marketplace (onlayn do'kon) bilan HMAC-SHA256 autentifikatsiya orqali integratsiya qilingan. Bu hujjatda integratsiya sozlamalari va API marshrutlari haqida ma'lumot berilgan.

## Sozlamalar

### .env fayli

Quyidagi o'zgaruvchilar `.env` faylida sozlangan:

```env
# Marketplace HMAC kaliti (Marketplace'dagi ERP_HMAC_SECRET bilan AYNAN bir xil bo'lishi shart)
MP_HMAC_SECRET=<KALIT — .env da, repoga YOZILMAYDI>

# Marketplace URL'lari
MARKETPLACE_URL=https://www.biomaxmarketplace.store
MARKETPLACE_OMMAVIY_URL=https://www.biomaxmarketplace.store
```

### HMAC Autentifikatsiya

Har bir marketplace so'rovida quyidagi sarlavhalar bo'lishi kerak:

- `X-MP-Timestamp` - Unix timestamp (millisoniyalarda)
- `X-MP-Signature` - HMAC-SHA256 imzo (hex formatda)
- `X-MP-Version` - API versiyasi (ixtiyoriy)

**Imzo hisoblash:**
```typescript
const matn = `${timestamp}\n${path}\n${body}`
const imzo = HMAC-SHA256(MP_HMAC_SECRET, matn).hex()
```

**Muhim qoidalar:**
- Vaqt farqi 5 daqiqadan oshmasligi kerak
- Kelajakdagi vaqt qabul qilinmaydi
- Imzo `timingSafeEqual` orqali tekshiriladi (timing attack'dan himoya)

## API Marshrutlari

### 1. Salomatlik tekshiruvi

**Endpoint:** `GET /api/marketplace/salomatlik`

**Maqsad:** Bog'lanish va autentifikatsiyani tekshirish

**Javob:**
```json
{
  "ok": true,
  "xabar": "ERP tayyor",
  "dokonNomi": "BioMax",
  "vaqt": "2026-09-21T10:30:00.000Z",
  "versiya": "1.0.0",
  "marshrutlar": ["..."]
}
```

---

### 2. Katalog

**Endpoint:** `GET /api/marketplace/katalog`

**Maqsad:** Vitrina uchun mahsulotlar ro'yxati

**Xususiyatlar:**
- Faqat `saytda: true` va `qulflangan: false` mahsulotlar
- Mavjudlik: BOR / KAM / YOQ (aniq raqam HECH QACHON qaytarilmaydi)
- Onlayn buyurtmalar band qilgani hisobga olinadi
- Rasmlarning o'zi yo'q (faqat versiyalar) - alohida so'rovda olinadi

**Javob:**
```json
{
  "tovarlar": [
    {
      "id": "...",
      "nomi": "Mahsulot nomi",
      "birlik": "dona",
      "sotishNarxi": 50000,
      "valyuta": "UZS",
      "mavjudlik": "BOR",
      "kategoriya": {...},
      "ombor": {...},
      "sarlavha": "...",
      "brend": "...",
      "tavsif": "...",
      "xususiyatlar": {...},
      "hajm": 100,
      "hajmBirligi": "ml",
      "eskiNarx": 60000,
      "aksiyaOxiri": "2026-09-30T23:59:59.000Z",
      "rasmlar": [
        {"tartib": 1, "versiya": "v1", "rasmTuri": "image/jpeg"}
      ],
      "yangilangan": "2026-09-21T10:00:00.000Z"
    }
  ],
  "usdKursi": 12750,
  "vaqt": "2026-09-21T10:30:00.000Z"
}
```

---

### 3. Qoldiq tekshirish

**Endpoint:** `POST /api/marketplace/qoldiq`

**Maqsad:** Bir nechta tovar uchun mavjudlikni tekshirish

**So'rov tanasi:**
```json
{
  "tovarIds": ["tovar-id-1", "tovar-id-2", "..."]
}
```

**Cheklovlar:**
- Maksimal 100 ta tovar bir so'rovda
- Faqat mavjudlik qaytariladi (BOR/KAM/YOQ)

**Javob:**
```json
{
  "tovarlar": {
    "tovar-id-1": "BOR",
    "tovar-id-2": "KAM",
    "tovar-id-3": "YOQ"
  },
  "vaqt": "2026-09-21T10:30:00.000Z"
}
```

---

### 4. Rezerv qo'yish

**Endpoint:** `POST /api/marketplace/rezerv`

**Maqsad:** Mahsulotlarni band qilish (zaxira)

**Xususiyatlar:**
- Idempotent: ikkinchi marta chaqirilsa muddatni uzaytiradi
- Rezerv 2 soat amal qiladi
- Bir vaqtda bir buyurtma band qilishda navbat ishlatiladi

**So'rov tanasi:**
```json
{
  "raqam": "MP-2026-12345",
  "qatorlar": [
    {
      "erpTovarId": "tovar-id-1",
      "nomi": "Mahsulot nomi",
      "miqdor": 2
    }
  ]
}
```

**Javob (muvaffaqiyatli):**
```json
{
  "ok": true,
  "yangi": true,
  "xabar": "Zaxira band qilindi"
}
```

**Javob (zaxira yetmaydi):**
```json
{
  "kod": "rezerv_xatosi",
  "xato": "Zaxira yetmaydi: «Mahsulot» — kerak 5, mavjud 2"
}
```

---

### 5. Rezervni bo'shatish

**Endpoint:** `POST /api/marketplace/rezerv-boshat`

**Maqsad:** Bekor qilingan buyurtmaning rezervini bo'shatish

**Xususiyatlar:**
- Idempotent: band bo'lmasa ham `ok: true`

**So'rov tanasi:**
```json
{
  "buyurtmaRaqami": "MP-2026-12345"
}
```

**Javob:**
```json
{
  "ok": true,
  "boshatildi": 3
}
```

---

### 6. Buyurtmani bajarish

**Endpoint:** `POST /api/marketplace/bajarish`

**Maqsad:** Topshirilgan buyurtmani ERP'da sotuv qilish

**Xususiyatlar:**
- Idempotent: ikkinchi marta chaqirilsa mavjud sotuvni qaytaradi
- Mijoz kartasi telefon bo'yicha topiladi yoki yaratiladi
- Ballar va keshbek avtomatik qo'shiladi
- Kassadagi sotuv bilan bir xil yozuvlar yaratiladi

**So'rov tanasi:**
```json
{
  "raqam": "MP-2026-12345",
  "aloqaTel": "+998901234567",
  "aloqaIsm": "Abdulla",
  "tolovUsuli": "NAQD",
  "mahsulotSumma": 150000,
  "yetkazishNarx": 10000,
  "yetkazish": "YETKAZISH",
  "hudud": "Chilonzor",
  "manzilMatni": "1-mavze, 2-uy",
  "lat": 41.2995,
  "lng": 69.2401,
  "qatorlar": [
    {
      "erpTovarId": "tovar-id-1",
      "nomi": "Mahsulot nomi",
      "miqdor": 2,
      "birlikNarxi": 50000,
      "jami": 100000
    }
  ]
}
```

**Javob:**
```json
{
  "ok": true,
  "sotuvId": "sotuv-id",
  "chekRaqami": "CHK-20260921-1234",
  "yangi": true,
  "xabar": "Sotuv yaratildi"
}
```

---

### 7. Mijoz topish/yaratish

**Endpoint:** `POST /api/marketplace/mijoz`

**Maqsad:** Telefon bo'yicha mijoz kartasini topish yoki yaratish

**Xususiyatlar:**
- Idempotent: mavjud mijozni qaytaradi yoki yangi yaratadi
- Telefon variantlarini tekshiradi (+998, 998, +)

**So'rov tanasi:**
```json
{
  "telefon": "+998901234567",
  "ism": "Abdulla",
  "izoh": "Marketplace"
}
```

**Javob:**
```json
{
  "ok": true,
  "yangi": false,
  "mijoz": {
    "id": "mijoz-id",
    "ism": "Abdulla",
    "telefon": "+998901234567",
    "telefon2": null,
    "tuman": "Chilonzor",
    "manzil": "1-mavze, 2-uy",
    "izoh": "Marketplace"
  },
  "xabar": "Mavjud mijoz topildi"
}
```

---

### 8. Do'kon ma'lumotlari

**Endpoint:** `GET /api/marketplace/dokon`

**Maqsad:** Do'kon aloqa ma'lumotlarini olish

**Javob:**
```json
{
  "nomi": "BioMax",
  "telefon": "+998901234567",
  "manzil": "Toshkent shahar, Chilonzor tumani",
  "ishVaqti": "9:00 - 21:00",
  "qaytarishShartlari": "7 kun ichida"
}
```

---

### 9. Mahsulot rasmi

**Endpoint:** `GET /api/marketplace/rasm/:tovarId/:tartib`

**Maqsad:** Mahsulot rasmini olish

**Parametrlar:**
- `tovarId` - Tovar identifikatori
- `tartib` - Rasm tartibi (1, 2, 3, ...)

**Javob:** Binary rasm fayli (JPEG/PNG)

**Cache:**
- `Cache-Control: public, max-age=86400` (24 soat)
- ETag versiya bilan

---

### 10. Kirish kodi yuborish

**Endpoint:** `POST /api/marketplace/kod-yubor`

**Maqsad:** Mijozga Telegram orqali kirish kodini yuborish

**So'rov tanasi:**
```json
{
  "telefon": "+998901234567",
  "kod": "123456"
}
```

**Javob:**
```json
{
  "ok": true
}
```

## Xavfsizlik qoidalari

### 1. Ma'lumot maxfiyligi

❌ **HECH QACHON marketplace'ga yuborilmaydi:**
- Kelish narxi
- Aniq qoldiq soni
- Ta'minotchi ma'lumotlari
- Foyda marjasi
- Ichki hisobotlar

✅ **Faqat ommaviy ma'lumotlar:**
- Mahsulot nomi va tavsifi
- Sotish narxi
- Mavjudlik holati (BOR/KAM/YOQ)
- Do'kon aloqa ma'lumotlari

### 2. Idempotency

Barcha POST/DELETE marshrutlar idempotent:
- Bir xil so'rov ikkinchi marta xatolik bermaydi
- Mavjud yozuvni qaytaradi yoki yangilamasdan chiqadi
- To'qnashuvlardan himoyalangan (PostgreSQL advisory locks)

### 3. Vaqt chegaralari

- Rezerv: 2 soat
- Imzo: 5 daqiqa
- Telegram kod: 5 daqiqa

### 4. Rate limiting

Marketplace tomonida sozlanadi:
- Umumiy so'rovlar: 100/daqiqa
- Kod yuborish: 3/soat (bir telefon uchun)

## Xatoliklarni boshqarish

### Autentifikatsiya xatolari (401/403)

```json
{
  "kod": "imzo_yoq",
  "xato": "Ruxsat yo'q"
}
```

Kodlar:
- `kalit_sozlanmagan` - MP_HMAC_SECRET o'rnatilmagan
- `imzo_yoq` - Sarlavhalar yo'q
- `vaqt_notogri` - Timestamp formati noto'g'ri
- `muddati_otgan` - 5 daqiqadan ko'p o'tgan
- `kelajak_vaqti` - Vaqt oldinda
- `imzo_shakli` - Hex format noto'g'ri
- `imzo_mos_emas` - Imzo mos kelmadi

### Domen xatolari (422)

```json
{
  "kod": "rezerv_xatosi",
  "xato": "Zaxira yetmaydi: ..."
}
```

Marketplace qayta urinmaydi - foydalanuvchiga xatolik ko'rsatadi.

### Server xatolari (500)

```json
{
  "kod": "server_xatosi",
  "xato": "Server xatosi"
}
```

Marketplace keyinroq qayta urinadi (exponential backoff).

## Test qilish

### 1. Salomatlik tekshiruvi

```bash
# HMAC imzosiz (xato)
curl https://www.biomaxx.store/api/marketplace/salomatlik

# HMAC imzosi bilan (muvaffaqiyatli)
# TypeScript yoki Python orqali imzo yaratib test qiling
```

### 2. Katalog

```bash
curl -H "X-MP-Timestamp: $(date +%s)000" \
     -H "X-MP-Signature: <HMAC_IMZO>" \
     https://www.biomaxx.store/api/marketplace/katalog
```

### 3. Qoldiq

```bash
curl -X POST \
     -H "Content-Type: application/json" \
     -H "X-MP-Timestamp: $(date +%s)000" \
     -H "X-MP-Signature: <HMAC_IMZO>" \
     -d '{"tovarIds": ["tovar-id-1", "tovar-id-2"]}' \
     https://www.biomaxx.store/api/marketplace/qoldiq
```

## Texnik detallar

### Baza jadvallari

**OnlaynRezerv** - Zaxira bandlari
```sql
CREATE TABLE "OnlaynRezerv" (
  id UUID PRIMARY KEY,
  buyurtmaRaqami TEXT NOT NULL,
  tovarId TEXT NOT NULL,
  miqdor DECIMAL(10,3) NOT NULL,
  holati TEXT NOT NULL, -- FAOL, BOSHATILDI, SOTILDI
  amalQiladi TIMESTAMP NOT NULL,
  foydalanuvchiId TEXT NOT NULL,
  yaratilgan TIMESTAMP DEFAULT NOW()
)
```

**Sotuv.onlaynRaqam** - Buyurtma izini saqlash
```sql
ALTER TABLE "Sotuv" 
ADD COLUMN onlaynRaqam TEXT UNIQUE
```

### Performance

- Katalog: ~500ms (rasmlar yo'q)
- Qoldiq: ~100ms (100 ta tovar)
- Rezerv: ~200ms (navbat bilan)
- Bajarish: ~500ms (tranzaksiya ichida)

### Monitoring

Loglar:
```
[mp/katalog] imzo rad etildi: imzo_yoq
[mp/rezerv] Zaxira yetmaydi: «Mahsulot» — kerak 5, mavjud 2
[mp/bajarish] Sotuv yaratildi: CHK-20260921-1234
```

## Kelajak rejalar

- [ ] Webhook'lar (buyurtma holati o'zgarsa ERP'dan marketplace'ga)
- [ ] GraphQL API
- [ ] Batch operatsiyalar
- [ ] Real-time qoldiq yangilanishlari (WebSocket)

## Muammolarni hal qilish

### Imzo mos kelmaydi

1. `MP_HMAC_SECRET` ERP va Marketplace'da AYNAN bir xilligini tekshiring
2. Vaqt farqi 5 daqiqadan kam ekanligini tekshiring
3. Body aynan shu ko'rinishda imzolanyaptimi: `\n` ajratuvchisi
4. Hex formatda ekanligini tekshiring

### Zaxira yetmaydi

1. Katalogda mavjudlikni tekshiring
2. Boshqa buyurtmalar band qilgan bo'lishi mumkin
3. Ombor harakatlarini tekshiring

### Sotuv yaratilmadi

1. Rezerv qo'yilganligini tekshiring
2. Tovarlar ERP'da mavjudligini tekshiring
3. Transaction loglarini ko'ring

## Aloqa

Texnik savol-javoblar: [Email/Telegram]
Hujjatlar versiyasi: 1.0.0
Oxirgi yangilanish: 2026-09-21
