-- Filiallararo o'tkazma uchun ikkita yangi harakat turi.
--
-- Enum qiymatlari ATAYLAB alohida migratsiyada: PostgreSQL'da
-- `ALTER TYPE ... ADD VALUE` bilan qo'shilgan qiymatni aynan o'sha
-- tranzaksiya ichida ishlatib bo'lmaydi.
--
-- Mavjud OTKAZMA turi tegilmaydi — u filial ICHIDA ombordan do'konga
-- ko'chirishni bildiradi va boshqacha hisoblanadi.

ALTER TYPE "HarakatTuri" ADD VALUE IF NOT EXISTS 'OTKAZMA_CHIQIM' AFTER 'OTKAZMA';
ALTER TYPE "HarakatTuri" ADD VALUE IF NOT EXISTS 'OTKAZMA_KIRIM' AFTER 'OTKAZMA_CHIQIM';
