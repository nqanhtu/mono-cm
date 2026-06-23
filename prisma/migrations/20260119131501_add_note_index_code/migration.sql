/*
  Warnings:

  - The values [UPLOAD,BASIC] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `fileId` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `labelDetails` on the `StorageBox` table. All the data in the column will be lost.
  - Added the required column `datetime` to the `File` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'VIEWER', 'COORDINATOR');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'VIEWER';
COMMIT;

-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_fileId_fkey";

-- AlterTable
ALTER TABLE "Document" DROP COLUMN "fileId";

-- AlterTable
ALTER TABLE "File" ADD COLUMN     "datetime" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "indexCode" TEXT,
ADD COLUMN     "note" TEXT,
ALTER COLUMN "year" DROP NOT NULL;

-- AlterTable
ALTER TABLE "StorageBox" DROP COLUMN "labelDetails",
ADD COLUMN     "caseType" TEXT,
ADD COLUMN     "fromFileCode" TEXT,
ADD COLUMN     "retention" TEXT,
ADD COLUMN     "toFileCode" TEXT,
ADD COLUMN     "year" INTEGER;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'VIEWER';

-- CreateTable
CREATE TABLE "StorageBoxLabel" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "fromYear" INTEGER,
    "toYear" INTEGER,
    "label" TEXT NOT NULL,
    "storageBoxId" TEXT,

    CONSTRAINT "StorageBoxLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileIndex" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "attachments" TEXT[],
    "totalPage" INTEGER NOT NULL,
    "judgmentTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FileIndex_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FileIndex_fileId_key" ON "FileIndex"("fileId");

-- AddForeignKey
ALTER TABLE "StorageBoxLabel" ADD CONSTRAINT "StorageBoxLabel_storageBoxId_fkey" FOREIGN KEY ("storageBoxId") REFERENCES "StorageBox"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileIndex" ADD CONSTRAINT "FileIndex_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;
