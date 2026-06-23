-- AlterTable
ALTER TABLE "File" ADD COLUMN     "civilDefendants" TEXT[],
ADD COLUMN     "defendants" TEXT[],
ADD COLUMN     "judgmentNumber" TEXT,
ADD COLUMN     "plaintiffs" TEXT[];
