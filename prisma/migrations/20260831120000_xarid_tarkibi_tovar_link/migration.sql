-- Xarid tarkibini haqiqiy tovarga bog'lash (xarid qilinganda avtomatik omborga kirim uchun)
ALTER TABLE "xarid_tarkibi" ADD COLUMN IF NOT EXISTS "tovarId" TEXT;

ALTER TABLE "xarid_tarkibi" DROP CONSTRAINT IF EXISTS "xarid_tarkibi_tovarId_fkey";
ALTER TABLE "xarid_tarkibi" ADD CONSTRAINT "xarid_tarkibi_tovarId_fkey"
  FOREIGN KEY ("tovarId") REFERENCES "tovarlar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
