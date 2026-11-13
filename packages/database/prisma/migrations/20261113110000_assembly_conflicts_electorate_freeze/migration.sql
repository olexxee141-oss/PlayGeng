CREATE TYPE "AssemblyConflictDeclarationStatus" AS ENUM ('OPEN', 'WITHDRAWN', 'CONFLICT_CONFIRMED', 'NO_CONFLICT');

ALTER TYPE "AssemblyCaseEventType" ADD VALUE IF NOT EXISTS 'CONFLICT_REVIEW_STARTED';
ALTER TYPE "AssemblyCaseEventType" ADD VALUE IF NOT EXISTS 'ELECTORATE_FROZEN';

ALTER TABLE "assembly_cases"
  ADD COLUMN "conflictReviewStartedAt" TIMESTAMP(3),
  ADD COLUMN "electorateFrozenAt" TIMESTAMP(3),
  ADD COLUMN "eligibleVoterCount" INTEGER;

CREATE TABLE "assembly_conflict_declarations" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "declarantId" TEXT NOT NULL,
  "subjectUserId" TEXT NOT NULL,
  "reason" VARCHAR(2000) NOT NULL,
  "status" "AssemblyConflictDeclarationStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "withdrawnAt" TIMESTAMP(3),
  "determinedAt" TIMESTAMP(3),
  CONSTRAINT "assembly_conflict_declarations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "assembly_conflict_declarations_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "assembly_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "assembly_conflict_declarations_declarantId_fkey" FOREIGN KEY ("declarantId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "assembly_conflict_declarations_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "assembly_conflict_decisions" (
  "id" TEXT NOT NULL,
  "declarationId" TEXT NOT NULL,
  "reviewerId" TEXT NOT NULL,
  "conflictExists" BOOLEAN NOT NULL,
  "reason" VARCHAR(1000) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "assembly_conflict_decisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "assembly_conflict_decisions_declarationId_fkey" FOREIGN KEY ("declarationId") REFERENCES "assembly_conflict_declarations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "assembly_conflict_decisions_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "assembly_case_electorate_members" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "eligible" BOOLEAN NOT NULL,
  "exclusionReason" VARCHAR(80),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "assembly_case_electorate_members_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "assembly_case_electorate_members_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "assembly_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "assembly_case_electorate_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "assembly_conflict_declarations_one_open_per_subject_key"
  ON "assembly_conflict_declarations"("caseId", "subjectUserId") WHERE "status" = 'OPEN';
CREATE INDEX "assembly_conflict_declarations_caseId_status_createdAt_idx" ON "assembly_conflict_declarations"("caseId", "status", "createdAt");
CREATE INDEX "assembly_conflict_declarations_subjectUserId_status_idx" ON "assembly_conflict_declarations"("subjectUserId", "status");
CREATE UNIQUE INDEX "assembly_conflict_decisions_declarationId_reviewerId_key" ON "assembly_conflict_decisions"("declarationId", "reviewerId");
CREATE INDEX "assembly_conflict_decisions_declarationId_createdAt_idx" ON "assembly_conflict_decisions"("declarationId", "createdAt");
CREATE UNIQUE INDEX "assembly_case_electorate_members_caseId_userId_key" ON "assembly_case_electorate_members"("caseId", "userId");
CREATE INDEX "assembly_case_electorate_members_caseId_eligible_idx" ON "assembly_case_electorate_members"("caseId", "eligible");

