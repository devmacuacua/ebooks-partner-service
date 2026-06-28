CREATE TYPE "PartnerStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'EXHAUSTED');

CREATE TABLE "partners" (
    "id"               UUID         NOT NULL DEFAULT gen_random_uuid(),
    "userId"           VARCHAR(255) NOT NULL,
    "name"             VARCHAR(255) NOT NULL,
    "email"            VARCHAR(255) NOT NULL,
    "websiteUrl"       VARCHAR(500),
    "description"      TEXT,
    "logoUrl"          VARCHAR(500),
    "status"           "PartnerStatus" NOT NULL DEFAULT 'PENDING',
    "revenueSharePct"  INTEGER      NOT NULL DEFAULT 80,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "partners_userId_key" ON "partners"("userId");
CREATE UNIQUE INDEX "partners_email_key" ON "partners"("email");

CREATE TABLE "api_keys" (
    "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
    "partnerId"     UUID         NOT NULL,
    "name"          VARCHAR(255) NOT NULL,
    "publicKey"     VARCHAR(255) NOT NULL,
    "secretKeyHash" VARCHAR(255) NOT NULL,
    "lastUsedAt"    TIMESTAMP(3),
    "revokedAt"     TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "api_keys_publicKey_key" ON "api_keys"("publicKey");

ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "partner_books" (
    "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
    "partnerId"   UUID         NOT NULL,
    "bookId"      VARCHAR(255) NOT NULL,
    "enabled"     BOOLEAN      NOT NULL DEFAULT TRUE,
    "customPrice" DECIMAL(10, 2),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_books_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "partner_books_partnerId_bookId_key" ON "partner_books"("partnerId", "bookId");

ALTER TABLE "partner_books" ADD CONSTRAINT "partner_books_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "webhooks" (
    "id"        UUID         NOT NULL DEFAULT gen_random_uuid(),
    "partnerId" UUID         NOT NULL,
    "url"       VARCHAR(500) NOT NULL,
    "events"    TEXT[]       NOT NULL,
    "secret"    VARCHAR(255) NOT NULL,
    "active"    BOOLEAN      NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "webhook_deliveries" (
    "id"            UUID            NOT NULL DEFAULT gen_random_uuid(),
    "webhookId"     UUID            NOT NULL,
    "event"         VARCHAR(100)    NOT NULL,
    "payload"       JSONB           NOT NULL,
    "status"        "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts"      INTEGER         NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "responseCode"  INTEGER,
    "responseBody"  TEXT,
    "createdAt"     TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "webhook_deliveries_status_nextAttemptAt_idx"
    ON "webhook_deliveries"("status", "nextAttemptAt");

ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhookId_fkey"
    FOREIGN KEY ("webhookId") REFERENCES "webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "revenue_shares" (
    "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
    "partnerId"      UUID         NOT NULL,
    "orderId"        VARCHAR(255) NOT NULL,
    "orderItemId"    VARCHAR(255) NOT NULL,
    "bookId"         VARCHAR(255) NOT NULL,
    "bookTitle"      VARCHAR(500) NOT NULL,
    "grossAmount"    DECIMAL(10, 2) NOT NULL,
    "partnerAmount"  DECIMAL(10, 2) NOT NULL,
    "platformAmount" DECIMAL(10, 2) NOT NULL,
    "currency"       VARCHAR(10)  NOT NULL DEFAULT 'MZN',
    "settledAt"      TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revenue_shares_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "revenue_shares_orderItemId_key" ON "revenue_shares"("orderItemId");
CREATE INDEX "revenue_shares_partnerId_settledAt_idx" ON "revenue_shares"("partnerId", "settledAt");

ALTER TABLE "revenue_shares" ADD CONSTRAINT "revenue_shares_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON UPDATE CASCADE;
