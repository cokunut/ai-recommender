-- CreateTable
CREATE TABLE "ReadingTasteTag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReadingTasteTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReadingTasteTag_userId_idx" ON "ReadingTasteTag"("userId");

-- AddForeignKey
ALTER TABLE "ReadingTasteTag" ADD CONSTRAINT "ReadingTasteTag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
