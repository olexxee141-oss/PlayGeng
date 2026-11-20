-- Extend the original Assembly case guard into the complete, monotonic notice/voting state machine.
-- Identity, governance milestones, published notice, voting window, and recorded outcome are immutable.
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

  IF (OLD."withdrawnAt" IS NOT NULL AND NEW."withdrawnAt" IS DISTINCT FROM OLD."withdrawnAt")
    OR (OLD."conflictReviewStartedAt" IS NOT NULL AND NEW."conflictReviewStartedAt" IS DISTINCT FROM OLD."conflictReviewStartedAt")
    OR (OLD."electorateFrozenAt" IS NOT NULL AND NEW."electorateFrozenAt" IS DISTINCT FROM OLD."electorateFrozenAt")
    OR (OLD."eligibleVoterCount" IS NOT NULL AND NEW."eligibleVoterCount" IS DISTINCT FROM OLD."eligibleVoterCount")
    OR (OLD."noticePublishedAt" IS NOT NULL AND NEW."noticePublishedAt" IS DISTINCT FROM OLD."noticePublishedAt")
    OR (OLD."noticeOpensAt" IS NOT NULL AND NEW."noticeOpensAt" IS DISTINCT FROM OLD."noticeOpensAt")
    OR (OLD."votingOpenedAt" IS NOT NULL AND NEW."votingOpenedAt" IS DISTINCT FROM OLD."votingOpenedAt")
    OR (OLD."votingClosesAt" IS NOT NULL AND NEW."votingClosesAt" IS DISTINCT FROM OLD."votingClosesAt")
    OR (OLD."outcomeRecordedAt" IS NOT NULL AND NEW."outcomeRecordedAt" IS DISTINCT FROM OLD."outcomeRecordedAt")
    OR (OLD."approvedAt" IS NOT NULL AND NEW."approvedAt" IS DISTINCT FROM OLD."approvedAt")
    OR (OLD."rejectedAt" IS NOT NULL AND NEW."rejectedAt" IS DISTINCT FROM OLD."rejectedAt")
    OR (OLD."yesVoteCount" IS NOT NULL AND NEW."yesVoteCount" IS DISTINCT FROM OLD."yesVoteCount")
    OR (OLD."noVoteCount" IS NOT NULL AND NEW."noVoteCount" IS DISTINCT FROM OLD."noVoteCount")
    OR (OLD."quorumRequired" IS NOT NULL AND NEW."quorumRequired" IS DISTINCT FROM OLD."quorumRequired") THEN
    RAISE EXCEPTION 'Assembly governance milestones and outcomes are immutable once recorded';
  END IF;

  IF OLD."status" = 'SUBMITTED' AND NEW."status" = 'SUBMITTED' THEN
    IF NEW."withdrawnAt" IS NOT NULL
      OR NEW."noticePublishedAt" IS NOT NULL OR NEW."noticeOpensAt" IS NOT NULL
      OR NEW."votingOpenedAt" IS NOT NULL OR NEW."votingClosesAt" IS NOT NULL
      OR NEW."outcomeRecordedAt" IS NOT NULL OR NEW."approvedAt" IS NOT NULL OR NEW."rejectedAt" IS NOT NULL
      OR NEW."yesVoteCount" IS NOT NULL OR NEW."noVoteCount" IS NOT NULL OR NEW."quorumRequired" IS NOT NULL THEN
      RAISE EXCEPTION 'A submitted Assembly case cannot contain notice, voting, or outcome fields';
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

  IF OLD."status" = 'SUBMITTED' AND NEW."status" = 'NOTICE_PUBLISHED' THEN
    IF OLD."electorateFrozenAt" IS NULL OR OLD."eligibleVoterCount" IS NULL OR OLD."eligibleVoterCount" < 1
      OR NEW."noticePublishedAt" IS NULL OR NEW."noticeOpensAt" IS NULL
      OR NEW."noticePublishedAt" <> NEW."noticeOpensAt"
      OR NEW."votingOpenedAt" IS NOT NULL OR NEW."votingClosesAt" IS NOT NULL
      OR NEW."outcomeRecordedAt" IS NOT NULL THEN
      RAISE EXCEPTION 'Notice publication requires a frozen electorate and a valid publication timestamp';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD."status" = 'NOTICE_PUBLISHED' AND NEW."status" = 'VOTING_OPEN' THEN
    IF OLD."noticeOpensAt" IS NULL OR CURRENT_TIMESTAMP < OLD."noticeOpensAt" + INTERVAL '48 hours'
      OR NEW."votingOpenedAt" IS NULL
      OR NEW."votingOpenedAt" < OLD."noticeOpensAt" + INTERVAL '48 hours'
      OR NEW."votingClosesAt" IS DISTINCT FROM NEW."votingOpenedAt" + INTERVAL '72 hours'
      OR NEW."outcomeRecordedAt" IS NOT NULL THEN
      RAISE EXCEPTION 'Voting requires 48 hours of notice and an exact 72-hour voting window';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD."status" = 'VOTING_OPEN' AND NEW."status" IN ('APPROVED', 'REJECTED') THEN
    IF OLD."votingClosesAt" IS NULL OR CURRENT_TIMESTAMP < OLD."votingClosesAt"
      OR NEW."outcomeRecordedAt" IS NULL
      OR NEW."outcomeRecordedAt" < OLD."votingClosesAt"
      OR NEW."yesVoteCount" IS NULL OR NEW."yesVoteCount" < 0
      OR NEW."noVoteCount" IS NULL OR NEW."noVoteCount" < 0
      OR NEW."yesVoteCount" + NEW."noVoteCount" > OLD."eligibleVoterCount"
      OR (NEW."status" = 'APPROVED' AND NEW."approvedAt" IS DISTINCT FROM NEW."outcomeRecordedAt")
      OR (NEW."status" = 'REJECTED' AND NEW."rejectedAt" IS DISTINCT FROM NEW."outcomeRecordedAt")
      OR NEW."quorumRequired" IS DISTINCT FROM CEIL(OLD."eligibleVoterCount"::numeric / 2)::integer
      OR (NEW."status" = 'APPROVED' AND NOT (NEW."yesVoteCount" + NEW."noVoteCount" >= NEW."quorumRequired" AND NEW."yesVoteCount" > NEW."noVoteCount" AND NEW."approvedAt" IS NOT NULL AND NEW."rejectedAt" IS NULL))
      OR (NEW."status" = 'REJECTED' AND NOT (NEW."approvedAt" IS NULL AND NEW."rejectedAt" IS NOT NULL AND (NEW."yesVoteCount" + NEW."noVoteCount" < NEW."quorumRequired" OR NEW."yesVoteCount" <= NEW."noVoteCount"))) THEN
      RAISE EXCEPTION 'Assembly outcome violates voting close, quorum, majority, or timestamp requirements';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid Assembly case state transition';
END;
$$ LANGUAGE plpgsql;

-- Qualify the electorate lookup variable explicitly. The earlier trigger used a
-- PL/pgSQL variable named "eligible", which collided with the table column name.
CREATE OR REPLACE FUNCTION "guard_assembly_ballot"() RETURNS trigger AS $$
DECLARE
  case_status "AssemblyCaseStatus";
  opens_at TIMESTAMP(3);
  closes_at TIMESTAMP(3);
  voter_is_eligible BOOLEAN;
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

  SELECT electorate_member."eligible" INTO voter_is_eligible
  FROM "assembly_case_electorate_members" AS electorate_member
  WHERE electorate_member."caseId" = NEW."caseId"
    AND electorate_member."userId" = NEW."voterId";

  IF voter_is_eligible IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Voter is not eligible in the frozen Assembly electorate';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
