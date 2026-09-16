-- Mijozning 3-va keyingi telefon raqamlari (faqat qo'shimcha ustun — mavjud ma'lumotga tegilmaydi)
ALTER TABLE "mijozlar" ADD COLUMN "qoshimchaTelefonlar" TEXT[] DEFAULT ARRAY[]::TEXT[];
