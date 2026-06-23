CREATE TYPE "UserAccessEvent" AS ENUM ('LOGIN', 'LOGOUT');

CREATE TABLE "UserAccessLog" (
    "id" TEXT NOT NULL,
    "event" "UserAccessEvent" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceType" TEXT,
    "osName" TEXT,
    "osVersion" TEXT,
    "browserName" TEXT,
    "browserVersion" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "UserAccessLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserAccessLog_userId_occurredAt_idx" ON "UserAccessLog"("userId", "occurredAt");
CREATE INDEX "UserAccessLog_event_occurredAt_idx" ON "UserAccessLog"("event", "occurredAt");

ALTER TABLE "UserAccessLog" ADD CONSTRAINT "UserAccessLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
