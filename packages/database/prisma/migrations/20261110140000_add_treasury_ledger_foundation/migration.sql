CREATE TYPE "TreasuryAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE');
CREATE TYPE "JournalTransactionType" AS ENUM ('OPENING_BALANCE', 'OBLIGATION_ISSUED', 'PAYMENT_RECEIVED', 'CONTRIBUTION_RECEIVED', 'EXPENSE_PAID', 'REFUND', 'ADJUSTMENT', 'REVERSAL');
CREATE TYPE "JournalTransactionStatus" AS ENUM ('DRAFT', 'POSTED');
CREATE TYPE "LedgerPostingSide" AS ENUM ('DEBIT', 'CREDIT');
CREATE TYPE "ObligationSourceType" AS ENUM ('CONTRIBUTION', 'MATCH_FEE', 'COMPETITION_FEE', 'OTHER');
CREATE TYPE "ObligationStatus" AS ENUM ('OPEN', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED');

CREATE TABLE "treasuries" (
  "id" TEXT NOT NULL,
  "communityId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "treasuries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "treasuries_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "treasuries_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "treasuries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "treasuries_communityId_key" ON "treasuries"("communityId");

CREATE TABLE "treasury_accounts" (
  "id" TEXT NOT NULL,
  "treasuryId" TEXT NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "type" "TreasuryAccountType" NOT NULL,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "treasury_accounts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "treasury_accounts_treasuryId_fkey" FOREIGN KEY ("treasuryId") REFERENCES "treasuries"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "treasury_accounts_treasuryId_code_key" ON "treasury_accounts"("treasuryId", "code");
CREATE UNIQUE INDEX "treasury_accounts_id_treasuryId_key" ON "treasury_accounts"("id", "treasuryId");
CREATE INDEX "treasury_accounts_treasuryId_type_isActive_idx" ON "treasury_accounts"("treasuryId", "type", "isActive");

CREATE TABLE "journal_transactions" (
  "id" TEXT NOT NULL,
  "treasuryId" TEXT NOT NULL,
  "type" "JournalTransactionType" NOT NULL,
  "status" "JournalTransactionStatus" NOT NULL DEFAULT 'DRAFT',
  "description" VARCHAR(500) NOT NULL,
  "sourceType" VARCHAR(64),
  "sourceId" VARCHAR(128),
  "idempotencyKey" VARCHAR(160) NOT NULL,
  "createdById" TEXT NOT NULL,
  "reversalOfId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "postedAt" TIMESTAMP(3),
  CONSTRAINT "journal_transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "journal_transactions_treasuryId_fkey" FOREIGN KEY ("treasuryId") REFERENCES "treasuries"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "journal_transactions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "journal_transactions_reversalOfId_treasuryId_fkey" FOREIGN KEY ("reversalOfId", "treasuryId") REFERENCES "journal_transactions"("id", "treasuryId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "journal_transactions_postedAt_check" CHECK (("status" = 'DRAFT' AND "postedAt" IS NULL) OR ("status" = 'POSTED' AND "postedAt" IS NOT NULL))
);
CREATE UNIQUE INDEX "journal_transactions_treasuryId_idempotencyKey_key" ON "journal_transactions"("treasuryId", "idempotencyKey");
CREATE UNIQUE INDEX "journal_transactions_id_treasuryId_key" ON "journal_transactions"("id", "treasuryId");
CREATE UNIQUE INDEX "journal_transactions_reversalOfId_key" ON "journal_transactions"("reversalOfId");
CREATE INDEX "journal_transactions_treasuryId_status_postedAt_idx" ON "journal_transactions"("treasuryId", "status", "postedAt");
CREATE INDEX "journal_transactions_treasuryId_createdAt_idx" ON "journal_transactions"("treasuryId", "createdAt");
CREATE INDEX "journal_transactions_sourceType_sourceId_idx" ON "journal_transactions"("sourceType", "sourceId");

CREATE TABLE "ledger_postings" (
  "id" TEXT NOT NULL,
  "treasuryId" TEXT NOT NULL,
  "journalTransactionId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "side" "LedgerPostingSide" NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ledger_postings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ledger_postings_amountMinor_check" CHECK ("amountMinor" > 0),
  CONSTRAINT "ledger_postings_journalTransactionId_treasuryId_fkey" FOREIGN KEY ("journalTransactionId", "treasuryId") REFERENCES "journal_transactions"("id", "treasuryId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ledger_postings_accountId_treasuryId_fkey" FOREIGN KEY ("accountId", "treasuryId") REFERENCES "treasury_accounts"("id", "treasuryId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ledger_postings_treasuryId_accountId_createdAt_idx" ON "ledger_postings"("treasuryId", "accountId", "createdAt");
CREATE INDEX "ledger_postings_journalTransactionId_idx" ON "ledger_postings"("journalTransactionId");

CREATE TABLE "obligations" (
  "id" TEXT NOT NULL,
  "treasuryId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "sourceType" "ObligationSourceType" NOT NULL,
  "sourceId" VARCHAR(128) NOT NULL,
  "idempotencyKey" VARCHAR(160) NOT NULL,
  "description" VARCHAR(500) NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "status" "ObligationStatus" NOT NULL DEFAULT 'OPEN',
  "dueAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "cancelledAt" TIMESTAMP(3),
  "cancellationReason" VARCHAR(300),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "obligations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "obligations_amountMinor_check" CHECK ("amountMinor" > 0),
  CONSTRAINT "obligations_cancellation_check" CHECK (("status" = 'CANCELLED' AND "cancelledAt" IS NOT NULL AND "cancellationReason" IS NOT NULL) OR ("status" <> 'CANCELLED' AND "cancelledAt" IS NULL)),
  CONSTRAINT "obligations_treasuryId_fkey" FOREIGN KEY ("treasuryId") REFERENCES "treasuries"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "obligations_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "obligations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "obligations_treasuryId_idempotencyKey_key" ON "obligations"("treasuryId", "idempotencyKey");
CREATE UNIQUE INDEX "obligations_treasuryId_sourceType_sourceId_key" ON "obligations"("treasuryId", "sourceType", "sourceId");
CREATE INDEX "obligations_treasuryId_status_dueAt_idx" ON "obligations"("treasuryId", "status", "dueAt");
CREATE INDEX "obligations_memberId_status_idx" ON "obligations"("memberId", "status");

CREATE TABLE "financial_audit_events" (
  "id" TEXT NOT NULL,
  "treasuryId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" VARCHAR(80) NOT NULL,
  "entityType" VARCHAR(80) NOT NULL,
  "entityId" VARCHAR(128) NOT NULL,
  "reason" VARCHAR(500),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "financial_audit_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "financial_audit_events_treasuryId_fkey" FOREIGN KEY ("treasuryId") REFERENCES "treasuries"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "financial_audit_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "financial_audit_events_treasuryId_createdAt_idx" ON "financial_audit_events"("treasuryId", "createdAt");
CREATE INDEX "financial_audit_events_entityType_entityId_idx" ON "financial_audit_events"("entityType", "entityId");
CREATE INDEX "financial_audit_events_actorId_createdAt_idx" ON "financial_audit_events"("actorId", "createdAt");

CREATE FUNCTION "assert_journal_transaction_balanced"() RETURNS TRIGGER AS $$
DECLARE
  transaction_id TEXT;
  transaction_status "JournalTransactionStatus";
  posting_count BIGINT;
  debit_total NUMERIC;
  credit_total NUMERIC;
BEGIN
  IF TG_TABLE_NAME = 'journal_transactions' THEN
    transaction_id := NEW."id";
  ELSIF TG_OP = 'DELETE' THEN
    transaction_id := OLD."journalTransactionId";
  ELSE
    transaction_id := NEW."journalTransactionId";
  END IF;

  SELECT "status" INTO transaction_status FROM "journal_transactions" WHERE "id" = transaction_id;
  IF NOT FOUND OR transaction_status <> 'POSTED' THEN
    RETURN NULL;
  END IF;

  SELECT COUNT(*),
    COALESCE(SUM(CASE WHEN "side" = 'DEBIT' THEN "amountMinor" ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN "side" = 'CREDIT' THEN "amountMinor" ELSE 0 END), 0)
  INTO posting_count, debit_total, credit_total
  FROM "ledger_postings" WHERE "journalTransactionId" = transaction_id;

  IF posting_count < 2 OR debit_total <> credit_total THEN
    RAISE EXCEPTION 'Posted journal transaction % must contain at least two balanced postings', transaction_id
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "ledger_postings_balanced_constraint"
AFTER INSERT OR UPDATE OR DELETE ON "ledger_postings"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "assert_journal_transaction_balanced"();

CREATE CONSTRAINT TRIGGER "journal_transactions_insert_balanced_constraint"
AFTER INSERT ON "journal_transactions"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "assert_journal_transaction_balanced"();

CREATE CONSTRAINT TRIGGER "journal_transactions_balanced_constraint"
AFTER UPDATE OF "status" ON "journal_transactions"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "assert_journal_transaction_balanced"();

CREATE FUNCTION "prevent_posted_journal_mutation"() RETURNS TRIGGER AS $$
DECLARE
  current_status "JournalTransactionStatus";
BEGIN
  IF TG_TABLE_NAME = 'journal_transactions' THEN
    IF OLD."status" = 'POSTED' THEN
      RAISE EXCEPTION 'Posted journal transactions are immutable; create a reversal instead'
        USING ERRCODE = '55000';
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    SELECT "status" INTO current_status FROM "journal_transactions" WHERE "id" = OLD."journalTransactionId";
  ELSE
    SELECT "status" INTO current_status FROM "journal_transactions" WHERE "id" = NEW."journalTransactionId";
  END IF;
  IF current_status = 'POSTED' THEN
    RAISE EXCEPTION 'Postings for a posted journal transaction are immutable'
      USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "journal_transactions_immutable_trigger"
BEFORE UPDATE OR DELETE ON "journal_transactions"
FOR EACH ROW EXECUTE FUNCTION "prevent_posted_journal_mutation"();

CREATE TRIGGER "ledger_postings_immutable_trigger"
BEFORE INSERT OR UPDATE OR DELETE ON "ledger_postings"
FOR EACH ROW EXECUTE FUNCTION "prevent_posted_journal_mutation"();

CREATE FUNCTION "prevent_financial_audit_mutation"() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Financial audit events are append-only'
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "financial_audit_events_immutable_trigger"
BEFORE UPDATE OR DELETE ON "financial_audit_events"
FOR EACH ROW EXECUTE FUNCTION "prevent_financial_audit_mutation"();


CREATE FUNCTION "protect_treasury_currency"() RETURNS TRIGGER AS $$
BEGIN
  IF OLD."currency" <> NEW."currency" AND EXISTS (
    SELECT 1 FROM "journal_transactions"
    WHERE "treasuryId" = OLD."id" AND "status" = 'POSTED'
  ) THEN
    RAISE EXCEPTION 'Treasury currency cannot change after the first posted journal transaction'
      USING ERRCODE = '55000';
  END IF;
  IF OLD."communityId" <> NEW."communityId" THEN
    RAISE EXCEPTION 'Treasury community ownership is immutable'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "treasuries_currency_immutable_after_posting"
BEFORE UPDATE ON "treasuries"
FOR EACH ROW EXECUTE FUNCTION "protect_treasury_currency"();

CREATE FUNCTION "protect_treasury_account_identity"() RETURNS TRIGGER AS $$
BEGIN
  IF (OLD."code" <> NEW."code" OR OLD."type" <> NEW."type") AND EXISTS (
    SELECT 1 FROM "ledger_postings" WHERE "accountId" = OLD."id"
  ) THEN
    RAISE EXCEPTION 'Treasury account code and type cannot change after postings exist'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "treasury_accounts_identity_immutable_after_posting"
BEFORE UPDATE ON "treasury_accounts"
FOR EACH ROW EXECUTE FUNCTION "protect_treasury_account_identity"();
