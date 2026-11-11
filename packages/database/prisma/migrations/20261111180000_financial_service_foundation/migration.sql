-- Financial Service foundation. Keep provider credentials and provider-specific
-- integrations out of this migration; this establishes only provider-neutral records.

ALTER TYPE "ReceiptSource" ADD VALUE IF NOT EXISTS 'PROVIDER_SETTLEMENT';

CREATE TYPE "FinancialProviderStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "FinancialCollectionStatus" AS ENUM ('CREATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED');
CREATE TYPE "ProviderEventStatus" AS ENUM ('RECEIVED', 'VALIDATED', 'REJECTED', 'PROCESSED', 'FAILED');
CREATE TYPE "FinancialSettlementStatus" AS ENUM ('PENDING', 'SETTLED', 'FAILED', 'RECONCILIATION_REQUIRED');
CREATE TYPE "FinancialReconciliationStatus" AS ENUM ('OPEN', 'MATCHED', 'DISCREPANCY', 'RESOLVED');

CREATE TABLE "financial_providers" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "displayName" VARCHAR(120) NOT NULL,
    "status" "FinancialProviderStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "financial_providers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "financial_collections" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "treasuryId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "obligationId" TEXT,
    "amountMinor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "FinancialCollectionStatus" NOT NULL DEFAULT 'CREATED',
    "idempotencyKey" VARCHAR(160) NOT NULL,
    "externalReference" VARCHAR(160),
    "providerCollectionId" VARCHAR(160),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "financial_collections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "provider_events" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "collectionId" TEXT,
    "externalEventId" VARCHAR(160) NOT NULL,
    "eventType" VARCHAR(120) NOT NULL,
    "status" "ProviderEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validatedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "failureReason" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "provider_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "financial_settlements" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "treasuryReceiptId" TEXT,
    "status" "FinancialSettlementStatus" NOT NULL DEFAULT 'PENDING',
    "amountMinor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "idempotencyKey" VARCHAR(160) NOT NULL,
    "failureReason" VARCHAR(500),
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "financial_settlements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "financial_reconciliation_records" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "settlementId" TEXT,
    "status" "FinancialReconciliationStatus" NOT NULL DEFAULT 'OPEN',
    "expectedAmountMinor" BIGINT NOT NULL,
    "observedAmountMinor" BIGINT,
    "currency" CHAR(3) NOT NULL,
    "reason" VARCHAR(500),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "financial_reconciliation_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "financial_providers_code_key" ON "financial_providers"("code");
CREATE INDEX "financial_providers_status_idx" ON "financial_providers"("status");

CREATE UNIQUE INDEX "financial_collections_treasuryId_idempotencyKey_key" ON "financial_collections"("treasuryId", "idempotencyKey");
CREATE UNIQUE INDEX "financial_collections_providerId_externalReference_key" ON "financial_collections"("providerId", "externalReference");
CREATE UNIQUE INDEX "financial_collections_providerId_providerCollectionId_key" ON "financial_collections"("providerId", "providerCollectionId");
CREATE INDEX "financial_collections_treasuryId_memberId_status_createdAt_idx" ON "financial_collections"("treasuryId", "memberId", "status", "createdAt");
CREATE INDEX "financial_collections_obligationId_idx" ON "financial_collections"("obligationId");
CREATE INDEX "financial_collections_providerId_status_createdAt_idx" ON "financial_collections"("providerId", "status", "createdAt");

CREATE UNIQUE INDEX "provider_events_providerId_externalEventId_key" ON "provider_events"("providerId", "externalEventId");
CREATE INDEX "provider_events_providerId_status_receivedAt_idx" ON "provider_events"("providerId", "status", "receivedAt");
CREATE INDEX "provider_events_collectionId_receivedAt_idx" ON "provider_events"("collectionId", "receivedAt");

CREATE UNIQUE INDEX "financial_settlements_collectionId_key" ON "financial_settlements"("collectionId");
CREATE UNIQUE INDEX "financial_settlements_providerEventId_key" ON "financial_settlements"("providerEventId");
CREATE UNIQUE INDEX "financial_settlements_treasuryReceiptId_key" ON "financial_settlements"("treasuryReceiptId");
CREATE UNIQUE INDEX "financial_settlements_idempotencyKey_key" ON "financial_settlements"("idempotencyKey");
CREATE INDEX "financial_settlements_status_createdAt_idx" ON "financial_settlements"("status", "createdAt");

CREATE INDEX "financial_reconciliation_records_status_createdAt_idx" ON "financial_reconciliation_records"("status", "createdAt");
CREATE INDEX "financial_reconciliation_records_collectionId_createdAt_idx" ON "financial_reconciliation_records"("collectionId", "createdAt");
CREATE INDEX "financial_reconciliation_records_settlementId_idx" ON "financial_reconciliation_records"("settlementId");

ALTER TABLE "financial_collections" ADD CONSTRAINT "financial_collections_providerId_fkey"
    FOREIGN KEY ("providerId") REFERENCES "financial_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_collections" ADD CONSTRAINT "financial_collections_treasuryId_fkey"
    FOREIGN KEY ("treasuryId") REFERENCES "treasuries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_collections" ADD CONSTRAINT "financial_collections_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_collections" ADD CONSTRAINT "financial_collections_obligationId_fkey"
    FOREIGN KEY ("obligationId") REFERENCES "obligations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_collections" ADD CONSTRAINT "financial_collections_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "provider_events" ADD CONSTRAINT "provider_events_providerId_fkey"
    FOREIGN KEY ("providerId") REFERENCES "financial_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_events" ADD CONSTRAINT "provider_events_collectionId_fkey"
    FOREIGN KEY ("collectionId") REFERENCES "financial_collections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "financial_settlements" ADD CONSTRAINT "financial_settlements_collectionId_fkey"
    FOREIGN KEY ("collectionId") REFERENCES "financial_collections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_settlements" ADD CONSTRAINT "financial_settlements_providerEventId_fkey"
    FOREIGN KEY ("providerEventId") REFERENCES "provider_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_settlements" ADD CONSTRAINT "financial_settlements_treasuryReceiptId_fkey"
    FOREIGN KEY ("treasuryReceiptId") REFERENCES "payment_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "financial_reconciliation_records" ADD CONSTRAINT "financial_reconciliation_records_collectionId_fkey"
    FOREIGN KEY ("collectionId") REFERENCES "financial_collections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_reconciliation_records" ADD CONSTRAINT "financial_reconciliation_records_settlementId_fkey"
    FOREIGN KEY ("settlementId") REFERENCES "financial_settlements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
