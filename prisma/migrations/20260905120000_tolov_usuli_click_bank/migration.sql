-- Yangi to'lov usullari: Click va bank o'tkazmasi.
--
-- Enum qiymatlari ATAYLAB alohida migratsiyada — PostgreSQL'da
-- `ALTER TYPE ... ADD VALUE` bilan qo'shilgan qiymatni AYNAN O'SHA
-- tranzaksiya ichida ishlatib bo'lmaydi. Prisma har bir migratsiya
-- faylini alohida tranzaksiyada bajaradi, shuning uchun ustunlar
-- keyingi migratsiyada qo'shiladi.

ALTER TYPE "TolovUsuli" ADD VALUE IF NOT EXISTS 'CLICK' AFTER 'KARTA';
ALTER TYPE "TolovUsuli" ADD VALUE IF NOT EXISTS 'BANK' AFTER 'CLICK';
