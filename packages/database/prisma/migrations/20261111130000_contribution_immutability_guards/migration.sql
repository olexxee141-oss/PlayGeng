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
    RAISE EXCEPTION 'Issued contribution assessments are immutable.'
      USING ERRCODE = '55000';
  END IF;

  -- The one permitted financial transition is DRAFT -> ISSUED. Issuance metadata
  -- may be set, but the assessment terms and ownership must remain unchanged.
  IF NEW."status" = 'ISSUED' AND (
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
