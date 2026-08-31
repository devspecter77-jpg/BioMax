-- CreateTable
CREATE TABLE "ruxsatlar" (
    "id" TEXT NOT NULL,
    "foydalanuvchiId" TEXT NOT NULL,
    "bolim" TEXT NOT NULL,
    "korinadi" BOOLEAN NOT NULL,
    "yangilangan" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ruxsatlar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ruxsatlar_foydalanuvchiId_bolim_key" ON "ruxsatlar"("foydalanuvchiId", "bolim");

-- AddForeignKey
ALTER TABLE "ruxsatlar" ADD CONSTRAINT "ruxsatlar_foydalanuvchiId_fkey" FOREIGN KEY ("foydalanuvchiId") REFERENCES "foydalanuvchilar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
