CREATE TABLE "StorageLayout" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "data" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StorageLayout_pkey" PRIMARY KEY ("id")
);
