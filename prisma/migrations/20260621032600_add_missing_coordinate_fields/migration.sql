-- AlterEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'UserRole' AND e.enumlabel = 'BASIC_VIEWER') THEN
    ALTER TYPE "UserRole" ADD VALUE 'BASIC_VIEWER';
  END IF;
END
$$;

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "macAddress" TEXT;

-- AlterTable
ALTER TABLE "BorrowItem" ALTER COLUMN "status" SET DEFAULT 'REQUESTED';

-- AlterTable
ALTER TABLE "BorrowSlip" ALTER COLUMN "status" SET DEFAULT 'PENDING_APPROVAL';

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "updatedById" TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "File" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "updatedById" TEXT;

-- AlterTable
ALTER TABLE "UserAccessLog" ADD COLUMN     "macAddress" TEXT;

-- AlterTable
ALTER TABLE "user" RENAME CONSTRAINT "User_pkey" TO "user_pkey";

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "User_username_key" RENAME TO "user_username_key";
