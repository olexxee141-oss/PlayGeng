ALTER TYPE "AssemblyCaseStatus" ADD VALUE IF NOT EXISTS 'NOTICE_PUBLISHED';
ALTER TYPE "AssemblyCaseStatus" ADD VALUE IF NOT EXISTS 'VOTING_OPEN';
ALTER TYPE "AssemblyCaseStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "AssemblyCaseStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

ALTER TYPE "AssemblyCaseEventType" ADD VALUE IF NOT EXISTS 'NOTICE_PUBLISHED';
ALTER TYPE "AssemblyCaseEventType" ADD VALUE IF NOT EXISTS 'VOTING_OPENED';
ALTER TYPE "AssemblyCaseEventType" ADD VALUE IF NOT EXISTS 'BALLOT_CAST';
ALTER TYPE "AssemblyCaseEventType" ADD VALUE IF NOT EXISTS 'VOTING_CLOSED';
ALTER TYPE "AssemblyCaseEventType" ADD VALUE IF NOT EXISTS 'OUTCOME_RECORDED';

CREATE TYPE "AssemblyVoteChoice" AS ENUM ('YES', 'NO');

ALTER TABLE "assembly_cases"
  ADD COLUMN "noticePublishedAt" TIMESTAMP(3),
  ADD COLUMN "noticeOpensAt" TIMESTAMP(3),
  ADD COLUMN "votingOpenedAt" TIMESTAMP(3),
  ADD COLUMN "votingClosesAt" TIMESTAMP(3),
  ADD COLUMN "outcomeRecordedAt" TIMESTAMP(3),
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "rejectedAt" TIMESTAMP(3),
  ADD COLUMN "yesVoteCount" INTEGER,
  ADD COLUMN "noVoteCount" INTEGER,
  ADD COLUMN "quorumRequired" INTEGER;

CREATE TABLE "assembly_case_ballots" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "voterId" TEXT NOT NULL,
  "vote" "AssemblyVoteChoice" NOT NULL,
  "castAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "assembly_case_ballots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "assembly_case_ballots_caseId_voterId_key" UNIQUE ("caseId", "voterId"),
  CONSTRAINT "assembly_case_ballots_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "assembly_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "assembly_case_ballots_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "assembly_case_ballots_caseId_vote_idx" ON "assembly_case_ballots"("caseId", "vote");

ALTER TABLE "assembly_cases"
  ADD CONSTRAINT "assembly_cases_voting_window_check"
  CHECK (
    ("votingOpenedAt" IS NULL AND "votingClosesAt" IS NULL)
    OR
    ("votingOpenedAt" IS NOT NULL AND "votingClosesAt" = "votingOpenedAt" + INTERVAL '72 hours')
  );

CREATE OR REPLACE FUNCTION "guard_assembly_ballot"() RETURNS trigger AS $$
DECLARE
  case_status "AssemblyCaseStatus";
  opens_at TIMESTAMP(3);
  closes_at TIMESTAMP(3);
  eligible BOOLEAN;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Assembly ballots are immutable';
  END IF;

  SELECT "status", "votingOpenedAt", "votingClosesAt"
  INTO case_status, opens_at, closes_at
  FROM "assembly_cases"
  WHERE "id" = NEW."caseId"
  FOR KEY SHARE;

  IF case_status IS NULL OR case_status <> 'VOTING_OPEN' OR opens_at IS NULL OR closes_at IS NULL
    OR CURRENT_TIMESTAMP < opens_at OR CURRENT_TIMESTAMP >= closes_at THEN
    RAISE EXCEPTION 'Assembly voting is not open';
  END IF;

  SELECT "eligible" INTO eligible
  FROM "assembly_case_electorate_members"
  WHERE "caseId" = NEW."caseId" AND "userId" = NEW."voterId";

  IF eligible IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Voter is not eligible in the frozen Assembly electorate';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "assembly_case_ballot_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "assembly_case_ballots"
FOR EACH ROW EXECUTE FUNCTION "guard_assembly_ballot"();
