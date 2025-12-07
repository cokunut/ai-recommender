-- CreateEnum
CREATE TYPE "TagPreference" AS ENUM ('LIKE', 'DISLIKE');

-- AlterTable
ALTER TABLE "ReadingTasteTag" ADD COLUMN     "preference" "TagPreference" NOT NULL DEFAULT 'LIKE';
