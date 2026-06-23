-- CreateTable
CREATE TABLE "BorrowSlipEvent" (
    "id" TEXT NOT NULL,
    "borrowSlipId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "description" TEXT,
    "details" JSONB,
    "creatorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BorrowSlipEvent_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "BorrowSlipEvent" ADD CONSTRAINT "BorrowSlipEvent_borrowSlipId_fkey" FOREIGN KEY ("borrowSlipId") REFERENCES "BorrowSlip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BorrowSlipEvent" ADD CONSTRAINT "BorrowSlipEvent_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
