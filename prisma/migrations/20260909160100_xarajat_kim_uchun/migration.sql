-- Xarajat kim uchun qilingani va qaysi kanal orqali to'langani.
-- Faqat qo'shimcha ustunlar — mavjud yozuvlar o'zgarmaydi.
ALTER TABLE "xarajatlar" ADD COLUMN "xodimId" TEXT;
ALTER TABLE "xarajatlar" ADD COLUMN "kimUchun" TEXT;
ALTER TABLE "xarajatlar" ADD COLUMN "tolovUsuli" "TolovUsuli";

CREATE INDEX "xarajatlar_xodimId_idx" ON "xarajatlar"("xodimId");

ALTER TABLE "xarajatlar" ADD CONSTRAINT "xarajatlar_xodimId_fkey"
    FOREIGN KEY ("xodimId") REFERENCES "foydalanuvchilar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