-- A case may only be withdrawn or advance monotonically through conflict review and electorate freeze.
CREATE OR REPLACE FUNCTION "guard_assembly_case_transition"() RETURNS trigger AS $$
BEGIN
  IF NEW."communityId" IS DISTINCT FROM OLD."communityId"
    OR NEW."assessmentMemberId" IS DISTINCT FROM OLD."assessmentMemberId"
    OR NEW."requesterId" IS DISTINCT FROM OLD."requesterId"
    OR NEW."reason" IS DISTINCT FROM OLD."reason"
    OR NEW."submittedAt" IS DISTINCT FROM OLD."submittedAt"
    OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'Assembly case identity and submission content are immutable';
  END IF;

  IF OLD."status" = 'SUBMITTED' AND NEW."status" = 'SUBMITTED' THEN
    IF OLD."withdrawnAt" IS DISTINCT FROM NEW."withdrawnAt"
      OR (OLD."conflictReviewStartedAt" IS NOT NULL AND NEW."conflictReviewStartedAt" IS DISTINCT FROM OLD."conflictReviewStartedAt")
      OR (OLD."electorateFrozenAt" IS NOT NULL AND NEW."electorateFrozenAt" IS DISTINCT FROM OLD."electorateFrozenAt")
      OR (OLD."eligibleVoterCount" IS NOT NULL AND NEW."eligibleVoterCount" IS DISTINCT FROM OLD."eligibleVoterCount") THEN
      RAISE EXCEPTION 'Assembly case governance milestones are immutable once recorded';
    END IF;
    IF OLD."electorateFrozenAt" IS NOT NULL AND NEW."conflictReviewStartedAt" IS DISTINCT FROM OLD."conflictReviewStartedAt" THEN
      RAISE EXCEPTION 'Conflict review cannot change after electorate freeze';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD."status" = 'SUBMITTED' AND NEW."status" = 'WITHDRAWN'
    AND OLD."conflictReviewStartedAt" IS NULL AND OLD."electorateFrozenAt" IS NULL
    AND NEW."withdrawnAt" IS NOT NULL AND OLD."withdrawnAt" IS NULL
    AND NEW."conflictReviewStartedAt" IS NOT DISTINCT FROM OLD."conflictReviewStartedAt"
    AND NEW."electorateFrozenAt" IS NOT DISTINCT FROM OLD."electorateFrozenAt"
    AND NEW."eligibleVoterCount" IS NOT DISTINCT FROM OLD."eligibleVoterCount" THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid Assembly case state transition';
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "guard_assembly_conflict_declaration"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Assembly conflict declarations are retained for audit';
  END IF;
  IF NEW."caseId" IS DISTINCT FROM OLD."caseId"
    OR NEW."declarantId" IS DISTINCT FROM OLD."declarantId"
    OR NEW."subjectUserId" IS DISTINCT FROM OLD."subjectUserId"
    OR NEW."reason" IS DISTINCT FROM OLD."reason"
    OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'Assembly conflict declaration content is immutable';
  END IF;
  IF OLD."status" <> 'OPEN' OR NEW."status" NOT IN ('WITHDRAWN','CONFLICT_CONFIRMED','NO_CONFLICT') THEN
    RAISE EXCEPTION 'Invalid Assembly conflict declaration transition';
  END IF;
  IF NEW."status" = 'WITHDRAWN' AND (NEW."withdrawnAt" IS NULL OR NEW."determinedAt" IS NOT NULL) THEN
    RAISE EXCEPTION 'Withdrawal must be timestamped and cannot be a determination';
  END IF;
  IF NEW."status" IN ('CONFLICT_CONFIRMED','NO_CONFLICT') AND (NEW."determinedAt" IS NULL OR NEW."withdrawnAt" IS NOT NULL) THEN
    RAISE EXCEPTION 'Conflict determination must be timestamped';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "assembly_conflict_declarations_transition_guard"
BEFORE UPDATE OR DELETE ON "assembly_conflict_declarations"
FOR EACH ROW EXECUTE FUNCTION "guard_assembly_conflict_declaration"();

CREATE FUNCTION "reject_assembly_conflict_decision_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Assembly conflict decisions are append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "assembly_conflict_decisions_append_only"
BEFORE UPDATE OR DELETE ON "assembly_conflict_decisions"
FOR EACH ROW EXECUTE FUNCTION "reject_assembly_conflict_decision_mutation"();

CREATE FUNCTION "reject_assembly_electorate_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Frozen Assembly electorates are immutable';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "assembly_case_electorate_append_only"
BEFORE UPDATE OR DELETE ON "assembly_case_electorate_members"
FOR EACH ROW EXECUTE FUNCTION "reject_assembly_electorate_mutation"();

CREATE FUNCTION "guard_assembly_case_event_type"() RETURNS trigger AS $$
BEGIN
  IF NEW."type" NOT IN ('SUBMITTED','WITHDRAWN','CONFLICT_REVIEW_STARTED','ELECTORATE_FROZEN') THEN
    RAISE EXCEPTION 'Invalid Assembly case event type';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
