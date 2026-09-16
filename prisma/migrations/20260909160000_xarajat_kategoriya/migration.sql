-- Yangi xarajat kategoriyalari.
-- ALTER TYPE ... ADD VALUE bitta tranzaksiyada ishlatib bo'lmaydi,
-- shuning uchun enum qiymatlari ALOHIDA migratsiyada.
ALTER TYPE "XarajatKategoriya" ADD VALUE IF NOT EXISTS 'OVQAT';
ALTER TYPE "XarajatKategoriya" ADD VALUE IF NOT EXISTS 'SOLIQ';
ALTER TYPE "XarajatKategoriya" ADD VALUE IF NOT EXISTS 'TAMIRLASH';
ALTER TYPE "XarajatKategoriya" ADD VALUE IF NOT EXISTS 'REKLAMA';
