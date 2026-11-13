ALTER TABLE "assembly_cases"
  ADD CONSTRAINT "assembly_cases_electorate_freeze_consistency_check"
  CHECK (
    ("electorateFrozenAt" IS NULL AND "eligibleVoterCount" IS NULL)
    OR
    ("electorateFrozenAt" IS NOT NULL AND "conflictReviewStartedAt" IS NOT NULL AND "eligibleVoterCount" IS NOT NULL AND "eligibleVoterCount" > 0)
  );

DROP TRIGGER "assembly_case_electorate_append_only" ON "assembly_case_electorate_members";

CREATE OR REPLACE FUNCTION "guard_assembly_electorate_mutation"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (
      SELECT 1 FROM "assembly_cases"
      WHERE "id" = NEW."caseId" AND "electorateFrozenAt" IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'A frozen Assembly electorate cannot accept new members';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Frozen Assembly electorates are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "assembly_case_electorate_append_only"
BEFORE INSERT OR UPDATE OR DELETE ON "assembly_case_electorate_members"
FOR EACH ROW EXECUTE FUNCTION "guard_assembly_electorate_mutation"();
