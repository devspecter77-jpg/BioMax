-- CreateTable
CREATE TABLE IF NOT EXISTS "tovar_yashirish" (
    "id" TEXT NOT NULL,
    "tovarId" TEXT NOT NULL,
    "foydalanuvchiId" TEXT NOT NULL,
    "yaratilgan" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tovar_yashirish_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tovar_yashirish_foydalanuvchiId_idx" ON "tovar_yashirish"("foydalanuvchiId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "tovar_yashirish_tovarId_foydalanuvchiId_key" ON "tovar_yashirish"("tovarId", "foydalanuvchiId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "tovar_yashirish" ADD CONSTRAINT "tovar_yashirish_tovarId_fkey" FOREIGN KEY ("tovarId") REFERENCES "tovarlar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "tovar_yashirish" ADD CONSTRAINT "tovar_yashirish_foydalanuvchiId_fkey" FOREIGN KEY ("foydalanuvchiId") REFERENCES "foydalanuvchilar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
