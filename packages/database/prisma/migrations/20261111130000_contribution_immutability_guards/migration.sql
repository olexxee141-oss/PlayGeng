-- Issued contribution assessments and their member snapshots are financial history.
-- Enforce immutability in PostgreSQL so direct SQL and future services cannot bypass it.

CREATE OR REPLACE FUNCTION prevent_contribution_campaign_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Contribution campaign events are append-only.'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER contribution_campaign_events_append_only
BEFORE UPDATE OR DELETE ON "contribution_campaign_events"
FOR EACH ROW
EXECUTE FUNCTION prevent_contribution_campaign_event_mutation();

CREATE OR REPLACE FUNCTION guard_contribution_assessment_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" = 'ISSUED' THEN
      RAISE EXCEPTION 'Issued contribution assessments cannot be deleted.'
        USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD."status" = 'ISSUED' THEN
    -- Issuance retries lock the assessment with a no-op UPDATE. Permit that
    -- exact no-op while rejecting every actual mutation.
    IF NEW IS DISTINCT FROM OLD THEN
      RAISE EXCEPTION 'Issued contribution assessments are immutable.'
        USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
  END IF;

  -- The one permitted financial transition is DRAFT -> ISSUED. Issuance metadata
  -- may be set, but the assessment terms and ownership must remain unchanged.
  IF NEW."status" = 'ISSUED' AND (
    OLD."status" <> 'DRAFT' OR
    NEW."issuedById" IS NULL OR
    NEW."issuedAt" IS NULL OR
    NEW."campaignId" IS DISTINCT FROM OLD."campaignId" OR
    NEW."communityId" IS DISTINCT FROM OLD."communityId" OR
    NEW."periodKey" IS DISTINCT FROM OLD."periodKey" OR
    NEW."description" IS DISTINCT FROM OLD."description" OR
    NEW."amountMinor" IS DISTINCT FROM OLD."amountMinor" OR
    NEW."currency" IS DISTINCT FROM OLD."currency" OR
    NEW."dueAt" IS DISTINCT FROM OLD."dueAt" OR
    NEW."createdById" IS DISTINCT FROM OLD."createdById"
  ) THEN
    RAISE EXCEPTION 'Assessment terms cannot change during issuance.'
      USING ERRCODE = '55000';
  END IF;

  IF NEW."status" = 'ISSUED' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM "contribution_assessment_members" s
      WHERE s."assessmentId" = NEW."id"
    ) THEN
      RAISE EXCEPTION 'An assessment cannot be issued without member snapshots.'
        USING ERRCODE = '55000';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM "community_members" cm
      JOIN "users" u ON u."id" = cm."userId" AND u."status" = 'ACTIVE'
      WHERE cm."communityId" = NEW."communityId"
        AND NOT EXISTS (
          SELECT 1
          FROM "contribution_assessment_members" s
          WHERE s."assessmentId" = NEW."id" AND s."memberId" = cm."userId"
        )
    ) THEN
      RAISE EXCEPTION 'An issued assessment must snapshot every active community member.'
        USING ERRCODE = '55000';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM "contribution_assessment_members" s
      LEFT JOIN "obligations" o ON o."id" = s."obligationId"
      LEFT JOIN "treasuries" t ON t."id" = o."treasuryId"
      WHERE s."assessmentId" = NEW."id"
        AND (
          s."obligationId" IS NULL OR
          o."id" IS NULL OR
          o."memberId" IS DISTINCT FROM s."memberId" OR
          o."sourceType" <> 'CONTRIBUTION' OR
          o."sourceId" <> s."id" OR
          o."idempotencyKey" <> ('contribution:' || NEW."id" || ':' || s."memberId") OR
          o."amountMinor" IS DISTINCT FROM NEW."amountMinor" OR
          o."dueAt" IS DISTINCT FROM NEW."dueAt" OR
          o."status" <> 'OPEN' OR
          t."communityId" IS DISTINCT FROM NEW."communityId" OR
          t."currency" IS DISTINCT FROM NEW."currency"
        )
    ) THEN
      RAISE EXCEPTION 'An issued assessment must have one valid Treasury obligation per snapshot.'
        USING ERRCODE = '55000';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER contribution_assessments_immutable_after_issue
BEFORE UPDATE OR DELETE ON "contribution_assessments"
FOR EACH ROW
EXECUTE FUNCTION guard_contribution_assessment_mutation();

CREATE OR REPLACE FUNCTION guard_contribution_assessment_member_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  old_assessment_status text;
  new_assessment_status text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT "status"::text INTO old_assessment_status
    FROM "contribution_assessments"
    WHERE "id" = OLD."assessmentId";

    IF old_assessment_status = 'ISSUED' THEN
      RAISE EXCEPTION 'Issued contribution member snapshots cannot be deleted.'
        USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT "status"::text INTO old_assessment_status
    FROM "contribution_assessments"
    WHERE "id" = OLD."assessmentId";

    IF old_assessment_status = 'ISSUED' THEN
      RAISE EXCEPTION 'Issued contribution member snapshots are immutable.'
        USING ERRCODE = '55000';
    END IF;
  END IF;

  SELECT "status"::text INTO new_assessment_status
  FROM "contribution_assessments"
  WHERE "id" = NEW."assessmentId";

  IF new_assessment_status = 'ISSUED' THEN
    RAISE EXCEPTION 'No member snapshots may be added or moved into an issued assessment.'
      USING ERRCODE = '55000';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER contribution_assessment_members_immutable_after_issue
BEFORE INSERT OR UPDATE OR DELETE ON "contribution_assessment_members"
FOR EACH ROW
EXECUTE FUNCTION guard_contribution_assessment_member_mutation();
