-- Drift tuzatish: bu ustunlar va indekslar productionda migratsiyasiz
-- (to'g'ridan-to'g'ri) qo'shilgan edi, shu sabab migratsiya tarixida yo'q edi.
-- schema.prisma'dagi BildirishnomLog modeliga mos holga keltiramiz.

ALTER TABLE "bildirishnom_loglar" ADD COLUMN IF NOT EXISTS "xabarMatni" TEXT;
ALTER TABLE "bildirishnom_loglar" ADD COLUMN IF NOT EXISTS "telegramTarget" TEXT;
ALTER TABLE "bildirishnom_loglar" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "bildirishnom_loglar" ADD COLUMN IF NOT EXISTS "urinishSoni" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "bildirishnom_loglar" ADD COLUMN IF NOT EXISTS "yuborilganSana" TIMESTAMP(3);

-- nasiyaId ixtiyoriy bo'lishi kerak (kod null qiymat bilan yozadi)
ALTER TABLE "bildirishnom_loglar" ALTER COLUMN "nasiyaId" DROP NOT NULL;

-- schema.prisma'dagi qolgan ikkita indeks (uchinchisini 20260521 o'zi yaratadi)
CREATE INDEX IF NOT EXISTS "bildirishnom_loglar_status_sana_idx"
  ON "bildirishnom_loglar"("status", "sana");
CREATE INDEX IF NOT EXISTS "bildirishnom_loglar_xabarTuri_idx"
  ON "bildirishnom_loglar"("xabarTuri");
