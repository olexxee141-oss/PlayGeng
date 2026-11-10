CREATE TYPE "ReceiptSource" AS ENUM ('MANUAL_RECONCILIATION');

ALTER TABLE "obligations"
  ADD CONSTRAINT "obligations_id_treasuryId_memberId_key"
  UNIQUE ("id", "treasuryId", "memberId");

CREATE TABLE "payment_receipts" (
  "id" TEXT NOT NULL,
  "treasuryId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "source" "ReceiptSource" NOT NULL DEFAULT 'MANUAL_RECONCILIATION',
  "amountMinor" BIGINT NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "externalReference" VARCHAR(160) NOT NULL,
  "evidenceReference" VARCHAR(500) NOT NULL,
  "idempotencyKey" VARCHAR(160) NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL,
  "verifiedById" TEXT NOT NULL,
  "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_receipts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_receipts_amount_positive" CHECK ("amountMinor" > 0),
  CONSTRAINT "payment_receipts_currency_format" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "payment_receipts_treasury_fkey" FOREIGN KEY ("treasuryId") REFERENCES "treasuries"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payment_receipts_member_fkey" FOREIGN KEY ("memberId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payment_receipts_verifier_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payment_receipts_id_treasuryId_memberId_key" UNIQUE ("id", "treasuryId", "memberId"),
  CONSTRAINT "payment_receipts_treasuryId_externalReference_key" UNIQUE ("treasuryId", "externalReference"),
  CONSTRAINT "payment_receipts_treasuryId_idempotencyKey_key" UNIQUE ("treasuryId", "idempotencyKey")
);

CREATE INDEX "payment_receipts_treasuryId_memberId_receivedAt_idx"
  ON "payment_receipts"("treasuryId", "memberId", "receivedAt");

CREATE TABLE "obligation_allocations" (
  "id" TEXT NOT NULL,
  "treasuryId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "receiptId" TEXT NOT NULL,
  "obligationId" TEXT NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "idempotencyKey" VARCHAR(160) NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "obligation_allocations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "obligation_allocations_amount_positive" CHECK ("amountMinor" > 0),
  CONSTRAINT "obligation_allocations_treasury_fkey" FOREIGN KEY ("treasuryId") REFERENCES "treasuries"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "obligation_allocations_receipt_member_fkey" FOREIGN KEY ("receiptId", "treasuryId", "memberId") REFERENCES "payment_receipts"("id", "treasuryId", "memberId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "obligation_allocations_obligation_member_fkey" FOREIGN KEY ("obligationId", "treasuryId", "memberId") REFERENCES "obligations"("id", "treasuryId", "memberId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "obligation_allocations_actor_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "obligation_allocations_treasuryId_idempotencyKey_key" UNIQUE ("treasuryId", "idempotencyKey"),
  CONSTRAINT "obligation_allocations_receiptId_obligationId_key" UNIQUE ("receiptId", "obligationId")
);

CREATE INDEX "obligation_allocations_treasuryId_obligationId_createdAt_idx"
  ON "obligation_allocations"("treasuryId", "obligationId", "createdAt");
CREATE INDEX "obligation_allocations_treasuryId_receiptId_idx"
  ON "obligation_allocations"("treasuryId", "receiptId");
