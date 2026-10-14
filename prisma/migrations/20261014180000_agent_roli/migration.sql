-- Agent: savdo agenti. Namuna tovar oladi va joylashuvi kuzatiladi (dostavchik
-- kabi), lekin onlayn buyurtma yetkazmaydi. Faqat yangi qiymat qo'shiladi —
-- mavjud yozuvlarga tegilmaydi.
ALTER TYPE "Rol" ADD VALUE IF NOT EXISTS 'AGENT';
