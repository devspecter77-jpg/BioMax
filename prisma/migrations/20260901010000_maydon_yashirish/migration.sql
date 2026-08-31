-- DropForeignKey (agar mavjud bo'lsa)
ALTER TABLE "tovar_yashirish" DROP CONSTRAINT IF EXISTS "tovar_yashirish_foydalanuvchiId_fkey";
ALTER TABLE "tovar_yashirish" DROP CONSTRAINT IF EXISTS "tovar_yashirish_tovarId_fkey";

-- DropTable
DROP TABLE IF EXISTS "tovar_yashirish";

-- CreateTable
CREATE TABLE IF NOT EXISTS "maydon_yashirish" (
    "id" TEXT NOT NULL,
    "foydalanuvchiId" TEXT NOT NULL,
    "maydon" TEXT NOT NULL,
    "yaratilgan" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maydon_yashirish_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "maydon_yashirish_foydalanuvchiId_idx" ON "maydon_yashirish"("foydalanuvchiId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "maydon_yashirish_foydalanuvchiId_maydon_key" ON "maydon_yashirish"("foydalanuvchiId", "maydon");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "maydon_yashirish" ADD CONSTRAINT "maydon_yashirish_foydalanuvchiId_fkey" FOREIGN KEY ("foydalanuvchiId") REFERENCES "foydalanuvchilar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
