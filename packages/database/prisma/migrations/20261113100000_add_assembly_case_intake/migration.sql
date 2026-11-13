CREATE TYPE "AssemblyCaseStatus" AS ENUM ('SUBMITTED', 'WITHDRAWN');
CREATE TYPE "AssemblyCaseEventType" AS ENUM ('SUBMITTED', 'WITHDRAWN');

CREATE TABLE "assembly_cases" (
  "id" TEXT NOT NULL,
  "communityId" TEXT NOT NULL,
  "assessmentMemberId" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "reason" VARCHAR(2000) NOT NULL,
  "status" "AssemblyCaseStatus" NOT NULL DEFAULT 'SUBMITTED',
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "withdrawnAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "assembly_cases_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "assembly_cases_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "assembly_cases_assessmentMemberId_fkey" FOREIGN KEY ("assessmentMemberId") REFERENCES "contribution_assessment_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "assembly_cases_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "assembly_case_events" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "type" "AssemblyCaseEventType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "assembly_case_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "assembly_case_events_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "assembly_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "assembly_case_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "assembly_cases_one_submitted_per_snapshot_key" ON "assembly_cases"("assessmentMemberId") WHERE "status" = 'SUBMITTED';
CREATE INDEX "assembly_cases_assessmentMemberId_status_idx" ON "assembly_cases"("assessmentMemberId", "status");
CREATE INDEX "assembly_cases_communityId_status_submittedAt_idx" ON "assembly_cases"("communityId", "status", "submittedAt");
CREATE INDEX "assembly_cases_requesterId_status_submittedAt_idx" ON "assembly_cases"("requesterId", "status", "submittedAt");
CREATE INDEX "assembly_case_events_caseId_createdAt_idx" ON "assembly_case_events"("caseId", "createdAt");
CREATE INDEX "assembly_case_events_actorId_createdAt_idx" ON "assembly_case_events"("actorId", "createdAt");

-- Audit events are append-only. Case events must never be rewritten or deleted.
CREATE FUNCTION "reject_assembly_case_event_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Assembly case audit events are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "assembly_case_events_append_only"
BEFORE UPDATE OR DELETE ON "assembly_case_events"
FOR EACH ROW EXECUTE FUNCTION "reject_assembly_case_event_mutation"();

-- Case identity and submitted reason are immutable; only a pending request may be withdrawn.
CREATE FUNCTION "guard_assembly_case_transition"() RETURNS trigger AS $$
BEGIN
  IF NEW."communityId" IS DISTINCT FROM OLD."communityId"
    OR NEW."assessmentMemberId" IS DISTINCT FROM OLD."assessmentMemberId"
    OR NEW."requesterId" IS DISTINCT FROM OLD."requesterId"
    OR NEW."reason" IS DISTINCT FROM OLD."reason"
    OR NEW."submittedAt" IS DISTINCT FROM OLD."submittedAt"
    OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'Assembly case identity and submission content are immutable';
  END IF;

  IF OLD."status" <> 'SUBMITTED' OR NEW."status" <> 'WITHDRAWN'
    OR NEW."withdrawnAt" IS NULL OR OLD."withdrawnAt" IS NOT NULL THEN
    RAISE EXCEPTION 'Only a submitted Assembly case may be withdrawn';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "assembly_cases_transition_guard"
BEFORE UPDATE ON "assembly_cases"
FOR EACH ROW EXECUTE FUNCTION "guard_assembly_case_transition"();
