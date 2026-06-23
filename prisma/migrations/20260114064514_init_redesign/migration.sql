-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'UPLOAD', 'VIEWER', 'BASIC');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'BASIC',
    "unit" TEXT,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgencyHistory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),

    CONSTRAINT "AgencyHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageBox" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "warehouse" TEXT NOT NULL,
    "line" TEXT NOT NULL,
    "shelf" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "boxNumber" TEXT NOT NULL,
    "agencyId" TEXT,
    "labelDetails" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorageBox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "File" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "pageCount" INTEGER,
    "details" JSONB,
    "judgmentDate" TIMESTAMP(3),
    "retention" TEXT,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'IN_STOCK',
    "boxId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "title" TEXT NOT NULL,
    "year" INTEGER,
    "pageCount" INTEGER,
    "order" INTEGER NOT NULL,
    "fileId" TEXT NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BorrowSlip" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "borrowerName" TEXT NOT NULL,
    "borrowerUnit" TEXT,
    "borrowerTitle" TEXT,
    "reason" TEXT,
    "borrowDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "returnedDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'BORROWING',
    "lenderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BorrowSlip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BorrowItem" (
    "id" TEXT NOT NULL,
    "borrowSlipId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "returnedDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'BORROWING',
    "condition" TEXT,

    CONSTRAINT "BorrowItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "targetId" TEXT,
    "detail" JSONB,
    "ipAddress" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "StorageBox_code_key" ON "StorageBox"("code");

-- CreateIndex
CREATE INDEX "StorageBox_warehouse_line_shelf_slot_idx" ON "StorageBox"("warehouse", "line", "shelf", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "File_code_key" ON "File"("code");

-- CreateIndex
CREATE UNIQUE INDEX "BorrowSlip_code_key" ON "BorrowSlip"("code");

-- CreateIndex
CREATE UNIQUE INDEX "BorrowItem_borrowSlipId_fileId_key" ON "BorrowItem"("borrowSlipId", "fileId");

-- AddForeignKey
ALTER TABLE "StorageBox" ADD CONSTRAINT "StorageBox_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "AgencyHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_boxId_fkey" FOREIGN KEY ("boxId") REFERENCES "StorageBox"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BorrowSlip" ADD CONSTRAINT "BorrowSlip_lenderId_fkey" FOREIGN KEY ("lenderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BorrowItem" ADD CONSTRAINT "BorrowItem_borrowSlipId_fkey" FOREIGN KEY ("borrowSlipId") REFERENCES "BorrowSlip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BorrowItem" ADD CONSTRAINT "BorrowItem_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
