-- Merge BASIC_VIEWER into VIEWER: they already carry the exact same
-- permission set (viewFiles, viewStorage, viewReports) in server/lib/rbac.ts,
-- so this only removes a redundant role, it does not take anything away
-- from accounts that were BASIC_VIEWER.

-- 1. Reassign any existing BASIC_VIEWER accounts to VIEWER before the enum
--    value is removed (Postgres refuses to drop an enum value that is still
--    referenced by a row).
UPDATE "user" SET "role" = 'VIEWER' WHERE "role" = 'BASIC_VIEWER';

-- 2. Postgres has no "ALTER TYPE ... DROP VALUE" — recreate the enum without
--    BASIC_VIEWER and swap the column over to it.
ALTER TABLE "user" ALTER COLUMN "role" DROP DEFAULT;

ALTER TYPE "UserRole" RENAME TO "UserRole_old";

CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'VIEWER', 'COORDINATOR');

ALTER TABLE "user" ALTER COLUMN "role" TYPE "UserRole" USING ("role"::text::"UserRole");

ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'VIEWER';

DROP TYPE "UserRole_old";
