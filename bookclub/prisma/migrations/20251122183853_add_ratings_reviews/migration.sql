-- AlterTable
ALTER TABLE "ReadingRound" ADD COLUMN     "aiGroupReview" TEXT;

-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL,
    "readingRoundId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "readingRoundId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reviewText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Rating_readingRoundId_idx" ON "Rating"("readingRoundId");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_readingRoundId_userId_key" ON "Rating"("readingRoundId", "userId");

-- CreateIndex
CREATE INDEX "Review_readingRoundId_idx" ON "Review"("readingRoundId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_readingRoundId_userId_key" ON "Review"("readingRoundId", "userId");

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_readingRoundId_fkey" FOREIGN KEY ("readingRoundId") REFERENCES "ReadingRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_readingRoundId_fkey" FOREIGN KEY ("readingRoundId") REFERENCES "ReadingRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
