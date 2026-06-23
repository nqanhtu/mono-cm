-- AlterTable: Add columns as nullable first
ALTER TABLE "Document" ADD COLUMN "createdAt" TIMESTAMP(3);
ALTER TABLE "Document" ADD COLUMN "updatedAt" TIMESTAMP(3);

-- Backfill older records using parent File's updatedAt
UPDATE "Document" d
SET "createdAt" = f."updatedAt", "updatedAt" = f."updatedAt"
FROM "File" f
WHERE d."fileId" = f.id;

-- If any documents are left without a date (e.g. orphaned), fallback to current_timestamp
UPDATE "Document"
SET "createdAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
WHERE "createdAt" IS NULL;

-- Set defaults and add NOT NULL constraints
ALTER TABLE "Document" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Document" ALTER COLUMN "createdAt" SET NOT NULL;
ALTER TABLE "Document" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Document" ALTER COLUMN "updatedAt" SET NOT NULL;
