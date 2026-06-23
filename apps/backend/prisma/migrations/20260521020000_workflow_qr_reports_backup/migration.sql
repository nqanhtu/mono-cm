ALTER TABLE "BorrowSlip"
  ADD COLUMN "approvedById" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "rejectedById" TEXT,
  ADD COLUMN "rejectedAt" TIMESTAMP(3),
  ADD COLUMN "rejectReason" TEXT,
  ADD COLUMN "exportedById" TEXT,
  ADD COLUMN "exportedAt" TIMESTAMP(3);

UPDATE "BorrowSlip" SET "status" = 'EXPORTED' WHERE "status" = 'BORROWING';

CREATE TABLE "BackupSchedule" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "frequency" TEXT NOT NULL DEFAULT 'DAILY',
  "timeOfDay" TEXT NOT NULL DEFAULT '23:00',
  "retentionDays" INTEGER NOT NULL DEFAULT 7,
  "target" TEXT NOT NULL DEFAULT 'local',
  "lastRunAt" TIMESTAMP(3),
  "lastStatus" TEXT,
  "lastMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BackupSchedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BackupRun" (
  "id" TEXT NOT NULL,
  "filename" TEXT,
  "size" INTEGER,
  "status" TEXT NOT NULL,
  "message" TEXT,
  "target" TEXT NOT NULL DEFAULT 'local',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  CONSTRAINT "BackupRun_pkey" PRIMARY KEY ("id")
);
